import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board, COLS, ROWS } from '../board';
import { Piece, Color } from '../pieces';
import { legalMoves, squareAttacked, allLegalMoves } from '../legalMoves';
import { createGameState, makeMove, GameState, positionKey, resign, timeout } from '../gameState';
import { applyMove } from '../moveValidation';

function boardWith(...pieces: Array<[number, number, Piece]>): Board {
  const board: Board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  for (const [row, col, piece] of pieces) board[row][col] = piece;
  return board;
}

function stateWith(board: Board, turn: Color = 'white'): GameState {
  return { ...createGameState(), board, turn, positionCounts: {} };
}

test('pawns attack empty diagonals, never forward squares, for both colors', () => {
  for (const color of ['white', 'black'] as const) {
    const dir = color === 'white' ? -1 : 1;
    const board = boardWith([3, 5, { type: 'P', color }]);
    assert.equal(squareAttacked(board, { row: 3 + dir, col: 4 }, color), true);
    assert.equal(squareAttacked(board, { row: 3 + dir, col: 6 }, color), true);
    assert.equal(squareAttacked(board, { row: 3 + dir, col: 5 }, color), false);
  }
});

test('castling cannot cross a pawn attack, for either color and flank', () => {
  for (const color of ['white', 'black'] as const) {
    const row = color === 'white' ? 7 : 0;
    const enemy = color === 'white' ? 'black' : 'white';
    for (const step of [-1, 1]) {
      const board = boardWith(
        [row, 5, { type: 'K', color }],
        [row, step === 1 ? 9 : 0, { type: 'R', color }],
        [7 - row, 0, { type: 'K', color: enemy }],
        [row === 7 ? 6 : 1, 5, { type: 'P', color: enemy }],
      );
      assert.equal(legalMoves(board, row, 5).some(m => m.row === row && m.col === 5 + step * 2), false);
    }
  }
});

test('initial position counts toward repetition and knight moved flags do not distinguish it', () => {
  let state = createGameState();
  const cycle = [
    { from: { row: 7, col: 1 }, to: { row: 5, col: 2 } },
    { from: { row: 0, col: 1 }, to: { row: 2, col: 2 } },
    { from: { row: 5, col: 2 }, to: { row: 7, col: 1 } },
    { from: { row: 2, col: 2 }, to: { row: 0, col: 1 } },
  ];
  for (let repeat = 0; repeat < 2; repeat++) {
    for (let i = 0; i < cycle.length; i++) {
      state = makeMove(state, cycle[i]);
      assert.equal(state.status, repeat === 1 && i === 3 ? 'draw_repetition' : 'active');
    }
  }
  assert.equal(state.history.length, 8);
});

test('King and Shifter is not an insufficient-material draw', () => {
  const state = stateWith(boardWith(
    [7, 9, { type: 'K', color: 'white' }], [0, 0, { type: 'K', color: 'black' }],
    [4, 4, { type: 'S', color: 'white' }],
  ));
  assert.equal(makeMove(state, { from: { row: 4, col: 4 }, to: { row: 3, col: 3 } }).status, 'active');
});

test('King and Shifter can deliver checkmate without other material', () => {
  const state = stateWith(boardWith(
    [2, 1, { type: 'K', color: 'white' }], [0, 0, { type: 'K', color: 'black' }],
    [1, 2, { type: 'S', color: 'white' }],
  ));
  const next = makeMove(state, { from: { row: 1, col: 2 }, to: { row: 1, col: 1 } });
  assert.equal(next.status, 'checkmate');
  assert.equal(next.winner, 'white');
});

test('one ordinary minor on each side is not automatically dead material', () => {
  const board = boardWith(
    [7, 9, { type: 'K', color: 'white' }], [0, 0, { type: 'K', color: 'black' }],
    [4, 4, { type: 'N', color: 'white' }], [2, 7, { type: 'N', color: 'black' }],
  );
  assert.equal(makeMove(stateWith(board), { from: { row: 4, col: 4 }, to: { row: 2, col: 3 } }).status, 'active');
});

test('computer move generation exposes every legal promotion and applies its choice', () => {
  const board = boardWith(
    [7, 9, { type: 'K', color: 'white' }], [0, 0, { type: 'K', color: 'black' }],
    [1, 4, { type: 'P', color: 'white' }],
  );
  const promotions = allLegalMoves(board, 'white').filter(m => m.from.row === 1 && m.from.col === 4);
  assert.deepEqual(promotions.map(m => m.promotion).sort(), ['B', 'N', 'Q', 'R', 'S']);
  for (const move of promotions) assert.equal(applyMove(board, move)?.board[0][4]?.type, move.promotion);
  assert.equal(applyMove(board, { from: { row: 1, col: 4 }, to: { row: 0, col: 4 }, promotion: 'K' }), null);
});

