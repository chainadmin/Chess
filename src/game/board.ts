import { Piece } from './pieces';
export const COLS = 10;
export const ROWS = 8;
export const FILES = 'abcdefghij'.split('');
export type Board = (Piece | null)[][];
export const BACK_RANK: Piece['type'][] = ['R', 'N', 'S', 'B', 'Q', 'K', 'B', 'S', 'N', 'R'];
export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  board[0] = BACK_RANK.map(type => ({ type, color: 'black' }));
  board[1] = Array.from({ length: COLS }, () => ({ type: 'P', color: 'black' }));
  board[6] = Array.from({ length: COLS }, () => ({ type: 'P', color: 'white' }));
  board[7] = BACK_RANK.map(type => ({ type, color: 'white' }));
  return board;
}
export const inBounds = (row: number, col: number) => row >= 0 && row < ROWS && col >= 0 && col < COLS;
export const cloneBoard = (board: Board): Board => board.map(row => row.map(piece => piece ? { ...piece } : null));
export const sameSquare = (a?: {row:number;col:number} | null, b?: {row:number;col:number} | null) => !!a && !!b && a.row === b.row && a.col === b.col;
export const algebraic = ({ row, col }: { row: number; col: number }) => `${FILES[col]}${ROWS - row}`;
