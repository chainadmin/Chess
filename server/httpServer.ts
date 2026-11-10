import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer, IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { OnlineAuthority } from '../src/online/OnlineAuthority';
import { AuthenticatedPlayer, OnlineError, OnlineState, parseOnlineCommand } from '../src/online/protocol';
import { clientAddress } from './shared/http';

export type ServerOptions = {
  host?: string; port?: number; allowedOrigins?: string[];
  maxBodyBytes?: number; maxSessions?: number; sessionTtlMs?: number;
  maxConnections?: number; maxRateKeys?: number;
  requestsPerMinute?: number; sessionsPerMinute?: number;
  commandsPerMinute?: number; aggregateRequestsPerMinute?: number;
  authority?: OnlineAuthority; now?: () => number;
  /**
   * Production mode: verify bearer tokens issued by the accounts API instead of
   * minting guest sessions. Verified identities are cached for cacheMs so normal
   * play never waits on the database.
   */
  accounts?: { verify(token: string): Promise<AuthenticatedPlayer | null>; cacheMs?: number };
  /** 1 behind Railway's edge proxy; 0 (default) ignores forwarded headers. */
  trustProxyHops?: number;
  /** Longest time a sync with waitForRevision is held open. */
  longPollMaxMs?: number;
};
class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
function positive(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}

