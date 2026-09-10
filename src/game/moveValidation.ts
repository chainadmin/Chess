import { Board } from './board';
import { Move, Piece, PieceType, Square } from './pieces';
import { legalMoves } from './legalMoves';
import { applyRawMove } from './applyRaw';
export type ApplyContext = { enPassantTarget?: Square | null; promotion?: PieceType };
export type ApplyResult = { board: Board; captured?: Piece; enPassantTarget: Square | null; isCastle: boolean; isEnPassant: boolean };
export function applyMove(board: Board, move: Move, context: ApplyContext = {}): ApplyResult | null {
  const piece = board[move.from.row][move.from.col]; if (!piece) return null;
  const legal = legalMoves(board, move.from.row, move.from.col, { enPassantTarget: context.enPassantTarget }).find(m => m.row === move.to.row && m.col === move.to.col);
  if (!legal) return null;
  const isEnPassant = piece.type === 'P' && move.from.col !== move.to.col && !board[move.to.row][move.to.col];
  const captured = isEnPassant ? board[move.from.row][move.to.col] ?? undefined : board[move.to.row][move.to.col] ?? undefined;
  const board2 = applyRawMove(board, move, context.promotion ?? 'Q');
  const isDoubleStep = piece.type === 'P' && Math.abs(move.to.row - move.from.row) === 2;
  const enPassantTarget = isDoubleStep ? { row: (move.from.row + move.to.row) / 2, col: move.from.col } : null;
  const isCastle = piece.type === 'K' && Math.abs(move.to.col - move.from.col) === 2;
  return { board: board2, captured, enPassantTarget, isCastle, isEnPassant };
}
