import test from 'node:test';
import assert from 'node:assert/strict';
import { PostmarkMailer, resetEmail } from '../api/mailer';
import { createCombinedServer } from '../main';
import { MemoryStore } from '../shared/store';

test('one server handles sign-up, rated online games, long-poll and web pages on one port', async t => {
  const store = new MemoryStore();
  const app = createCombinedServer({
    store, port: 0, allowedOrigins: ['http://localhost:8081'],
    game: { longPollMaxMs: 3000 },
    api: { pages: { owner: 'Chain Software Group' } },
  });
  const { port } = await app.listen();
  t.after(() => app.close());
  const url = `http://127.0.0.1:${port}`;
  const json = async (path: string, body: unknown, token?: string) => {
    const response = await fetch(`${url}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  };

  assert.deepEqual(await (await fetch(`${url}/health`)).json(), { ok: true, service: 'shiftchess', protocolVersion: 1 });
  assert.match(await (await fetch(`${url}/privacy`)).text(), /Chain Software Group/);
  const a = (await json('/auth/register', { username: 'one_server_a', password: 'password a' })).body;
  const b = (await json('/auth/register', { username: 'one_server_b', password: 'password b' })).body;
  assert.equal((await json('/command', { version: 1, type: 'queue.join', ticket: 'a' }, a.token)).body.status, 'queued');
  const paired = (await json('/command', { version: 1, type: 'queue.join', ticket: 'b' }, b.token)).body.match;
  assert.equal(paired.rated, true);
  // The guest-session endpoint of the old development server is not exposed.
  assert.equal((await json('/session', {})).status, 404);

  const [white, black] = paired.playerColor === 'white' ? [b, a] : [a, b];
  const started = Date.now();
  const waiting = json('/command', { version: 1, type: 'sync', matchId: paired.matchId, waitForRevision: 0 }, black.token);
  await new Promise(resolve => setTimeout(resolve, 150));
  await json('/command', { version: 1, type: 'move', requestId: 'm1', matchId: paired.matchId, expectedRevision: 0, move: { from: { row: 6, col: 0 }, to: { row: 5, col: 0 } } }, white.token);
  assert.equal((await waiting).body.match.revision, 1);
  assert.ok(Date.now() - started < 1500);

  await json('/command', { version: 1, type: 'resign', requestId: 'r1', matchId: paired.matchId, expectedRevision: 1 }, black.token);
  for (let i = 0; i < 50 && app.settler.pending.size; i++) await new Promise(resolve => setTimeout(resolve, 10));
  const me = await fetch(`${url}/me`, { headers: { Authorization: `Bearer ${white.token}` } });
  const profile = (await me.json() as any).user;
  assert.equal(profile.wins, 1);
  assert.ok(profile.rating > 1200);
});

test('Postmark mailer sends with the server token and fails loudly on errors', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  let ok = true;
  const mailer = new PostmarkMailer('server-token', 'ShiftChess <no-reply@example.com>', 'outbound', (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init! });
    return ok ? new Response('{"ErrorCode":0}') : new Response('{"ErrorCode":406,"Message":"Inactive recipient"}', { status: 422 });
  }) as typeof fetch);
  await mailer.send(resetEmail('player@example.com', 'player', 'https://x.example/reset-password?token=t', 60));
  assert.equal(calls[0].url, 'https://api.postmarkapp.com/email');
  assert.equal((calls[0].init.headers as Record<string, string>)['X-Postmark-Server-Token'], 'server-token');
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.From, 'ShiftChess <no-reply@example.com>');
  assert.equal(body.To, 'player@example.com');
  assert.equal(body.MessageStream, 'outbound');
  assert.equal(body.TrackLinks, 'None'); // reset links must not be rewritten through a tracker
  assert.match(body.TextBody, /reset-password\?token=t/);
  ok = false;
  await assert.rejects(mailer.send(resetEmail('gone@example.com', 'p', 'https://x', 60)), /406/);
});

test('SHIFTCHESS_ROLE picks which job a copy of the server does', async () => {
  const { roleFromEnv } = await import('../main');
  assert.equal(roleFromEnv(undefined), 'all');
  assert.equal(roleFromEnv(''), 'all');
  assert.equal(roleFromEnv('accounts'), 'accounts');
  assert.equal(roleFromEnv(' Online '), 'online');
  assert.equal(roleFromEnv('game'), 'online');
  assert.throws(() => roleFromEnv('everything'), /SHIFTCHESS_ROLE/);
});
