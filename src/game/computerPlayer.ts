import { Board } from './board';
import { allLegalMoves, isInCheck, legalMoves } from './legalMoves';
import { Color, Move, opponent, PieceType } from './pieces';

export type ComputerDifficulty = 'easy' | 'medium' | 'hard';

type ScoredMove = { move: Move; score: number };

const PIECE_VALUES: Record<PieceType, number> = { P: 100, N: 320, B: 330, S: 360, R: 500, Q: 900, K: 20000 };
const CENTER_ROWS = [3, 4];
const CENTER_COLS = [4, 5];

function deterministicPick<T>(items: T[], seed: string) {
  if (items.length === 0) return undefined;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return items[hash % items.length];
}

function boardSeed(board: Board, color: Color, difficulty: ComputerDifficulty) {
  return `${difficulty}:${color}:` + board.map(row => row.map(piece => piece ? `${piece.color[0]}${piece.type}` : '..').join('')).join('|');
}

function material(board: Board, color: Color) {
  return board.flat().reduce((total, piece) => {
    if (!piece) return total;
    return total + (piece.color === color ? PIECE_VALUES[piece.type] : -PIECE_VALUES[piece.type]);
  }, 0);
}

function applyMoveForSearch(board: Board, move: Move): Board {
  const next = board.map(row => row.map(piece => piece ? { ...piece } : null));
  next[move.to.row][move.to.col] = next[move.from.row][move.from.col];
  next[move.from.row][move.from.col] = null;
  return next;
}

function scoreMove(board: Board, move: Move, color: Color, depth: 1 | 2): number {
  const target = board[move.to.row][move.to.col];
  const mover = board[move.from.row][move.from.col];
  const next = applyMoveForSearch(board, move);
  const replyColor = opponent(color);
  let score = target ? PIECE_VALUES[target.type] * 10 - (mover ? PIECE_VALUES[mover.type] : 0) : 0;
  score += CENTER_ROWS.includes(move.to.row) ? 18 : 0;
  score += CENTER_COLS.includes(move.to.col) ? 18 : 0;
  score += move.shift ? 14 : 0;
  score += isInCheck(next, replyColor) ? 120 : 0;
  score += legalMoves(next, move.to.row, move.to.col).length * 3;
  score += material(next, color) / 10;

  if (depth === 2) {
    const replies = allLegalMoves(next, replyColor).map(reply => scoreMove(next, reply, replyColor, 1));
    score -= replies.length ? Math.max(...replies) * 0.75 : 10000;
  }

  return score;
}

function bestMove(board: Board, color: Color, depth: 1 | 2): Move | null {
  const scored = allLegalMoves(board, color).map<ScoredMove>(move => ({ move, score: scoreMove(board, move, color, depth) }));
  if (scored.length === 0) return null;
  const bestScore = Math.max(...scored.map(item => item.score));
  const best = scored.filter(item => item.score === bestScore).map(item => item.move);
  return deterministicPick(best, `${boardSeed(board, color, depth === 1 ? 'medium' : 'hard')}:${bestScore}`) ?? best[0];
}

export function chooseComputerMove(board: Board, color: Color, difficulty: ComputerDifficulty): Move | null {
  const moves = allLegalMoves(board, color);
  if (moves.length === 0) return null;
  if (difficulty === 'easy') return deterministicPick(moves, boardSeed(board, color, difficulty)) ?? moves[0];
  return bestMove(board, color, difficulty === 'medium' ? 1 : 2);
}
