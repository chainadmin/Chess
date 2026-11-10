import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Board, COLS, ROWS } from '../game/board';
import { pseudoMoves } from '../game/legalMoves';
import { useAppearance } from '../appearance/useAppearance';
import { ChessBoard } from './ChessBoard';
import { theme } from '../styles/theme';

// The Lancer hops between a few squares so new players see both kinds of move.
const TOUR = [{ row: 4, col: 4 }, { row: 3, col: 4 }, { row: 3, col: 6 }, { row: 4, col: 6 }];
const EXTRAS: { row: number; col: number; type: 'P' | 'N' | 'B'; color: 'white' | 'black' }[] = [
  { row: 1, col: 1, type: 'P', color: 'black' },
  { row: 2, col: 4, type: 'N', color: 'black' },
  { row: 6, col: 2, type: 'P', color: 'white' },
  { row: 1, col: 8, type: 'B', color: 'black' },
];

function demoBoard(at: { row: number; col: number }): Board {
  const board: Board = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
  for (const piece of EXTRAS) board[piece.row][piece.col] = { type: piece.type, color: piece.color };
  board[at.row][at.col] = { type: 'S', color: 'white' };
  return board;
}

/** Decorative, non-interactive board showing how the Lancer moves. */
export function LancerShowcase({ animate = true }: { animate?: boolean }) {
  const [step, setStep] = useState(0);
  const { boardTheme } = useAppearance();
  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => setStep(value => (value + 1) % TOUR.length), 2200);
    return () => clearInterval(timer);
  }, [animate]);
  const at = TOUR[step];
  const board = useMemo(() => demoBoard(at), [at]);
  const moves = useMemo(() => pseudoMoves(board, at.row, at.col), [board, at]);
  return <View>
    <View accessible accessibilityRole="image" accessibilityLabel="A 10 by 8 chess board showing the Lancer, which slides diagonally like a bishop or steps one square straight up, down, left or right."
      importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <ChessBoard board={board} selected={at} moves={moves} onSquarePress={() => undefined} disabled />
    </View>
    <View style={styles.legend}>
      <View style={styles.item}><View style={[styles.dot, { backgroundColor: boardTheme.move }]} /><Text style={styles.text}>Slides diagonally</Text></View>
      <View style={styles.item}><View style={[styles.dot, { backgroundColor: boardTheme.shift }]} /><Text style={styles.text}>Steps one square straight</Text></View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 16, marginTop: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#ffffff55' },
  text: { color: theme.colors.textDim, fontSize: 12, fontWeight: '700' },
});
