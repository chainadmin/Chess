import { Board, COLS, ROWS, algebraic, createInitialBoard } from './board';
import { Color, Move, opponent, Piece, Square } from './pieces';
import { allLegalMoves, isInCheck, legalMoves } from './legalMoves';
import { applyMove } from './moveValidation';
export type GameStatus = 'active' | 'checkmate' | 'stalemate' | 'draw_fifty' | 'draw_repetition' | 'draw_material' | 'timeout' | 'resigned';
export const DRAW_STATUSES: GameStatus[] = ['stalemate', 'draw_fifty', 'draw_repetition', 'draw_material'];
export const isDrawStatus = (status: GameStatus) => DRAW_STATUSES.includes(status);
export type GameState = {
  board: Board; turn: Color; captured: Piece[]; history: string[]; status: GameStatus; winner?: Color; selected?: Square | null;
  enPassant: Square | null; halfmoveClock: number; positionCounts: Record<string, number>;
};
export function createGameState(): GameState {
  const board = createInitialBoard();
  return { board, turn: 'white', captured: [], history: [], status: 'active', selected: null,
    enPassant: null, halfmoveClock: 0, positionCounts: { [positionKey(board, 'white', null)]: 1 } };
}

function isInsufficientMaterial(board: Board): boolean {
  const material = board.flatMap((rank, row) => rank.flatMap((piece, col) =>
    piece && piece.type !== 'K' ? [{ piece, squareColor: (row + col) % 2 }] : []));
  // A Shifter changes square color and can mate with its king. Do not treat it
  // as an ordinary bishop, or assume one minor per side is always a dead game.
  if (material.some(({ piece }) => !['B', 'N'].includes(piece.type))) return false;
  if (material.length <= 1) return true;
  return material.every(({ piece, squareColor }) => piece.type === 'B' && squareColor === material[0].squareColor);
}

/** Only rights that change legal moves distinguish repeated positions. */
export function positionKey(board: Board, turn: Color, enPassant: Square | null): string {
  const rows = board.map(row => row.map(p => p ? `${p.color[0]}${p.type}` : '.').join(',')).join('|');
  const castling: string[] = [];
  for (const color of ['white', 'black'] as const) {
    const row = color === 'white' ? ROWS - 1 : 0;
    const king = board[row][5];
    if (king?.type !== 'K' || king.color !== color || king.moved) continue;
    for (const col of [0, COLS - 1]) {
      const rook = board[row][col];
      if (rook?.type === 'R' && rook.color === color && !rook.moved) castling.push(`${color[0]}${col}`);
    }
  }
  let ep = '-';
  if (enPassant) {
    const pawnRow = enPassant.row + (turn === 'white' ? 1 : -1);
    const canCapture = [enPassant.col - 1, enPassant.col + 1].some(col => {
      const piece = board[pawnRow]?.[col];
      return piece?.type === 'P' && piece.color === turn &&
        legalMoves(board, pawnRow, col, { enPassantTarget: enPassant })
          .some(move => move.row === enPassant.row && move.col === enPassant.col);
    });
    if (canCapture) ep = `${enPassant.row}-${enPassant.col}`;
  }
  return `${rows}#${turn}#${castling.join(',')}#${ep}`;
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
  // Seed imported/custom positions too, while preserving every recorded occurrence.
  const currentKey = positionKey(state.board, state.turn, state.enPassant);
  const positionCounts = { ...state.positionCounts };
  positionCounts[currentKey] ??= 1;
  positionCounts[key] = (positionCounts[key] ?? 0) + 1;
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
export const resign = (state: GameState, color: Color): GameState => state.status === 'active' ? { ...state, selected: null, status: 'resigned', winner: opponent(color) } : state;
export const timeout = (state: GameState, color: Color): GameState => state.status === 'active' ? { ...state, selected: null, status: 'timeout', winner: opponent(color) } : state;
