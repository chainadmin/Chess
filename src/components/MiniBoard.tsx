import React from 'react';
import { View } from 'react-native';
import type { Board } from '../game/board';
import { useAppearance } from '../appearance/useAppearance';
import { PieceView } from './PieceView';

/** Lightweight, non-interactive thumbnail of a position. */
export function MiniBoard({ board, width }: { board: Board; width: number }) {
  const { boardTheme, pieces } = useAppearance();
  const cols = board[0]?.length ?? 10;
  const square = Math.floor((width - 4) / cols);
  return <View accessible={false} importantForAccessibility="no-hide-descendants"
    style={{ borderWidth: 2, borderColor: boardTheme.border, borderRadius: 6, overflow: 'hidden', alignSelf: 'flex-start' }}>
    {board.map((row, r) => <View key={r} style={{ flexDirection: 'row' }}>
      {row.map((piece, c) => <View key={c} style={{ width: square, height: square, alignItems: 'center', justifyContent: 'center', backgroundColor: (r + c) % 2 ? boardTheme.dark : boardTheme.light }}>
        {piece && <PieceView type={piece.type} color={piece.color} set={pieces} size={square} />}
      </View>)}
    </View>)}
  </View>;
}
