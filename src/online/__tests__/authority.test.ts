import assert from 'node:assert/strict';
import test from 'node:test';
import { OnlineAuthority } from '../OnlineAuthority';
import {
  MatchSnapshot, OnlineCommand, OnlineError, OnlineErrorCode,
  OnlineState, ONLINE_QUEUE_ID, QUEUE_LEASE_MS, parseOnlineCommand,
} from '../protocol';

const alice = { id: 'alice', displayName: 'Alice' };
const bob = { id: 'bob', displayName: 'Bob' };
const eve = { id: 'eve', displayName: 'Eve' };
const join = (ticket: string): OnlineCommand => ({ version: 1, type: 'queue.join', ticket });
const cancel = (ticket: string): OnlineCommand => ({ version: 1, type: 'queue.cancel', ticket });
const sync = (matchId?: string): OnlineCommand => ({ version: 1, type: 'sync', ...(matchId ? { matchId } : {}) });
function match(state: OnlineState): MatchSnapshot {
  assert.equal(state.status, 'matched');
  if (state.status !== 'matched') throw new Error('Expected match');
  return state.match;
}
function error(code: OnlineErrorCode, run: () => unknown) {
  assert.throws(run, (err: unknown) => err instanceof OnlineError && err.code === code);
}
function setup(options: ConstructorParameters<typeof OnlineAuthority>[0] = {}) {
  let now = 0;
  const authority = new OnlineAuthority({ now: () => now, random: () => 0, ...options });
  return { authority, at: (value: number) => { now = value; } };
}
function pair(authority: OnlineAuthority, a = alice, b = bob, ticket = 'first') {
  assert.equal(authority.handle(a, join(ticket)).status, 'queued');
  return match(authority.handle(b, join(ticket)));
}
function move(matchId: string, expectedRevision = 0, requestId = 'move-1', black = false): OnlineCommand {
  return { version: 1, type: 'move', matchId, expectedRevision, requestId,
    move: { from: { row: black ? 1 : 6, col: 4 }, to: { row: black ? 3 : 4, col: 4 } } };
}
function resign(matchId: string, expectedRevision = 0, requestId = 'resign-1'): OnlineCommand {
  return { version: 1, type: 'resign', matchId, expectedRevision, requestId };
}

test('single free FIFO human 3+2 queue never pairs the same identity', () => {
  const { authority } = setup();
  assert.equal(authority.handle(alice, join('a')).status, 'queued');
  assert.equal(authority.handle({ ...alice, displayName: 'Other tab' }, join('a')).status, 'queued');
  error('already_queued', () => authority.handle(alice, join('b')));
  const b = match(authority.handle(bob, join('b')));
  const a = match(authority.handle(alice, sync()));
  assert.equal(a.matchId, b.matchId);
  assert.equal(a.playerColor, 'white');
  assert.equal(b.playerColor, 'black');
  assert.equal(b.opponentName, 'Alice');
  assert.equal(a.queueId, ONLINE_QUEUE_ID);
  assert.equal(a.rated, false);
  assert.equal(a.timeControl.initialMs, 180_000);
  assert.equal(a.timeControl.incrementMs, 2_000);
  assert.equal(a.game.board[0].length, 10);
  assert.equal(authority.handle(eve, join('e')).status, 'queued');
  assert.equal(match(authority.handle(alice, join('new'))).matchId, a.matchId);
});

test('randomized colors do not follow arrival order', () => {
  const { authority } = setup({ random: () => 0.99 });
  assert.equal(pair(authority).playerColor, 'white');
  assert.equal(match(authority.handle(alice, sync())).playerColor, 'black');
});

test('queued time does not debit clocks and exact server elapsed time is used with +2 increment', () => {
  const { authority, at } = setup();
  authority.handle(alice, join('a'));
  at(10_000);
  const initial = match(authority.handle(bob, join('b')));
  assert.equal(initial.clock.whiteMs, 180_000);
  at(11_500);
  const first = match(authority.handle(alice, move(initial.matchId)));
  assert.equal(first.clock.whiteMs, 180_500);
  assert.equal(first.clock.blackMs, 180_000);
  assert.equal(first.clock.active, 'black');
  assert.equal(first.revision, 1);
  assert.equal(first.game.board[4][4]?.color, 'white');
  at(14_000);
  const second = match(authority.handle(bob, move(initial.matchId, 1, 'black-move', true)));
  assert.equal(second.clock.whiteMs, 180_500);
  assert.equal(second.clock.blackMs, 179_500);
  assert.equal(second.revision, 2);
});

