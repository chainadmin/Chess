import { Board, inBounds, cloneBoard, sameSquare } from './board';
import { Color, Move, Square } from './pieces';
import { shifterMoves, BISHOP_DIRS, ORTHO_DIRS } from './shifter';
const QUEEN_DIRS = [...BISHOP_DIRS, ...ORTHO_DIRS] as const;
const KNIGHT_DIRS = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]] as const;
function ray(board: Board, row: number, col: number, dirs: readonly (readonly [number, number])[], color: Color): Square[] {
  const moves: Square[] = [];
  for (const [dc, dr] of dirs) { let r = row + dr, c = col + dc; while (inBounds(r,c)) { const t = board[r][c]; if (!t) moves.push({row:r,col:c}); else { if (t.color !== color) moves.push({row:r,col:c}); break; } r += dr; c += dc; } }
  return moves;
}
export function pseudoMoves(board: Board, row: number, col: number): (Square & {shift?: boolean})[] {
  const piece = board[row][col]; if (!piece) return [];
  if (piece.type === 'B') return ray(board,row,col,BISHOP_DIRS,piece.color);
  if (piece.type === 'R') return ray(board,row,col,ORTHO_DIRS,piece.color);
  if (piece.type === 'Q') return ray(board,row,col,QUEEN_DIRS,piece.color);
  if (piece.type === 'S') return shifterMoves(board,row,col,piece.color);
  if (piece.type === 'N') return KNIGHT_DIRS.map(([dc,dr])=>({row:row+dr,col:col+dc})).filter(m=>inBounds(m.row,m.col)&&board[m.row][m.col]?.color!==piece.color);
  if (piece.type === 'K') return QUEEN_DIRS.map(([dc,dr])=>({row:row+dr,col:col+dc})).filter(m=>inBounds(m.row,m.col)&&board[m.row][m.col]?.color!==piece.color);
  if (piece.type === 'P') { const dir = piece.color === 'white' ? -1 : 1; const start = piece.color === 'white' ? 6 : 1; const moves: Square[] = []; if (inBounds(row+dir,col) && !board[row+dir][col]) { moves.push({row:row+dir,col}); if (row === start && !board[row+dir*2][col]) moves.push({row:row+dir*2,col}); } for (const dc of [-1,1]) { const r=row+dir,c=col+dc; if (inBounds(r,c)&&board[r][c]&&board[r][c]?.color!==piece.color) moves.push({row:r,col:c}); } return moves; }
  return [];
}
export function findKing(board: Board, color: Color): Square | null { for (let row=0; row<8; row++) for (let col=0; col<10; col++) if (board[row][col]?.type === 'K' && board[row][col]?.color === color) return {row,col}; return null; }
export function isInCheck(board: Board, color: Color) { const king = findKing(board,color); if (!king) return true; for (let row=0; row<8; row++) for (let col=0; col<10; col++) if (board[row][col] && board[row][col]?.color !== color && pseudoMoves(board,row,col).some(m=>sameSquare(m,king))) return true; return false; }
export function legalMoves(board: Board, row: number, col: number): (Square & {shift?: boolean})[] { const piece = board[row][col]; if (!piece) return []; return pseudoMoves(board,row,col).filter(m => { const next = cloneBoard(board); next[m.row][m.col] = next[row][col]; next[row][col] = null; return !isInCheck(next,piece.color); }); }
export function allLegalMoves(board: Board, color: Color) { const all: Move[] = []; for (let row=0; row<8; row++) for (let col=0; col<10; col++) if (board[row][col]?.color === color) all.push(...legalMoves(board,row,col).map(to=>({from:{row,col},to}))); return all; }
