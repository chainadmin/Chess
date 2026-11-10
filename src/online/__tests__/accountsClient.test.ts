import test from 'node:test';
import assert from 'node:assert/strict';
import { createOnlineServer } from '../../../server/httpServer';
import { newToken, tokenDigest } from '../../../server/shared/passwords';
import { MemoryStore } from '../../../server/shared/store';
import { OnlineAuthority } from '../OnlineAuthority';
import { OnlineClient } from '../OnlineClient';

const until = async (check: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};

test('account clients play over long-poll and see opponent moves without polling delay', async t => {
  const store = new MemoryStore();
  const app = createOnlineServer({
    port: 0, authority: new OnlineAuthority({ random: () => 0, rated: true }), longPollMaxMs: 5000,
    accounts: { async verify(token) { const a = await store.findSession(tokenDigest(token), Date.now()); return a ? { id: a.id, displayName: a.username } : null; } },
  });
  const { port } = await app.listen();
  t.after(() => app.close());
  const url = `http://127.0.0.1:${port}`;
  const token = async (name: string) => {
    const account = await store.createAccount(name, 'h');
    if (account === 'taken') throw new Error();
    const value = newToken();
    await store.createSession(account.id, tokenDigest(value), Date.now() + 60_000);
    return value;
  };
  const tokens = [await token('white_player'), await token('black_player')];
  // A long pollMs proves updates arrive through the held request, not the poll timer.
  const [a, b] = tokens.map(value => new OnlineClient(url, { getToken: async () => value, longPollMs: 5000, pollMs: 4000 }));
  t.after(() => { a.dispose(); b.dispose(); });
  const offA = a.subscribe(() => undefined), offB = b.subscribe(() => undefined);
  t.after(() => { offA(); offB(); });

  await a.join();
  await b.join();
  await a.sync();
  const matchA = a.getSnapshot().online, matchB = b.getSnapshot().online;
  assert.equal(matchA?.status, 'matched');
  assert.equal(matchB?.status, 'matched');
  const white = matchA?.status === 'matched' && matchA.match.playerColor === 'white' ? a : b;
  const black = white === a ? b : a;
  await new Promise(resolve => setTimeout(resolve, 100)); // let black's long-poll start
  const sent = Date.now();
  await white.move({ from: { row: 6, col: 0 }, to: { row: 5, col: 0 } });
  await until(() => { const s = black.getSnapshot().online; return s?.status === 'matched' && s.match.revision === 1; });
  assert.ok(Date.now() - sent < 1000, `opponent saw the move in ${Date.now() - sent}ms`);
});

test('without a signed-in account the client asks the player to log in', async () => {
  const client = new OnlineClient('http://127.0.0.1:9', { getToken: async () => null });
  await assert.rejects(client.join());
  assert.equal(client.getSnapshot().connection, 'expired');
  assert.match(client.getSnapshot().error ?? '', /Log in/);
  client.reset();
  assert.equal(client.getSnapshot().connection, 'idle');
});

test('the default fetch is called unbound, as browsers require', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let receiver: unknown = 'not called';
  // Browsers throw "Illegal invocation" when fetch runs with a foreign `this`.
  globalThis.fetch = function (this: unknown) {
    receiver = this;
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    return Promise.resolve(new Response(JSON.stringify({ version: 1, serverNow: 1, status: 'idle' })));
  } as typeof fetch;
  const client = new OnlineClient('http://127.0.0.1:9', { getToken: async () => 'x'.repeat(43) });
  const state = await client.sync().then(() => client.join()).catch(error => error);
  assert.notEqual(receiver, 'not called');
  assert.ok(!(state instanceof TypeError), String(state));
  client.dispose();
});