test('wrong-turn, stale, illegal and premature-promotion moves never change the board or award increment', () => {
  const { authority, at } = setup();
  const initial = pair(authority);
  at(1_000);
  error('not_your_turn', () => authority.handle(bob, move(initial.matchId)));
  error('stale_revision', () => authority.handle(alice, move(initial.matchId, 9)));
  const illegal = move(initial.matchId);
  assert.equal(illegal.type, 'move');
  if (illegal.type !== 'move') return;
  illegal.move.to.row = 2;
  error('illegal_move', () => authority.handle(alice, illegal));
  illegal.move.to.row = 4;
  illegal.move.promotion = 'Q';
  error('illegal_move', () => authority.handle(alice, illegal));
  const after = match(authority.handle(alice, sync()));
  assert.deepEqual(after.game, initial.game);
  assert.equal(after.clock.whiteMs, 179_000);
  assert.equal(after.revision, 0);
});

test('timeout wins at the exact deadline before a late move or resignation', () => {
  const { authority, at } = setup();
  const initial = pair(authority);
  at(180_000);
  error('game_over', () => authority.handle(alice, move(initial.matchId)));
  error('game_over', () => authority.handle(bob, resign(initial.matchId, 1)));
  const after = match(authority.handle(bob, sync()));
  assert.equal(after.game.status, 'timeout');
  assert.equal(after.game.winner, 'black');
  assert.equal(after.clock.whiteMs, 0);
  assert.equal(after.clock.running, false);
  assert.equal(after.revision, 1);
  assert.deepEqual(after.game.board, initial.game.board);
  at(200_000);
  authority.tick();
  assert.equal(match(authority.handle(bob, sync())).revision, 1);
});

test('timer settles a match without traffic, and sync only debits active clock without revising position', () => {
  const { authority, at } = setup();
  pair(authority);
  at(5_000);
  authority.tick();
  const state = match(authority.handle(alice, sync()));
  assert.equal(state.revision, 0);
  assert.equal(state.clock.whiteMs, 175_000);
  at(180_001);
  authority.tick();
  assert.equal(match(authority.handle(alice, sync())).game.status, 'timeout');
});

test('a move immediately before the deadline remains valid and earns increment', () => {
  const { authority, at } = setup();
  const initial = pair(authority);
  at(179_999);
  const state = match(authority.handle(alice, move(initial.matchId)));
  assert.equal(state.clock.whiteMs, 2_001);
  assert.equal(state.game.status, 'active');
});

test('resigning always resigns authenticated owner, even off-turn, and freezes clocks', () => {
  const { authority, at } = setup();
  const initial = pair(authority);
  at(1_000);
  const after = match(authority.handle(bob, resign(initial.matchId)));
  assert.equal(after.game.status, 'resigned');
  assert.equal(after.game.winner, 'white');
  assert.equal(after.clock.running, false);
  at(200_000);
  assert.deepEqual(match(authority.handle(alice, sync())).clock, after.clock);
});

test('match existence is hidden from outsiders for sync, move and resign', () => {
  const { authority } = setup();
  const initial = pair(authority);
  for (const id of [initial.matchId, 'missing']) {
    for (const cmd of [sync(id), move(id), resign(id)]) {
      error('match_not_found', () => authority.handle(eve, cmd));
    }
  }
  assert.equal(match(authority.handle(alice, sync())).revision, 0);
});

