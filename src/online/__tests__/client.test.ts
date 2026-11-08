import test from 'node:test';
import assert from 'node:assert/strict';
import { createOnlineServer } from '../../../server/httpServer';
import { OnlineAuthority } from '../OnlineAuthority';
import { OnlineClient, displayedClock, onlineServerUrl } from '../OnlineClient';
import { formatMs } from '../../game/timers';
import { MatchSnapshot, OnlineState } from '../protocol';

async function setup(t: test.TestContext, fetcher?: typeof fetch, limits?: { requestsPerMatch: number }) {
  let now = 1000;
  const app = createOnlineServer({ port: 0, authority: new OnlineAuthority({ now: () => now, random: () => 0, limits }) });
  const address = await app.listen();
  const url = `http://127.0.0.1:${address.port}`;
  const a = new OnlineClient(url, { fetch: fetcher, now: () => now });
  const b = new OnlineClient(url, { now: () => now });
  t.after(async () => { a.dispose(); b.dispose(); await app.close(); });
  return { a, b, url, advance: (ms: number) => { now += ms; } };
}
function match(state: OnlineState | null): MatchSnapshot {
  assert.equal(state?.status, 'matched');
  return (state as Extract<OnlineState, { status: 'matched' }>).match;
}

test('real app clients pair, exchange moves, receive server increment and resign', async t => {
  const { a, b, advance } = await setup(t);
  assert.equal((await a.join()).status, 'queued');
  assert.equal(match(await b.join()).playerColor, 'black');
  assert.equal(match(await a.sync()).playerColor, 'white');
  advance(5000);
  const white = match(await a.move({ from: { row: 6, col: 0 }, to: { row: 4, col: 0 }, shift: false }));
  assert.equal(white.revision, 1);
  assert.equal(white.clock.whiteMs, 177000);
  const black = match(await b.sync());
  assert.deepEqual(black.game, white.game);
  advance(2000);
  await b.move({ from: { row: 1, col: 0 }, to: { row: 3, col: 0 } });
  assert.equal(match(await a.sync()).clock.blackMs, 180000);
  const end = match(await a.resign());
  assert.equal(end.game.winner, 'black');
  assert.equal(end.clock.running, false);
  assert.equal(match(await b.sync()).game.status, 'resigned');
});

test('lost move acknowledgement retries the same command without double move or increment', async t => {
  const commands: unknown[] = [];
  let drop = true;
  const fetcher: typeof fetch = async (input, init) => {
    const body = JSON.parse(String(init?.body));
    const response = await fetch(input, init);
    if (body.type === 'move') {
      commands.push(body);
      if (drop) { drop = false; await response.text(); throw new Error('Connection lost after commit'); }
    }
    return response;
  };
  const { a, b } = await setup(t, fetcher);
  await a.join(); await b.join(); await a.sync();
  await assert.rejects(a.move({ from: { row: 6, col: 0 }, to: { row: 5, col: 0 } }));
  assert.equal(a.getSnapshot().connection, 'reconnecting');
  assert.equal(match(a.getSnapshot().online).revision, 0, 'no optimistic board mutation');
  await assert.rejects(a.move({ from: { row: 6, col: 1 }, to: { row: 5, col: 1 } }));
  const recovered = match(await a.sync());
  assert.equal(recovered.revision, 1);
  assert.equal(recovered.clock.whiteMs, 182000);
  assert.deepEqual(commands[0], commands[1]);
  assert.equal(a.getSnapshot().connection, 'connected');
});

test('a gateway failure also preserves mutation id for safe retry', async t => {
  let failed = false;
  const fetcher: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    if (!failed && JSON.parse(String(init?.body)).type === 'resign') {
      failed = true; await response.text();
      return new Response(JSON.stringify({ error: { code: 'gateway_error', message: 'Gateway interrupted' } }), { status: 502 });
    }
    return response;
  };
  const { a, b } = await setup(t, fetcher);
  await a.join(); await b.join(); await a.sync();
  await assert.rejects(a.resign());
  assert.equal(a.getSnapshot().connection, 'reconnecting');
  assert.equal(match(await a.sync()).revision, 1);
  assert.equal(match(await b.sync()).game.status, 'resigned');
});

