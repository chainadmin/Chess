import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Board } from '../game/board';
import { algebraic, COLS, ROWS, sameSquare } from '../game/board';
import { Color, PIECE_NAMES, Square } from '../game/pieces';
import { useAppearance } from '../appearance/useAppearance';
import { PieceView } from './PieceView';

type Props = {
  board: Board;
  selected: Square | null;
  moves: (Square & { shift?: boolean })[];
  onSquarePress: (row: number, col: number) => void;
  disabled?: boolean;
  orientation?: Color;
};
export function ChessBoard({ board, selected, moves, onSquarePress, disabled = false, orientation = 'white' }: Props) {
  const [focused, setFocused] = useState<Square | null>(null);
  const { boardTheme: palette, pieces } = useAppearance();
  return <View testID="chess-board" style={[styles.board, { borderColor: palette.border }]}>
    {Array.from({ length: ROWS }, (_, displayRow) => {
      const rowIndex = orientation === 'black' ? ROWS - 1 - displayRow : displayRow;
      return Array.from({ length: COLS }, (_, displayCol) => {
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
        style={[styles.square, { backgroundColor: (rowIndex + colIndex) % 2 ? palette.dark : palette.light },
          sameSquare(focused, square) && { outlineColor: '#111', outlineWidth: 2, outlineStyle: 'solid', zIndex: 1 }]}>
        {piece && <PieceView type={piece.type} color={piece.color} set={pieces} />}
        {move && <View pointerEvents="none" style={[piece ? styles.capture : styles.dot, { borderColor: move.shift ? palette.shift : palette.move, backgroundColor: piece ? 'transparent' : move.shift ? palette.shift : palette.move }]} />}
        {isSelected && <View pointerEvents="none" style={[styles.selection, { borderColor: palette.selected }]} />}
      </Pressable>;
    }); })}
  </View>;
}
const styles = StyleSheet.create({
  board: { width: '100%', maxWidth: 680, alignSelf: 'center', aspectRatio: COLS / ROWS, flexDirection: 'row', flexWrap: 'wrap', borderRadius: 6, overflow: 'hidden', borderWidth: 3 },
  square: { width: `${100 / COLS}%`, height: `${100 / ROWS}%`, alignItems: 'center', justifyContent: 'center' },
  selection: { position: 'absolute', top: 1, bottom: 1, left: 1, right: 1, borderWidth: 3, borderRadius: 2 },
  dot: { position: 'absolute', width: '23%', height: '23%', borderRadius: 99, borderWidth: 1, opacity: 0.85 },
  capture: { position: 'absolute', width: '90%', height: '90%', borderRadius: 99, borderWidth: 3 },
});
