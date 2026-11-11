import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiServer, ApiOptions } from '../api/app';
import { ReceiptError } from '../api/receipts';
import { MemoryStore } from '../shared/store';

async function setup(t: test.TestContext, options: Partial<ApiOptions> = {}) {
  const store = new MemoryStore();
  const app = createApiServer({ store, port: 0, ...options });
  const { port } = await app.listen();
  t.after(() => app.close());
  const url = `http://127.0.0.1:${port}`;
  const call = async (method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}) => {
    const response = await fetch(`${url}${path}`, {
      method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: response.status, body: json, headers: response.headers };
  };
  return { store, url, call };
}

test('register, login, profile, logout and username rules', async t => {
  const { call } = await setup(t);
  const created = await call('POST', '/auth/register', { username: 'Knight_Rider', password: 'correct horse' });
  assert.equal(created.status, 201);
  assert.match(created.body.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(created.body.user.username, 'Knight_Rider');
  assert.equal(created.body.user.rating, 1200);
  assert.deepEqual(created.body.entitlements, { adsRemoved: false, premiumPieceSets: [] });
  assert.equal(created.body.user.passwordHash, undefined);

  assert.equal((await call('POST', '/auth/register', { username: 'knight_rider', password: 'another pass' })).body.error.code, 'username_taken');
  assert.equal((await call('POST', '/auth/register', { username: 'ab', password: 'long enough' })).status, 400);
  assert.equal((await call('POST', '/auth/register', { username: 'admin', password: 'long enough' })).status, 400);
  assert.equal((await call('POST', '/auth/register', { username: 'okname', password: 'short' })).status, 400);
  assert.equal((await call('POST', '/auth/register', { username: 'okname', password: 'long enough', admin: true })).status, 400);

  assert.equal((await call('POST', '/auth/login', { username: 'knight_rider', password: 'wrong password' })).status, 401);
  assert.equal((await call('POST', '/auth/login', { username: 'nobody_here', password: 'whatever1' })).status, 401);
  const login = await call('POST', '/auth/login', { username: 'KNIGHT_RIDER', password: 'correct horse' });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.username, 'Knight_Rider');

  assert.equal((await call('GET', '/me', undefined, login.body.token)).body.user.username, 'Knight_Rider');
  assert.equal((await call('GET', '/me')).status, 401);
  assert.equal((await call('POST', '/auth/logout', undefined, login.body.token)).status, 200);
  assert.equal((await call('GET', '/me', undefined, login.body.token)).status, 401);
  // The other device's session is unaffected by this logout.
  assert.equal((await call('GET', '/me', undefined, created.body.token)).status, 200);
});

test('repeated failed logins lock that username without revealing whether it exists', async t => {
  const { call } = await setup(t, { failedLoginsPerUsername: 3, authPerMinute: 100 });
  await call('POST', '/auth/register', { username: 'target', password: 'right password' });
  for (let i = 0; i < 3; i++) assert.equal((await call('POST', '/auth/login', { username: 'target', password: 'nope nope' })).status, 401);
  const locked = await call('POST', '/auth/login', { username: 'target', password: 'right password' });
  assert.equal(locked.status, 429);
  assert.ok(Number(locked.headers.get('retry-after')) > 0);
});

test('auth endpoints are rate limited per client address', async t => {
  const { call } = await setup(t, { authPerMinute: 2 });
  await call('POST', '/auth/login', { username: 'a_user', password: 'x' });
  await call('POST', '/auth/login', { username: 'a_user', password: 'x' });
  assert.equal((await call('POST', '/auth/login', { username: 'a_user', password: 'x' })).status, 429);
});

test('trusted proxy hop uses the forwarded client address', async t => {
  const { call } = await setup(t, { authPerMinute: 1, trustProxyHops: 1 });
  const forwarded = (ip: string) => ({ 'X-Forwarded-For': `spoofed, ${ip}` });
  assert.equal((await call('POST', '/auth/login', { username: 'a', password: 'b' }, undefined, forwarded('1.1.1.1'))).status, 401);
  assert.equal((await call('POST', '/auth/login', { username: 'a', password: 'b' }, undefined, forwarded('1.1.1.1'))).status, 429);
  assert.equal((await call('POST', '/auth/login', { username: 'a', password: 'b' }, undefined, forwarded('2.2.2.2'))).status, 401);
});

test('account deletion requires the password and removes sessions and data', async t => {
  const { call, store } = await setup(t);
  const { body } = await call('POST', '/auth/register', { username: 'leaving', password: 'goodbye pass' });
  assert.equal((await call('POST', '/me/delete', { password: 'wrong one!' }, body.token)).status, 401);
  assert.equal((await call('POST', '/me/delete', { password: 'goodbye pass' }, body.token)).body.deleted, true);
  assert.equal((await call('GET', '/me', undefined, body.token)).status, 401);
  assert.equal(await store.findAccountByUsername('leaving'), null);
  assert.equal((await call('POST', '/auth/register', { username: 'leaving', password: 'new person' })).status, 201);
});

