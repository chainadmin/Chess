import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle, PUZZLE_TEMPLATES, localDateKey } from '../../services/puzzles/DailyPuzzleService';
import { legalMoves, isInCheck, allLegalMoves } from '../legalMoves';

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return (max: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % max;
  };
}

test('generatePuzzle always produces a legal solution move, across many dates', () => {
  for (let day = 1; day <= 120; day++) {
    const date = `2026-${String(1 + (day % 12)).padStart(2, '0')}-${String(1 + (day % 28)).padStart(2, '0')}`;
    const puzzle = generatePuzzle(date);
    const legal = legalMoves(puzzle.board, puzzle.solution.from.row, puzzle.solution.from.col);
    assert.ok(legal.some(m => m.row === puzzle.solution.to.row && m.col === puzzle.solution.to.col), `puzzle for ${date} (${puzzle.title}) has an illegal solution`);
  }
});

test('generatePuzzle is deterministic for the same date', () => {
  const a = generatePuzzle('2026-05-01');
  const b = generatePuzzle('2026-05-01');
  assert.deepEqual(a, b);
});

test('the back-rank template always delivers an actual checkmate, not just a check', () => {
  const random = mulberry32(12345);
  for (let i = 0; i < 30; i++) {
    const { board, solution } = PUZZLE_TEMPLATES.backRankMatePuzzle(random);
    const legal = legalMoves(board, solution.from.row, solution.from.col);
    assert.ok(legal.some(m => m.row === solution.to.row && m.col === solution.to.col));
    const next = board.map(row => row.slice());
    next[solution.to.row][solution.to.col] = next[solution.from.row][solution.from.col];
    next[solution.from.row][solution.from.col] = null;
    assert.equal(isInCheck(next, 'black'), true, 'the mating move must give check');
    assert.equal(allLegalMoves(next, 'black').length, 0, 'the black king must have no legal replies');
  }
});

test('localDateKey formats the local date as YYYY-MM-DD', () => {
  const date = new Date(2026, 8, 5);
  assert.equal(localDateKey(date), '2026-09-05');
});