test('accepted request retries return current state without replay or duplicate increment', () => {
  const { authority, at } = setup();
  const initial = pair(authority);
  const command = move(initial.matchId);
  at(1_000);
  authority.handle(alice, command);
  at(2_000);
  const retry = match(authority.handle(alice, command));
  assert.equal(retry.revision, 1);
  assert.equal(retry.game.history.length, 1);
  assert.equal(retry.clock.whiteMs, 181_000);
  assert.equal(retry.clock.blackMs, 179_000);
  authority.handle(bob, move(initial.matchId, 1, 'reply', true));
  assert.equal(match(authority.handle(alice, command)).revision, 2);
  authority.handle(bob, resign(initial.matchId, 2));
  assert.equal(match(authority.handle(alice, command)).game.status, 'resigned');
});

test('request signatures are canonical, conflict on changed intent, and are scoped to player', () => {
  const { authority } = setup();
  const initial = pair(authority);
  const cmd = move(initial.matchId, 0, 'same-id');
  authority.handle(alice, cmd);
  // Object key order from a different serializer must not turn a retry into a conflict.
  const reordered = Object.fromEntries(Object.entries(cmd).reverse());
  assert.equal(match(authority.handle(alice, reordered)).revision, 1);
  error('request_conflict', () => authority.handle(alice, move(initial.matchId, 1, 'same-id')));
  error('request_conflict', () => authority.handle(alice, resign(initial.matchId, 1, 'same-id')));
  assert.equal(match(authority.handle(bob, move(initial.matchId, 1, 'same-id', true))).revision, 2);
});

test('rejected requests do not consume IDs, but successful resignation retries stay idempotent', () => {
  const { authority } = setup();
  const initial = pair(authority);
  error('stale_revision', () => authority.handle(alice, resign(initial.matchId, 99)));
  const command = resign(initial.matchId);
  authority.handle(alice, command);
  assert.equal(match(authority.handle(alice, command)).revision, 1);
  error('game_over', () => authority.handle(alice, resign(initial.matchId, 1, 'different')));
});

test('cancel before join wins, duplicate cancel is harmless, and tickets are scoped to identity', () => {
  const { authority } = setup();
  assert.equal(authority.handle(alice, cancel('a')).status, 'idle');
  assert.equal(authority.handle(alice, cancel('a')).status, 'idle');
  error('ticket_used', () => authority.handle(alice, join('a')));
  assert.equal(authority.handle(bob, join('a')).status, 'queued');
  assert.equal(authority.handle(alice, join('new')).status, 'matched');
});

test('cancel after pairing returns the live match without abandoning or resigning', () => {
  const { authority } = setup();
  const initial = pair(authority);
  const state = match(authority.handle(alice, cancel('first')));
  assert.equal(state.matchId, initial.matchId);
  assert.equal(state.game.status, 'active');
  assert.equal(state.revision, 0);
});

test('stale cancel cannot cancel a newer search; cancelled search cannot be resurrected', () => {
  const { authority } = setup();
  authority.handle(alice, join('old'));
  authority.handle(alice, cancel('old'));
  authority.handle(alice, join('new'));
  const state = authority.handle(alice, cancel('old'));
  assert.equal(state.status, 'queued');
  if (state.status === 'queued') assert.equal(state.ticket, 'new');
  authority.handle(alice, cancel('new'));
  error('ticket_used', () => authority.handle(alice, join('old')));
  error('ticket_used', () => authority.handle(alice, join('new')));
});

test('queue expires at lease boundary, cannot pair a ghost, and expires consumed tickets', () => {
  const { authority, at } = setup();
  authority.handle(alice, join('a'));
  at(QUEUE_LEASE_MS);
  assert.equal(authority.handle(bob, join('b')).status, 'queued');
  assert.equal(authority.handle(alice, sync()).status, 'idle');
  error('ticket_used', () => authority.handle(alice, join('a')));
  assert.equal(authority.handle(alice, join('fresh')).status, 'matched');
});

test('only matching-ticket sync or duplicate join renews queue lease', () => {
  const { authority, at } = setup();
  authority.handle(alice, join('a'));
  at(20_000);
  authority.handle(alice, { version: 1, type: 'sync', ticket: 'wrong' });
  authority.handle(alice, sync());
  at(29_000);
  const renewed = authority.handle(alice, { version: 1, type: 'sync', ticket: 'a' });
  assert.equal(renewed.status, 'queued');
  if (renewed.status === 'queued') assert.equal(renewed.expiresAt, 59_000);
  at(58_000);
  authority.handle(alice, join('a'));
  at(87_999);
  assert.equal(authority.handle(alice, sync()).status, 'queued');
  at(88_000);
  assert.equal(authority.handle(alice, sync()).status, 'idle');
});