test('resign and timeout cannot overwrite a completed result', () => {
  const ended = { ...createGameState(), status: 'checkmate' as const, winner: 'white' as const };
  assert.equal(resign(ended, 'white'), ended);
  assert.equal(timeout(ended, 'white'), ended);
});

test('position identity retains castling rights even when the path is blocked', () => {
  const state = createGameState();
  const original = positionKey(state.board, 'white', null);
  state.board[7][9]!.moved = true;
  assert.notEqual(positionKey(state.board, 'white', null), original);
  state.board[7][9]!.moved = false;
  state.board[7][5]!.moved = true;
  assert.notEqual(positionKey(state.board, 'white', null), original);
  assert.notEqual(positionKey(state.board, 'black', null), positionKey(state.board, 'white', null));
});

test('irrelevant moved flags do not split repeated positions', () => {
  const board = boardWith(
    [7, 5, { type: 'K', color: 'white' }], [0, 5, { type: 'K', color: 'black' }],
    [4, 4, { type: 'R', color: 'white' }], [2, 4, { type: 'B', color: 'black' }],
  );
  const original = positionKey(board, 'white', null);
  for (const piece of board.flat()) if (piece) piece.moved = true;
  assert.equal(positionKey(board, 'white', null), original);
});

test('only a legal en passant capture distinguishes position identity', () => {
  const board = boardWith(
    [7, 9, { type: 'K', color: 'white' }], [0, 0, { type: 'K', color: 'black' }],
    [3, 5, { type: 'P', color: 'black' }],
  );
  const target = { row: 2, col: 5 };
  assert.equal(positionKey(board, 'white', target), positionKey(board, 'white', null));
  board[3][4] = { type: 'P', color: 'white' };
  assert.notEqual(positionKey(board, 'white', target), positionKey(board, 'white', null));
  board[7][9] = null;
  board[7][4] = { type: 'K', color: 'white' };
  board[0][4] = { type: 'R', color: 'black' };
  assert.equal(positionKey(board, 'white', target), positionKey(board, 'white', null), 'a pinned pawn cannot capture en passant');
});

test('castling requires the original king square and unmoved king and rook', () => {
  for (const row of [0, 4, 7]) {
    const board = boardWith(
      [row, 4, { type: 'K', color: 'white' }], [row, 9, { type: 'R', color: 'white' }],
      [1, 0, { type: 'K', color: 'black' }],
    );
    assert.equal(legalMoves(board, row, 4).some(m => m.row === row && Math.abs(m.col - 4) === 2), false);
  }
  const board = boardWith(
    [7, 5, { type: 'K', color: 'white' }], [7, 9, { type: 'R', color: 'white', moved: true }],
    [0, 0, { type: 'K', color: 'black' }],
  );
  assert.equal(legalMoves(board, 7, 5).some(m => m.col === 7), false);
  board[7][9]!.moved = false;
  board[7][5]!.moved = true;
  assert.equal(legalMoves(board, 7, 5).some(m => m.col === 7), false);
});

test('only same-color-square bishops are automatically drawn when both sides have bishops', () => {
  for (const blackCol of [6, 7]) {
    const board = boardWith(
      [7, 9, { type: 'K', color: 'white' }], [0, 0, { type: 'K', color: 'black' }],
      [4, 4, { type: 'B', color: 'white' }], [2, blackCol, { type: 'B', color: 'black' }],
    );
    const next = makeMove(stateWith(board), { from: { row: 4, col: 4 }, to: { row: 3, col: 3 } });
    assert.equal(next.status, blackCol === 6 ? 'draw_material' : 'active');
  }
});

test('en passant expires after another move and cannot capture a missing pawn', () => {
  let state = stateWith(boardWith(
    [7, 0, { type: 'K', color: 'white' }], [0, 0, { type: 'K', color: 'black' }],
    [6, 5, { type: 'P', color: 'white' }], [4, 4, { type: 'P', color: 'black' }],
  ));
  state = makeMove(state, { from: { row: 6, col: 5 }, to: { row: 4, col: 5 } });
  state = makeMove(state, { from: { row: 0, col: 0 }, to: { row: 0, col: 1 } });
  assert.equal(state.enPassant, null);
  state = makeMove(state, { from: { row: 7, col: 0 }, to: { row: 7, col: 1 } });
  assert.equal(legalMoves(state.board, 4, 4).some(m => m.col === 5), false);
  state.board[4][5] = null;
  assert.equal(legalMoves(state.board, 4, 4, { enPassantTarget: { row: 5, col: 5 } }).some(m => m.col === 5), false);
});
