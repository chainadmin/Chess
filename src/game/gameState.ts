import { Board, algebraic, createInitialBoard } from './board';
import { Color, Move, opponent, Piece, Square } from './pieces';
import { allLegalMoves, isInCheck } from './legalMoves';
import { applyMove } from './moveValidation';
export type GameStatus = 'active' | 'checkmate' | 'timeout' | 'resigned';
export type GameState = { board: Board; turn: Color; captured: Piece[]; history: string[]; status: GameStatus; winner?: Color; selected?: Square | null };
export const createGameState = (): GameState => ({ board: createInitialBoard(), turn: 'white', captured: [], history: [], status: 'active', selected: null });
export function makeMove(state: GameState, move: Move): GameState {
  if (state.status !== 'active') return state;
  const moving = state.board[move.from.row][move.from.col]; if (!moving || moving.color !== state.turn) return state;
  const captured = state.board[move.to.row][move.to.col] ?? undefined; const board = applyMove(state.board, move); if (!board) return state;
  const nextTurn = opponent(state.turn); const isMate = isInCheck(board,nextTurn) && allLegalMoves(board,nextTurn).length === 0;
  return { ...state, board, turn: nextTurn, captured: captured ? [...state.captured, captured] : state.captured, history: [`${moving.type}${algebraic(move.from)}→${algebraic(move.to)}${captured ? ` x${captured.type}` : ''}`, ...state.history], status: isMate ? 'checkmate' : 'active', winner: isMate ? moving.color : undefined, selected: null };
}
export const resign = (state: GameState, color: Color): GameState => ({ ...state, status: 'resigned', winner: opponent(color) });
export const timeout = (state: GameState, color: Color): GameState => ({ ...state, status: 'timeout', winner: opponent(color) });
