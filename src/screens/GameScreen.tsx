import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { COLS, ROWS, algebraic, sameSquare } from '../game/board';
import { DRAW_STATUSES, GameState, GameStatus } from '../game/gameState';
import { isInCheck, legalMoves } from '../game/legalMoves';
import { Move, PIECE_NAMES, PIECE_VALUE, PROMOTION_CHOICES, PieceType, SYMBOLS } from '../game/pieces';
import { formatMs, TIME_CONTROLS } from '../game/timers';
import { chooseComputerMove } from '../game/computerPlayer';
import { canPlayerMove, confirmResignRequest, createResignRequest, createSession, GameSession, MoveActor, OpponentTurnScheduler, playSessionMove, ResignRequest, tickSession } from '../game/opponentFlow';
import { adService } from '../services/ads/AdService';
import { multiplayerService } from '../services/multiplayer/MultiplayerService';
import { authService } from '../services/auth/AuthService';
import { soundService } from '../services/sound/SoundService';
import { GameResult, RatingChange, ratingService } from '../services/rating/RatingService';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

const DRAW_REASON: Partial<Record<GameStatus, string>> = {
  stalemate: 'Stalemate', draw_fifty: '50-move rule', draw_repetition: 'Threefold repetition', draw_material: 'Insufficient material',
};

function statusMessage(state: GameState): string {
  if (state.status === 'active') return isInCheck(state.board, state.turn) ? `${state.turn === 'white' ? 'White' : 'Black'} is in check` : `${state.turn === 'white' ? 'White' : 'Black'} to move`;
  const reason = DRAW_REASON[state.status];
  if (reason) return `Draw — ${reason}`;
  const who = state.winner === 'white' ? 'White' : 'Black';
  const cause = state.status === 'checkmate' ? 'checkmate' : state.status === 'resigned' ? 'resignation' : 'timeout';
  return `${who} wins by ${cause}`;
}

function afterMoveSound(prev: GameState, next: GameState) {
  if (next.status !== 'active') return 'gameEnd' as const;
  if (next.captured.length > prev.captured.length) return 'capture' as const;
  if (isInCheck(next.board, next.turn)) return 'check' as const;
  return 'move' as const;
}

