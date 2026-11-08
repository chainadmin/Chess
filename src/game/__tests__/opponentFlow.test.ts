import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board, ROWS, COLS } from '../board';
import { allLegalMoves } from '../legalMoves';
import { GameState, createGameState, makeMove, resign } from '../gameState';
import { canPlayerMove, confirmResignRequest, createResignRequest, createSession, OpponentTurnScheduler, playSessionMove, resignSession, ScheduleTimer, tickSession } from '../opponentFlow';
import { Color, Move, Piece } from '../pieces';
import { TIME_CONTROLS } from '../timers';
import { Match, MockMultiplayerService, QueueCancelledError } from '../../services/multiplayer/MultiplayerService';

class FakeTimers {
  jobs: Array<{ run: () => void; cancelled: boolean }> = [];
  schedule: ScheduleTimer = run => {
    const job = { run, cancelled: false };
    this.jobs.push(job);
    return () => { job.cancelled = true; };
  };
  // Intentionally fire even cancelled jobs to model a callback already in the queue.
  fire(index = this.jobs.length - 1) { this.jobs[index]?.run(); }
}

const whiteOpening: Move = { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } };
const blackOpening: Move = { from: { row: 1, col: 4 }, to: { row: 3, col: 4 } };
const matchFor = (color: Color): Match => ({ matchId: `test-${color}`, mode: 'mock-online', playerColor: color, opponentName: 'Demo', opponentRating: 1200, timeControl: TIME_CONTROLS.bullet_1_1 });

test('player and opponent ownership is enforced with exactly one clock increment per legal move', () => {
  const session = createSession(TIME_CONTROLS.bullet_1_1);
  assert.equal(canPlayerMove(session.game, 'white'), true);
  assert.equal(canPlayerMove(session.game, 'black'), false);
  assert.equal(playSessionMove(session, whiteOpening, 'opponent', 'white'), session);
  const played = playSessionMove(session, whiteOpening, 'player', 'white');
  assert.equal(played.clock.whiteMs, 61000);
  assert.equal(played.clock.blackMs, 60000);
  assert.equal(played.clock.active, 'black');
  assert.equal(playSessionMove(played, blackOpening, 'player', 'white'), played);
  assert.equal(playSessionMove(played, whiteOpening, 'opponent', 'white'), played);
  const reply = playSessionMove(played, blackOpening, 'opponent', 'white');
  assert.equal(reply.clock.blackMs, 61000);
  assert.equal(reply.clock.active, 'white');
  assert.equal(playSessionMove(reply, blackOpening, 'opponent', 'white'), reply);
});

test('pass-and-play permits either human side and never permits an automatic opponent', () => {
  const initial = createSession(TIME_CONTROLS.blitz_3_0);
  const white = playSessionMove(initial, whiteOpening, 'player');
  assert.notEqual(playSessionMove(white, blackOpening, 'player'), white);
  assert.equal(playSessionMove(white, blackOpening, 'opponent'), white);
});

test('resignation belongs to the human even during the opponent turn and ends both clocks', () => {
  const initial = createSession(TIME_CONTROLS.bullet_1_1);
  const afterWhite = playSessionMove(initial, whiteOpening, 'player', 'white');
  const resigned = resignSession(afterWhite, 'white');
  assert.equal(resigned.game.winner, 'black');
  assert.equal(resigned.clock.running, false);
  assert.equal(resignSession(initial, 'black').game.winner, 'white', 'a human assigned Black may resign before the opening');
  assert.equal(playSessionMove(resigned, blackOpening, 'opponent', 'white'), resigned);
  assert.equal(tickSession(resigned, 1000), resigned);
  assert.equal(resignSession(resigned, 'black'), resigned);
});

test('a clock flag ends the game atomically before a queued opponent move can apply', () => {
  const session = createSession(TIME_CONTROLS.bullet_1_1);
  const expired = tickSession(session, 60000);
  assert.equal(expired.game.status, 'timeout');
  assert.equal(expired.game.winner, 'black');
  assert.equal(expired.clock.running, false);
  assert.equal(playSessionMove(expired, whiteOpening, 'opponent', 'black'), expired);
});

test('opponent scheduling refuses human turns, completed games and no-move positions', () => {
  const timers = new FakeTimers();
  const scheduler = new OpponentTurnScheduler(timers.schedule);
  let emitted = 0;
  const schedule = (state: GameState, chooseMove: () => Move | null = () => whiteOpening) => scheduler.scheduleTurn({ state, color: 'white', delayMs: 0, chooseMove, isCurrent: () => true, onMove: () => emitted++ });
  schedule({ ...createGameState(), turn: 'black' });
  schedule(resign(createGameState(), 'black'));
  assert.equal(timers.jobs.length, 0);
  schedule(createGameState(), () => null);
  timers.fire();
  assert.equal(emitted, 0);
});

test('reset, resignation, stale snapshots and navigation cancellation invalidate queued callbacks', () => {
  for (const interruption of ['reset', 'resign', 'navigate'] as const) {
    const timers = new FakeTimers();
    const scheduler = new OpponentTurnScheduler(timers.schedule);
    const scheduled = createGameState();
    let current = scheduled;
    let searches = 0;
    let emitted = 0;
    scheduler.scheduleTurn({ state: scheduled, color: 'white', delayMs: 450, chooseMove: () => { searches++; return whiteOpening; }, isCurrent: () => current === scheduled, onMove: () => emitted++ });
    if (interruption === 'reset') current = createGameState();
    if (interruption === 'resign') current = resign(current, 'black');
    if (interruption === 'navigate') scheduler.cancel();
    timers.fire();
    assert.equal(emitted, 0, interruption);
    assert.equal(searches, 0, interruption);
  }
});

