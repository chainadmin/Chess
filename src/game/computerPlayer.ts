import { Board, cloneBoard, COLS as BOARD_COLS, KING_START_COL, ROWS as BOARD_ROWS } from './board';
import { GameState, positionKey } from './gameState';
import { allLegalMoves } from './legalMoves';
import { applyRawMove } from './applyRaw';
import { Color, Move, Piece, PieceType, Square } from './pieces';

// Local copies: module bindings can compile to getter calls, which dominate a hot search loop.
const COLS = BOARD_COLS;
const ROWS = BOARD_ROWS;
const K0 = KING_START_COL;
const opponent = (color: Color): Color => color === 'white' ? 'black' : 'white';

export type ComputerDifficulty = 'easy' | 'medium' | 'hard';
/** Nodes visited by the most recent search (diagnostics and tests). */
export let lastSearchNodes = 0;

const VALUES: Record<PieceType, number> = { P: 100, N: 310, B: 330, S: 400, R: 500, Q: 900, K: 0 };
const MATE = 100_000;
const INF = 1_000_000;

/** Search limits per level. Node budgets (not wall-clock time) keep every level repeatable
 * across devices and fast enough on a phone's JavaScript engine. */
const LEVELS: Record<ComputerDifficulty, { depth: number; nodes: number; noise: number }> = {
  easy: { depth: 1, nodes: 3_000, noise: 200 },
  medium: { depth: 3, nodes: 25_000, noise: 12 },
  hard: { depth: 7, nodes: 150_000, noise: 0 },
};

function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash >>> 0;
}

function positionSeed(state: GameState, difficulty: ComputerDifficulty): string {
  const board = state.board.map(row => row.map(p => p ? `${p.color[0]}${p.type}${p.moved ? 1 : 0}` : '.').join(',')).join('|');
  return `${difficulty}:${state.turn}:${board}:${JSON.stringify(state.enPassant)}:${state.halfmoveClock}`;
}

const PROMO_INDEX: Record<string, number> = { Q: 1, R: 2, B: 3, N: 4, S: 5 };
const moveKey = (m: Move) => (((m.from.row * 10 + m.from.col) * 100 + m.to.row * 10 + m.to.col) * 8) + (m.promotion ? PROMO_INDEX[m.promotion] : 0);

// ---------------------------------------------------------------------------
// Evaluation (from White's point of view; negamax flips the sign)

const centrality = (row: number, col: number) =>
  (3.5 - Math.abs(row - 3.5)) + (4.5 - Math.abs(col - 4.5)); // 1 at the corners, 8 in the middle

const PAWN_FILES: Record<Color, Int8Array> = { white: new Int8Array(10), black: new Int8Array(10) };

function evaluateWhite(board: Board): number {
  let score = 0;
  const nonPawn = { white: 0, black: 0 };
  const pawnFiles = PAWN_FILES;
  pawnFiles.white.fill(0); pawnFiles.black.fill(0);
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const p = board[row][col];
    if (!p) continue;
    if (p.type === 'P') pawnFiles[p.color][col]++;
    else if (p.type !== 'K') nonPawn[p.color] += VALUES[p.type];
  }
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const p = board[row][col];
    if (!p) continue;
    const sign = p.color === 'white' ? 1 : -1;
    const advance = p.color === 'white' ? ROWS - 1 - row : row; // 0 on own back rank
    const center = centrality(row, col);
    const enemyMaterial = nonPawn[opponent(p.color)];
    let v = VALUES[p.type];
    switch (p.type) {
      case 'P': {
        v += [0, 0, 6, 14, 26, 44, 70, 0][advance];
        if (col >= 3 && col <= 6 && advance >= 2) v += 10;
        if (pawnFiles[p.color][col] > 1) v -= 12;
        const isolated = (col === 0 || !pawnFiles[p.color][col - 1]) && (col === COLS - 1 || !pawnFiles[p.color][col + 1]);
        if (isolated) v -= 10;
        // Passed pawn: no enemy pawn ahead on this or a neighboring file.
        let passed = true;
        const dir = p.color === 'white' ? -1 : 1;
        for (let c = Math.max(0, col - 1); c <= Math.min(COLS - 1, col + 1) && passed; c++) {
          for (let r = row + dir; r >= 0 && r < ROWS; r += dir) {
            const q = board[r][c];
            if (q?.type === 'P' && q.color !== p.color) { passed = false; break; }
          }
        }
        if (passed) v += [0, 8, 12, 22, 38, 62, 95, 0][advance] * (enemyMaterial < 1500 ? 2 : 1);
        break;
      }
      case 'N': v += center * 6 - (advance === 0 ? 18 : 0); break;
      case 'B': v += center * 4 - (advance === 0 ? 16 : 0); break;
      case 'S': v += center * 5 - (advance === 0 ? 16 : 0); break;
      case 'R': {
        v += center;
        if (!pawnFiles[p.color][col]) v += pawnFiles[opponent(p.color)][col] ? 10 : 18;
        if (advance === ROWS - 2) v += 15;
        break;
      }
      case 'Q': v += center * 2; break;
      case 'K': {
        if (enemyMaterial > 1400) {
          // Middlegame: stay home, get castled, keep pawns in front.
          v -= advance * 22;
          if (col >= 3 && col <= 6) v -= 18;
          const dir = p.color === 'white' ? -1 : 1;
          for (let c = Math.max(0, col - 1); c <= Math.min(COLS - 1, col + 1); c++) {
            const q = board[row + dir]?.[c];
            if (q?.type === 'P' && q.color === p.color) v += 12;
          }
        } else {
          v += center * 7;
        }
        break;
      }
    }
    score += sign * v;
  }
  return score;
}

