import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { ChessBoard } from '../components/ChessBoard';
import { PieceView } from '../components/PieceView';
import { useAppearance } from '../appearance/useAppearance';
import { onlineClient, useOnlineState } from '../online/onlineService';
import { displayedClock } from '../online/OnlineClient';
import { legalMoves, isInCheck } from '../game/legalMoves';
import { DRAW_STATUSES } from '../game/gameState';
import { Move, PIECE_NAMES, PROMOTION_CHOICES, PieceType, Square } from '../game/pieces';
import { formatMs } from '../game/timers';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'OnlineGame'>;

/** This screen renders server snapshots. It never calls makeMove, tickSession,
 * recordResult, or the mock multiplayer service. Local clocks are visual only. */
export function OnlineGameScreen({ route, navigation }: Props) {
  const state = useOnlineState();
  const match = state.online?.status === 'matched' && state.online.match.matchId === route.params.matchId ? state.online.match : null;
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<Move | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [now, setNow] = useState(() => performance.now());
  const { pieces } = useAppearance();
  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 200); return () => clearInterval(timer); }, []);
  useEffect(() => { void onlineClient?.sync().catch(() => undefined); }, []);
  useEffect(() => { setSelected(null); setPromotion(null); }, [match?.matchId, match?.revision]);
  const moves = useMemo(() => match && selected ? legalMoves(match.game.board, selected.row, selected.col, { enPassantTarget: match.game.enPassant }) : [], [match, selected]);
  if (!match) return <Screen><Text style={styles.title}>Reconnecting to your game</Text><Text style={styles.copy}>{state.error ?? 'Open Online 3+2 to find your current match.'}</Text><AppButton title="Back to online lobby" onPress={() => navigation.replace('Multiplayer')} /></Screen>;
  const { game, playerColor } = match;
  const clock = displayedClock(match, state.receivedAt, now);
  const active = game.status === 'active';
  const locked = state.connection !== 'connected' || state.pending || !active || game.turn !== playerColor;
  const result = DRAW_STATUSES.includes(game.status) ? 'Draw' : `${game.winner === 'white' ? 'White' : 'Black'} wins`;
  const status = !active ? `${result} · ${game.status.replace(/_/g, ' ')}` : state.pending ? 'Waiting for server confirmation…' : game.turn === playerColor ? (isInCheck(game.board, game.turn) ? 'Your king is in check' : 'Your turn') : 'Opponent’s turn';
  function submit(move: Move) { setSelected(null); setPromotion(null); void onlineClient?.move(move).catch(() => undefined); }
  function tap(row: number, col: number) {
    if (locked || promotion || !match) return;
    const target = moves.find(move => move.row === row && move.col === col);
    if (selected && target) {
      const move: Move = { from: selected, to: { row, col } };
      if (game.board[selected.row][selected.col]?.type === 'P' && (row === 0 || row === 7)) setPromotion(move);
      else submit(move);
    } else setSelected(game.board[row][col]?.color === playerColor ? { row, col } : null);
  }
  function promote(type: PieceType) { if (promotion && !locked) submit({ ...promotion, promotion: type }); }
  return <Screen><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>{match.rated ? 'RATED · HUMAN OPPONENT' : 'HUMAN OPPONENT · UNRATED'}</Text>
    <Text style={styles.title}>vs {match.opponentName}</Text>
    <Text style={styles.copy}>You play {playerColor} · 3 minutes + 2 seconds per move</Text>
    <Text style={styles.status}>{status}</Text>
    {!!state.error && <View style={styles.notice}><Text style={styles.warning}>{state.error}</Text><AppButton title="Retry connection" secondary onPress={() => { void onlineClient?.sync().catch(() => undefined); }} disabled={state.pending || state.connection === 'expired'} /></View>}
    <View style={styles.clocks}>{(['black', 'white'] as const).map(color => <View key={color} style={[styles.clock, active && clock.active === color && styles.activeClock]}><Text style={styles.eyebrow}>{color.toUpperCase()}</Text><Text style={styles.clockValue}>{formatMs(color === 'white' ? clock.whiteMs : clock.blackMs)}</Text></View>)}</View>
    <ChessBoard board={game.board} selected={selected} moves={moves} onSquarePress={tap} disabled={locked || !!promotion} orientation={playerColor} />
    <AppButton title="Resign" secondary onPress={() => setConfirmResign(true)} disabled={!active || state.pending || state.connection !== 'connected'} />
    <Text style={styles.copy}>Leaving this screen does not pause or resign. Your clock keeps running; return through Online 3+2 to resume.</Text>
    <Text style={styles.subhead}>Move history</Text>
    <View style={styles.history}>{game.history.slice(0, 20).map((move, index) => <Text key={index} style={styles.copy}>{game.history.length - index}. {move}</Text>)}</View>
    {!active && <AppButton title="Play another free 3+2" onPress={() => navigation.replace('Multiplayer')} />}
    <AppButton title="Back Home" secondary onPress={() => navigation.navigate('Home')} />
    <Modal visible={confirmResign && active} transparent animationType="fade" onRequestClose={() => setConfirmResign(false)}><View style={styles.backdrop}><View style={styles.card}>
      <Text style={styles.title}>Resign this game?</Text><Text style={styles.copy}>This ends your game as {playerColor}.</Text>
      <AppButton title="Keep playing" secondary onPress={() => setConfirmResign(false)} />
      <AppButton title="Confirm resignation" disabled={state.pending || state.connection !== 'connected'} onPress={() => { setConfirmResign(false); void onlineClient?.resign().catch(() => undefined); }} />
    </View></View></Modal>
    <Modal visible={!!promotion && !locked} transparent animationType="fade" onRequestClose={() => setPromotion(null)}><View style={styles.backdrop}><View style={styles.card}>
      <Text style={styles.title}>Promote your pawn</Text><View style={styles.options}>{PROMOTION_CHOICES.map(type => <Pressable accessibilityRole="button" accessibilityLabel={`Promote to ${PIECE_NAMES[type]}`} key={type} onPress={() => promote(type)} style={styles.option}><PieceView type={type} color={playerColor} set={pieces} size={44} /><Text style={styles.copy}>{PIECE_NAMES[type]}</Text></Pressable>)}</View>
      <AppButton title="Cancel" secondary onPress={() => setPromotion(null)} />
    </View></View></Modal>
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingBottom: 30 },
  eyebrow: { color: theme.colors.cyan, textAlign: 'center', fontWeight: '800', fontSize: 11, letterSpacing: 1, marginVertical: 6 },
  title: { color: theme.colors.text, fontWeight: '900', fontSize: 25, textAlign: 'center' },
  copy: { color: theme.colors.textDim, fontSize: 13, lineHeight: 20, marginVertical: 6, textAlign: 'center' },
  status: { color: theme.colors.text, fontWeight: '800', textAlign: 'center', padding: 12 },
  notice: { borderColor: theme.colors.danger, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  warning: { color: theme.colors.text, lineHeight: 20 },
  clocks: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  clock: { flex: 1, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 10, padding: 8 },
  activeClock: { borderColor: theme.colors.accent },
  clockValue: { color: theme.colors.text, fontSize: 26, textAlign: 'center', fontWeight: '900', fontVariant: ['tabular-nums'] },
  subhead: { color: theme.colors.text, fontWeight: '800', marginTop: 12 },
  history: { marginBottom: 12 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#000a' },
  card: { backgroundColor: theme.colors.surface, padding: 20, borderRadius: 16 },
  options: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 16 },
  option: { alignItems: 'center', padding: 8, borderRadius: 8, backgroundColor: '#7a7467' },
});
