import { Board, COLS, KING_START_COL, ROWS, inBounds } from './board';
import { Color, Move, PROMOTION_CHOICES, Square, opponent } from './pieces';
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
    const dir = piece.color === 'white' ? -1 : 1;
    const start = piece.color === 'white' ? 6 : 1;
    const moves: Square[] = [];
    if (inBounds(row + dir, col) && !board[row + dir][col]) {
      moves.push({ row: row + dir, col });
      if (row === start && !board[row + dir * 2][col]) moves.push({ row: row + dir * 2, col });
    }
    for (const dc of [-1, 1]) {
      const r = row + dir, c = col + dc;
      if (!inBounds(r, c)) continue;
      const target = board[r][c];
      if (target && target.color !== piece.color) moves.push({ row: r, col: c });
      else {
        const adjacent = board[row][c];
        const ep = context.enPassantTarget;
        if (!target && row === (piece.color === 'white' ? 3 : 4) &&
          ep?.row === r && ep.col === c && adjacent?.type === 'P' && adjacent.color !== piece.color) {
          moves.push({ row: r, col: c });
        }
      }
    }
    return moves;
  }
  return [];
}
export function findKing(board: Board, color: Color): Square | null { for (let row=0; row<ROWS; row++) for (let col=0; col<COLS; col++) if (board[row][col]?.type === 'K' && board[row][col]?.color === color) return {row,col}; return null; }
/** Attack geometry is independent of whether a square is empty or friendly occupied.
 * In particular, pawn pushes are never attacks and pawn diagonals always are. */
export function squareAttacked(board: Board, square: Square, byColor: Color): boolean {
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const piece = board[row][col];
    if (!piece || piece.color !== byColor) continue;
    const dr = square.row - row, dc = square.col - col;
    const ar = Math.abs(dr), ac = Math.abs(dc);
    if (ar === 0 && ac === 0) continue;
    if (piece.type === 'P') {
      if (dr === (byColor === 'white' ? -1 : 1) && ac === 1) return true;
      continue;
    }
    if (piece.type === 'N') {
      if ((ar === 1 && ac === 2) || (ar === 2 && ac === 1)) return true;
      continue;
    }
    if (piece.type === 'K') {
      if (Math.max(ar, ac) === 1) return true;
      continue;
    }
    if (piece.type === 'S' && ar + ac === 1) return true;
    const diagonal = ar === ac;
    const orthogonal = dr === 0 || dc === 0;
    const slides = (diagonal && ['B', 'Q', 'S'].includes(piece.type)) ||
      (orthogonal && ['R', 'Q'].includes(piece.type));
    if (!slides) continue;
    const stepRow = Math.sign(dr), stepCol = Math.sign(dc);
    let r = row + stepRow, c = col + stepCol;
    while ((r !== square.row || c !== square.col) && !board[r][c]) { r += stepRow; c += stepCol; }
    if (r === square.row && c === square.col) return true;
  }
  return false;
}
export function isInCheck(board: Board, color: Color) { const king = findKing(board,color); if (!king) return true; return squareAttacked(board,king,opponent(color)); }
function castlingMoves(board: Board, row: number, col: number, color: Color): Square[] {
  const king = board[row][col];
  if (!king || king.type !== 'K' || king.moved || row !== (color === 'white' ? ROWS - 1 : 0) || col !== KING_START_COL) return [];
  if (isInCheck(board,color)) return [];
  const results: Square[] = [];
  for (const kingside of [true,false]) {
    const rookCol = kingside ? COLS-1 : 0; const rook = board[row][rookCol];
    if (!rook || rook.type !== 'R' || rook.color !== color || rook.moved) continue;
    const step = kingside ? 1 : -1; const between: number[] = [];
    for (let c = col+step; c !== rookCol; c += step) between.push(c);
    if (between.some(c => board[row][c])) continue;
    const kingPath = [col+step, col+2*step];
    if (kingPath.some(c => isInCheck(applyRawMove(board, { from: { row, col }, to: { row, col: c } }), color))) continue;
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
export function allLegalMoves(board: Board, color: Color, context: MoveContext = {}): Move[] {
  const all: Move[] = [];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const piece = board[row][col];
    if (piece?.color !== color) continue;
    for (const to of legalMoves(board, row, col, context)) {
      const move: Move = { from: { row, col }, to, ...(to.shift ? { shift: true } : {}) };
      if (piece.type === 'P' && (to.row === 0 || to.row === ROWS - 1)) {
        all.push(...PROMOTION_CHOICES.map(promotion => ({ ...move, promotion })));
      } else all.push(move);
    }
  }
  return all;
}
