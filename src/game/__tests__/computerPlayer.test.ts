import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board, COLS, ROWS } from '../board';
import { ComputerDifficulty, chooseComputerMove, searchTargets } from '../computerPlayer';
import { GameState, createGameState, makeMove, resign } from '../gameState';
import { allLegalMoves, isInCheck, pseudoMoves } from '../legalMoves';
import { Piece, PROMOTION_CHOICES } from '../pieces';

const difficulties: ComputerDifficulty[] = ['easy', 'medium', 'hard'];
function position(pieces: Array<[number, number, Piece]>, overrides: Partial<GameState> = {}): GameState {
  const board: Board = Array.from({ length: ROWS }, () => Array<Piece | null>(COLS).fill(null));
  for (const [row, col, piece] of pieces) board[row][col] = piece;
  return { ...createGameState(), board, ...overrides };
}

test('all computer levels choose reproducible legal moves without mutating their input', () => {
  const initial = createGameState();
  const before = JSON.stringify(initial);
  for (const difficulty of difficulties) {
    const move = chooseComputerMove(initial, difficulty);
    assert.ok(move, difficulty);
    assert.deepEqual(chooseComputerMove(initial, difficulty), move, difficulty);
    assert.notEqual(makeMove(initial, move), initial, difficulty);
  }
  assert.equal(JSON.stringify(initial), before);
});

test('computers do not play after a game ends or in checkmate/stalemate positions', () => {
  const mate = position([
    [0, 9, { type: 'K', color: 'black' }],
    [1, 7, { type: 'P', color: 'black' }], [1, 8, { type: 'P', color: 'black' }], [1, 9, { type: 'P', color: 'black' }],
    [7, 0, { type: 'K', color: 'white' }], [0, 0, { type: 'R', color: 'white' }],
  ], { turn: 'black' });
  const stalemate = position([
    [0, 0, { type: 'K', color: 'black' }], [1, 2, { type: 'K', color: 'white' }], [2, 1, { type: 'Q', color: 'white' }],
  ], { turn: 'black' });
  assert.equal(isInCheck(mate.board, 'black'), true);
  assert.equal(isInCheck(stalemate.board, 'black'), false);
  for (const difficulty of difficulties) {
    assert.equal(chooseComputerMove(resign(createGameState(), 'white'), difficulty), null);
    assert.equal(chooseComputerMove(mate, difficulty), null);
    assert.equal(chooseComputerMove(stalemate, difficulty), null);
  }
});

test('Medium and Hard choose immediate mate rather than penalizing positions with no reply', () => {
  const state = position([
    [0, 9, { type: 'K', color: 'black' }],
    [1, 7, { type: 'P', color: 'black' }], [1, 8, { type: 'P', color: 'black' }], [1, 9, { type: 'P', color: 'black' }],
    [7, 0, { type: 'K', color: 'white' }], [2, 0, { type: 'R', color: 'white' }],
  ]);
  for (const difficulty of ['medium', 'hard'] as const) {
    const move = chooseComputerMove(state, difficulty);
    assert.ok(move);
    const next = makeMove(state, move);
    assert.equal(next.status, 'checkmate', difficulty);
    assert.equal(next.winner, 'white');
  }
});

test('Medium and Hard evaluate en passant using the removed pawn and expire its context', () => {
  const state = position([
    [7, 0, { type: 'K', color: 'white' }], [0, 9, { type: 'K', color: 'black' }],
    [3, 4, { type: 'P', color: 'white' }], [3, 5, { type: 'P', color: 'black' }],
  ], { enPassant: { row: 2, col: 5 } });
  for (const difficulty of ['medium', 'hard'] as const) {
    const move = chooseComputerMove(state, difficulty);
    assert.ok(move);
    assert.deepEqual(move.to, { row: 2, col: 5 });
    const next = makeMove(state, move);
    assert.equal(next.board[3][5], null);
    assert.equal(next.captured[0].type, 'P');
    assert.equal(next.enPassant, null);
    const expiredMove = chooseComputerMove({ ...state, enPassant: null }, difficulty);
    assert.ok(expiredMove);
    assert.notDeepEqual(expiredMove.to, { row: 2, col: 5 });
  }
});

