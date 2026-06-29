import { Board, inBounds } from './board';
import { Color, Square } from './pieces';
export const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
export const ORTHO_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
export function shifterMoves(board: Board, row: number, col: number, color: Color): (Square & { shift?: boolean })[] {
  const moves: (Square & { shift?: boolean })[] = [];
  for (const [dc, dr] of BISHOP_DIRS) {
    let nextRow = row + dr, nextCol = col + dc;
    while (inBounds(nextRow, nextCol)) {
      const target = board[nextRow][nextCol];
      if (!target) moves.push({ row: nextRow, col: nextCol });
      else { if (target.color !== color) moves.push({ row: nextRow, col: nextCol }); break; }
      nextRow += dr; nextCol += dc;
    }
  }
  for (const [dc, dr] of ORTHO_DIRS) {
    const nextRow = row + dr, nextCol = col + dc;
    if (inBounds(nextRow, nextCol) && board[nextRow][nextCol]?.color !== color) moves.push({ row: nextRow, col: nextCol, shift: true });
  }
  return moves;
}
