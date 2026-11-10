import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresStore } from '../shared/postgres';

// Runs only when a disposable database is provided, e.g.
// TEST_DATABASE_URL=postgresql://postgres@localhost:5432/shiftchess_test npm test
const url = process.env.TEST_DATABASE_URL;

test('Postgres store: accounts, sessions, settlement, purchases and deletion', { skip: !url && 'TEST_DATABASE_URL not set' }, async t => {
  const store = new PostgresStore(url!);
  t.after(() => store.close());
  await store.pool.query('DROP TABLE IF EXISTS password_resets, purchases, games, sessions, users CASCADE');
  await Promise.all([store.migrate(), store.migrate()]); // concurrent services starting together
  await store.migrate();

  const a = await store.createAccount('Alice', 'hash-a');
  assert.notEqual(a, 'taken');
  assert.equal(await store.createAccount('ALICE', 'hash-x'), 'taken');
  const b = await store.createAccount('bob', 'hash-b');
  if (typeof a === 'string' || typeof b === 'string') throw new Error('unexpected');
  assert.equal((await store.findAccountByUsername('alice'))!.id, a.id);
  assert.equal(await store.findAccountById('not-a-uuid'), null);

  await store.createSession(a.id, 'digest-a', Date.now() + 60_000);
  await store.createSession(a.id, 'digest-old', Date.now() - 1);
  assert.equal((await store.findSession('digest-a', Date.now()))!.username, 'Alice');
  assert.equal(await store.findSession('digest-old', Date.now()), null);

  const settled = await store.settleMatch({ matchId: 'g1', whiteId: a.id, blackId: b.id, outcome: 'white', reason: 'checkmate', moves: ['e3'] });
  assert.deepEqual(settled, { white: { before: 1200, after: 1220 }, black: { before: 1200, after: 1180 } });
  assert.equal(await store.settleMatch({ matchId: 'g1', whiteId: a.id, blackId: b.id, outcome: 'black', reason: 'x', moves: [] }), 'duplicate');
  // Concurrent settlements of different games for the same players do not deadlock or lose updates.
  await Promise.all(Array.from({ length: 10 }, (_, i) => store.settleMatch({
    matchId: `c${i}`, whiteId: i % 2 ? a.id : b.id, blackId: i % 2 ? b.id : a.id, outcome: 'draw', reason: 'stalemate', moves: [],
  })));
  const profile = (await store.profile(a.id))!;
  assert.equal(profile.gamesPlayed, 11);
  assert.equal(profile.wins, 1);
  assert.equal(profile.draws, 10);
  assert.deepEqual((await store.leaderboard(10)).map(p => p.username), ['Alice', 'bob']);

  await store.recordPurchase(a.id, { platform: 'ios', productId: 'remove_ads', transactionId: '1000' });
  await store.recordPurchase(b.id, { platform: 'ios', productId: 'remove_ads', transactionId: '1000' }); // first owner keeps it
  assert.deepEqual(await store.ownedProducts(a.id), ['remove_ads']);
  assert.deepEqual(await store.ownedProducts(b.id), []);

  // v2: optional unique email, recovery hash and single-use reset links.
  const c = await store.createAccount('carol', 'hash-c', { email: 'Carol@Example.com', recoveryHash: 'r1' });
  if (typeof c === 'string') throw new Error('unexpected');
  assert.equal(c.email, 'carol@example.com');
  assert.equal(c.recoveryHash, 'r1');
  assert.equal(await store.createAccount('dave', 'hash-d', { email: 'CAROL@example.com', recoveryHash: 'r2' }), 'email_taken');
  assert.equal((await store.findAccountByEmail('carol@EXAMPLE.com'))!.id, c.id);
  assert.equal(await store.setEmail(a.id, 'carol@example.com'), 'email_taken');
  assert.equal(await store.setEmail(a.id, 'alice@example.com'), 'ok');
  await store.setRecoveryHash(c.id, 'r3');
  assert.equal((await store.findAccountById(c.id))!.recoveryHash, 'r3');
  await store.createPasswordReset(c.id, 'reset-1', Date.now() + 60_000);
  await store.createPasswordReset(c.id, 'reset-2', Date.now() + 60_000); // replaces reset-1
  assert.equal(await store.findPasswordReset('reset-1', Date.now()), null);
  assert.equal(await store.findPasswordReset('reset-2', Date.now()), c.id);
  const consumed = await Promise.all([store.consumePasswordReset('reset-2', Date.now()), store.consumePasswordReset('reset-2', Date.now())]);
  assert.deepEqual(consumed.filter(Boolean), [c.id], 'a link can only be used once, even concurrently');
  await store.createPasswordReset(c.id, 'reset-old', Date.now() - 1);
  assert.equal(await store.consumePasswordReset('reset-old', Date.now()), null);

  await store.deleteAccount(a.id);
  assert.equal(await store.findSession('digest-a', Date.now()), null);
  assert.equal(await store.profile(a.id), null);
  const game = await store.pool.query('SELECT white_id, black_id FROM games WHERE id = $1', ['g1']);
  assert.deepEqual(game.rows[0], { white_id: null, black_id: b.id });
});
