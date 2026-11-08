import { COLS, ROWS } from './board';
import { GameState, makeMove } from './gameState';
import { allLegalMoves, isInCheck } from './legalMoves';
import { Color, Move, PieceType } from './pieces';

export type ComputerDifficulty = 'easy' | 'medium' | 'hard';

const VALUES: Record<PieceType, number> = { P: 100, N: 320, B: 330, S: 400, R: 500, Q: 900, K: 0 };
const MATE_SCORE = 1_000_000;
// A node budget is repeatable across devices, unlike a wall-clock cutoff.
const MAX_REPLY_NODES = 1000;

function deterministicPick<T>(items: T[], seed: string): T | null {
  if (!items.length) return null;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return items[hash % items.length];
}

function positionSeed(state: GameState, difficulty: ComputerDifficulty): string {
  const board = state.board.map(row => row.map(p => p ? `${p.color[0]}${p.type}${p.moved ? 1 : 0}` : '.').join(',')).join('|');
  return `${difficulty}:${state.turn}:${board}:${JSON.stringify(state.enPassant)}:${state.halfmoveClock}`;
}

function evaluate(state: GameState, color: Color): number {
  if (state.status !== 'active') {
    return state.winner === undefined ? 0 : state.winner === color ? MATE_SCORE : -MATE_SCORE;
  }
  let score = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const piece = state.board[row][col];
      if (!piece) continue;
      const center = (ROWS - 1) / 2 - Math.abs(row - (ROWS - 1) / 2)
        + (COLS - 1) / 2 - Math.abs(col - (COLS - 1) / 2);
      const position = piece.type === 'K' ? 0 : center * 4;
      score += (piece.color === color ? 1 : -1) * (VALUES[piece.type] + position);
    }
  }
  if (isInCheck(state.board, state.turn)) score += state.turn === color ? -25 : 25;
  return score;
}

/** Deterministic, deliberately small local opponents, not a production chess engine.
 * Search uses the real state transition, including castling, en passant, all five
 * promotions and draw/checkmate adjudication. Hard looks one opponent reply ahead within a fixed node budget.
 */
export function chooseComputerMove(state: GameState, difficulty: ComputerDifficulty): Move | null {
  if (state.status !== 'active') return null;
  const moves = allLegalMoves(state.board, state.turn, { enPassantTarget: state.enPassant });
  if (!moves.length) return null;
  const seed = positionSeed(state, difficulty);
  if (difficulty === 'easy') return deterministicPick(moves, seed);

  const candidates = moves.map(move => {
    const next = makeMove(state, move);
    return { move, next, score: evaluate(next, state.turn) };
  }).sort((a, b) => b.score - a.score);
  let bestScore = -Infinity;
  let bestMoves: Move[] = [];
  let remaining = MAX_REPLY_NODES;
  for (const candidate of candidates) {
    const { move, next } = candidate;
    let score = candidate.score;
    if (difficulty === 'hard' && next.status === 'active') {
      // Search captures/promotions first so obvious refutations prune early.
      const replies = allLegalMoves(next.board, next.turn, { enPassantTarget: next.enPassant });
      const priority = (reply: Move) => VALUES[next.board[reply.to.row][reply.to.col]?.type ?? 'K'] + (reply.promotion ? VALUES[reply.promotion] : 0);
      replies.sort((a, b) => priority(b) - priority(a));
      if (replies.length) score = Infinity;
      let complete = true;
      for (const reply of replies) {
        if (remaining-- <= 0) { complete = false; break; }
        score = Math.min(score, evaluate(makeMove(next, reply), state.turn));
        if (score < bestScore) break;
      }
      // Never compare a partially searched move with fully searched candidates.
      if (!complete) break;
    }
    if (score > bestScore) { bestScore = score; bestMoves = [move]; }
    else if (score === bestScore) bestMoves.push(move);
  }
  // Only relevant if a single unusual position exhausts the entire reply budget.
  if (!bestMoves.length) bestMoves = candidates.filter(c => c.score === candidates[0].score).map(c => c.move);
  return deterministicPick(bestMoves, seed);
}