export function GameScreen({ route, navigation }: Props) {
  const mode = route.params.mode;
  const match = route.params.mode === 'multiplayer' ? route.params.match : undefined;
  const computerDifficulty = route.params.mode === 'local' ? route.params.computerDifficulty : undefined;
  const playerColor = match?.playerColor ?? (computerDifficulty ? 'white' : undefined);
  const timeControl = match?.timeControl ?? TIME_CONTROLS.blitz_3_0;
  const [session, setSession] = useState<GameSession>(() => createSession(timeControl));
  const sessionRef = useRef(session);
  const { game: state, clock } = session;
  const isFocused = useIsFocused();
  const focusedRef = useRef(false);
  const computer = useRef(new OpponentTurnScheduler());
  const gameGeneration = useRef(0);
  const [ratingChange, setRatingChange] = useState<RatingChange | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<Move | null>(null);
  const [resignRequest, setResignRequest] = useState<ResignRequest | null>(null);
  const adRecorded = useRef(false);
  const ratingRecorded = useRef(false);
  const moves = useMemo(() => state.selected ? legalMoves(state.board, state.selected.row, state.selected.col, { enPassantTarget: state.enPassant }) : [], [state]);
  const inputLocked = !canPlayerMove(state, playerColor);

  // Event handlers update a synchronous snapshot and React together. Rule/clock
  // transitions are pure; sounds and transport calls never run in a state updater.
  const commit = useCallback((next: GameSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const play = useCallback((move: Move, actor: MoveActor = 'player', expectedState?: GameState) => {
    if (!focusedRef.current) return;
    const before = sessionRef.current;
    if (expectedState && before.game !== expectedState) return;
    const next = playSessionMove(before, move, actor, playerColor);
    if (next === before) return;
    commit(next);
    soundService.play(afterMoveSound(before.game, next.game));
    if (mode === 'multiplayer' && actor === 'player') void multiplayerService.sendMove(move, next.game);
  }, [commit, mode, playerColor]);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    const unsubscribe = mode === 'multiplayer'
      ? multiplayerService.onOpponentMove((move, expectedState) => play(move, 'opponent', expectedState))
      : undefined;
    if (match) multiplayerService.startMatch(match, sessionRef.current.game);
    const timer = setInterval(() => {
      const before = sessionRef.current;
      if (!focusedRef.current) return;
      const next = tickSession(before, 1000);
      if (next !== before) commit(next);
    }, 1000);
    return () => {
      focusedRef.current = false;
      gameGeneration.current++;
      clearInterval(timer);
      computer.current.cancel();
      unsubscribe?.();
      if (mode === 'multiplayer') void multiplayerService.disconnect();
      setPendingPromotion(null);
      setResignRequest(null);
    };
  }, [commit, match, mode, play]));

  useEffect(() => {
    if (!isFocused) return;
    if (mode === 'multiplayer') multiplayerService.updateGame(state);
    if (!computerDifficulty) return;
    const scheduler = computer.current;
    scheduler.scheduleTurn({
      state, color: 'black', delayMs: 450,
      chooseMove: position => chooseComputerMove(position, computerDifficulty),
      isCurrent: () => focusedRef.current && sessionRef.current.game === state,
      onMove: (move, expectedState) => play(move, 'opponent', expectedState),
    });
    return () => scheduler.cancel();
  }, [computerDifficulty, isFocused, mode, play, state]);

  useEffect(() => {
    if (state.status === 'active') return;
    setPendingPromotion(null);
    setResignRequest(null);
    if (!adRecorded.current) { adRecorded.current = true; void adService.recordCompletedGame(); }
  }, [state.status]);

  useEffect(() => {
    if (mode !== 'multiplayer' || !match || state.status === 'active' || ratingRecorded.current) return;
    ratingRecorded.current = true;
    const generation = gameGeneration.current;
    authService.currentUser().then(async user => {
      if (!user) return;
      const result: GameResult = state.winner === undefined ? 'draw' : state.winner === match.playerColor ? 'win' : 'loss';
      const change = await ratingService.recordResult(user.id, match.opponentRating, result);
      if (focusedRef.current && generation === gameGeneration.current) setRatingChange(change);
    });
  }, [match, mode, state.status, state.winner]);

  function reset() {
    computer.current.cancel();
    gameGeneration.current++;
    adRecorded.current = false;
    ratingRecorded.current = false;
    setRatingChange(null);
    setPendingPromotion(null);
    setResignRequest(null);
    commit(createSession(timeControl));
  }

  function tap(row: number, col: number) {
    const current = sessionRef.current.game;
    if (!focusedRef.current || !canPlayerMove(current, playerColor) || pendingPromotion) return;
    const piece = current.board[row][col];
    const available = current.selected ? legalMoves(current.board, current.selected.row, current.selected.col, { enPassantTarget: current.enPassant }) : [];
    const picked = available.find(m => m.row === row && m.col === col);
    if (current.selected && picked) {
      const moving = current.board[current.selected.row][current.selected.col];
      const isPromotion = moving?.type === 'P' && (picked.row === 0 || picked.row === ROWS - 1);
      const move: Move = { from: current.selected, to: picked, shift: picked.shift };
      if (isPromotion) setPendingPromotion(move);
      else play(move);
    } else {
      commit({ ...sessionRef.current, game: { ...current, selected: piece?.color === current.turn ? { row, col } : null } });
    }
  }

  function choosePromotion(type: PieceType) {
    if (!pendingPromotion) return;
    const move = { ...pendingPromotion, promotion: type };
    setPendingPromotion(null);
    play(move);
  }

  function doResign() {
    if (sessionRef.current.game.status !== 'active') return;
    setResignRequest(createResignRequest(sessionRef.current, gameGeneration.current, playerColor));
  }

  function confirmResign() {
    if (!focusedRef.current || !resignRequest) return;
    const next = confirmResignRequest(sessionRef.current, resignRequest, gameGeneration.current);
    setResignRequest(null);
    if (next === sessionRef.current) return;
    computer.current.cancel();
    if (mode === 'multiplayer') void multiplayerService.resign();
    setPendingPromotion(null);
    commit(next);
    soundService.play('gameEnd');
  }

  function goHome() {
    focusedRef.current = false;
    computer.current.cancel();
    if (mode === 'multiplayer') void multiplayerService.disconnect();
    navigation.navigate('Home');
  }

  const capturedByWhite = state.captured.filter(p => p.color === 'black');
  const capturedByBlack = state.captured.filter(p => p.color === 'white');
  const materialOf = (list: typeof state.captured) => list.reduce((sum, p) => sum + PIECE_VALUE[p.type], 0);
  const materialEdge = materialOf(capturedByWhite) - materialOf(capturedByBlack);
  const inCheck = state.status === 'active' && isInCheck(state.board, state.turn);
  const isDraw = DRAW_STATUSES.includes(state.status);
  const title = computerDifficulty ? `Computer ${computerDifficulty[0].toUpperCase()}${computerDifficulty.slice(1)}` : mode === 'local' ? 'Local Game' : `vs ${match?.opponentName} (${match?.opponentRating})`;
  const thinking = state.status === 'active' && inputLocked;

  return <Screen style={styles.screen}>
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{computerDifficulty ? 'YOU PLAY WHITE' : mode === 'local' ? 'PASS AND PLAY' : `MOCK MATCH · YOU PLAY ${playerColor?.toUpperCase()}`}</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.statusPill, state.status === 'active' ? (inCheck ? styles.statusCheck : styles.statusActive) : (isDraw ? styles.statusDraw : styles.statusOver)]}>
        <Text style={styles.statusText}>{thinking ? computerDifficulty ? 'Computer thinking…' : 'Mock opponent thinking…' : statusMessage(state)}</Text>
      </View>
      {ratingChange && <Text style={ratingChange.change >= 0 ? styles.ratingGain : styles.ratingLoss}>Demo rating {ratingChange.before} → {ratingChange.after} ({ratingChange.change >= 0 ? '+' : ''}{ratingChange.change})</Text>}
    </View>

    <View style={styles.clocks}>
      <View style={[styles.clockCard, clock.active === 'black' && state.status === 'active' && styles.clockActive]}>
        <Text style={styles.clockLabel}>BLACK</Text>
        <Text style={[styles.clockValue, clock.blackMs < 15000 && styles.clockLow]}>{formatMs(clock.blackMs)}</Text>
      </View>
      <View style={[styles.clockCard, clock.active === 'white' && state.status === 'active' && styles.clockActive]}>
        <Text style={styles.clockLabel}>WHITE</Text>
        <Text style={[styles.clockValue, clock.whiteMs < 15000 && styles.clockLow]}>{formatMs(clock.whiteMs)}</Text>
      </View>
    </View>

    <View style={styles.board}>
      {state.board.map((row, rowIndex) => row.map((piece, colIndex) => {
        const isMove = moves.some(m => m.row === rowIndex && m.col === colIndex);
        const isShift = moves.some(m => m.row === rowIndex && m.col === colIndex && m.shift);
        const label = `${algebraic({ row: rowIndex, col: colIndex })}${piece ? `, ${piece.color} ${PIECE_NAMES[piece.type]}` : ', empty'}`;
        return <Pressable
          key={`${rowIndex}-${colIndex}`}
          onPress={() => tap(rowIndex, colIndex)}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={[styles.square, (rowIndex + colIndex) % 2 ? styles.dark : styles.light, sameSquare(state.selected, { row: rowIndex, col: colIndex }) && styles.selected, isMove && styles.move, isShift && styles.shift]}
        >
          {isMove && !piece && <View style={styles.dot} />}
          <Text style={[styles.piece, piece?.color === 'black' && styles.blackPiece, piece?.type === 'S' && styles.shifter]}>{piece ? SYMBOLS[piece.type] : ''}</Text>
        </Pressable>;
      }))}
    </View>

    <View style={styles.capturedRow}>
      <View style={styles.capturedGroup}>
        <Text style={styles.capturedLabel}>White captured</Text>
        <Text style={styles.capturedIcons}>{capturedByWhite.map((p, i) => <Text key={i}>{SYMBOLS[p.type]} </Text>)}{materialEdge > 0 && <Text style={styles.edge}> +{materialEdge}</Text>}</Text>
      </View>
      <View style={styles.capturedGroup}>
        <Text style={styles.capturedLabel}>Black captured</Text>
        <Text style={styles.capturedIcons}>{capturedByBlack.map((p, i) => <Text key={i}>{SYMBOLS[p.type]} </Text>)}{materialEdge < 0 && <Text style={styles.edge}> +{-materialEdge}</Text>}</Text>
      </View>
    </View>

    <View style={styles.actions}>
      <AppButton title="Resign" onPress={doResign} secondary disabled={state.status !== 'active'} />
      {mode === 'local' && <AppButton title="New Game" onPress={reset} secondary />}
    </View>

    <Text style={styles.subhead}>Move History</Text>
    <ScrollView style={styles.history}>{state.history.map((h, i) => <Text key={i} style={styles.historyLine}>{state.history.length - i}. {h}</Text>)}</ScrollView>
    <AppButton title="Back Home" onPress={goHome} secondary />

    <Modal visible={!!resignRequest && state.status === 'active' && isFocused} onRequestClose={() => setResignRequest(null)} transparent animationType="fade">
      <View style={styles.promoBackdrop}>
        <View style={styles.promoCard}>
          <Text style={styles.promoTitle}>Resign this game?</Text>
          <Text style={styles.confirmCopy}>{resignRequest?.color === 'black' ? 'Black' : 'White'} will resign. This ends the game.</Text>
          <AppButton title="Keep Playing" secondary onPress={() => setResignRequest(null)} />
          <AppButton title="Confirm Resignation" onPress={confirmResign} />
        </View>
      </View>
    </Modal>

    <Modal visible={!!pendingPromotion && state.status === 'active' && isFocused} onRequestClose={() => setPendingPromotion(null)} transparent animationType="fade">
      <View style={styles.promoBackdrop}>
        <View style={styles.promoCard}>
          <Text style={styles.promoTitle}>Promote your pawn</Text>
          <View style={styles.promoOptions}>
            {PROMOTION_CHOICES.map(type => (
              <Pressable key={type} accessibilityRole="button" accessibilityLabel={`Promote to ${PIECE_NAMES[type]}`} onPress={() => choosePromotion(type)} style={styles.promoOption}>
                <Text style={[styles.promoSymbol, type === 'S' && styles.shifter]}>{SYMBOLS[type]}</Text>
                <Text style={styles.promoName}>{PIECE_NAMES[type]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: theme.space(4) },
  header: { marginBottom: 10, alignItems: 'center' },
  eyebrow: { color: theme.colors.cyan, fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  title: { fontSize: 24, fontWeight: '900', color: theme.colors.text, marginTop: 2 },
  statusPill: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radius.pill, borderWidth: 1 },
  statusActive: { backgroundColor: '#24314a', borderColor: '#3a5a8a' },
  statusCheck: { backgroundColor: '#4a2430', borderColor: '#a24b5e' },
  statusDraw: { backgroundColor: '#3a3624', borderColor: '#8a7a3a' },
  statusOver: { backgroundColor: '#2a4a34', borderColor: '#4ba26f' },
  statusText: { color: theme.colors.text, fontWeight: '800', fontSize: 13, textTransform: 'capitalize' },
  ratingGain: { color: theme.colors.success, fontWeight: '900', marginTop: 6 },
  ratingLoss: { color: theme.colors.danger, fontWeight: '900', marginTop: 6 },
  clocks: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  clockCard: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.borderSoft, paddingVertical: 8, alignItems: 'center' },
  clockActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceAlt },
  clockLabel: { color: theme.colors.textFaint, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  clockValue: { color: theme.colors.text, fontWeight: '900', fontSize: 20, marginTop: 2, fontVariant: ['tabular-nums'] },
  clockLow: { color: theme.colors.danger },
  board: { width: '100%', aspectRatio: 10 / 8, flexDirection: 'row', flexWrap: 'wrap', borderRadius: theme.radius.md, overflow: 'hidden', borderWidth: 3, borderColor: theme.colors.boardBorder },
  square: { width: `${100 / COLS}%`, height: `${100 / ROWS}%`, alignItems: 'center', justifyContent: 'center' },
  light: { backgroundColor: theme.colors.boardLight }, dark: { backgroundColor: theme.colors.boardDark },
  selected: { borderWidth: 3, borderColor: theme.colors.gold }, move: { borderWidth: 2, borderColor: '#2f6b46' },
  shift: { borderColor: theme.colors.cyan, shadowColor: theme.colors.cyan, shadowOpacity: 1, shadowRadius: 6 },
  dot: { position: 'absolute', width: '28%', height: '28%', borderRadius: 99, backgroundColor: '#0006' },
  piece: { fontSize: 24, color: '#fffaf0', fontWeight: '900' },
  blackPiece: { color: '#211913' },
  shifter: { color: '#071018', backgroundColor: theme.colors.cyan, borderRadius: 14, paddingHorizontal: 7, overflow: 'hidden' },
  capturedRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  capturedGroup: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, padding: 8, minHeight: 44 },
  capturedLabel: { color: theme.colors.textFaint, fontSize: 10, fontWeight: '800', marginBottom: 2 },
  capturedIcons: { color: theme.colors.text, fontSize: 16 },
  edge: { color: theme.colors.success, fontWeight: '900', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  subhead: { color: theme.colors.text, fontWeight: '900', fontSize: 16, marginTop: 10, marginBottom: 4 },
  history: { maxHeight: 84 },
  historyLine: { color: theme.colors.textDim, marginVertical: 2, fontSize: 13 },
  promoBackdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 24 },
  promoCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 20, borderWidth: 1, borderColor: theme.colors.border },
  promoTitle: { color: theme.colors.text, fontWeight: '900', fontSize: 18, textAlign: 'center', marginBottom: 14 },
  confirmCopy: { color: theme.colors.textDim, textAlign: 'center', marginBottom: 10 },
  promoOptions: { flexDirection: 'row', justifyContent: 'space-between' },
  promoOption: { alignItems: 'center', flex: 1, paddingVertical: 8 },
  promoSymbol: { fontSize: 30, color: '#fffaf0', backgroundColor: theme.colors.surfaceAlt, width: 52, height: 52, borderRadius: 14, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border },
  promoName: { color: theme.colors.textDim, fontSize: 11, marginTop: 6, fontWeight: '700' },
});
