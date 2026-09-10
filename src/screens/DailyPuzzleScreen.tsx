import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { COLS, ROWS, algebraic, sameSquare } from '../game/board';
import { legalMoves } from '../game/legalMoves';
import { PIECE_NAMES, Square, SYMBOLS } from '../game/pieces';
import { soundService } from '../services/sound/SoundService';
import { DailyPuzzle, dailyPuzzleService } from '../services/puzzles/DailyPuzzleService';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyPuzzle'>;
const DIFFICULTY_COLOR: Record<string, string> = { Easy: '#7fffa0', Medium: '#f2c974', Hard: '#ff8a8a' };

export function DailyPuzzleScreen({ navigation }: Props) {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);
  const [queued, setQueued] = useState(0);
  const moves = useMemo(() => puzzle && selected ? legalMoves(puzzle.board, selected.row, selected.col) : [], [puzzle, selected]);
  useEffect(() => { dailyPuzzleService.getDaily().then(result => { setPuzzle(result.puzzle); setComplete(result.completed); setQueued(result.queued); setMessage(result.completed ? 'Solved today — come back tomorrow!' : ''); }); }, []);
  async function tap(row: number, col: number) {
    if (!puzzle || complete) return;
    const piece = puzzle.board[row][col];
    if (!selected) { if (piece?.color === 'white') setSelected({ row, col }); return; }
    const legal = moves.some(move => move.row === row && move.col === col);
    if (legal && sameSquare(selected, puzzle.solution.from) && sameSquare({ row, col }, puzzle.solution.to)) {
      setComplete(true); setMessage('Brilliant! Puzzle solved.'); setSelected(null);
      soundService.play('gameEnd');
      await dailyPuzzleService.markCompleted(puzzle.date); return;
    }
    if (legal) { setMessage('Not quite — reset and look again.'); setSelected(null); soundService.play('capture'); }
    else if (piece?.color === 'white') { setSelected({ row, col }); soundService.play('move'); }
    else setSelected(null);
  }
  if (!puzzle) return <Screen style={styles.loading}><ActivityIndicator color={theme.colors.cyan} /><Text style={styles.copy}>Generating today's puzzle…</Text></Screen>;
  return <Screen>
    <View style={styles.headerRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>DAILY PUZZLE · {puzzle.date}</Text>
        <Text style={styles.title}>{puzzle.title}</Text>
      </View>
      <View style={[styles.badge, { borderColor: DIFFICULTY_COLOR[puzzle.difficulty] }]}>
        <Text style={[styles.badgeText, { color: DIFFICULTY_COLOR[puzzle.difficulty] }]}>{puzzle.difficulty}</Text>
      </View>
    </View>
    <Text style={styles.copy}>{puzzle.prompt}</Text>
    <View style={styles.board}>
      {puzzle.board.map((row, rowIndex) => row.map((piece, colIndex) => {
        const canMove = moves.some(move => move.row === rowIndex && move.col === colIndex);
        const label = `${algebraic({ row: rowIndex, col: colIndex })}${piece ? `, ${piece.color} ${PIECE_NAMES[piece.type]}` : ', empty'}`;
        return <Pressable
          key={`${rowIndex}-${colIndex}`}
          onPress={() => tap(rowIndex, colIndex)}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={[styles.square, (rowIndex + colIndex) % 2 ? styles.dark : styles.light, sameSquare(selected, { row: rowIndex, col: colIndex }) && styles.selected, canMove && styles.move]}
        >
          <Text style={[styles.piece, piece?.color === 'black' && styles.blackPiece]}>{piece ? SYMBOLS[piece.type] : ''}</Text>
        </Pressable>;
      }))}
    </View>
    <View style={styles.card}>
      <Text style={complete ? styles.success : styles.feedback}>{message || 'Tap a white piece, then choose its destination.'}</Text>
      <Text style={styles.queue}>⚡ {queued} puzzles generated · Tomorrow's puzzle is ready</Text>
    </View>
    {!complete && <AppButton title="Reset Puzzle" onPress={() => { setSelected(null); setMessage(''); }} secondary />}
    <AppButton title="Back Home" onPress={() => navigation.navigate('Home')} secondary />
  </Screen>;
}
const styles = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  eyebrow: { color: theme.colors.cyan, fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
  title: { fontSize: 27, fontWeight: '900', color: theme.colors.text, marginTop: 4 },
  badge: { borderWidth: 1.5, borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  badgeText: { fontWeight: '900', fontSize: 12 },
  copy: { color: theme.colors.textDim, marginVertical: 10 },
  board: { width: '100%', aspectRatio: 10 / 8, flexDirection: 'row', flexWrap: 'wrap', borderRadius: theme.radius.md, overflow: 'hidden', borderWidth: 3, borderColor: theme.colors.boardBorder, marginVertical: 12 },
  square: { width: `${100 / COLS}%`, height: `${100 / ROWS}%`, alignItems: 'center', justifyContent: 'center' },
  light: { backgroundColor: theme.colors.boardLight }, dark: { backgroundColor: theme.colors.boardDark },
  selected: { borderWidth: 3, borderColor: theme.colors.gold }, move: { borderWidth: 3, borderColor: theme.colors.cyan },
  piece: { fontSize: 25, color: '#fffaf0', fontWeight: '900' }, blackPiece: { color: '#211913' },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 14, marginVertical: 8, borderWidth: 1, borderColor: theme.colors.borderSoft },
  feedback: { color: theme.colors.text, fontWeight: '800' }, success: { color: theme.colors.success, fontWeight: '900', fontSize: 17 },
  queue: { color: theme.colors.textFaint, marginTop: 8, fontSize: 12 },
});
