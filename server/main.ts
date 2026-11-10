import { randomUUID } from 'node:crypto';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { OnlineAuthority } from '../src/online/OnlineAuthority';
import { createApiServer, ApiOptions } from './api/app';
import { mailerFromEnv } from './api/mailer';
import { receiptVerifierFromEnv } from './api/receipts';
import { createSettler } from './game/index';
import { createOnlineServer } from './httpServer';
import { envInt, envOrigins } from './shared/http';
import { TOKEN_PATTERN, tokenDigest } from './shared/passwords';
import { storeFromEnv } from './shared/postgres';
import { Store } from './shared/store';

/** Paths served by the live-game engine; everything else is accounts, purchases and web pages. */
const GAME_PATHS = new Set(['/command']);

export type CombinedOptions = {
  store: Store;
  host?: string; port?: number;
  allowedOrigins?: string[];
  trustProxyHops?: number;
  api?: Partial<Omit<ApiOptions, 'store' | 'host' | 'port' | 'allowedOrigins' | 'trustProxyHops'>>;
  game?: { longPollMaxMs?: number; maxPlayers?: number; maxConnections?: number; maxRateKeys?: number; authority?: OnlineAuthority };
};

/**
 * ONE Railway service: accounts, purchases, /privacy and password resets, plus
 * matchmaking and live games, on a single port. Both halves share the database;
 * games stay in memory for speed and results are saved as soon as a game ends.
 */
export function createCombinedServer(options: CombinedOptions) {
  const { store } = options;
  const settler = createSettler(store);
  const authority = options.game?.authority ?? new OnlineAuthority({ matchId: randomUUID, rated: true, onFinished: settler.settle });
  const shared = { allowedOrigins: options.allowedOrigins, trustProxyHops: options.trustProxyHops };
  const api = createApiServer({ store, ...shared, ...options.api });
  const game = createOnlineServer({
    authority, ...shared,
    longPollMaxMs: options.game?.longPollMaxMs,
    maxSessions: options.game?.maxPlayers ?? 5000,
    maxConnections: options.game?.maxConnections ?? 5000,
    maxRateKeys: options.game?.maxRateKeys ?? 20_000,
    accounts: {
      async verify(token) {
        if (!TOKEN_PATTERN.test(token)) return null;
        const account = await store.findSession(tokenDigest(token), Date.now());
        return account ? { id: account.id, displayName: account.username } : null;
      },
    },
  });
  const longPoll = options.game?.longPollMaxMs ?? 15_000;

  const server = createServer({ maxHeaderSize: 16384, requestTimeout: 15_000, headersTimeout: 15_000 }, (req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url ?? '/').split('?')[0];
    if (req.method === 'GET' && path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, service: 'shiftchess', protocolVersion: 1 }));
      return;
    }
    if (GAME_PATHS.has(path)) game.handle(req, res);
    else api.handle(req, res);
  });
  server.keepAliveTimeout = 65_000;
  // Long-polls hold a request open for up to longPoll ms with no bytes sent.
  server.setTimeout(longPoll + 15_000, socket => socket.destroy());
  server.maxConnections = options.game?.maxConnections ?? 5000;

  return {
    server,
    settler,
    async listen() {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port ?? 8080, options.host ?? '127.0.0.1', () => { server.off('error', reject); resolve(); });
      });
      game.startTimers();
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing TCP address.');
      return { host: address.address, port: address.port };
    },
    async close() {
      await game.close();
      await api.close();
      if (server.listening) await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
      for (let i = 0; i < 50 && settler.pending.size; i++) await new Promise(resolve => setTimeout(resolve, 100));
    },
  };
}

async function main() {
  const production = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
  const store = await storeFromEnv();
  const port = envInt('PORT', 8080);
  const app = createCombinedServer({
    store,
    host: process.env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1'),
    port,
    allowedOrigins: envOrigins('ALLOWED_ORIGINS', ['http://localhost:8081', 'http://127.0.0.1:8081']),
    trustProxyHops: envInt('TRUST_PROXY_HOPS', production ? 1 : 0),
    api: {
      receipts: receiptVerifierFromEnv(),
      mailer: mailerFromEnv(),
      // Base address for reset links. Railway provides RAILWAY_PUBLIC_DOMAIN once a domain is generated.
      publicUrl: process.env.PUBLIC_URL ?? (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${port}`),
      pages: { owner: process.env.APP_OWNER ?? 'Chain Software Group', appName: 'ShiftChess', contactEmail: process.env.PRIVACY_CONTACT_EMAIL || undefined },
    },
  });
  const { host, port: bound } = await app.listen();
  console.log(`ShiftChess server (accounts + online games) listening on ${host}:${bound}`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void app.close().then(() => store.close()).catch(() => { process.exitCode = 1; }); });
  }
}
if (require.main === module) main().catch(error => { console.error('Unable to start ShiftChess server:', error instanceof Error ? error.message : error); process.exit(1); });