test('cancel queued behind an in-flight join wins without exposing a late launch', async t => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const start = new Promise<void>(resolve => { started = resolve; });
  const fetcher: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    if (JSON.parse(String(init?.body)).type === 'queue.join') { started(); await gate; }
    return response;
  };
  const { a, b } = await setup(t, fetcher);
  const joining = a.join(); await start;
  const cancelling = a.cancel();
  release(); await joining;
  assert.equal(a.getSnapshot().pending, true, 'cancel still pending blocks navigation');
  assert.equal((await cancelling)?.status, 'idle');
  assert.equal((await b.join()).status, 'queued');
  assert.equal(a.getSnapshot().pending, false);
});

test('a pairing that beats cancel is surfaced as a resumable match', async t => {
  const { a, b } = await setup(t);
  await a.join(); const paired = match(await b.join());
  assert.equal(match(await a.cancel()).matchId, paired.matchId);
  assert.equal(match(await a.sync()).game.status, 'active');
});

test('lost join response can still be cancelled safely', async t => {
  let dropped = false;
  const fetcher: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    if (!dropped && JSON.parse(String(init?.body)).type === 'queue.join') {
      dropped = true; await response.text(); throw new Error('Dropped');
    }
    return response;
  };
  const { a, b } = await setup(t, fetcher);
  await assert.rejects(a.join());
  assert.equal((await a.cancel())?.status, 'idle');
  assert.equal((await b.join()).status, 'queued');
});

test('duplicate taps cannot submit another move while first acknowledgement is pending', async t => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const fetcher: typeof fetch = async (input, init) => {
    if (JSON.parse(String(init?.body)).type === 'move') await gate;
    return fetch(input, init);
  };
  const { a, b } = await setup(t, fetcher);
  await a.join(); await b.join(); await a.sync();
  const move = { from: { row: 6, col: 0 }, to: { row: 5, col: 0 } };
  const first = a.move(move);
  await assert.rejects(a.move(move));
  release();
  assert.equal(match(await first).revision, 1);
});

test('server rejection never fabricates a local move and sync restores the authoritative state', async t => {
  const { a, b } = await setup(t);
  await a.join(); await b.join(); await a.sync();
  await assert.rejects(b.move({ from: { row: 1, col: 0 }, to: { row: 2, col: 0 } }));
  assert.equal(match(b.getSnapshot().online).revision, 0);
  await b.sync();
  assert.equal(b.getSnapshot().error, null);
});

test('expired credentials do not silently mint a new identity or lose the previous game', async t => {
  let expire = false, sessions = 0;
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input).endsWith('/session')) sessions++;
    if (expire) return new Response(JSON.stringify({ error: { code: 'unauthenticated', message: 'Guest session expired.' } }), { status: 401 });
    return fetch(input, init);
  };
  const { a, b } = await setup(t, fetcher);
  await a.join(); await b.join(); await a.sync(); expire = true;
  await assert.rejects(a.sync());
  assert.equal(a.getSnapshot().connection, 'expired');
  assert.equal(sessions, 1);
  assert.equal(match(a.getSnapshot().online).game.status, 'active');
});

test('display clock interpolation cannot adjudicate a timeout or mutate server state', async t => {
  const { a, b } = await setup(t);
  await a.join(); const position = match(await b.join());
  const clock = displayedClock(position, 100, 9999999);
  assert.equal(clock.whiteMs, 0);
  assert.equal(clock.timedOut, undefined);
  assert.equal(position.clock.whiteMs, 180000);
  assert.equal(position.game.status, 'active');
});

