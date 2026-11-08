import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createOnlineServer, ServerOptions } from '../../../server/httpServer';
import { OnlineAuthority } from '../OnlineAuthority';

async function setup(t: test.TestContext, options: ServerOptions = {}) {
  const app = createOnlineServer({ port: 0, ...options });
  const address = await app.listen();
  t.after(() => app.close());
  const url = `http://127.0.0.1:${address.port}`;
  const post = async (path: string, body: unknown, token?: string, headers: Record<string, string> = {}) => {
    const response = await fetch(`${url}${path}`, { method: 'POST', headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers,
    }, body: JSON.stringify(body) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  const guest = async () => {
    const result = await post('/session', {});
    assert.equal(result.status, 201);
    return result.body as { token: string; player: { id: string; displayName: string }; expiresAt: number };
  };
  return { app, url, post, guest };
}

test('two actual HTTP guests match, move, sync, retry and resign without purchase or local identity', async t => {
  const { post, guest } = await setup(t, { authority: new OnlineAuthority({ random: () => 0 }) });
  const a = await guest(), b = await guest(), outsider = await guest();
  assert.notEqual(a.token, b.token);
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.player.id, b.player.id);
  const command = (token: string, body: object) => post('/command', { version: 1, ...body }, token);
  assert.equal((await command(a.token, { type: 'queue.join', ticket: 'a' })).body.status, 'queued');
  const pairing = await command(b.token, { type: 'queue.join', ticket: 'b' });
  assert.equal(pairing.body.status, 'matched');
  const state = (await command(a.token, { type: 'sync' })).body;
  assert.equal(state.match.playerColor, 'white');
  assert.equal(state.match.rated, false);
  assert.equal(state.match.timeControl.incrementMs, 2000);
  const matchId = state.match.matchId;
  assert.equal((await command(outsider.token, { type: 'sync', matchId })).body.error.code, 'match_not_found');
  const move = { type: 'move', requestId: 'm1', matchId, expectedRevision: 0, move: { from: { row: 6, col: 0 }, to: { row: 5, col: 0 } } };
  assert.equal((await command(b.token, move)).body.error.code, 'not_your_turn');
  const moved = await command(a.token, move);
  assert.equal(moved.status, 200);
  assert.equal(moved.body.match.revision, 1);
  assert.equal((await command(a.token, move)).body.match.revision, 1);
  assert.equal((await command(b.token, { type: 'sync', matchId })).body.match.game.turn, 'black');
  const resign = await command(b.token, { type: 'resign', requestId: 'r1', matchId, expectedRevision: 1 });
  assert.equal(resign.body.match.clock.running, false);
  assert.notEqual(resign.body.match.game.status, 'active');
});

test('requires server credentials and rejects forged identity, board, clock and malformed commands', async t => {
  const { post, guest, url } = await setup(t);
  assert.equal((await post('/command', { version: 1, type: 'sync' })).status, 401);
  assert.equal((await post('/command', { version: 1, type: 'sync' }, 'x'.repeat(43))).status, 401);
  assert.equal((await post('/session', { id: 'local-admin', displayName: 'Admin' })).status, 400);
  const a = await guest();
  for (const field of ['player', 'clock', 'game', 'premium']) {
    const forged = await post('/command', { version: 1, type: 'sync', [field]: {} }, a.token);
    assert.equal(forged.status, 400);
    assert.equal(forged.body.error.code, 'invalid_command');
  }
  const invalid = await fetch(`${url}/command`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}` }, body: '{' });
  assert.equal(invalid.status, 400);
  assert.equal((await post('/session', {}, undefined, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await fetch(`${url}/missing`)).status, 404);
});

test('CORS only reflects exact allowed origins, and permits native requests without Origin', async t => {
  const { url, post } = await setup(t, { allowedOrigins: ['http://localhost:8081'] });
  const allowed = await post('/session', {}, undefined, { Origin: 'http://localhost:8081' });
  assert.equal(allowed.status, 201);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:8081');
  assert.equal(allowed.headers.get('access-control-expose-headers'), 'Retry-After');
  for (const origin of ['null', 'https://evil.example', 'http://localhost:8081.evil.example']) {
    const denied = await post('/session', {}, undefined, { Origin: origin });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  }
  assert.equal((await post('/session', {})).status, 201);
  const preflight = await fetch(`${url}/command`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:8081' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-headers'), 'Authorization, Content-Type');
});

test('enforces body cap on declared and chunked bodies', async t => {
  const { post, url } = await setup(t, { maxBodyBytes: 64 });
  assert.equal((await post('/session', { padding: 'x'.repeat(100) })).status, 413);
  const status = await new Promise<number | undefined>((resolve, reject) => {
    const req = request(`${url}/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    req.on('error', reject); req.write(' '.repeat(100)); req.end('{}');
  });
  assert.equal(status, 413);
});