test('replay after finish requires fresh queue tickets and old match does not replace new match', () => {
  const { authority } = setup();
  const old = pair(authority);
  const oldCommand = resign(old.matchId);
  authority.handle(alice, oldCommand);
  error('ticket_used', () => authority.handle(alice, join('first')));
  const next = pair(authority, alice, bob, 'second');
  assert.notEqual(next.matchId, old.matchId);
  assert.equal(match(authority.handle(alice, oldCommand)).matchId, old.matchId);
  assert.equal(match(authority.handle(alice, sync())).matchId, next.matchId);
});

test('finished match retention cleanup preserves a newer live match and consumed tickets', () => {
  const { authority, at } = setup();
  const old = pair(authority);
  authority.handle(alice, resign(old.matchId));
  at(3_590_000);
  const next = pair(authority, alice, bob, 'second');
  at(3_600_000);
  authority.tick();
  error('match_not_found', () => authority.handle(alice, sync(old.matchId)));
  assert.equal(match(authority.handle(alice, sync())).matchId, next.matchId);
  authority.handle(alice, resign(next.matchId));
  error('ticket_used', () => authority.handle(alice, join('first')));
});

test('snapshots and authenticated identities are defensively copied', () => {
  const { authority } = setup();
  const identity = { ...alice };
  authority.handle(identity, join('a'));
  identity.id = 'changed';
  identity.displayName = 'Changed';
  const state = match(authority.handle(bob, join('b')));
  assert.equal(state.opponentName, 'Alice');
  state.game.board[0][0] = null;
  state.game.history.push('forged');
  state.game.positionCounts.forged = 999;
  state.clock.whiteMs = 999_999;
  state.timeControl.incrementMs = 999;
  const fresh = match(authority.handle(alice, sync()));
  assert.equal(fresh.game.board[0][0]?.type, 'R');
  assert.equal(fresh.game.history.length, 0);
  assert.equal(fresh.game.positionCounts.forged, undefined);
  assert.equal(fresh.clock.whiteMs, 180_000);
  assert.equal(fresh.timeControl.incrementMs, 2_000);
});

test('clock rollback never refunds time and invalid clocks fail before mutation', () => {
  const { authority, at } = setup();
  pair(authority);
  at(5_000);
  authority.tick();
  at(2_000);
  assert.equal(match(authority.handle(alice, sync())).clock.whiteMs, 175_000);
  for (const value of [NaN, Infinity, -1]) {
    at(value);
    assert.throws(() => authority.handle(alice, sync()), /Invalid server clock/);
  }
  at(6_000);
  assert.equal(match(authority.handle(alice, sync())).clock.whiteMs, 174_000);
});

test('invalid identity never joins the queue', () => {
  const { authority } = setup();
  for (const identity of [null, { id: '', displayName: 'X' }, { id: ' ', displayName: 'X' },
    { id: 'a'.repeat(257), displayName: 'X' }, { id: 'a', displayName: '' },
    { id: 'a', displayName: 'x'.repeat(81) }]) {
    error('unauthenticated', () => authority.handle(identity, join('a')));
  }
  assert.equal(authority.handle(bob, join('b')).status, 'queued');
});