test('endpoint validation allows TLS or explicit local dev but rejects credentials, paths and public plaintext', () => {
  assert.equal(onlineServerUrl(undefined), null);
  assert.equal(onlineServerUrl('https://play.example.com/'), 'https://play.example.com');
  assert.equal(onlineServerUrl('http://localhost:8787'), 'http://localhost:8787');
  assert.equal(onlineServerUrl('http://192.168.1.2:8787', true), 'http://192.168.1.2:8787');
  for (const value of ['http://play.example.com', 'https://user:secret@play.example.com', 'https://play.example.com/path', 'https://play.example.com/?token=secret', 'https://play.example.com/#secret', 'file:///tmp/a', 'http://192.168.1.2:8787']) {
    assert.equal(onlineServerUrl(value), null, value);
  }
});

test('clock labels never display sixty seconds at minute boundaries', () => {
  assert.equal(formatMs(179999), '3:00');
  assert.equal(formatMs(179000), '2:59');
  assert.equal(formatMs(59999), '1:00');
  assert.equal(formatMs(1), '0:01');
  assert.equal(formatMs(-1), '0:00');
});


test('capacity is a definitive rejection and does not block the reserved resignation', async t => {
  const { a, b } = await setup(t, undefined, { requestsPerMatch: 1 });
  await a.join(); await b.join(); await a.sync();
  await a.move({ from: { row: 6, col: 0 }, to: { row: 5, col: 0 } });
  await b.sync();
  await assert.rejects(b.move({ from: { row: 1, col: 0 }, to: { row: 2, col: 0 } }));
  assert.equal(b.getSnapshot().connection, 'connected');
  assert.equal(match(await b.sync()).revision, 1);
  assert.equal(match(await b.resign()).game.status, 'resigned');
});

test('retry after initial session failure reconnects and resumes the requested queue', async t => {
  let fail = true, requests = 0;
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input).endsWith('/session')) { requests++; if (fail) { fail = false; throw new Error('Offline'); } }
    return fetch(input, init);
  };
  const { a } = await setup(t, fetcher);
  await assert.rejects(a.join());
  assert.equal((await a.sync())?.status, 'queued');
  assert.equal(requests, 2);
});

test('cancel after session failure clears queue intent so retry cannot restart it', async t => {
  let requests = 0;
  const fetcher: typeof fetch = async () => { requests++; throw new Error('Offline'); };
  const { a } = await setup(t, fetcher);
  await assert.rejects(a.join()); await a.cancel(); await a.sync();
  assert.equal(requests, 1);
  assert.equal(a.getSnapshot().connection, 'idle');
});

test('rate-limited cancel is retried instead of renewing a cancelled queue', async t => {
  let rejectCancel = true;
  const commands: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.type) commands.push(body.type);
    if (body.type === 'queue.cancel' && rejectCancel) {
      rejectCancel = false;
      return new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'Retry later' } }), { status: 429, headers: { 'Retry-After': '60' } });
    }
    return fetch(input, init);
  };
  const { a, b } = await setup(t, fetcher);
  await a.join(); await assert.rejects(a.cancel());
  assert.equal(a.getSnapshot().connection, 'reconnecting');
  assert.equal((await a.sync())?.status, 'idle');
  assert.deepEqual(commands.slice(0, 3), ['queue.join', 'queue.cancel', 'queue.cancel']);
  assert.equal((await b.join()).status, 'queued');
});

test('private-looking public DNS names never qualify for plaintext LAN access', () => {
  for (const host of ['192.168.attacker.example', '10.attacker.example', '172.16.attacker.example', '192.168.300.1']) {
    assert.equal(onlineServerUrl(`http://${host}:8787`, true), null);
  }
});

