import { envInt, envOrigins } from '../shared/http';
import { storeFromEnv } from '../shared/postgres';
import { createApiServer } from './app';
import { mailerFromEnv } from './mailer';
import { receiptVerifierFromEnv } from './receipts';

/** Railway service #1: accounts, purchases and the /privacy page. */
async function main() {
  const production = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
  const store = await storeFromEnv();
  const app = createApiServer({
    store,
    receipts: receiptVerifierFromEnv(),
    host: process.env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1'),
    port: envInt('PORT', 8788),
    allowedOrigins: envOrigins('ALLOWED_ORIGINS', ['http://localhost:8081', 'http://127.0.0.1:8081']),
    trustProxyHops: envInt('TRUST_PROXY_HOPS', production ? 1 : 0),
    mailer: mailerFromEnv(),
    // Base address for reset links. Railway provides RAILWAY_PUBLIC_DOMAIN once a domain is generated.
    publicUrl: process.env.PUBLIC_URL ?? (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${envInt('PORT', 8788)}`),
    pages: { owner: process.env.APP_OWNER ?? 'Chain Software Group', appName: 'ShiftChess', contactEmail: process.env.PRIVACY_CONTACT_EMAIL || undefined },
  });
  const { host, port } = await app.listen();
  console.log(`ShiftChess accounts API listening on ${host}:${port}`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void app.close().then(() => store.close()).catch(() => { process.exitCode = 1; }); });
  }
}
main().catch(error => { console.error('Unable to start the accounts API:', error instanceof Error ? error.message : error); process.exit(1); });
