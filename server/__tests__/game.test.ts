import test from 'node:test';
import assert from 'node:assert/strict';
import { OnlineAuthority } from '../../src/online/OnlineAuthority';
import { createSettler } from '../game/index';
import { createOnlineServer } from '../httpServer';
import { newToken, tokenDigest } from '../shared/passwords';
import { MemoryStore } from '../shared/store';

async function setup(t: test.TestContext) {
  const store = new MemoryStore();
  const settler = createSettler(store, () => undefined);
  const authority = new OnlineAuthority({ random: () => 0, rated: true, onFinished: settler.settle });
  let lookups = 0;
  const app = createOnlineServer({
    port: 0, authority, longPollMaxMs: 2000,
    accounts: {
      async verify(token) {
        lookups++;
        const account = await store.findSession(tokenDigest(token), Date.now());
        return account ? { id: account.id, displayName: account.username } : null;
      },
    },
  });
  const { port } = await app.listen();
  t.after(() => app.close());
  const url = `http://127.0.0.1:${port}`;
  const player = async (username: string) => {
    const account = await store.createAccount(username, 'hash');
    if (account === 'taken') throw new Error('taken');
    const token = newToken();
    await store.createSession(account.id, tokenDigest(token), Date.now() + 60_000);
    return { account, token };
  };
  const command = async (token: string | undefined, body: object) => {
    const response = await fetch(`${url}/command`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ version: 1, ...body }),
    });
    return { status: response.status, body: await response.json() as any };
  };
  return { store, url, player, command, settler, lookups: () => lookups };
}

test('account players match, play rated, and the result is settled into ratings', async t => {
  const { store, url, player, command, settler, lookups } = await setup(t);
  const alice = await player('alice'), bob = await player('bob');
  assert.equal((await fetch(`${url}/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
  assert.equal((await command(undefined, { type: 'sync' })).status, 401);
  assert.equal((await command(newToken(), { type: 'sync' })).status, 401);

  assert.equal((await command(alice.token, { type: 'queue.join', ticket: 'a' })).body.status, 'queued');
  const paired = await command(bob.token, { type: 'queue.join', ticket: 'b' });
  assert.equal(paired.body.status, 'matched');
  assert.equal(paired.body.match.rated, true);
  assert.equal(paired.body.match.opponentName, 'alice');
  const matchId = paired.body.match.matchId;
  const white = paired.body.match.playerColor === 'white' ? bob : alice;
  const black = white === bob ? alice : bob;
  // Identity lookups are cached: repeated polling does not hit the database.
  for (let i = 0; i < 5; i++) await command(alice.token, { type: 'sync', matchId });
  assert.equal(lookups(), 3); // forged token, alice, bob

  const resigned = await command(black.token, { type: 'resign', requestId: 'r1', matchId, expectedRevision: 0 });
  assert.notEqual(resigned.body.match.game.status, 'active');
  for (let i = 0; i < 20 && settler.pending.size; i++) await new Promise(resolve => setTimeout(resolve, 10));
  const winner = await store.profile(white.account.id), loser = await store.profile(black.account.id);
  assert.equal(winner!.wins, 1);
  assert.equal(loser!.losses, 1);
  assert.ok(winner!.rating > 1200 && loser!.rating < 1200);
});

test('a long-poll sync returns as soon as the opponent moves', async t => {
  const { player, command } = await setup(t);
  const a = await player('first'), b = await player('second');
  await command(a.token, { type: 'queue.join', ticket: 'a' });
  const paired = (await command(b.token, { type: 'queue.join', ticket: 'b' })).body.match;
  const [white, black] = paired.playerColor === 'white' ? [b, a] : [a, b];
  const started = Date.now();
  const waiting = command(black.token, { type: 'sync', matchId: paired.matchId, waitForRevision: 0 });
  await new Promise(resolve => setTimeout(resolve, 150));
  const moved = await command(white.token, { type: 'move', requestId: 'm1', matchId: paired.matchId, expectedRevision: 0, move: { from: { row: 6, col: 0 }, to: { row: 5, col: 0 } } });
  assert.equal(moved.status, 200);
  const result = await waiting;
  assert.equal(result.body.match.revision, 1);
  assert.ok(Date.now() - started < 1500, 'returned before the long-poll timeout');
});

test('a long-poll with no change returns the unchanged state after the wait', async t => {
  const { player, command } = await setup(t);
  const a = await player('third'), b = await player('fourth');
  await command(a.token, { type: 'queue.join', ticket: 'a' });
  const paired = (await command(b.token, { type: 'queue.join', ticket: 'b' })).body.match;
  const started = Date.now();
  const result = await command(b.token, { type: 'sync', matchId: paired.matchId, waitForRevision: 0 });
  assert.equal(result.body.match.revision, 0);
  assert.ok(Date.now() - started >= 1900);
  // Already-stale revisions answer immediately.
  const quick = Date.now();
  await command(b.token, { type: 'sync', matchId: paired.matchId, waitForRevision: 5 });
  assert.ok(Date.now() - quick < 500);
});

test('settlement is idempotent and ratings move by the Elo formula', async () => {
  const store = new MemoryStore();
  const a = await store.createAccount('one', 'h'), b = await store.createAccount('two', 'h');
  if (a === 'taken' || b === 'taken') throw new Error();
  const first = await store.settleMatch({ matchId: 'x', whiteId: a.id, blackId: b.id, outcome: 'draw', reason: 'stalemate', moves: [] });
  assert.deepEqual(first, { white: { before: 1200, after: 1200 }, black: { before: 1200, after: 1200 } });
  assert.equal(await store.settleMatch({ matchId: 'x', whiteId: a.id, blackId: b.id, outcome: 'white', reason: 'checkmate', moves: [] }), 'duplicate');
  assert.equal((await store.profile(a.id))!.draws, 1);
  assert.equal((await store.profile(a.id))!.gamesPlayed, 1);
});
