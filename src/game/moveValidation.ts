import { Board, cloneBoard, ROWS } from './board';
import { Move } from './pieces';
import { legalMoves } from './legalMoves';
export function applyMove(board: Board, move: Move): Board | null {
  const piece = board[move.from.row][move.from.col]; if (!piece) return null;
  const legal = legalMoves(board, move.from.row, move.from.col).find(m => m.row === move.to.row && m.col === move.to.col); if (!legal) return null;
  const next = cloneBoard(board); const moving = next[move.from.row][move.from.col]!;
  next[move.to.row][move.to.col] = moving; next[move.from.row][move.from.col] = null;
  if (moving.type === 'P' && (move.to.row === 0 || move.to.row === ROWS - 1)) next[move.to.row][move.to.col] = { ...moving, type: 'Q' };
  return next;
}
