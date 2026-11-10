import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiServer, ApiOptions } from '../api/app';
import { Email, normalizeRecoveryCode, newRecoveryCode } from '../api/mailer';
import { MemoryStore } from '../shared/store';

async function setup(t: test.TestContext, options: Partial<ApiOptions> = {}) {
  const store = new MemoryStore();
  const sent: Email[] = [];
  let clock = Date.now();
  const app = createApiServer({ store, port: 0, mailer: { async send(email) { sent.push(email); } }, publicUrl: 'https://api.example.com', now: () => clock, ...options });
  const { port } = await app.listen();
  t.after(() => app.close());
  const url = `http://127.0.0.1:${port}`;
  const call = async (method: string, path: string, body?: unknown, token?: string) => {
    const response = await fetch(`${url}${path}`, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  };
  const form = async (fields: Record<string, string>) => {
    const response = await fetch(`${url}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://api.example.com' }, body: new URLSearchParams(fields).toString() });
    return { status: response.status, html: await response.text(), headers: response.headers };
  };
  const linkToken = (email: Email) => /token=([A-Za-z0-9_-]{43})/.exec(email.text)![1];
  return { store, url, call, form, sent, linkToken, advance: (ms: number) => { clock += ms; } };
}

test('sign-up returns a one-time recovery code and stores an optional email', async t => {
  const { call, store } = await setup(t);
  const created = await call('POST', '/auth/register', { username: 'mailer', password: 'password one', email: 'Me@Example.com' });
  assert.equal(created.status, 201);
  assert.match(created.body.recoveryCode, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  assert.equal(created.body.email, 'me@example.com');
  const saved = await store.findAccountByUsername('mailer');
  assert.notEqual(saved!.recoveryHash, created.body.recoveryCode); // only a hash is stored
  assert.equal((await call('POST', '/auth/register', { username: 'other', password: 'password two', email: 'ME@example.com' })).body.error.code, 'email_taken');
  assert.equal((await call('POST', '/auth/register', { username: 'bad_mail', password: 'password two', email: 'not-an-email' })).status, 400);
  assert.equal((await call('POST', '/auth/register', { username: 'no_mail', password: 'password two', email: '' })).status, 201);
  assert.equal((await call('GET', '/me', undefined, created.body.token)).body.email, 'me@example.com');
});

test('email reset: link works once, signs out other devices, and expires', async t => {
  const { call, form, sent, linkToken, url, advance } = await setup(t);
  const created = await call('POST', '/auth/register', { username: 'forgetful', password: 'old password', email: 'f@example.com' });
  const same = { ok: true, message: 'If that account has an email address, a reset link is on its way. Check your inbox and spam folder.' };
  assert.deepEqual((await call('POST', '/auth/forgot', { login: 'nobody_at_all' })).body, same);
  assert.equal(sent.length, 0);
  assert.deepEqual((await call('POST', '/auth/forgot', { login: 'F@EXAMPLE.com' })).body, same);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'f@example.com');
  assert.match(sent[0].text, /https:\/\/api\.example\.com\/reset-password\?token=/);
  // Cooldown: repeated requests do not spam the inbox.
  await call('POST', '/auth/forgot', { login: 'forgetful' });
  assert.equal(sent.length, 1);

  const token = linkToken(sent[0]);
  const page = await fetch(`${url}/reset-password?token=${token}`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
  assert.match(await page.text(), /Choose a new password/);
  assert.equal((await form({ token, password: 'brand new pw', confirm: 'different!!' })).status, 400);
  assert.equal((await form({ token, password: 'short', confirm: 'short' })).status, 400);
  const done = await form({ token, password: 'brand new pw', confirm: 'brand new pw' });
  assert.equal(done.status, 200);
  assert.match(done.html, /Password updated/);
  assert.equal((await form({ token, password: 'another pass', confirm: 'another pass' })).status, 410); // single use
  assert.equal((await call('GET', '/me', undefined, created.body.token)).status, 401);
  assert.equal((await call('POST', '/auth/login', { username: 'forgetful', password: 'old password' })).status, 401);
  assert.equal((await call('POST', '/auth/login', { username: 'forgetful', password: 'brand new pw' })).status, 200);

  advance(61_000);
  await call('POST', '/auth/forgot', { login: 'forgetful' });
  assert.equal(sent.length, 2);
  advance(61 * 60_000); // past the one-hour expiry
  assert.equal((await fetch(`${url}/reset-password?token=${linkToken(sent[1])}`)).status, 410);
  assert.equal((await form({ token: linkToken(sent[1]), password: 'expired pw!', confirm: 'expired pw!' })).status, 410);
});

test('a newer reset link replaces the older one', async t => {
  const { call, form, sent, linkToken, advance } = await setup(t);
  await call('POST', '/auth/register', { username: 'twice', password: 'old password', email: 't@example.com' });
  await call('POST', '/auth/forgot', { login: 'twice' });
  advance(61_000);
  await call('POST', '/auth/forgot', { login: 'twice' });
  assert.equal((await form({ token: linkToken(sent[0]), password: 'new password', confirm: 'new password' })).status, 410);
  assert.equal((await form({ token: linkToken(sent[1]), password: 'new password', confirm: 'new password' })).status, 200);
});

test('email resets report not configured when the server has no mail provider', async t => {
  const { call } = await setup(t, { mailer: undefined });
  assert.equal((await call('POST', '/auth/forgot', { login: 'anyone' })).body.error.code, 'not_configured');
});

test('recovery code resets the password once and issues a new code', async t => {
  const { call } = await setup(t, { failedLoginsPerUsername: 3, authPerMinute: 100 });
  const created = await call('POST', '/auth/register', { username: 'coder', password: 'old password' });
  const code: string = created.body.recoveryCode;
  assert.equal((await call('POST', '/auth/recover', { username: 'coder', recoveryCode: 'AAAA-BBBB-CCCC-DDDD', newPassword: 'new password' })).status, 401);
  // Typing it lowercase and without dashes still works.
  const recovered = await call('POST', '/auth/recover', { username: 'CODER', recoveryCode: code.toLowerCase().replace(/-/g, ' '), newPassword: 'new password' });
  assert.equal(recovered.status, 200);
  assert.match(recovered.body.token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(recovered.body.recoveryCode, code);
  assert.equal((await call('GET', '/me', undefined, created.body.token)).status, 401); // old sessions gone
  assert.equal((await call('POST', '/auth/recover', { username: 'coder', recoveryCode: code, newPassword: 'third password' })).status, 401); // used up
  assert.equal((await call('POST', '/auth/login', { username: 'coder', password: 'new password' })).status, 200);
  // Guessing is locked out after a few tries.
  for (let i = 0; i < 2; i++) await call('POST', '/auth/recover', { username: 'coder', recoveryCode: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ', newPassword: 'whatever pw' });
  assert.equal((await call('POST', '/auth/recover', { username: 'coder', recoveryCode: recovered.body.recoveryCode, newPassword: 'whatever pw' })).status, 429);
});

test('signed-in players can change email and make a new recovery code with their password', async t => {
  const { call } = await setup(t);
  const { body } = await call('POST', '/auth/register', { username: 'settings', password: 'my password' });
  assert.equal((await call('POST', '/me/email', { email: 'new@example.com', password: 'wrong pass' }, body.token)).status, 401);
  assert.equal((await call('POST', '/me/email', { email: 'new@example.com', password: 'my password' }, body.token)).body.email, 'new@example.com');
  assert.equal((await call('POST', '/me/email', { email: null, password: 'my password' }, body.token)).body.email, null);
  const fresh = await call('POST', '/me/recovery-code', { password: 'my password' }, body.token);
  assert.notEqual(fresh.body.recoveryCode, body.recoveryCode);
  assert.equal((await call('POST', '/auth/recover', { username: 'settings', recoveryCode: body.recoveryCode, newPassword: 'nope nope' })).status, 401);
  assert.equal((await call('POST', '/auth/recover', { username: 'settings', recoveryCode: fresh.body.recoveryCode, newPassword: 'yes yes yes' })).status, 200);
});

test('recovery codes are readable and normalize common typos', () => {
  const code = newRecoveryCode();
  assert.doesNotMatch(code, /[ILOU]/);
  assert.equal(normalizeRecoveryCode('o1l-I'), '0111');
});

test('privacy policy mentions optional email and the email provider', async t => {
  const { url } = await setup(t);
  const html = await (await fetch(`${url}/privacy`)).text();
  assert.match(html, /Email address<\/strong> \(optional\)/);
  assert.match(html, /Postmark/);
});
