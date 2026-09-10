import { Board, ROWS, algebraic, createInitialBoard } from './board';
import { Color, Move, opponent, Piece, Square } from './pieces';
import { allLegalMoves, isInCheck } from './legalMoves';
import { applyMove } from './moveValidation';
export type GameStatus = 'active' | 'checkmate' | 'stalemate' | 'draw_fifty' | 'draw_repetition' | 'draw_material' | 'timeout' | 'resigned';
export const DRAW_STATUSES: GameStatus[] = ['stalemate', 'draw_fifty', 'draw_repetition', 'draw_material'];
export const isDrawStatus = (status: GameStatus) => DRAW_STATUSES.includes(status);
export type GameState = {
  board: Board; turn: Color; captured: Piece[]; history: string[]; status: GameStatus; winner?: Color; selected?: Square | null;
  enPassant: Square | null; halfmoveClock: number; positionCounts: Record<string, number>;
};
export const createGameState = (): GameState => ({ board: createInitialBoard(), turn: 'white', captured: [], history: [], status: 'active', selected: null, enPassant: null, halfmoveClock: 0, positionCounts: {} });

const MINOR_TYPES = new Set(['N', 'B', 'S']);
function isInsufficientMaterial(board: Board): boolean {
  const pieces = board.flat().filter((p): p is Piece => !!p);
  if (pieces.some(p => p.type === 'Q' || p.type === 'R' || p.type === 'P')) return false;
  const minors: Record<Color, number> = { white: 0, black: 0 };
  for (const p of pieces) if (MINOR_TYPES.has(p.type)) minors[p.color]++;
  return minors.white <= 1 && minors.black <= 1;
}

function positionKey(board: Board, turn: Color, enPassant: Square | null): string {
  const rows = board.map(row => row.map(p => p ? `${p.color[0]}${p.type}${p.moved ? '1' : '0'}` : '.').join(',')).join('|');
  return `${rows}#${turn}#${enPassant ? `${enPassant.row}-${enPassant.col}` : '-'}`;
}

export function makeMove(state: GameState, move: Move): GameState {
  if (state.status !== 'active') return state;
  const moving = state.board[move.from.row][move.from.col]; if (!moving || moving.color !== state.turn) return state;
  const result = applyMove(state.board, move, { enPassantTarget: state.enPassant, promotion: move.promotion });
  if (!result) return state;
  const { board, captured, enPassantTarget, isCastle, isEnPassant } = result;
  const nextTurn = opponent(state.turn);
  const halfmoveClock = moving.type === 'P' || captured ? 0 : state.halfmoveClock + 1;
  const key = positionKey(board, nextTurn, enPassantTarget);
  const positionCounts = { ...state.positionCounts, [key]: (state.positionCounts[key] ?? 0) + 1 };
  const inCheck = isInCheck(board, nextTurn);
  const hasMoves = allLegalMoves(board, nextTurn, { enPassantTarget }).length > 0;
  let status: GameStatus = 'active'; let winner: Color | undefined;
  if (inCheck && !hasMoves) { status = 'checkmate'; winner = moving.color; }
  else if (!hasMoves) { status = 'stalemate'; }
  else if (halfmoveClock >= 100) { status = 'draw_fifty'; }
  else if (positionCounts[key] >= 3) { status = 'draw_repetition'; }
  else if (isInsufficientMaterial(board)) { status = 'draw_material'; }
  const isPromotion = moving.type === 'P' && (move.to.row === 0 || move.to.row === ROWS - 1);
  const label = isCastle
    ? (move.to.col > move.from.col ? 'O-O' : 'O-O-O')
    : `${moving.type}${algebraic(move.from)}→${algebraic(move.to)}${captured ? ` x${captured.type}` : ''}${isEnPassant ? ' e.p.' : ''}${isPromotion ? `=${move.promotion ?? 'Q'}` : ''}`;
  return {
    ...state, board, turn: nextTurn,
    captured: captured ? [...state.captured, captured] : state.captured,
    history: [label, ...state.history],
    status, winner, selected: null, enPassant: enPassantTarget, halfmoveClock, positionCounts,
  };
}
export const resign = (state: GameState, color: Color): GameState => ({ ...state, status: 'resigned', winner: opponent(color) });
export const timeout = (state: GameState, color: Color): GameState => ({ ...state, status: 'timeout', winner: opponent(color) });
