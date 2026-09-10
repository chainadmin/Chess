import { Board, COLS, ROWS, inBounds, sameSquare } from './board';
import { Color, Move, Square, opponent } from './pieces';
import { shifterMoves, BISHOP_DIRS, ORTHO_DIRS } from './shifter';
import { applyRawMove } from './applyRaw';
const QUEEN_DIRS = [...BISHOP_DIRS, ...ORTHO_DIRS] as const;
const KNIGHT_DIRS = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]] as const;
export type MoveContext = { enPassantTarget?: Square | null };
function ray(board: Board, row: number, col: number, dirs: readonly (readonly [number, number])[], color: Color): Square[] {
  const moves: Square[] = [];
  for (const [dc, dr] of dirs) { let r = row + dr, c = col + dc; while (inBounds(r,c)) { const t = board[r][c]; if (!t) moves.push({row:r,col:c}); else { if (t.color !== color) moves.push({row:r,col:c}); break; } r += dr; c += dc; } }
  return moves;
}
export function pseudoMoves(board: Board, row: number, col: number, context: MoveContext = {}): (Square & {shift?: boolean})[] {
  const piece = board[row][col]; if (!piece) return [];
  if (piece.type === 'B') return ray(board,row,col,BISHOP_DIRS,piece.color);
  if (piece.type === 'R') return ray(board,row,col,ORTHO_DIRS,piece.color);
  if (piece.type === 'Q') return ray(board,row,col,QUEEN_DIRS,piece.color);
  if (piece.type === 'S') return shifterMoves(board,row,col,piece.color);
  if (piece.type === 'N') return KNIGHT_DIRS.map(([dc,dr])=>({row:row+dr,col:col+dc})).filter(m=>inBounds(m.row,m.col)&&board[m.row][m.col]?.color!==piece.color);
  if (piece.type === 'K') return QUEEN_DIRS.map(([dc,dr])=>({row:row+dr,col:col+dc})).filter(m=>inBounds(m.row,m.col)&&board[m.row][m.col]?.color!==piece.color);
  if (piece.type === 'P') {
    const dir = piece.color === 'white' ? -1 : 1; const start = piece.color === 'white' ? 6 : 1; const moves: Square[] = [];
    if (inBounds(row+dir,col) && !board[row+dir][col]) { moves.push({row:row+dir,col}); if (row === start && !board[row+dir*2][col]) moves.push({row:row+dir*2,col}); }
    for (const dc of [-1,1]) { const r=row+dir,c=col+dc; if (!inBounds(r,c)) continue; if (board[r][c] && board[r][c]?.color!==piece.color) moves.push({row:r,col:c}); else if (context.enPassantTarget && context.enPassantTarget.row===r && context.enPassantTarget.col===c) moves.push({row:r,col:c}); }
    return moves;
  }
  return [];
}
export function findKing(board: Board, color: Color): Square | null { for (let row=0; row<ROWS; row++) for (let col=0; col<COLS; col++) if (board[row][col]?.type === 'K' && board[row][col]?.color === color) return {row,col}; return null; }
export function squareAttacked(board: Board, square: Square, byColor: Color): boolean { for (let row=0; row<ROWS; row++) for (let col=0; col<COLS; col++) if (board[row][col]?.color === byColor && pseudoMoves(board,row,col).some(m=>sameSquare(m,square))) return true; return false; }
export function isInCheck(board: Board, color: Color) { const king = findKing(board,color); if (!king) return true; return squareAttacked(board,king,opponent(color)); }
function castlingMoves(board: Board, row: number, col: number, color: Color): Square[] {
  const king = board[row][col]; if (!king || king.type !== 'K' || king.moved) return [];
  if (isInCheck(board,color)) return [];
  const results: Square[] = [];
  for (const kingside of [true,false]) {
    const rookCol = kingside ? COLS-1 : 0; const rook = board[row][rookCol];
    if (!rook || rook.type !== 'R' || rook.color !== color || rook.moved) continue;
    const step = kingside ? 1 : -1; const between: number[] = [];
    for (let c = col+step; c !== rookCol; c += step) between.push(c);
    if (between.some(c => board[row][c])) continue;
    const kingPath = [col+step, col+2*step];
    if (kingPath.some(c => squareAttacked(board,{row,col:c},opponent(color)))) continue;
    results.push({row, col: col+2*step});
  }
  return results;
}
export function legalMoves(board: Board, row: number, col: number, context: MoveContext = {}): (Square & {shift?: boolean})[] {
  const piece = board[row][col]; if (!piece) return [];
  const moves = pseudoMoves(board,row,col,context);
  if (piece.type === 'K') moves.push(...castlingMoves(board,row,col,piece.color));
  return moves.filter(m => !isInCheck(applyRawMove(board,{from:{row,col},to:m}), piece.color));
}
export function allLegalMoves(board: Board, color: Color, context: MoveContext = {}) { const all: Move[] = []; for (let row=0; row<ROWS; row++) for (let col=0; col<COLS; col++) if (board[row][col]?.color === color) all.push(...legalMoves(board,row,col,context).map(to=>({from:{row,col},to}))); return all; }
