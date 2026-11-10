import { randomUUID } from 'node:crypto';
import { FinishedMatchSummary, OnlineAuthority } from '../../src/online/OnlineAuthority';
import { createOnlineServer } from '../httpServer';
import { envInt, envOrigins } from '../shared/http';
import { TOKEN_PATTERN, tokenDigest } from '../shared/passwords';
import { storeFromEnv } from '../shared/postgres';
import { Store } from '../shared/store';

/**
 * Settles each finished match into Postgres (game record + both ratings).
 * Retries with backoff so a brief database hiccup never loses a result; the
 * matchId makes settlement idempotent.
 */
export function createSettler(store: Store, log: (message: string) => void = console.log) {
  const pending = new Set<string>();
  const settle = (match: FinishedMatchSummary, attempt = 0) => {
    pending.add(match.matchId);
    store.settleMatch({
      matchId: match.matchId, whiteId: match.white.id, blackId: match.black.id,
      outcome: match.outcome, reason: match.reason, moves: match.moves,
    }).then(() => { pending.delete(match.matchId); }).catch(error => {
      if (attempt >= 8) { pending.delete(match.matchId); log(`Failed to settle match ${match.matchId}: ${error instanceof Error ? error.message : error}`); return; }
      const timer = setTimeout(() => settle(match, attempt + 1), Math.min(60_000, 1000 * 2 ** attempt));
      timer.unref();
    });
  };
  return { settle, pending };
}

/** Railway service #2: live games only. Accounts are verified against the shared database. */
async function main() {
  const production = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
  const store = await storeFromEnv();
  const settler = createSettler(store);
  const authority = new OnlineAuthority({ matchId: randomUUID, rated: true, onFinished: settler.settle });
  const app = createOnlineServer({
    authority,
    host: process.env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1'),
    port: envInt('PORT', 8787),
    allowedOrigins: envOrigins('ALLOWED_ORIGINS', ['http://localhost:8081', 'http://127.0.0.1:8081']),
    trustProxyHops: envInt('TRUST_PROXY_HOPS', production ? 1 : 0),
    maxSessions: envInt('MAX_PLAYERS', 5000),
    maxConnections: envInt('MAX_CONNECTIONS', 5000),
    maxRateKeys: envInt('MAX_RATE_KEYS', 20_000),
    accounts: {
      async verify(token) {
        if (!TOKEN_PATTERN.test(token)) return null;
        const account = await store.findSession(tokenDigest(token), Date.now());
        return account ? { id: account.id, displayName: account.username } : null;
      },
    },
  });
  const { host, port } = await app.listen();
  console.log(`ShiftChess game server listening on ${host}:${port}`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void (async () => {
        await app.close();
        // Give in-flight settlements a moment to finish before closing the pool.
        for (let i = 0; i < 50 && settler.pending.size; i++) await new Promise(resolve => setTimeout(resolve, 100));
        await store.close();
      })().catch(() => { process.exitCode = 1; });
    });
  }
}
if (require.main === module) main().catch(error => { console.error('Unable to start the game server:', error instanceof Error ? error.message : error); process.exit(1); });