/** Single-process game server. Guest sessions by default; account tokens when `accounts` is set. */
export function createOnlineServer(options: ServerOptions = {}) {
  const authority = options.authority ?? new OnlineAuthority({ matchId: randomUUID });
  const now = options.now ?? Date.now;
  const maxBody = positive(options.maxBodyBytes ?? 4096, 'maxBodyBytes');
  const maxSessions = positive(options.maxSessions ?? 1000, 'maxSessions');
  const ttl = positive(options.sessionTtlMs ?? 24 * 60 * 60 * 1000, 'sessionTtlMs');
  const maxRateKeys = positive(options.maxRateKeys ?? 2000, 'maxRateKeys');
  const requestLimit = positive(options.requestsPerMinute ?? 300, 'requestsPerMinute');
  const commandLimit = positive(options.commandsPerMinute ?? 300, 'commandsPerMinute');
  const aggregateLimit = positive(options.aggregateRequestsPerMinute ?? 12_000, 'aggregateRequestsPerMinute');
  const sessionLimit = positive(options.sessionsPerMinute ?? 20, 'sessionsPerMinute');
  const accountsMode = options.accounts;
  const accountCacheMs = positive(accountsMode?.cacheMs ?? 60_000, 'cacheMs');
  const trustHops = options.trustProxyHops ?? 0;
  const longPollMax = positive(options.longPollMaxMs ?? 15_000, 'longPollMaxMs');
  const origins = new Set(options.allowedOrigins ?? ['http://localhost:8081', 'http://127.0.0.1:8081']);
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) throw new Error('CORS origins must be exact HTTP(S) origins.');
  }
  type Window = { resetAt: number; count: number };
  const window = (): Window => ({ resetAt: now() + 60_000, count: 0 });
  const consume = (budget: Window, limit: number, res: ServerResponse) => {
    const time = now();
    if (budget.resetAt <= time) { budget.resetAt = time + 60_000; budget.count = 0; }
    if (budget.count >= limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((budget.resetAt - time) / 1000))));
      throw new HttpError(429, 'rate_limited', 'Too many requests. Try again later.');
    }
    budget.count++;
  };
  const matchGraceMs = 2 * 60 * 60 * 1000;
  const resultGraceMs = 60_000;
  const sessions = new Map<string, {
    player: AuthenticatedPlayer; expiresAt: number; commands: Window;
    grace?: { matchId: string; until: number };
  }>();
  const rates = new Map<string, { anonymous: Window; aggregate: Window; sessions: Window }>();
  const accounts = new Map<string, { player: AuthenticatedPlayer; checkedAt: number; commands: Window }>();
  const waiters = new Set<() => void>();
  const unsubscribe = authority.onChange(() => { for (const waiter of [...waiters]) waiter(); });
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const sweep = () => {
    const time = now();
    for (const [key, session] of sessions) if (session.expiresAt <= time) {
      authority.dropQueuedPlayer(session.player.id);
      const lifetime = authority.currentMatchLifetime(session.player.id);
      if (!session.grace && lifetime && lifetime.terminalAgeMs === undefined) {
        session.grace = { matchId: lifetime.matchId, until: session.expiresAt + matchGraceMs };
      }
      if (session.grace && lifetime?.matchId === session.grace.matchId) {
        if (lifetime.terminalAgeMs !== undefined) {
          session.grace.until = Math.min(session.grace.until, time + Math.max(0, resultGraceMs - lifetime.terminalAgeMs));
        }
        if (time < session.grace.until) continue;
      }
      sessions.delete(key);
    }
    for (const [key, account] of accounts) if (account.checkedAt + accountCacheMs <= time) accounts.delete(key);
    for (const [key, rate] of rates) if (Math.max(rate.anonymous.resetAt, rate.aggregate.resetAt, rate.sessions.resetAt) <= time) rates.delete(key);
  };
  const send = (res: ServerResponse, status: number, body: unknown) => {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(body));
  };
  const readJson = async (req: IncomingMessage): Promise<unknown> => {
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      throw new HttpError(415, 'unsupported_media_type', 'Send application/json.');
    }
    if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') {
      throw new HttpError(415, 'unsupported_encoding', 'Compressed request bodies are not supported.');
    }
    if (Number(req.headers['content-length']) > maxBody) throw new HttpError(413, 'body_too_large', 'Request body is too large.');
    // Event listeners, rather than an aborted async iterator, preserve the socket
    // long enough to deliver a deterministic 413 for chunked oversized bodies.
    return await new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      const cleanup = () => { req.off('data', data); req.off('end', end); req.off('error', error); req.off('aborted', aborted); };
      const error = () => { cleanup(); reject(new HttpError(400, 'invalid_body', 'Incomplete request body.')); };
      const aborted = error;
      const data = (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maxBody) { cleanup(); req.pause(); reject(new HttpError(413, 'body_too_large', 'Request body is too large.')); }
        else chunks.push(chunk);
      };
      const end = () => {
        cleanup();
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reject(new HttpError(400, 'invalid_json', 'Request body must be valid JSON.')); }
      };
      req.on('data', data); req.on('end', end); req.on('error', error); req.on('aborted', aborted);
    });
  };
  /** Long-poll: hold a sync until the match revision moves, the game ends or the wait expires. */
  const answer = async (player: AuthenticatedPlayer, body: unknown, req: IncomingMessage): Promise<OnlineState> => {
    const command = parseOnlineCommand(body);
    if (command.type === 'sync' && command.matchId !== undefined && command.waitForRevision !== undefined) {
      const { matchId, waitForRevision } = command;
      const unchanged = () => {
        const current = authority.revisionFor(player.id, matchId);
        return !!current && current.active && current.revision === waitForRevision;
      };
      if (unchanged()) {
        await new Promise<void>(resolve => {
          const done = () => { clearTimeout(timer); waiters.delete(check); req.socket.off('close', done); resolve(); };
          const check = () => { if (closed || !unchanged()) done(); };
          const timer = setTimeout(done, longPollMax);
          waiters.add(check);
          req.socket.once('close', done);
        });
      }
    }
    return authority.handle(player, body);
  };
  const server = createServer({ maxHeaderSize: 8192, requestTimeout: 10_000, headersTimeout: 10_000 }, (req, res) => {
    void (async () => {
      res.setHeader('Vary', 'Origin');
      const origin = req.headers.origin;
      if (origin && !origins.has(origin)) throw new HttpError(403, 'origin_denied', 'Origin is not allowed.');
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Expose-Headers', 'Retry-After');
      }
      sweep();
      // Forwarded headers count only when explicitly configured for a known proxy.
      const key = clientAddress(req, trustHops);
      let rate = rates.get(key);
      if (!rate) {
        if (rates.size >= maxRateKeys) throw new HttpError(503, 'capacity', 'Server is at capacity. Try again later.');
        rate = { anonymous: window(), aggregate: window(), sessions: window() }; rates.set(key, rate);
      }
      // Only a valid credential on the command endpoint earns an isolated budget.
      // Invalid credentials and arbitrary tokens never allocate extra rate keys.
      const auth = req.headers.authorization;
      const match = req.method === 'POST' && req.url === '/command' && typeof auth === 'string'
        ? /^Bearer ([A-Za-z0-9_-]{43})$/.exec(auth) : null;
      const session = match && !accountsMode ? sessions.get(digest(match[1])) : undefined;
      const cachedAccount = match && accountsMode ? accounts.get(digest(match[1])) : undefined;
      if (session) consume(session.commands, commandLimit, res);
      else if (cachedAccount) consume(cachedAccount.commands, commandLimit, res);
      else consume(rate.anonymous, requestLimit, res);
      // Reject a single exhausted credential before charging the shared circuit
      // breaker, so repeated rejected requests cannot starve neighboring players.
      consume(rate.aggregate, aggregateLimit, res);
      if (req.method === 'OPTIONS' && ['/session', '/command'].includes(req.url ?? '')) {
        res.setHeader('Access-Control-Allow-Methods', 'POST');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Max-Age', '600');
        res.writeHead(204); res.end(); return;
      }
      if (req.method === 'GET' && req.url === '/health') { send(res, 200, { ok: true, service: 'online', mode: accountsMode ? 'accounts' : 'development-guest', protocolVersion: 1 }); return; }
      if (req.method !== 'POST' || !['/session', '/command'].includes(req.url ?? '') || (accountsMode && req.url === '/session')) throw new HttpError(404, 'not_found', 'Endpoint not found.');
      if (accountsMode) {
        let account = cachedAccount;
        if (!account) {
          const player = match ? await accountsMode.verify(match[1]) : null;
          if (!player) throw new HttpError(401, 'unauthenticated', 'Please log in to play online.');
          if (accounts.size >= maxSessions) sweep();
          if (accounts.size >= maxSessions) throw new HttpError(503, 'capacity', 'Server is at capacity. Try again later.');
          account = { player, checkedAt: now(), commands: window() };
          accounts.set(digest(match![1]), account);
        }
        const body = await readJson(req);
        send(res, 200, await answer(account.player, body, req));
        return;
      }
      if (req.url === '/session') {
        consume(rate.sessions, sessionLimit, res);
        const body = await readJson(req);
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) throw new HttpError(400, 'invalid_session', 'Guest creation requires an empty JSON object.');
        if (sessions.size >= maxSessions) throw new HttpError(503, 'capacity', 'Guest capacity reached. Try again later.');
        const token = randomBytes(32).toString('base64url');
        const player = { id: randomUUID(), displayName: `Guest ${randomBytes(4).toString('hex')}` };
        const expiresAt = now() + ttl;
        sessions.set(digest(token), { player, expiresAt, commands: window() });
        send(res, 201, { token, player, expiresAt }); return;
      }
      if (!session) throw new HttpError(401, 'unauthenticated', 'A valid server-issued guest session is required.');
      const body = await readJson(req);
      // Recheck all identities after a slow body, before any matchmaking.
      sweep();
      // A slow body must not revive a session removed by expiration/retirement.
      if (!match || sessions.get(digest(match[1])) !== session) throw new HttpError(401, 'unauthenticated', 'Guest session expired.');
      if (session.expiresAt <= now()) {
        if (!session.grace || session.grace.until <= now()) throw new HttpError(401, 'unauthenticated', 'Guest session expired.');
        const command = parseOnlineCommand(body);
        if (!['sync', 'move', 'resign'].includes(command.type) ||
            ('matchId' in command && command.matchId !== undefined && command.matchId !== session.grace.matchId)) {
          throw new HttpError(403, 'session_scope', 'Expired guest may only finish its existing match.');
        }
        // A sync without an ID must never drift to a different current match.
        const scoped = { ...command, matchId: session.grace.matchId };
        send(res, 200, authority.handle(session.player, scoped));
      } else send(res, 200, await answer(session.player, body, req));
      // Start terminal retention immediately after a mutation, not at next poll.
      sweep();
    })().catch((error: unknown) => {
      // Close unread/oversized requests without draining an unbounded attacker body.
      if (!req.complete) res.setHeader('Connection', 'close');
      if (error instanceof HttpError) send(res, error.status, { error: { code: error.code, message: error.message } });
      else if (error instanceof OnlineError) send(res, error.code === 'capacity' ? 503 : error.code === 'invalid_command' ? 400 : error.code === 'unauthenticated' ? 401 : 409, { error: { code: error.code, message: error.message } });
      else send(res, 500, { error: { code: 'internal_error', message: 'Server error.' } });
    });
  });
  server.maxConnections = positive(options.maxConnections ?? 100, 'maxConnections');
  server.keepAliveTimeout = 5000;
  server.setTimeout(Math.max(10_000, longPollMax + 10_000), socket => socket.destroy());
  /** Clock ticks and expiry sweeps. listen() starts them; a combined server calls this itself. */
  const startTimers = () => {
    if (timer) return;
    timer = setInterval(() => { sweep(); authority.tick(); }, 250);
    timer.unref();
  };
  return {
    server,
    /** The request handler, for mounting inside another HTTP server (see server/main.ts). */
    handle: server.listeners('request')[0] as RequestListener,
    startTimers,
    async listen() {
      if (closed || server.listening) throw new Error('Server is already started or closed.');
      const port = options.port ?? 8787;
      if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw new Error('port must be 0–65535.');
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, options.host ?? '127.0.0.1', () => { server.off('error', reject); resolve(); });
      });
      startTimers();
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing TCP address.');
      return { host: address.address, port: address.port };
    },
    async close() {
      closed = true;
      if (timer) clearInterval(timer);
      unsubscribe();
      for (const waiter of [...waiters]) waiter();
      sessions.clear(); rates.clear(); accounts.clear();
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    },
  };
}