const DIAGONALS = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
const ORTHOGONALS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const KNIGHT_JUMPS = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]] as const;
const isAt = (board: Board, row: number, col: number, color: Color, types: string) => {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
  const p = board[row][col];
  return !!p && p.color === color && types.includes(p.type);
};

/** Same attack rules as legalMoves.squareAttacked, but scans outward from the square. */
function attacked(board: Board, row: number, col: number, by: Color): boolean {
  const pawnRow = by === 'white' ? row + 1 : row - 1;
  if (isAt(board, pawnRow, col - 1, by, 'P') || isAt(board, pawnRow, col + 1, by, 'P')) return true;
  for (const [dr, dc] of KNIGHT_JUMPS) if (isAt(board, row + dr, col + dc, by, 'N')) return true;
  for (const [dr, dc] of ORTHOGONALS) if (isAt(board, row + dr, col + dc, by, 'KS')) return true;
  for (const [dr, dc] of DIAGONALS) if (isAt(board, row + dr, col + dc, by, 'K')) return true;
  for (const [dr, dc] of DIAGONALS) {
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && !board[r][c]) { r += dr; c += dc; }
    if (isAt(board, r, c, by, 'BQS')) return true;
  }
  for (const [dr, dc] of ORTHOGONALS) {
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && !board[r][c]) { r += dr; c += dc; }
    if (isAt(board, r, c, by, 'RQ')) return true;
  }
  return false;
}

function inCheck(board: Board, color: Color): boolean {
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const p = board[row][col];
    if (p && p.type === 'K' && p.color === color) return attacked(board, row, col, opponent(color));
  }
  return true;
}

// ---------------------------------------------------------------------------
// Search on a private board copy with in-place make/unmake.

type SearchMove = Move & { order?: number };
type Undo = { from: Square; to: Square; moving: Piece; target: Piece | null; epSquare?: Square; epPiece?: Piece | null;
  rookFrom?: Square; rookTo?: Square; rook?: Piece | null };

function make(board: Board, move: Move): Undo {
  const moving = board[move.from.row][move.from.col]!;
  const target = board[move.to.row][move.to.col];
  const undo: Undo = { from: move.from, to: move.to, moving, target };
  if (moving.type === 'P' && move.from.col !== move.to.col && !target) {
    undo.epSquare = { row: move.from.row, col: move.to.col };
    undo.epPiece = board[move.from.row][move.to.col];
    board[move.from.row][move.to.col] = null;
  }
  const promotes = moving.type === 'P' && (move.to.row === 0 || move.to.row === ROWS - 1);
  board[move.to.row][move.to.col] = { type: promotes ? move.promotion ?? 'Q' : moving.type, color: moving.color, moved: true };
  board[move.from.row][move.from.col] = null;
  if (moving.type === 'K' && Math.abs(move.to.col - move.from.col) === 2) {
    const kingside = move.to.col > move.from.col;
    const rookFrom = { row: move.from.row, col: kingside ? COLS - 1 : 0 };
    const rookTo = { row: move.from.row, col: kingside ? move.to.col - 1 : move.to.col + 1 };
    const rook = board[rookFrom.row][rookFrom.col];
    Object.assign(undo, { rookFrom, rookTo, rook });
    if (rook) { board[rookTo.row][rookTo.col] = { ...rook, moved: true }; board[rookFrom.row][rookFrom.col] = null; }
  }
  return undo;
}