test('replacing an opponent request emits only the current move and consumes it exactly once', () => {
  const timers = new FakeTimers();
  const scheduler = new OpponentTurnScheduler(timers.schedule);
  const state = createGameState();
  let emitted = 0;
  const options = { state, color: 'white' as const, delayMs: 0, chooseMove: () => whiteOpening, isCurrent: () => true, onMove: () => emitted++ };
  scheduler.scheduleTurn(options);
  scheduler.scheduleTurn(options);
  timers.fire(0);
  assert.equal(emitted, 0);
  timers.fire(1);
  timers.fire(1);
  assert.equal(emitted, 1);
});

test('a mock match assigned Black receives the White opening without sending a move first', () => {
  const timers = new FakeTimers();
  const service = new MockMultiplayerService(timers.schedule, () => 0);
  const initial = createGameState();
  let next = initial;
  service.onOpponentMove((move, expectedState) => { assert.equal(expectedState, initial); next = makeMove(expectedState, move); });
  service.startMatch(matchFor('black'), initial);
  timers.fire();
  assert.equal(next.turn, 'black');
  assert.equal(next.history.length, 1);
  service.updateGame(next);
  assert.equal(timers.jobs.length, 1, 'does not also play the human side');
});

test('mock replies carry current rule context and stop on completion, resignation or disconnect', async () => {
  for (const end of ['completed', 'resigned', 'disconnected'] as const) {
    const timers = new FakeTimers();
    const service = new MockMultiplayerService(timers.schedule, () => 0);
    let replies = 0;
    service.onOpponentMove(() => replies++);
    service.startMatch(matchFor('white'), createGameState());
    assert.equal(timers.jobs.length, 0);
    const state = makeMove(createGameState(), whiteOpening);
    await service.sendMove(whiteOpening, state);
    assert.equal(timers.jobs.length, 1);
    if (end === 'completed') service.updateGame({ ...state, status: 'draw_repetition' });
    if (end === 'resigned') await service.resign();
    if (end === 'disconnected') await service.disconnect();
    timers.fire();
    assert.equal(replies, 0, end);
  }
});

test('an old mock subscription cannot remove the current listener, and old matches cannot emit', () => {
  const timers = new FakeTimers();
  const service = new MockMultiplayerService(timers.schedule, () => 0);
  let old = 0;
  let current = 0;
  const unsubscribe = service.onOpponentMove(() => old++);
  service.startMatch(matchFor('black'), createGameState());
  service.onOpponentMove(() => current++);
  unsubscribe();
  service.startMatch({ ...matchFor('black'), matchId: 'new-match' }, createGameState());
  timers.fire(0);
  assert.equal(current, 0);
  timers.fire(1);
  assert.equal(old, 0);
  assert.equal(current, 1);
});

test('cancelled or replaced matchmaking cannot resolve from a queued timer', async () => {
  const timers = new FakeTimers();
  const service = new MockMultiplayerService(timers.schedule, () => 0);
  const first = service.joinQueue('blitz_3_0', 1200);
  const rejected = assert.rejects(first, QueueCancelledError);
  const second = service.joinQueue('bullet_1_1', 1200);
  timers.fire(0);
  timers.fire(1);
  await rejected;
  const match = await second;
  assert.equal(match.playerColor, 'black');
  assert.equal(match.timeControl.id, 'bullet_1_1');
  const third = service.joinQueue('blitz_3_0', 1200);
  const cancelled = assert.rejects(third, QueueCancelledError);
  await service.disconnect();
  timers.fire();
  await cancelled;
});

test('resign confirmations retain their original color and cannot affect a reset or finished game', () => {
  const initial = createSession(TIME_CONTROLS.blitz_3_0);
  const request = createResignRequest(initial, 3);
  const afterWhite = playSessionMove(initial, whiteOpening, 'player');
  assert.equal(confirmResignRequest(afterWhite, request, 3).game.winner, 'black');
  assert.equal(confirmResignRequest(afterWhite, request, 4), afterWhite);
  const finished = resignSession(afterWhite, 'black');
  assert.equal(confirmResignRequest(finished, request, 3), finished);
});

test('the mock transport preserves en passant when it is the only legal reply', () => {
  const board: Board = Array.from({ length: ROWS }, () => Array<Piece | null>(COLS).fill(null));
  board[3][4] = { type: 'K', color: 'black', moved: true };
  board[4][4] = { type: 'P', color: 'black' };
  board[4][5] = { type: 'P', color: 'white', moved: true };
  board[1][4] = { type: 'K', color: 'white', moved: true };
  board[7][3] = { type: 'R', color: 'white' };
  board[7][5] = { type: 'R', color: 'white' };
  board[2][6] = { type: 'B', color: 'white' };
  const state: GameState = { ...createGameState(), board, turn: 'black', enPassant: { row: 5, col: 5 } };
  const legal = allLegalMoves(board, 'black', { enPassantTarget: state.enPassant });
  assert.equal(legal.length, 1);
  const timers = new FakeTimers();
  const service = new MockMultiplayerService(timers.schedule, () => 0);
  let result = state;
  service.onOpponentMove((move, expectedState) => { result = makeMove(expectedState, move); });
  service.startMatch(matchFor('white'), state);
  timers.fire();
  assert.equal(result.board[4][5], null);
  assert.equal(result.board[5][5]?.color, 'black');
  assert.equal(result.captured[0]?.type, 'P');
});
