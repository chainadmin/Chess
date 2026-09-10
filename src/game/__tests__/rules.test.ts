import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board, COLS, ROWS, createInitialBoard } from '../board';
import { Piece } from '../pieces';
import { legalMoves, isInCheck } from '../legalMoves';
import { applyMove } from '../moveValidation';
import { createGameState, makeMove, GameState } from '../gameState';
import { calculateRating, expectedScore, INITIAL_RATING } from '../rating';

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Piece | null>(COLS).fill(null));
}

function place(board: Board, squares: Array<[number, number, Piece]>): Board {
  for (const [row, col, piece] of squares) board[row][col] = piece;
  return board;
}

function stateWithBoard(board: Board, overrides: Partial<GameState> = {}): GameState {
  return { ...createGameState(), board, ...overrides };
}

test('initial board has the ShiftChess back rank and pawn counts', () => {
  const board = createInitialBoard();
  assert.equal(board[0].map(p => p?.type).join(''), 'RNSBQKBSNR');
  assert.equal(board[1].filter(p => p?.type === 'P').length, COLS);
  assert.equal(board[6].filter(p => p?.type === 'P').length, COLS);
});

test('Shifter moves like a bishop and one square orthogonally, both capturing', () => {
  const board = place(emptyBoard(), [
    [4, 4, { type: 'S', color: 'white' }],
    [3, 3, { type: 'P', color: 'black' }],
    [4, 5, { type: 'P', color: 'black' }],
    [4, 3, { type: 'P', color: 'white' }],
    [7, 0, { type: 'K', color: 'white' }],
    [0, 9, { type: 'K', color: 'black' }],
  ]);
  const moves = legalMoves(board, 4, 4);
  assert.ok(moves.some(m => m.row === 3 && m.col === 3), 'captures diagonally like a bishop');
  assert.ok(moves.some(m => m.row === 4 && m.col === 5), 'captures one square orthogonally');
  assert.ok(!moves.some(m => m.row === 4 && m.col === 3), 'cannot capture its own piece');
  assert.ok(!moves.some(m => m.row === 4 && m.col === 2), 'cannot slide more than one square orthogonally');
});

test('detects checkmate (back-rank style mate)', () => {
  const board = place(emptyBoard(), [
    [0, 9, { type: 'K', color: 'black' }],
    [1, 7, { type: 'P', color: 'black' }],
    [1, 8, { type: 'P', color: 'black' }],
    [1, 9, { type: 'P', color: 'black' }],
    [7, 0, { type: 'K', color: 'white' }],
    [2, 0, { type: 'R', color: 'white' }],
  ]);
  const state = makeMove(stateWithBoard(board, { turn: 'white' }), { from: { row: 2, col: 0 }, to: { row: 0, col: 0 } });
  assert.equal(state.status, 'checkmate');
  assert.equal(state.winner, 'white');
});

test('detects stalemate as a draw, not an active game', () => {
  // Classic corner stalemate: Kb2/Qb6 vs Ka8, mapped onto our row/col grid.
  const board = place(emptyBoard(), [
    [0, 0, { type: 'K', color: 'black' }],
    [1, 2, { type: 'K', color: 'white' }],
    [2, 2, { type: 'Q', color: 'white' }],
  ]);
  const state = makeMove(stateWithBoard(board, { turn: 'white' }), { from: { row: 2, col: 2 }, to: { row: 2, col: 1 } });
  assert.equal(isInCheck(state.board, 'black'), false);
  assert.equal(state.status, 'stalemate');
});

test('kingside and queenside castling move the rook and require empty, unattacked squares', () => {
  const board = place(emptyBoard(), [
    [7, 5, { type: 'K', color: 'white' }],
    [7, 9, { type: 'R', color: 'white' }],
    [7, 0, { type: 'R', color: 'white' }],
    [0, 5, { type: 'K', color: 'black' }],
  ]);
  const kingsideMoves = legalMoves(board, 7, 5);
  assert.ok(kingsideMoves.some(m => m.row === 7 && m.col === 7), 'king can castle kingside two squares');
  const afterKingside = applyMove(board, { from: { row: 7, col: 5 }, to: { row: 7, col: 7 } })!;
  assert.equal(afterKingside.board[7][6]?.type, 'R');
  assert.equal(afterKingside.board[7][9], null);

  const queensideMoves = legalMoves(board, 7, 5);
  assert.ok(queensideMoves.some(m => m.row === 7 && m.col === 3), 'king can castle queenside two squares');

  const blocked = place(emptyBoard(), [
    [7, 5, { type: 'K', color: 'white' }],
    [7, 9, { type: 'R', color: 'white' }],
    [7, 8, { type: 'N', color: 'white' }],
    [0, 5, { type: 'K', color: 'black' }],
  ]);
  assert.ok(!legalMoves(blocked, 7, 5).some(m => m.col === 7), 'castling requires empty squares between king and rook');

  const throughCheck = place(emptyBoard(), [
    [7, 5, { type: 'K', color: 'white' }],
    [7, 9, { type: 'R', color: 'white' }],
    [0, 6, { type: 'R', color: 'black' }],
    [0, 0, { type: 'K', color: 'black' }],
  ]);
  assert.ok(!legalMoves(throughCheck, 7, 5).some(m => m.col === 7), 'cannot castle through an attacked square');
});