test('protocol rejects forged server state, unsafe coordinates and unsupported fields', () => {
  const valid = move('match-1');
  const malformed: unknown[] = [
    null, [], {}, { version: 2, type: 'sync' }, { version: 1, type: 'unknown' },
    { ...join('ok'), premium: true }, join(''), join('with space'), join('a'.repeat(129)),
    { ...valid, playerId: 'alice' }, { ...valid, expectedRevision: -1 },
    { ...valid, expectedRevision: 0.5 }, { ...valid, expectedRevision: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, requestId: '../oops' }, { ...sync(), matchId: 12 },
    { ...resign('m'), color: 'black' },
  ];
  for (const row of [-1, 8, NaN, Infinity, 0.5, '6']) {
    malformed.push({ ...valid, move: { from: { row, col: 4 }, to: { row: 4, col: 4 } } });
  }
  for (const col of [-1, 10, '4', 0.5]) {
    malformed.push({ ...valid, move: { from: { row: 6, col }, to: { row: 4, col: 4 } } });
  }
  for (const extra of [{ shift: true }, { captured: { type: 'Q', color: 'black' } }, { promotion: 'K' }]) {
    malformed.push({ ...valid, move: { from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, ...extra } });
  }
  for (const command of malformed) error('invalid_command', () => parseOnlineCommand(command));
  assert.deepEqual(parseOnlineCommand(valid), valid);
});

test('invalid match ID generator leaves pending search intact and retry safe', () => {
  let id = 'bad id';
  const { authority } = setup({ matchId: () => id });
  authority.handle(alice, join('a'));
  assert.throws(() => authority.handle(bob, join('b')), /unique valid identifier/);
  assert.equal(authority.handle(alice, sync()).status, 'queued');
  id = 'valid-id';
  assert.equal(match(authority.handle(bob, join('b'))).matchId, id);
});

test('ticket hard cap preserves cancellation tombstones and existing retries', () => {
  const { authority } = setup({ limits: { tickets: 2 } });
  authority.handle(alice, cancel('old'));
  authority.handle(bob, join('b'));
  error('capacity', () => authority.handle(alice, join('fresh')));
  error('capacity', () => authority.handle(eve, cancel('unseen')));
  assert.equal(authority.handle(bob, join('b')).status, 'queued');
  assert.equal(authority.handle(bob, cancel('b')).status, 'idle');
  assert.equal(authority.handle(alice, cancel('old')).status, 'idle');
  error('ticket_used', () => authority.handle(alice, join('old')));
});

test('match hard cap rejects new matches until retained results expire without consuming new tickets', () => {
  const { authority, at } = setup({ limits: { matches: 1 } });
  const first = pair(authority);
  error('capacity', () => authority.handle(eve, join('e')));
  assert.equal(match(authority.handle(alice, join('first'))).matchId, first.matchId);
  authority.handle(alice, resign(first.matchId));
  at(3_600_000);
  assert.equal(authority.handle(eve, join('e')).status, 'queued');
  assert.equal(authority.handle(alice, sync()).status, 'idle');
});

test('receipt hard cap preserves retries and reserves terminal resignation', () => {
  const { authority } = setup({ limits: { requestsPerMatch: 1 } });
  const initial = pair(authority);
  const command = move(initial.matchId);
  authority.handle(alice, command);
  error('capacity', () => authority.handle(bob, move(initial.matchId, 1, 'black', true)));
  assert.equal(match(authority.handle(alice, command)).revision, 1);
  const resignation = resign(initial.matchId, 1);
  assert.equal(match(authority.handle(bob, resignation)).game.status, 'resigned');
  assert.equal(match(authority.handle(bob, resignation)).revision, 2);
});

test('invalid admission limits fail immediately', () => {
  for (const limit of [0, -1, NaN, Infinity, 1.1]) {
    assert.throws(() => new OnlineAuthority({ limits: { tickets: limit } }), /positive safe integers/);
  }
});

test('failed ticket admission does not discard the player’s finished result', () => {
  const { authority } = setup({ limits: { tickets: 2 } });
  const first = pair(authority);
  authority.handle(alice, resign(first.matchId));
  error('capacity', () => authority.handle(alice, join('new')));
  assert.equal(match(authority.handle(alice, sync())).matchId, first.matchId);
});

test('failed pairing admission leaves the waiting player available and unmodified', () => {
  const { authority } = setup({ limits: { tickets: 1 } });
  authority.handle(alice, join('a'));
  error('capacity', () => authority.handle(bob, join('b')));
  assert.equal(authority.handle(alice, sync()).status, 'queued');
  assert.equal(authority.handle(bob, sync()).status, 'idle');
  assert.equal(authority.handle(alice, cancel('a')).status, 'idle');
});