test('caps sessions, expires credentials and releases capacity', async t => {
  let now = 1000;
  const { guest, post } = await setup(t, { maxSessions: 1, sessionTtlMs: 10, now: () => now });
  const a = await guest();
  assert.equal((await post('/session', {})).status, 503);
  now += 10;
  assert.equal((await post('/command', { version: 1, type: 'sync' }, a.token)).status, 401);
  assert.notEqual((await guest()).token, a.token);
});

test('rate limits requests and guest minting, ignores spoofed forwarded addresses, resets window', async t => {
  let now = 1000;
  const { post } = await setup(t, { requestsPerMinute: 3, sessionsPerMinute: 1, now: () => now });
  assert.equal((await post('/session', {})).status, 201);
  assert.equal((await post('/session', {}, undefined, { 'X-Forwarded-For': '1.2.3.4' })).status, 429);
  assert.equal((await post('/command', {})).status, 401);
  const limited = await post('/command', {});
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
  now += 60_000;
  assert.equal((await post('/session', {})).status, 201);
});

test('health identifies dev mode; shutdown is idempotent, closes keepalive sockets, and cannot restart', async t => {
  const { app, url } = await setup(t);
  const response = await fetch(`${url}/health`);
  assert.equal((await response.json()).mode, 'development-guest');
  await app.close(); await app.close();
  assert.equal(app.server.listening, false);
  await assert.rejects(app.listen());
  await assert.rejects(fetch(`${url}/health`));
});

test('rejects unsafe or invalid configuration', () => {
  assert.throws(() => createOnlineServer({ allowedOrigins: ['*'] }));
  assert.throws(() => createOnlineServer({ allowedOrigins: ['http://localhost:8081/'] }));
  assert.throws(() => createOnlineServer({ maxBodyBytes: 0 }));
  assert.throws(() => createOnlineServer({ commandsPerMinute: 0 }));
  assert.throws(() => createOnlineServer({ aggregateRequestsPerMinute: 0 }));
});

test('timer advances authority without client traffic and shutdown clears it and incomplete requests', async t => {
  class CountingAuthority extends OnlineAuthority {
    ticks = 0;
    override tick() { this.ticks++; super.tick(); }
  }
  const authority = new CountingAuthority();
  const { app, url } = await setup(t, { authority });
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.ok(authority.ticks > 0);
  const pending = request(`${url}/session`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '100' } });
  const disconnected = new Promise<void>(resolve => { pending.on('error', () => resolve()); pending.on('close', () => resolve()); });
  pending.flushHeaders(); pending.write('{');
  await new Promise(resolve => setTimeout(resolve, 20));
  await app.close();
  await disconnected;
  const count = authority.ticks;
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(authority.ticks, count);
});

test('four guests on one direct IP poll for two full minutes without starving moves or resignation', async t => {
  let now = 1000;
  const { guest, post } = await setup(t, {
    now: () => now, authority: new OnlineAuthority({ now: () => now, random: () => 0 }),
  });
  const players = await Promise.all(Array.from({ length: 4 }, () => guest()));
  const command = (index: number, body: object) => post('/command', { version: 1, ...body }, players[index].token);
  for (let i = 0; i < 4; i++) assert.equal((await command(i, { type: 'queue.join', ticket: `join-${i}` })).status, 200);
  for (let elapsed = 0; elapsed <= 120_000; elapsed += 750) {
    now = 1000 + elapsed;
    for (let i = 0; i < 4; i++) {
      const result = await command(i, { type: 'sync' });
      assert.equal(result.status, 200, `player ${i} at ${elapsed}ms`);
      assert.equal(result.body.status, 'matched');
      assert.equal(result.body.match.game.status, 'active');
    }
    if (elapsed === 59_250 || elapsed === 119_250) {
      const white = elapsed === 59_250 ? 0 : 2;
      const state = (await command(white, { type: 'sync' })).body.match;
      assert.equal((await command(white, { type: 'move', matchId: state.matchId, requestId: `move-${white}`, expectedRevision: 0,
        move: { from: { row: 6, col: 0 }, to: { row: 5, col: 0 } } })).status, 200);
    }
  }
  for (const black of [1, 3]) {
    const state = (await command(black, { type: 'sync' })).body.match;
    const result = await command(black, { type: 'resign', matchId: state.matchId, requestId: `resign-${black}`, expectedRevision: 1 });
    assert.equal(result.status, 200);
    assert.equal(result.body.match.clock.running, false);
  }
});