function unmake(board: Board, undo: Undo): void {
  if (undo.rookFrom && undo.rookTo) {
    board[undo.rookFrom.row][undo.rookFrom.col] = undo.rook ?? null;
    board[undo.rookTo.row][undo.rookTo.col] = null;
  }
  board[undo.from.row][undo.from.col] = undo.moving;
  board[undo.to.row][undo.to.col] = undo.target;
  if (undo.epSquare) board[undo.epSquare.row][undo.epSquare.col] = undo.epPiece ?? null;
}

function castlingMoves(board: Board, color: Color): Move[] {
  const row = color === 'white' ? ROWS - 1 : 0;
  const king = board[row][K0];
  if (!king || king.type !== 'K' || king.color !== color || king.moved) return [];
  const enemy = opponent(color);
  if (attacked(board, row, K0, enemy)) return [];
  const moves: Move[] = [];
  for (const kingside of [true, false]) {
    const rookCol = kingside ? COLS - 1 : 0;
    const rook = board[row][rookCol];
    if (!rook || rook.type !== 'R' || rook.color !== color || rook.moved) continue;
    const step = kingside ? 1 : -1;
    let clear = true;
    for (let c = K0 + step; c !== rookCol; c += step) if (board[row][c]) { clear = false; break; }
    if (!clear) continue;
    if (attacked(board, row, K0 + step, enemy) || attacked(board, row, K0 + 2 * step, enemy)) continue;
    moves.push({ from: { row, col: K0 }, to: { row, col: K0 + 2 * step } });
  }
  return moves;
}

/** Destination squares for a piece; mirrors legalMoves.pseudoMoves without its allocations. */
function slide(board: Board, row: number, col: number, color: Color, dirs: readonly (readonly [number, number])[], out: Square[]): void {
  for (const [dr, dc] of dirs) {
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      const t = board[r][c];
      if (!t) out.push({ row: r, col: c });
      else { if (t.color !== color) out.push({ row: r, col: c }); break; }
      r += dr; c += dc;
    }
  }
}

function step(board: Board, row: number, col: number, color: Color, dirs: readonly (readonly [number, number])[], out: Square[]): void {
  for (const [dr, dc] of dirs) {
    const r = row + dr, c = col + dc;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
    const t = board[r][c];
    if (!t || t.color !== color) out.push({ row: r, col: c });
  }
}

/** Destination squares for a piece; mirrors legalMoves.pseudoMoves without its allocations. */
function targets(board: Board, row: number, col: number, piece: Piece, ep: Square | null, out: Square[]): void {
  const color = piece.color;
  switch (piece.type) {
    case 'B': slide(board, row, col, color, DIAGONALS, out); return;
    case 'R': slide(board, row, col, color, ORTHOGONALS, out); return;
    case 'Q': slide(board, row, col, color, DIAGONALS, out); slide(board, row, col, color, ORTHOGONALS, out); return;
    case 'S': slide(board, row, col, color, DIAGONALS, out); step(board, row, col, color, ORTHOGONALS, out); return;
    case 'N': step(board, row, col, color, KNIGHT_JUMPS, out); return;
    case 'K': step(board, row, col, color, DIAGONALS, out); step(board, row, col, color, ORTHOGONALS, out); return;
    case 'P': {
      const dir = color === 'white' ? -1 : 1;
      const r = row + dir;
      if (r < 0 || r >= ROWS) return;
      if (!board[r][col]) {
        out.push({ row: r, col });
        if (row === (color === 'white' ? 6 : 1) && !board[r + dir][col]) out.push({ row: r + dir, col });
      }
      for (let c = col - 1; c <= col + 1; c += 2) {
        if (c < 0 || c >= COLS) continue;
        const t = board[r][c];
        if (t) { if (t.color !== color) out.push({ row: r, col: c }); continue; }
        const adjacent = board[row][c];
        if (ep && ep.row === r && ep.col === c && row === (color === 'white' ? 3 : 4)
          && adjacent?.type === 'P' && adjacent.color !== color) out.push({ row: r, col: c });
      }
    }
  }
}

