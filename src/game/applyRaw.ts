import { Board, cloneBoard, COLS, ROWS } from './board';
import { Move, PieceType } from './pieces';

/**
 * Applies a move to the board with no legality checking. Used both by legalMoves'
 * check-safety simulation and by moveValidation's real move application, so castling,
 * en passant, and promotion behave identically in both places.
 */
export function applyRawMove(board: Board, move: Move, promotion: PieceType = 'Q'): Board {
  const next = cloneBoard(board);
  const moving = next[move.from.row][move.from.col];
  if (!moving) return next;
  const isEnPassant = moving.type === 'P' && move.from.col !== move.to.col && !board[move.to.row][move.to.col];
  if (isEnPassant) next[move.from.row][move.to.col] = null;
  next[move.to.row][move.to.col] = { ...moving, moved: true };
  next[move.from.row][move.from.col] = null;
  if (moving.type === 'K' && Math.abs(move.to.col - move.from.col) === 2) {
    const kingside = move.to.col > move.from.col;
    const rookFromCol = kingside ? COLS - 1 : 0;
    const rookToCol = kingside ? move.to.col - 1 : move.to.col + 1;
    const rook = next[move.from.row][rookFromCol];
    if (rook) {
      next[move.from.row][rookToCol] = { ...rook, moved: true };
      next[move.from.row][rookFromCol] = null;
    }
  }
  if (moving.type === 'P' && (move.to.row === 0 || move.to.row === ROWS - 1)) {
    next[move.to.row][move.to.col] = { ...next[move.to.row][move.to.col]!, type: promotion };
  }
  return next;
}