test('an exhausted session cannot spend neighboring sessions or the aggregate budget; retry uses remaining time', async t => {
  let now = 1000;
  const { guest, post } = await setup(t, { now: () => now, commandsPerMinute: 3, aggregateRequestsPerMinute: 8 });
  const a = await guest(), b = await guest();
  const sync = (token: string) => post('/command', { version: 1, type: 'sync' }, token);
  for (let i = 0; i < 3; i++) assert.equal((await sync(a.token)).status, 200);
  now += 55_500;
  for (let i = 0; i < 12; i++) {
    const rejected = await sync(a.token);
    assert.equal(rejected.status, 429);
    assert.equal(rejected.headers.get('retry-after'), '5');
  }
  for (let i = 0; i < 3; i++) assert.equal((await sync(b.token)).status, 200);
  now += 4500;
  assert.equal((await sync(a.token)).status, 200);
});

test('invalid tokens share the anonymous IP cap but do not consume authenticated command budgets', async t => {
  let now = 1000;
  const { guest, post } = await setup(t, { now: () => now, requestsPerMinute: 3 });
  const a = await guest();
  for (const token of ['x'.repeat(43), 'y'.repeat(43)]) {
    assert.equal((await post('/command', {}, token)).status, 401);
  }
  now += 59_001;
  const limited = await post('/command', {}, 'z'.repeat(43), { 'X-Forwarded-For': '203.0.113.1' });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '1');
  assert.equal((await post('/command', { version: 1, type: 'sync' }, a.token)).status, 200);
  now += 999;
  assert.equal((await post('/command', {}, 'z'.repeat(43))).status, 401);
});

test('aggregate circuit breaker bounds otherwise admitted traffic and resets at its actual deadline', async t => {
  let now = 1000;
  const { guest, post } = await setup(t, { now: () => now, aggregateRequestsPerMinute: 3 });
  const a = await guest(), b = await guest();
  assert.equal((await post('/command', { version: 1, type: 'sync' }, a.token)).status, 200);
  now += 42_500;
  const limited = await post('/command', { version: 1, type: 'sync' }, b.token);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '18');
  now += 17_500;
  assert.equal((await post('/command', { version: 1, type: 'sync' }, b.token)).status, 200);
});

test('guest minting has its own remaining-window retry and cannot block an existing player', async t => {
  let now = 1000;
  const { guest, post } = await setup(t, { now: () => now, sessionsPerMinute: 1 });
  const a = await guest();
  now += 55_500;
  const limited = await post('/session', {}, undefined, { 'X-Forwarded-For': '203.0.113.2' });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '5');
  assert.equal((await post('/command', { version: 1, type: 'sync' }, a.token)).status, 200);
  now += 4500;
  assert.equal((await post('/session', {})).status, 201);
});

test('expired guest is removed from matchmaking before another guest can pair with it', async t => {
  let now = 1000;
  const { guest, post } = await setup(t, { now: () => now, sessionTtlMs: 1000,
    authority: new OnlineAuthority({ now: () => now }) });
  const a = await guest();
  now = 1990;
  assert.equal((await post('/command', { version: 1, type: 'queue.join', ticket: 'a' }, a.token)).body.status, 'queued');
  now = 2010;
  const b = await guest();
  assert.equal((await post('/command', { version: 1, type: 'queue.join', ticket: 'b' }, b.token)).body.status, 'queued');
  assert.equal((await post('/command', { version: 1, type: 'sync' }, a.token)).status, 401);
  const c = await guest();
  const pair = await post('/command', { version: 1, type: 'queue.join', ticket: 'c' }, c.token);
  assert.equal(pair.body.status, 'matched');
  assert.equal((await post('/command', { version: 1, type: 'sync' }, b.token)).body.status, 'matched');
});