class Search {
  nodes = 0;
  aborted = false;
  killers: number[][] = [];
  history = new Map<number, number>();
  constructor(private readonly board: Board, private readonly budget: number, private readonly deadline = Infinity) {}

  private spent(): boolean {
    if (++this.nodes > this.budget || ((this.nodes & 1023) === 0 && Date.now() > this.deadline)) this.aborted = true;
    return this.aborted;
  }

  private generate(color: Color, ep: Square | null, capturesOnly: boolean): SearchMove[] {
    const board = this.board;
    const moves: SearchMove[] = [];
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;
      const squares: Square[] = [];
      targets(board, row, col, piece, ep, squares);
      for (const to of squares) {
        const target = board[to.row][to.col];
        const promotes = piece.type === 'P' && (to.row === 0 || to.row === ROWS - 1);
        const isEp = piece.type === 'P' && to.col !== col && !target;
        if (capturesOnly && !target && !isEp && !promotes) continue;
        const victim = target ? VALUES[target.type] : isEp ? VALUES.P : 0;
        const base = victim ? 10_000 + victim * 10 - VALUES[piece.type] / 10 : 0;
        if (promotes) {
          moves.push({ from: { row, col }, to, promotion: 'Q', order: base + 9_000 });
          if (!capturesOnly) moves.push({ from: { row, col }, to, promotion: 'N', order: base - 500 });
        } else moves.push({ from: { row, col }, to, order: base });
      }
    }
    if (!capturesOnly) moves.push(...castlingMoves(board, color).map(m => ({ ...m, order: 50 })));
    return moves;
  }

  private order(moves: SearchMove[], ply: number, hashMove?: number) {
    const killers = this.killers[ply] ?? [];
    for (const m of moves) {
      const key = moveKey(m);
      if (key === hashMove) m.order = 1_000_000;
      else if (!m.order) m.order = killers.includes(key) ? 5_000 : Math.min(4_000, this.history.get(key) ?? 0);
    }
    moves.sort((a, b) => b.order! - a.order!);
  }

  private nextEp(move: Move): Square | null {
    const piece = this.board[move.to.row][move.to.col];
    return piece?.type === 'P' && Math.abs(move.to.row - move.from.row) === 2
      ? { row: (move.to.row + move.from.row) / 2, col: move.from.col } : null;
  }

  evaluate(color: Color): number {
    const white = evaluateWhite(this.board);
    return (color === 'white' ? white : -white) + 10; // small bonus for having the move
  }

  quiesce(color: Color, ep: Square | null, alpha: number, beta: number, ply: number): number {
    if (this.spent()) return 0;
    const standPat = this.evaluate(color);
    if (standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;
    if (ply > 24) return standPat;
    const moves = this.generate(color, ep, true);
    this.order(moves, ply);
    for (const move of moves) {
      // Delta pruning: skip captures that cannot lift the score to alpha.
      const victim = this.board[move.to.row][move.to.col];
      const gain = (victim ? VALUES[victim.type] : 100) + (move.promotion ? VALUES[move.promotion] - 100 : 0);
      if (standPat + gain + 200 < alpha) continue;
      const undo = make(this.board, move);
      if (inCheck(this.board, color)) { unmake(this.board, undo); continue; }
      const score = -this.quiesce(opponent(color), null, -beta, -alpha, ply + 1);
      unmake(this.board, undo);
      if (this.aborted) return 0;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  negamax(color: Color, ep: Square | null, depth: number, alpha: number, beta: number, ply: number): number {
    const checked = inCheck(this.board, color);
    if (checked) depth++; // check extension
    if (depth <= 0) return this.quiesce(color, ep, alpha, beta, ply);
    if (this.spent()) return 0;
    const moves = this.generate(color, ep, false);
    this.order(moves, ply);
    let best = -INF;
    let legal = 0;
    for (const move of moves) {
      const undo = make(this.board, move);
      if (inCheck(this.board, color)) { unmake(this.board, undo); continue; }
      legal++;
      const score = -this.negamax(opponent(color), this.nextEp(move), depth - 1, -beta, -alpha, ply + 1);
      unmake(this.board, undo);
      if (this.aborted) return 0;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!undo.target && !move.promotion) {
          const key = moveKey(move);
          const killers = (this.killers[ply] ??= []);
          if (!killers.includes(key)) { killers.unshift(key); killers.length = Math.min(killers.length, 2); }
          this.history.set(key, (this.history.get(key) ?? 0) + depth * depth);
        }
        break;
      }
    }
    if (!legal) return checked ? -MATE + ply : 0;
    return best;
  }

  /** Scores each root move to the given depth. Returns false if the budget ran out first. */
  root(color: Color, ep: Square | null, moves: Move[], depth: number, scores: Map<number, number>): boolean {
    let alpha = -INF;
    for (const move of moves) {
      const undo = make(this.board, move);
      // Search each root move with a window slightly below the best so near-equal moves get exact scores.
      const score = -this.negamax(opponent(color), this.nextEp(move), depth - 1, -INF, -(alpha - 60), 1);
      unmake(this.board, undo);
      if (this.aborted) return false;
      scores.set(moveKey(move), score);
      if (score > alpha) alpha = score;
    }
    return true;
  }
}