test('password change signs out other devices', async t => {
  const { call } = await setup(t);
  const first = (await call('POST', '/auth/register', { username: 'changer', password: 'first password' })).body;
  const second = (await call('POST', '/auth/login', { username: 'changer', password: 'first password' })).body;
  assert.equal((await call('POST', '/me/password', { currentPassword: 'wrong', newPassword: 'second password' }, first.token)).status, 401);
  const changed = await call('POST', '/me/password', { currentPassword: 'first password', newPassword: 'second password' }, first.token);
  assert.equal(changed.status, 200);
  assert.equal((await call('GET', '/me', undefined, second.token)).status, 401);
  assert.equal((await call('GET', '/me', undefined, changed.body.token)).status, 200);
  assert.equal((await call('POST', '/auth/login', { username: 'changer', password: 'second password' })).status, 200);
});

test('privacy and account deletion pages name the owner and are public', async t => {
  const { call } = await setup(t, { pages: { owner: 'Chain Software Group', contactEmail: 'privacy@example.com' }, allowedOrigins: ['https://app.example.com'] });
  const privacy = await call('GET', '/privacy', undefined, undefined, { Origin: 'https://elsewhere.example' });
  assert.equal(privacy.status, 200);
  assert.match(privacy.headers.get('content-type') ?? '', /text\/html/);
  assert.match(privacy.body, /Chain Software Group/);
  assert.match(privacy.body, /privacy@example\.com/);
  assert.match(privacy.body, /AdMob/);
  const deletion = await call('GET', '/account-deletion');
  assert.match(deletion.body, /Delete account/);
  assert.equal((await call('GET', '/')).status, 200);
  assert.equal((await call('GET', '/me', undefined, undefined, { Origin: 'https://elsewhere.example' })).status, 403);
});

test('purchase verification unlocks for guests and persists for accounts', async t => {
  const seen: string[] = [];
  const { call } = await setup(t, {
    receipts: {
      async verify(platform, productId, token) {
        seen.push(`${platform}:${productId}`);
        if (token === 'bad-token-0000') throw new ReceiptError('invalid_receipt', 'nope');
        return { platform, productId: productId as any, transactionId: `tx-${token}` };
      },
    },
  });
  const guest = await call('POST', '/purchases/verify', { platform: 'ios', productId: 'remove_ads', purchaseToken: 'guest-token-1' });
  assert.equal(guest.status, 200);
  assert.deepEqual(guest.body.entitlements, { adsRemoved: true, premiumPieceSets: [] });
  assert.equal((await call('POST', '/purchases/verify', { platform: 'ios', productId: 'remove_ads', purchaseToken: 'bad-token-0000' })).status, 400);
  assert.equal((await call('POST', '/purchases/verify', { platform: 'ios', productId: 'free_money', purchaseToken: 'x' })).status, 400);

  const { body } = await call('POST', '/auth/register', { username: 'buyer', password: 'buyer password' });
  await call('POST', '/purchases/verify', { platform: 'android', productId: 'pieces_forged_metal', purchaseToken: 'android-token-1' }, body.token);
  const me = await call('GET', '/me', undefined, body.token);
  assert.deepEqual(me.body.entitlements, { adsRemoved: false, premiumPieceSets: ['modern'] });
  assert.deepEqual(seen, ['ios:remove_ads', 'ios:remove_ads', 'android:pieces_forged_metal']);
});

test('purchases fail closed when the server has no store configuration', async t => {
  const { call } = await setup(t);
  assert.equal((await call('POST', '/purchases/verify', { platform: 'ios', productId: 'remove_ads', purchaseToken: 'token-abc' })).status, 503);
});

test('leaderboard lists rated players without private fields', async t => {
  const { call, store } = await setup(t);
  const a = (await call('POST', '/auth/register', { username: 'alpha', password: 'alpha pass' })).body.user;
  const b = (await call('POST', '/auth/register', { username: 'bravo', password: 'bravo pass' })).body.user;
  await store.settleMatch({ matchId: 'm1', whiteId: a.id, blackId: b.id, outcome: 'white', reason: 'checkmate', moves: [] });
  const board = await call('GET', '/leaderboard');
  assert.deepEqual(board.body.players.map((p: any) => p.username), ['alpha', 'bravo']);
  assert.equal(board.body.players[0].id, undefined);
  assert.ok(board.body.players[0].rating > 1200);
});

test('home, support and app-ads.txt are public for store listings and AdMob', async t => {
  const { call } = await setup(t, { pages: { owner: 'Chain Software Group', contactEmail: 'help@example.com' } });
  const home = await call('GET', '/', undefined, undefined, { Origin: 'https://anywhere.example' });
  assert.equal(home.status, 200);
  assert.match(home.body, /Lancer/);
  const terms = await call('GET', '/terms', undefined, undefined, { Origin: 'https://anywhere.example' });
  assert.equal(terms.status, 200);
  assert.match(terms.body, /Terms of Service/);
  assert.match(terms.body, /Chain Software Group/);
  assert.match(terms.body, /third-party beneficiaries/);
  const support = await call('GET', '/support');
  assert.match(support.body, /help@example\.com/);
  assert.match(support.body, /Restore purchases/);
  const ads = await call('GET', '/app-ads.txt', undefined, undefined, { Origin: 'https://anywhere.example' });
  assert.equal(ads.status, 200);
  assert.match(ads.headers.get('content-type') ?? '', /text\/plain/);
  assert.equal(ads.body, 'google.com, pub-1580761947831808, DIRECT, f08c47fec0942fa0\n');
});
