import { timingSafeEqual } from 'node:crypto';
import { createServer, IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { grantsFor, isProductId } from '../../src/services/purchases/products';
import {
  clientAddress, HttpError, parseOrigins, positive, rateLimiter, readForm, readJson, sendHtml, sendJson, Window,
} from '../shared/http';
import {
  dummyVerify, hashPassword, newToken, passwordProblem, TOKEN_PATTERN, tokenDigest, usernameProblem, verifyPassword,
} from '../shared/passwords';
import { Account, Store } from '../shared/store';
import { EMAIL_PATTERN, Mailer, newRecoveryCode, recoveryDigest, resetEmail } from './mailer';
import { accountDeletionPage, homePage, PageOptions, privacyPage, resetDonePage, resetFormPage, resetInvalidPage, supportPage, termsPage } from './pages';
import { ReceiptError, ReceiptVerifier } from './receipts';

export type ApiOptions = {
  store: Store;
  receipts?: ReceiptVerifier;
  host?: string; port?: number;
  allowedOrigins?: string[];
  /** 1 on Railway (one edge proxy), 0 for direct local connections. */
  trustProxyHops?: number;
  sessionTtlMs?: number;
  requestsPerMinute?: number; authPerMinute?: number; purchasesPerMinute?: number;
  failedLoginsPerUsername?: number;
  maxRateKeys?: number; maxBodyBytes?: number;
  pages?: PageOptions;
  /** Body of /app-ads.txt (AdMob seller verification). */
  appAdsTxt?: string;
  /** Sends password-reset emails. Without one, email resets answer "not configured". */
  mailer?: Mailer;
  /** Public https origin of this service, used in reset links. */
  publicUrl?: string;
  resetTtlMs?: number;
  now?: () => number;
};

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
const FAILED_LOGIN_WINDOW = 15 * 60 * 1000;
/** AdMob publisher ID pub-1580761947831808; f08c47fec0942fa0 is Google's fixed certification authority ID. */
export const DEFAULT_APP_ADS_TXT = 'google.com, pub-1580761947831808, DIRECT, f08c47fec0942fa0';
const RESET_TTL = 60 * 60 * 1000;
const RESET_EMAIL_COOLDOWN = 60 * 1000;
const sameDigest = (a: string, b: string | null) => !!b && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
function emailProblem(email: unknown): string | null {
  if (email === undefined || email === null || email === '') return null;
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address, or leave it empty.';
  return null;
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const only = (body: unknown, keys: string[]): Record<string, unknown> => {
  if (!record(body) || Object.keys(body).some(key => !keys.includes(key))) throw new HttpError(400, 'invalid_body', 'Unexpected request fields.');
  return body;
};

/**
 * Accounts, sign-in, profiles, purchases and the public privacy pages.
 * Runs as its own Railway service so password hashing and store calls never
 * slow down live games on the game server.
 */
export function createApiServer(options: ApiOptions) {
  const { store } = options;
  const now = options.now ?? Date.now;
  const ttl = positive(options.sessionTtlMs ?? SESSION_TTL, 'sessionTtlMs');
  const trustHops = options.trustProxyHops ?? 0;
  const maxBody = positive(options.maxBodyBytes ?? 16 * 1024, 'maxBodyBytes');
  const limits = {
    requests: positive(options.requestsPerMinute ?? 300, 'requestsPerMinute'),
    auth: positive(options.authPerMinute ?? 20, 'authPerMinute'),
    purchases: positive(options.purchasesPerMinute ?? 60, 'purchasesPerMinute'),
    failedLogins: positive(options.failedLoginsPerUsername ?? 10, 'failedLoginsPerUsername'),
    keys: positive(options.maxRateKeys ?? 10_000, 'maxRateKeys'),
  };
  const origins = parseOrigins(options.allowedOrigins ?? ['http://localhost:8081', 'http://127.0.0.1:8081']);
  const { window, consume } = rateLimiter(now);
  const rates = new Map<string, { requests: Window; auth: Window; purchases: Window }>();
  const failures = new Map<string, { count: number; resetAt: number }>();
  const privacy = privacyPage(options.pages);
  const resetTtl = positive(options.resetTtlMs ?? RESET_TTL, 'resetTtlMs');
  const lastResetEmail = new Map<string, number>();
  const deletion = accountDeletionPage(options.pages);

  const sweep = () => {
    const time = now();
    for (const [key, rate] of rates) if (Math.max(rate.requests.resetAt, rate.auth.resetAt, rate.purchases.resetAt) <= time) rates.delete(key);
    for (const [key, failure] of failures) if (failure.resetAt <= time) failures.delete(key);
    for (const [key, sentAt] of lastResetEmail) if (sentAt + RESET_EMAIL_COOLDOWN <= time) lastResetEmail.delete(key);
  };
  const sweeper = setInterval(sweep, 60_000);
  sweeper.unref();

  async function authenticate(req: IncomingMessage, required: true): Promise<{ account: Account; digest: string }>;
  async function authenticate(req: IncomingMessage, required: false): Promise<{ account: Account; digest: string } | null>;
  async function authenticate(req: IncomingMessage, required: boolean) {
    const match = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    if (!match) { if (required) throw new HttpError(401, 'unauthenticated', 'Please log in.'); return null; }
    if (!TOKEN_PATTERN.test(match[1])) throw new HttpError(401, 'unauthenticated', 'Your session has expired. Please log in again.');
    const digest = tokenDigest(match[1]);
    const account = await store.findSession(digest, now());
    if (!account) throw new HttpError(401, 'unauthenticated', 'Your session has expired. Please log in again.');
    return { account, digest };
  }
  async function issueSession(account: Account) {
    const token = newToken();
    const expiresAt = now() + ttl;
    await store.createSession(account.id, tokenDigest(token), expiresAt);
    return { token, expiresAt, user: await store.profile(account.id) };
  }
  async function entitlements(userId: string) { return grantsFor(await store.ownedProducts(userId)); }
  async function freshRecoveryCode(userId: string) {
    const code = newRecoveryCode();
    await store.setRecoveryHash(userId, recoveryDigest(code));
    return code;
  }
  async function account(id: string) { return store.findAccountById(id); }
  async function requirePassword(accountValue: Account, password: unknown, message: string) {
    if (typeof password !== 'string' || !(await verifyPassword(password, accountValue.passwordHash))) throw new HttpError(401, 'invalid_login', message);
  }
  function failureKey(username: string) { return username.trim().toLowerCase(); }
  function checkLockout(username: string, res: ServerResponse) {
    const failure = failures.get(failureKey(username));
    if (failure && failure.resetAt > now() && failure.count >= limits.failedLogins) {
      res.setHeader('Retry-After', String(Math.ceil((failure.resetAt - now()) / 1000)));
      throw new HttpError(429, 'locked', 'Too many failed attempts for this username. Try again in a few minutes.');
    }
  }
  function recordFailure(username: string) {
    const key = failureKey(username);
    const failure = failures.get(key);
    if (!failure || failure.resetAt <= now()) {
      if (failures.size < limits.keys) failures.set(key, { count: 1, resetAt: now() + FAILED_LOGIN_WINDOW });
    } else failure.count++;
  }

  const routes: Record<string, (req: IncomingMessage, res: ServerResponse, rate: { auth: Window; purchases: Window }) => Promise<void>> = {
    'GET /health': async (_req, res) => sendJson(res, 200, { ok: true, service: 'accounts' }),
    'GET /': async (_req, res) => sendHtml(res, homePage(options.pages)),
    'GET /support': async (_req, res) => sendHtml(res, supportPage(options.pages)),
    'GET /app-ads.txt': async (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
      res.end(`${(options.appAdsTxt ?? DEFAULT_APP_ADS_TXT).trim()}\n`);
    },
    'GET /privacy': async (_req, res) => sendHtml(res, privacy),
    'GET /terms': async (_req, res) => sendHtml(res, termsPage(options.pages)),
    'GET /account-deletion': async (_req, res) => sendHtml(res, deletion),

    'POST /auth/register': async (req, res, rate) => {
      consume(rate.auth, limits.auth, res);
      const body = only(await readJson(req, maxBody), ['username', 'password', 'email']);
      const problem = usernameProblem(body.username) ?? passwordProblem(body.password) ?? emailProblem(body.email);
      if (problem) throw new HttpError(400, 'invalid_account', problem);
      const recoveryCode = newRecoveryCode();
      const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null;
      const created = await store.createAccount((body.username as string).trim(), await hashPassword(body.password as string), { email, recoveryHash: recoveryDigest(recoveryCode) });
      if (created === 'taken') throw new HttpError(409, 'username_taken', 'That username is taken. Try another one.');
      if (created === 'email_taken') throw new HttpError(409, 'email_taken', 'That email is already used by another account. Log in, or reset that account\'s password.');
      // The recovery code is shown exactly once; only its hash is stored.
      sendJson(res, 201, { ...(await issueSession(created)), entitlements: await entitlements(created.id), recoveryCode, email: created.email });
    },
    'POST /auth/login': async (req, res, rate) => {
      consume(rate.auth, limits.auth, res);
      const body = only(await readJson(req, maxBody), ['username', 'password']);
      if (typeof body.username !== 'string' || typeof body.password !== 'string' || body.username.length > 40 || body.password.length > 256) {
        throw new HttpError(400, 'invalid_account', 'Enter your username and password.');
      }
      checkLockout(body.username, res);
      const account = await store.findAccountByUsername(body.username);
      const valid = account ? await verifyPassword(body.password, account.passwordHash) : (await dummyVerify(body.password), false);
      if (!account || !valid) { recordFailure(body.username); throw new HttpError(401, 'invalid_login', 'Wrong username or password.'); }
      failures.delete(failureKey(body.username));
      sendJson(res, 200, { ...(await issueSession(account)), entitlements: await entitlements(account.id) });
    },
    'POST /auth/logout': async (req, res) => {
      const auth = await authenticate(req, true);
      await store.deleteSession(auth.digest);
      sendJson(res, 200, { ok: true });
    },
    'GET /me': async (req, res) => {
      const { account } = await authenticate(req, true);
      sendJson(res, 200, { user: await store.profile(account.id), email: account.email, entitlements: await entitlements(account.id) });
    },
    'POST /me/email': async (req, res, rate) => {
      consume(rate.auth, limits.auth, res);
      const { account: current } = await authenticate(req, true);
      const body = only(await readJson(req, maxBody), ['email', 'password']);
      await requirePassword(current, body.password, 'Enter your current password to change your email.');
      const problem = emailProblem(body.email);
      if (problem) throw new HttpError(400, 'invalid_account', problem);
      const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null;
      if (await store.setEmail(current.id, email) === 'email_taken') throw new HttpError(409, 'email_taken', 'That email is already used by another account.');
      sendJson(res, 200, { email: (await account(current.id))?.email ?? null });
    },
    'POST /me/recovery-code': async (req, res, rate) => {
      consume(rate.auth, limits.auth, res);
      const { account: current } = await authenticate(req, true);
      const body = only(await readJson(req, maxBody), ['password']);
      await requirePassword(current, body.password, 'Enter your current password to make a new recovery code.');
      sendJson(res, 200, { recoveryCode: await freshRecoveryCode(current.id) });
    },
    'POST /auth/forgot': async (req, res, rate) => {
      consume(rate.auth, limits.auth, res);
      const body = only(await readJson(req, maxBody), ['login']);
      if (typeof body.login !== 'string' || !body.login.trim() || body.login.length > 254) throw new HttpError(400, 'invalid_account', 'Enter your username or email.');
      if (!options.mailer || !options.publicUrl) throw new HttpError(503, 'not_configured', 'Email resets are not set up yet. Use your recovery code instead.');
      const login = body.login.trim();
      const found = login.includes('@') ? await store.findAccountByEmail(login) : await store.findAccountByUsername(login);
      // Same answer whether or not the account exists or has an email, so this can't be used to find accounts.
      const answer = { ok: true, message: 'If that account has an email address, a reset link is on its way. Check your inbox and spam folder.' };
      if (found?.email && (lastResetEmail.get(found.id) ?? -Infinity) + RESET_EMAIL_COOLDOWN <= now()) {
        lastResetEmail.set(found.id, now());
        const token = newToken();
        await store.createPasswordReset(found.id, tokenDigest(token), now() + resetTtl);
        const link = `${options.publicUrl}/reset-password?token=${token}`;
        try { await options.mailer.send(resetEmail(found.email, found.username, link, Math.round(resetTtl / 60_000))); }
        catch (error) { console.error('Reset email failed:', error instanceof Error ? error.message : 'unknown'); }
      }
      sendJson(res, 200, answer);
    },
    'POST /auth/recover': async (req, res, rate) => {
      consume(rate.auth, limits.auth, res);
      const body = only(await readJson(req, maxBody), ['username', 'recoveryCode', 'newPassword']);
      if (typeof body.username !== 'string' || typeof body.recoveryCode !== 'string' || body.username.length > 40 || body.recoveryCode.length > 40) {
        throw new HttpError(400, 'invalid_account', 'Enter your username and recovery code.');
      }
      const problem = passwordProblem(body.newPassword);
      if (problem) throw new HttpError(400, 'invalid_account', problem);
      const key = `recover:${body.username}`;
      checkLockout(key, res);
      const found = await store.findAccountByUsername(body.username);
      if (!found || !sameDigest(recoveryDigest(body.recoveryCode), found.recoveryHash)) {
        recordFailure(key);
        throw new HttpError(401, 'invalid_recovery', 'That username and recovery code don\'t match.');
      }
      failures.delete(failureKey(key));
      await store.updatePassword(found.id, await hashPassword(body.newPassword as string));
      await store.deleteSessionsFor(found.id);
      // A recovery code works once: hand back a new one along with a fresh session.
      const recoveryCode = await freshRecoveryCode(found.id);
      sendJson(res, 200, { ...(await issueSession(found)), entitlements: await entitlements(found.id), recoveryCode });
    },
    'GET /reset-password': async (req, res) => {
      const token = new URL(req.url ?? '/', 'http://x').searchParams.get('token') ?? '';
      const valid = TOKEN_PATTERN.test(token) && await store.findPasswordReset(tokenDigest(token), now());
      if (!valid) { sendHtml(res, resetInvalidPage(options.pages), { status: 410, form: true }); return; }
      sendHtml(res, resetFormPage(token, null, options.pages), { form: true });
    },
    'POST /reset-password': async (req, res, rate) => {
      consume(rate.auth, limits.auth, res);
      const form = await readForm(req, maxBody);
      const token = form.get('token') ?? '', password = form.get('password') ?? '', confirm = form.get('confirm') ?? '';
      if (!TOKEN_PATTERN.test(token)) { sendHtml(res, resetInvalidPage(options.pages), { status: 410, form: true }); return; }
      const problem = passwordProblem(password) ?? (password !== confirm ? 'The two passwords don\'t match.' : null);
      if (problem) {
        if (!(await store.findPasswordReset(tokenDigest(token), now()))) { sendHtml(res, resetInvalidPage(options.pages), { status: 410, form: true }); return; }
        sendHtml(res, resetFormPage(token, problem, options.pages), { status: 400, form: true }); return;
      }
      const userId = await store.consumePasswordReset(tokenDigest(token), now());
      if (!userId) { sendHtml(res, resetInvalidPage(options.pages), { status: 410, form: true }); return; }
      await store.updatePassword(userId, await hashPassword(password));
      await store.deleteSessionsFor(userId);
      sendHtml(res, resetDonePage(options.pages), { form: true });
    },
    'POST /me/password': async (req, res, rate) => {
      consume(rate.auth, limits.auth, res);
      const { account } = await authenticate(req, true);
      const body = only(await readJson(req, maxBody), ['currentPassword', 'newPassword']);
      if (typeof body.currentPassword !== 'string' || !(await verifyPassword(body.currentPassword, account.passwordHash))) {
        throw new HttpError(401, 'invalid_login', 'Your current password is wrong.');
      }
      const problem = passwordProblem(body.newPassword);
      if (problem) throw new HttpError(400, 'invalid_account', problem);
      await store.updatePassword(account.id, await hashPassword(body.newPassword as string));
      // Sign out every other device, then hand this device a fresh session.
      await store.deleteSessionsFor(account.id);
      sendJson(res, 200, await issueSession(account));
    },
    'POST /me/delete': async (req, res, rate) => {
      consume(rate.auth, limits.auth, res);
      const { account } = await authenticate(req, true);
      const body = only(await readJson(req, maxBody), ['password']);
      await requirePassword(account, body.password, 'Enter your current password to delete your account.');
      await store.deleteAccount(account.id);
      sendJson(res, 200, { ok: true, deleted: true });
    },
    'GET /leaderboard': async (_req, res) => {
      const players = await store.leaderboard(50);
      sendJson(res, 200, { players: players.map(({ username, rating, gamesPlayed, wins, losses, draws }) => ({ username, rating, gamesPlayed, wins, losses, draws })) });
    },
    'POST /purchases/verify': async (req, res, rate) => {
      consume(rate.purchases, limits.purchases, res);
      const auth = await authenticate(req, false);
      const body = only(await readJson(req, maxBody), ['platform', 'productId', 'purchaseToken']);
      if ((body.platform !== 'ios' && body.platform !== 'android') || !isProductId(body.productId) ||
          typeof body.purchaseToken !== 'string' || body.purchaseToken.length > 12_000) {
        throw new HttpError(400, 'invalid_receipt', 'Invalid purchase details.');
      }
      if (!options.receipts) throw new HttpError(503, 'not_configured', 'Purchases are not configured on the server.');
      const verified = await options.receipts.verify(body.platform, body.productId, body.purchaseToken);
      if (auth) await store.recordPurchase(auth.account.id, verified);
      const owned = new Set(auth ? await store.ownedProducts(auth.account.id) : []);
      owned.add(verified.productId);
      sendJson(res, 200, { verified: { productId: verified.productId, platform: verified.platform }, entitlements: grantsFor(owned) });
    },
  };

  const server = createServer({ maxHeaderSize: 16384, requestTimeout: 15_000, headersTimeout: 15_000 }, (req, res) => {
    void (async () => {
      res.setHeader('Vary', 'Origin');
      const origin = req.headers.origin;
      const path = (req.url ?? '/').split('?')[0];
      const page = ['/', '/privacy', '/terms', '/account-deletion', '/support', '/app-ads.txt', '/health', '/reset-password'].includes(path) && (req.method === 'GET' || path === '/reset-password');
      if (origin && !page) {
        if (!origins.has(origin)) throw new HttpError(403, 'origin_denied', 'Origin is not allowed.');
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Expose-Headers', 'Retry-After');
      }
      const key = clientAddress(req, trustHops);
      let rate = rates.get(key);
      if (!rate) {
        if (rates.size >= limits.keys) sweep();
        if (rates.size >= limits.keys) throw new HttpError(503, 'capacity', 'Server is busy. Try again shortly.');
        rate = { requests: window(), auth: window(), purchases: window() };
        rates.set(key, rate);
      }
      consume(rate.requests, limits.requests, res);
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Max-Age', '600');
        res.writeHead(204); res.end(); return;
      }
      const route = routes[`${req.method} ${path}`];
      if (!route) throw new HttpError(404, 'not_found', 'Not found.');
      await route(req, res, rate);
    })().catch((error: unknown) => {
      if (!req.complete) res.setHeader('Connection', 'close');
      if (error instanceof HttpError) sendJson(res, error.status, { error: { code: error.code, message: error.message } });
      else if (error instanceof ReceiptError) sendJson(res, error.code === 'invalid_receipt' ? 400 : 503, { error: { code: error.code, message: error.message } });
      else {
        console.error('API error:', error instanceof Error ? error.message : 'unknown');
        sendJson(res, 500, { error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } });
      }
    });
  });
  server.keepAliveTimeout = 65_000;

  return {
    server,
    /** The request handler, for mounting inside another HTTP server (see server/main.ts). */
    handle: server.listeners('request')[0] as RequestListener,
    async listen() {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port ?? 8788, options.host ?? '127.0.0.1', () => { server.off('error', reject); resolve(); });
      });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing TCP address.');
      return { host: address.address, port: address.port };
    },
    async close() {
      clearInterval(sweeper);
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
    },
  };
}
