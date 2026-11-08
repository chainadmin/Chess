import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { ChessBoard } from '../components/ChessBoard';
import { AppButton } from '../components/AppButton';
import { sameSquare } from '../game/board';
import { legalMoves } from '../game/legalMoves';
import { Square } from '../game/pieces';
import { soundService } from '../services/sound/SoundService';
import { DailyPuzzle, dailyPuzzleService } from '../services/puzzles/DailyPuzzleService';
import { theme } from '../styles/theme';
import { progressionStore } from '../progression/useProgression';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyPuzzle'>;
const DIFFICULTY_COLOR: Record<string, string> = { Easy: '#7fffa0', Medium: '#f2c974', Hard: '#ff8a8a' };

export function DailyPuzzleScreen({ navigation }: Props) {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);
  const [queued, setQueued] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  async function saveCompletion(date: string) {
    setSaving(true); setSaveFailed(false);
    try {
      await dailyPuzzleService.markCompleted(date);
      const result = await progressionStore.record({ kind: 'puzzle', date });
      setSaveFailed(!result.saved);
      if (result.awarded > 0) setMessage(`Brilliant! Puzzle solved. +${result.awarded} practice XP.`);
    } catch { setSaveFailed(true); }
    finally { setSaving(false); }
  }
  const moves = useMemo(() => puzzle && selected ? legalMoves(puzzle.board, selected.row, selected.col) : [], [puzzle, selected]);
  function loadPuzzle() {
    setLoadFailed(false);
    void dailyPuzzleService.getDaily().then(result => {
      setPuzzle(result.puzzle); setComplete(result.completed); setQueued(result.queued);
      setMessage(result.completed ? 'Solved today — come back tomorrow!' : '');
      // Replay is idempotent and recovers an interrupted XP save after puzzle completion.
      if (result.completed) void saveCompletion(result.puzzle.date);
    }).catch(() => setLoadFailed(true));
  }
  useEffect(loadPuzzle, []);
  async function tap(row: number, col: number) {
    if (!puzzle || complete) return;
    const piece = puzzle.board[row][col];
    if (!selected) { if (piece?.color === 'white') setSelected({ row, col }); return; }
    const legal = moves.some(move => move.row === row && move.col === col);
    if (legal && sameSquare(selected, puzzle.solution.from) && sameSquare({ row, col }, puzzle.solution.to)) {
      setComplete(true); setMessage('Brilliant! Puzzle solved.'); setSelected(null);
      soundService.play('gameEnd');
      await saveCompletion(puzzle.date); return;
    }
    if (legal) { setMessage('Not quite — reset and look again.'); setSelected(null); soundService.play('capture'); }
    else if (piece?.color === 'white') { setSelected({ row, col }); soundService.play('move'); }
    else setSelected(null);
  }
  if (loadFailed) return <Screen><Text style={styles.copy}>The daily puzzle could not be loaded.</Text><AppButton title="Retry puzzle" onPress={loadPuzzle} /></Screen>;
  if (!puzzle) return <Screen style={styles.loading}><ActivityIndicator color={theme.colors.cyan} /><Text style={styles.copy}>Generating today's puzzle…</Text></Screen>;
  return <Screen>
    <ScrollView contentContainerStyle={styles.content}>
    <View style={styles.headerRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>DAILY PUZZLE · {puzzle.date}</Text>
        <Text style={styles.title}>{puzzle.title.replace(/Shifter/g, 'Lancer')}</Text>
      </View>
      <View style={[styles.badge, { borderColor: DIFFICULTY_COLOR[puzzle.difficulty] }]}>
        <Text style={[styles.badgeText, { color: DIFFICULTY_COLOR[puzzle.difficulty] }]}>{puzzle.difficulty}</Text>
      </View>
    </View>
    <Text style={styles.copy}>{puzzle.prompt.replace(/Shifter/g, 'Lancer')}</Text>
    <ChessBoard board={puzzle.board} selected={selected} moves={moves} onSquarePress={tap} disabled={complete} />
    <View style={styles.card}>
      <Text style={complete ? styles.success : styles.feedback}>{message || 'Tap a white piece, then choose its destination.'}</Text>
      <Text style={styles.queue}>Solve once per day for 30 practice XP. Saved on this device.</Text>
      {saving && <Text style={styles.queue}>Saving your result…</Text>}
      {saveFailed && <><Text accessibilityRole="alert" style={styles.copy}>Your result could not be fully saved. Retry before leaving.</Text><AppButton title="Retry saving result" disabled={saving} secondary onPress={() => { void saveCompletion(puzzle.date); }} /></>}
      <Text style={styles.queue}>⚡ {queued} puzzles generated · Tomorrow's puzzle is ready</Text>
    </View>
    {!complete && <AppButton title="Reset Puzzle" onPress={() => { setSelected(null); setMessage(''); }} secondary />}
    <AppButton title="Back Home" onPress={() => navigation.navigate('Home')} secondary />
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({
  content: { paddingBottom: 24, width: '100%', maxWidth: 680, alignSelf: 'center' },
  loading: { alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  eyebrow: { color: theme.colors.cyan, fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
  title: { fontSize: 27, fontWeight: '900', color: theme.colors.text, marginTop: 4 },
  badge: { borderWidth: 1.5, borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  badgeText: { fontWeight: '900', fontSize: 12 },
  copy: { color: theme.colors.textDim, marginVertical: 10 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 14, marginVertical: 8, borderWidth: 1, borderColor: theme.colors.borderSoft },
  feedback: { color: theme.colors.text, fontWeight: '800' }, success: { color: theme.colors.success, fontWeight: '900', fontSize: 17 },
  queue: { color: theme.colors.textFaint, marginTop: 8, fontSize: 12 },
});