test('en passant capture is only legal immediately after a double pawn step', () => {
  const board = place(emptyBoard(), [
    [4, 4, { type: 'P', color: 'black' }],
    [0, 0, { type: 'K', color: 'black' }],
    [7, 0, { type: 'K', color: 'white' }],
    [6, 5, { type: 'P', color: 'white' }],
  ]);
  let state = stateWithBoard(board, { turn: 'white' });
  state = makeMove(state, { from: { row: 6, col: 5 }, to: { row: 4, col: 5 } });
  assert.deepEqual(state.enPassant, { row: 5, col: 5 });
  const captureMoves = legalMoves(state.board, 4, 4, { enPassantTarget: state.enPassant });
  assert.ok(captureMoves.some(m => m.row === 5 && m.col === 5), 'the passed-over square is a legal capture destination');
  state = makeMove(state, { from: { row: 4, col: 4 }, to: { row: 5, col: 5 } });
  assert.equal(state.board[5][5]?.type, 'P');
  assert.equal(state.board[5][5]?.color, 'black');
  assert.equal(state.board[4][5], null, 'the captured white pawn is removed from its own square, not the destination');
  assert.equal(state.captured.length, 1);
  assert.equal(state.captured[0].type, 'P');
});

test('pawns promote to the requested piece', () => {
  const board = place(emptyBoard(), [
    [1, 2, { type: 'P', color: 'white' }],
    [0, 0, { type: 'K', color: 'black' }],
    [7, 0, { type: 'K', color: 'white' }],
  ]);
  const state = makeMove(stateWithBoard(board, { turn: 'white' }), { from: { row: 1, col: 2 }, to: { row: 0, col: 2 }, promotion: 'N' });
  assert.equal(state.board[0][2]?.type, 'N');
  assert.ok(state.history[0].includes('=N'));
});

test('lone kings plus at most one minor piece each is an insufficient-material draw', () => {
  const board = place(emptyBoard(), [
    [0, 0, { type: 'K', color: 'black' }],
    [7, 9, { type: 'K', color: 'white' }],
    [4, 4, { type: 'N', color: 'white' }],
    [7, 8, { type: 'P', color: 'white' }],
  ]);
  const withPawn = makeMove(stateWithBoard(board, { turn: 'white' }), { from: { row: 7, col: 8 }, to: { row: 6, col: 8 } });
  assert.notEqual(withPawn.status, 'draw_material');

  const bare = place(emptyBoard(), [
    [0, 0, { type: 'K', color: 'black' }],
    [7, 9, { type: 'K', color: 'white' }],
    [4, 4, { type: 'N', color: 'white' }],
    [3, 3, { type: 'N', color: 'black', moved: true }],
  ]);
  const state = makeMove(stateWithBoard(bare, { turn: 'black' }), { from: { row: 3, col: 3 }, to: { row: 5, col: 4 } });
  assert.equal(state.status, 'draw_material');
});

test('threefold repetition is declared a draw', () => {
  // Rooks sit off the kings' shuffle files/ranks so they never interfere with check,
  // but keep enough material on the board that this isn't also an insufficient-material draw.
  const board = place(emptyBoard(), [
    [0, 0, { type: 'K', color: 'black' }],
    [3, 5, { type: 'R', color: 'black' }],
    [7, 9, { type: 'K', color: 'white' }],
    [5, 4, { type: 'R', color: 'white' }],
  ]);
  let state = stateWithBoard(board, { turn: 'white' });
  const cycle: Array<[[number, number], [number, number]]> = [
    [[7, 9], [7, 8]], [[0, 0], [0, 1]],
    [[7, 8], [7, 9]], [[0, 1], [0, 0]],
  ];
  for (let i = 0; i < 4 && state.status === 'active'; i++) {
    for (const [from, to] of cycle) {
      if (state.status !== 'active') break;
      state = makeMove(state, { from: { row: from[0], col: from[1] }, to: { row: to[0], col: to[1] } });
    }
  }
  assert.equal(state.status, 'draw_repetition');
});

test('the 50-move rule ends the game as a draw', () => {
  const board = place(emptyBoard(), [
    [0, 0, { type: 'K', color: 'black' }],
    [7, 9, { type: 'K', color: 'white' }],
  ]);
  let state = stateWithBoard(board, { turn: 'white', halfmoveClock: 99 });
  state = makeMove(state, { from: { row: 7, col: 9 }, to: { row: 7, col: 8 } });
  assert.equal(state.status, 'draw_fifty');
});

test('a pinned piece may only move along the pin line', () => {
  const board = place(emptyBoard(), [
    [7, 5, { type: 'K', color: 'white' }],
    [5, 5, { type: 'R', color: 'white' }],
    [0, 5, { type: 'R', color: 'black' }],
    [0, 9, { type: 'K', color: 'black' }],
  ]);
  const moves = legalMoves(board, 5, 5);
  assert.ok(moves.length > 0, 'the rook still has moves along the pin');
  assert.ok(moves.every(m => m.col === 5), 'moving off the file would expose the king');
});

test('Elo rating math stays within bounds and rewards upsets', () => {
  const win = calculateRating({ value: INITIAL_RATING, gamesPlayed: 40 }, INITIAL_RATING + 400, 'win');
  assert.ok(win.change > 15, 'beating a much higher-rated opponent gains more than the baseline K-factor half-share');
  const loss = calculateRating({ value: INITIAL_RATING, gamesPlayed: 40 }, INITIAL_RATING - 400, 'loss');
  assert.ok(loss.change < 0);
  assert.ok(expectedScore(2000, 2000) === 0.5);
});