test('lost join acknowledgement beyond the lease reconciles to idle and a new explicit search uses a fresh ticket', async t => {
  let dropped = false;
  const commands: Array<{ type: string; ticket?: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.type) commands.push(body);
    const response = await fetch(input, init);
    if (!dropped && body.type === 'queue.join') {
      dropped = true; await response.text(); throw new Error('Join acknowledgement lost');
    }
    return response;
  };
  const { a, b, advance } = await setup(t, fetcher);
  await assert.rejects(a.join());
  assert.equal(a.getSnapshot().online, null);
  assert.equal(a.getSnapshot().connection, 'reconnecting');
  advance(30001);
  const unsubscribe = a.subscribe(() => undefined);
  t.after(unsubscribe);
  assert.equal((await a.sync())?.status, 'idle');
  assert.equal(a.getSnapshot().connection, 'connected');
  assert.equal(a.getSnapshot().pending, false);
  assert.match(a.getSnapshot().error ?? '', /search expired/);
  assert.deepEqual(commands.map(command => command.type), ['queue.join', 'queue.join', 'sync']);
  assert.equal(commands[2].ticket, undefined, 'reconciliation never renews an expired ticket');
  assert.equal((await b.join()).status, 'queued', 'recovery did not silently rejoin');
  assert.equal(match(await a.join()).game.status, 'active');
  assert.notEqual(commands.at(-1)?.ticket, commands[0].ticket, 'user can explicitly start a fresh search');
});

test('lost join recovery preserves a completed match instead of restarting the queue', async t => {
  let dropped = false;
  const fetcher: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    if (!dropped && JSON.parse(String(init?.body)).type === 'queue.join') {
      dropped = true; await response.text(); throw new Error('Join acknowledgement lost');
    }
    return response;
  };
  const { a, b } = await setup(t, fetcher);
  await assert.rejects(a.join());
  const pairing = match(await b.join());
  await b.resign();
  const recovered = match(await a.sync());
  assert.equal(recovered.matchId, pairing.matchId);
  assert.equal(recovered.game.status, 'resigned');
  assert.equal(a.getSnapshot().connection, 'connected');
});

test('interrupted expired-ticket reconciliation retries sync, never the consumed join', async t => {
  let dropJoin = true, dropSync = true;
  const commands: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.type) commands.push(body.type);
    const response = await fetch(input, init);
    if (body.type === 'queue.join' && dropJoin) { dropJoin = false; await response.text(); throw new Error('Lost join'); }
    if (body.type === 'sync' && dropSync) { dropSync = false; await response.text(); throw new Error('Lost reconciliation'); }
    return response;
  };
  const { a, advance } = await setup(t, fetcher);
  await assert.rejects(a.join());
  advance(30001);
  await assert.rejects(a.sync());
  assert.equal(a.getSnapshot().connection, 'reconnecting');
  assert.equal((await a.sync())?.status, 'idle');
  assert.deepEqual(commands, ['queue.join', 'queue.join', 'sync', 'sync']);
  assert.equal(a.getSnapshot().pending, false);
});

test('guest expiry during a live game preserves app moves and scope rejection does not disable recovery', async t => {
  let now = 1000;
  const server = createOnlineServer({ port: 0, now: () => now, sessionTtlMs: 1000,
    authority: new OnlineAuthority({ now: () => now, random: () => 0 }) });
  const address = await server.listen();
  const url = `http://127.0.0.1:${address.port}`;
  const a = new OnlineClient(url, { now: () => now }), b = new OnlineClient(url, { now: () => now });
  t.after(async () => { a.dispose(); b.dispose(); await server.close(); });
  await a.join(); await b.join(); await a.sync();
  now = 2001;
  assert.equal(match(await a.sync()).game.status, 'active');
  await assert.rejects(a.join(), error => error instanceof Error && /existing match/.test(error.message));
  assert.equal(a.getSnapshot().connection, 'connected', 'scope rejection is not a revoked credential');
  const moved = match(await a.move({ from: { row: 6, col: 0 }, to: { row: 5, col: 0 } }));
  assert.equal(moved.revision, 1);
  await b.sync();
  assert.equal(match(await b.resign()).game.status, 'resigned');
  assert.equal(match(await a.sync()).game.status, 'resigned');
});