test('every level returns an explicit legal promotion when promotion is the only escape', () => {
  const state = position([
    [0, 0, { type: 'K', color: 'white', moved: true }],
    [1, 0, { type: 'P', color: 'white' }], [1, 1, { type: 'P', color: 'white' }],
    [0, 9, { type: 'R', color: 'black' }], [7, 9, { type: 'K', color: 'black' }],
  ]);
  assert.equal(isInCheck(state.board, 'white'), true);
  const legal = allLegalMoves(state.board, 'white');
  assert.equal(legal.length, PROMOTION_CHOICES.length);
  assert.deepEqual(new Set(legal.map(move => move.promotion)), new Set(PROMOTION_CHOICES));
  for (const difficulty of difficulties) {
    const move = chooseComputerMove(state, difficulty);
    assert.ok(move?.promotion, difficulty);
    assert.ok(PROMOTION_CHOICES.includes(move.promotion));
    const next = makeMove(state, move);
    assert.equal(next.board[0][1]?.type, move.promotion);
    assert.equal(isInCheck(next.board, 'white'), false);
  }
});

test('Medium and Hard consider the reply and decline a poisoned pawn', () => {
  const state = position([
    [7, 9, { type: 'K', color: 'white' }], [0, 0, { type: 'K', color: 'black' }],
    [4, 3, { type: 'Q', color: 'white' }], [4, 6, { type: 'P', color: 'black' }],
    [0, 6, { type: 'R', color: 'black' }],
  ]);
  for (const difficulty of ['medium', 'hard'] as const) {
    const move = chooseComputerMove(state, difficulty);
    assert.ok(move, difficulty);
    assert.notDeepEqual(move.to, { row: 4, col: 6 }, difficulty);
  }
});

test('Medium and Hard take a free piece and do not leave their queen hanging', () => {
  const free = position([
    [7, 9, { type: 'K', color: 'white' }], [0, 0, { type: 'K', color: 'black' }],
    [6, 2, { type: 'N', color: 'white' }], [4, 3, { type: 'R', color: 'black' }],
  ]);
  const hanging = position([
    [7, 9, { type: 'K', color: 'white' }], [0, 0, { type: 'K', color: 'black' }],
    [4, 4, { type: 'Q', color: 'white' }], [2, 4, { type: 'R', color: 'black' }],
    [6, 0, { type: 'P', color: 'white' }],
  ]);
  for (const difficulty of ['medium', 'hard'] as const) {
    assert.deepEqual(chooseComputerMove(free, difficulty)?.to, { row: 4, col: 3 }, difficulty);
    const move = chooseComputerMove(hanging, difficulty)!;
    const next = makeMove(hanging, move);
    // After the move, Black cannot win the queen for free.
    const reply = chooseComputerMove(next, 'hard');
    const after = reply ? makeMove(next, reply) : next;
    assert.ok(after.board.flat().some(p => p?.type === 'Q' && p.color === 'white')
      || after.captured.some(p => p.type === 'R'), difficulty);
  }
});

test('the search move generator matches the game rules on positions from real play', () => {
  let state = createGameState();
  for (let ply = 0; ply < 40 && state.status === 'active'; ply++) {
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
      const key = (s: { row: number; col: number }) => `${s.row},${s.col}`;
      const expected = pseudoMoves(state.board, row, col, { enPassantTarget: state.enPassant }).map(key).sort();
      assert.deepEqual(searchTargets(state.board, row, col, state.enPassant).map(key).sort(), expected, `ply ${ply} ${row},${col}`);
    }
    state = makeMove(state, chooseComputerMove(state, ply % 2 ? 'easy' : 'medium')!);
  }
});

test('a time limit still returns a legal move', () => {
  const state = createGameState();
  const move = chooseComputerMove(state, 'hard', { timeLimitMs: 1 });
  assert.ok(move);
  assert.notEqual(makeMove(state, move), state);
});

test('search respects castling rights and king safety on an open castling position', () => {
  const state = position([
    [7, 5, { type: 'K', color: 'white' }], [7, 0, { type: 'R', color: 'white' }], [7, 9, { type: 'R', color: 'white' }],
    [0, 5, { type: 'K', color: 'black' }], [0, 0, { type: 'R', color: 'black' }], [0, 9, { type: 'R', color: 'black' }],
  ]);
  for (const difficulty of difficulties) {
    const move = chooseComputerMove(state, difficulty);
    assert.ok(move);
    const next = makeMove(state, move);
    assert.notEqual(next, state);
    assert.equal(isInCheck(next.board, 'white'), false);
  }
});