/** Exposed for tests: the search generator must match the game's own move rules. */
export function searchTargets(board: Board, row: number, col: number, ep: Square | null): Square[] {
  const piece = board[row][col];
  const out: Square[] = [];
  if (piece) targets(board, row, col, piece, ep, out);
  return out;
}

/** Deterministic local opponents. Hard and Medium run an alpha-beta search with
 * quiescence (so they see exchanges and hanging pieces); Easy searches one move plus
 * captures and adds large, repeatable noise so it makes human-like mistakes.
 */
export type ComputerOptions = {
  /** Optional wall-clock cap for slow devices. Without it the search is fully deterministic. */
  timeLimitMs?: number;
};

export function chooseComputerMove(state: GameState, difficulty: ComputerDifficulty, options: ComputerOptions = {}): Move | null {
  const startedAt = Date.now();
  if (state.status !== 'active') return null;
  const moves = allLegalMoves(state.board, state.turn, { enPassantTarget: state.enPassant });
  if (!moves.length) return null;
  const level = LEVELS[difficulty];
  const seed = hashString(positionSeed(state, difficulty));
  const noise = (move: Move) => level.noise ? (hashString(`${seed}:${moveKey(move)}`) % (2 * level.noise + 1)) - level.noise : 0;

  // Moves that would complete a threefold repetition are scored as draws.
  const repeats = new Set<number>();
  for (const move of moves) {
    const next = applyRawMove(state.board, move, move.promotion);
    const piece = state.board[move.from.row][move.from.col];
    const ep = piece?.type === 'P' && Math.abs(move.to.row - move.from.row) === 2 ? { row: (move.to.row + move.from.row) / 2, col: move.from.col } : null;
    if ((state.positionCounts[positionKey(next, opponent(state.turn), ep)] ?? 0) >= 2) repeats.add(moveKey(move));
  }

  const search = new Search(cloneBoard(state.board), level.nodes, options.timeLimitMs ? startedAt + options.timeLimitMs : Infinity);
  let ordered = [...moves];
  let finalScores = new Map<number, number>();
  for (let depth = 1; depth <= level.depth; depth++) {
    const scores = new Map<number, number>();
    const complete = search.root(state.turn, state.enPassant, ordered, depth, scores);
    if (complete) finalScores = scores;
    else if (depth === 1) {
      // Budget ran out during the first pass; unscored moves rank last.
      finalScores = scores;
      for (const move of moves) if (!scores.has(moveKey(move))) scores.set(moveKey(move), -INF / 2);
    } else if (scores.has(moveKey(ordered[0]))) {
      // A partial deeper pass searched the previous best first with a full window, so any
      // searched move that beats it is genuinely better at this depth.
      finalScores = scores;
    }
    if (!complete) break;
    ordered = [...moves].sort((a, b) => (scores.get(moveKey(b)) ?? -INF) - (scores.get(moveKey(a)) ?? -INF));
    const best = scores.get(moveKey(ordered[0])) ?? 0;
    if (Math.abs(best) > MATE - 100) break; // a forced mate was found
  }

  lastSearchNodes = search.nodes;
  let bestScore = -INF;
  let bestMoves: Move[] = [];
  for (const move of moves) {
    const key = moveKey(move);
    let score = finalScores.get(key) ?? -INF;
    if (repeats.has(key)) score = Math.min(score, 0);
    if (Math.abs(score) < MATE - 100) score += noise(move);
    if (score > bestScore) { bestScore = score; bestMoves = [move]; }
    else if (score === bestScore) bestMoves.push(move);
  }
  return bestMoves[seed % bestMoves.length];
}