test('expiring an identity does not resign its existing match', async t => {
  let now = 1000;
  const { guest, post } = await setup(t, { now: () => now, sessionTtlMs: 1000,
    authority: new OnlineAuthority({ now: () => now, random: () => 0 }) });
  const a = await guest();
  now = 1500;
  const b = await guest();
  await post('/command', { version: 1, type: 'queue.join', ticket: 'a' }, a.token);
  const paired = await post('/command', { version: 1, type: 'queue.join', ticket: 'b' }, b.token);
  now = 2010;
  const state = await post('/command', { version: 1, type: 'sync' }, b.token);
  assert.equal(state.status, 200);
  assert.equal(state.body.match.matchId, paired.body.match.matchId);
  assert.equal(state.body.match.revision, 0);
  assert.equal(state.body.match.game.status, 'active');
  assert.equal(state.body.match.clock.running, true);
});


test('expired guests can finish only their original match, read/retry result for60s, then release capacity', async t => {
  let now = 1000;
  const { guest, post } = await setup(t, { now: () => now, sessionTtlMs: 1000, maxSessions: 2,
    authority: new OnlineAuthority({ now: () => now, random: () => 0 }) });
  const a = await guest(), b = await guest();
  const command = (token: string, body: object) => post('/command', { version: 1, ...body }, token);
  await command(a.token, { type: 'queue.join', ticket: 'a' });
  const paired = await command(b.token, { type: 'queue.join', ticket: 'b' });
  const matchId = paired.body.match.matchId;
  now = 2001;
  const move = { type: 'move', matchId, expectedRevision: 0, requestId: 'expired-move',
    move: { from: { row: 6, col: 0 }, to: { row: 5, col: 0 } } };
  const moved = await command(a.token, move);
  assert.equal(moved.status, 200);
  assert.equal(moved.body.match.revision, 1);
  const outOfScope = await command(a.token, { type: 'queue.join', ticket: 'new-search' });
  assert.equal(outOfScope.status, 403);
  assert.equal(outOfScope.body.error.code, 'session_scope');
  assert.equal((await command(a.token, { type: 'queue.cancel', ticket: 'a' })).status, 403);
  assert.equal((await command(a.token, { type: 'sync', matchId: 'other-match' })).status, 403);
  assert.equal((await command(a.token, { ...move, matchId: 'other-match' })).status, 403);
  assert.equal((await post('/session', {})).status, 503);
  const resign = { type: 'resign', matchId, expectedRevision: 1, requestId: 'expired-resign' };
  const ended = await command(a.token, resign);
  assert.equal(ended.status, 200);
  assert.equal(ended.body.match.clock.running, false);
  now += 59_999;
  assert.equal((await command(a.token, { type: 'sync' })).body.match.matchId, matchId);
  assert.equal((await command(a.token, resign)).body.match.revision, ended.body.match.revision);
  assert.equal((await command(a.token, move)).status, 200);
  assert.equal((await post('/session', {})).status, 503);
  now += 1;
  assert.equal((await command(a.token, { type: 'sync' })).status, 401);
  assert.equal((await command(b.token, { type: 'sync' })).status, 401);
  assert.notEqual((await guest()).token, a.token);
});

test('match grace has a fixed two-hour ceiling, not sliding renewal, and never auto-resigns', async t => {
  let now = 1000;
  // Independent clocks let this test hold a match active beyond transport's cap.
  const authority = new OnlineAuthority({ now: () => 1000, random: () => 0 });
  const { guest, post } = await setup(t, { now: () => now, sessionTtlMs: 1000, maxSessions: 2, authority });
  const a = await guest(), b = await guest();
  await post('/command', { version: 1, type: 'queue.join', ticket: 'a' }, a.token);
  await post('/command', { version: 1, type: 'queue.join', ticket: 'b' }, b.token);
  now = 2000;
  assert.equal((await post('/command', { version: 1, type: 'sync' }, a.token)).status, 200);
  now = 2000 + 2 * 60 * 60 * 1000 - 1;
  assert.equal((await post('/command', { version: 1, type: 'sync' }, a.token)).status, 200);
  assert.equal((await post('/session', {})).status, 503);
  now++;
  assert.equal((await post('/command', { version: 1, type: 'sync' }, a.token)).status, 401);
  const retained = authority.handle(a.player, { version: 1, type: 'sync' });
  assert.equal(retained.status, 'matched');
  if (retained.status === 'matched') assert.equal(retained.match.game.status, 'active');
  assert.notEqual((await guest()).token, a.token);
});
