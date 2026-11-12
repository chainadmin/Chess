import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Board } from '../game/board';
import { algebraic, COLS, ROWS, sameSquare } from '../game/board';
import { Color, PIECE_NAMES, Square } from '../game/pieces';
import { useAppearance } from '../appearance/useAppearance';
import { BOARD_TEXTURES } from '../appearance/catalog';
import { BoardSurface } from './BoardSurface';
import { PieceView } from './PieceView';

type Props = {
  board: Board;
  selected: Square | null;
  moves: (Square & { shift?: boolean })[];
  onSquarePress: (row: number, col: number) => void;
  disabled?: boolean;
  orientation?: Color;
  /** Span the full screen width (game screens): squares and pieces draw larger. */
  edgeToEdge?: boolean;
};
export function ChessBoard({ board, selected, moves, onSquarePress, disabled = false, orientation = 'white', edgeToEdge = false }: Props) {
  const [focused, setFocused] = useState<Square | null>(null);
  const { boardTheme: palette, pieces, board: boardId } = useAppearance();
  const texture = BOARD_TEXTURES[boardId];
  // Explicit rows of equal flex squares. A percentage-width wrapping grid lays out
  // correctly on the web but wraps 9 squares per row on iOS/Android.
  return <View testID="chess-board" style={[styles.board, edgeToEdge ? styles.edgeToEdge : styles.contained, { borderColor: palette.border }]}>
    {texture && <BoardSurface texture={texture} light={palette.light} dark={palette.dark} />}
    {Array.from({ length: ROWS }, (_, displayRow) => {
      const rowIndex = orientation === 'black' ? ROWS - 1 - displayRow : displayRow;
      return <View key={rowIndex} style={styles.row}>{Array.from({ length: COLS }, (_, displayCol) => {
      const colIndex = orientation === 'black' ? COLS - 1 - displayCol : displayCol;
      const piece = board[rowIndex][colIndex];
      const square = { row: rowIndex, col: colIndex };
      const move = moves.find(m => sameSquare(m, square));
      const isSelected = sameSquare(selected, square);
      const label = `${algebraic(square)}, ${piece ? `${piece.color} ${PIECE_NAMES[piece.type]}` : 'empty'}${move ? ', legal destination' : ''}`;
      return <Pressable key={`${rowIndex}-${colIndex}`} testID={`square-${algebraic(square)}`}
        onPress={() => onSquarePress(rowIndex, colIndex)} disabled={disabled}
        accessibilityRole="button" accessibilityLabel={label}
        accessibilityState={{ selected: isSelected, disabled }}
        accessibilityHint={move ? 'Move the selected piece here' : 'Select this square'}
        onFocus={() => setFocused(square)} onBlur={() => setFocused(null)}
        style={[styles.square, { backgroundColor: texture ? 'transparent' : (rowIndex + colIndex) % 2 ? palette.dark : palette.light },
          sameSquare(focused, square) && { outlineColor: '#111', outlineWidth: 2, outlineStyle: 'solid', zIndex: 1 }]}>
        {piece && <PieceView type={piece.type} color={piece.color} set={pieces} fill />}
        {move && <View pointerEvents="none" style={[piece ? styles.capture : styles.dot, { borderColor: move.shift ? palette.shift : palette.move, backgroundColor: piece ? 'transparent' : move.shift ? palette.shift : palette.move }]} />}
        {isSelected && <View pointerEvents="none" style={[styles.selection, { borderColor: palette.selected }]} />}
      </Pressable>;
    })}</View>; })}
  </View>;
}
const styles = StyleSheet.create({
  board: { overflow: 'hidden', borderWidth: 3 },
  contained: { width: '100%', maxWidth: 680, alignSelf: 'center', borderRadius: 6 },
  // Cancels the screen's side padding; side borders are dropped so every point goes to squares.
  edgeToEdge: { alignSelf: 'stretch', marginHorizontal: -16, borderLeftWidth: 0, borderRightWidth: 0 },
  row: { flexDirection: 'row' },
  square: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  selection: { position: 'absolute', top: 1, bottom: 1, left: 1, right: 1, borderWidth: 3, borderRadius: 2 },
  dot: { position: 'absolute', width: '23%', height: '23%', borderRadius: 99, borderWidth: 1, opacity: 0.85 },
  capture: { position: 'absolute', width: '90%', height: '90%', borderRadius: 99, borderWidth: 3 },
});
