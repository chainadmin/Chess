import { Pool, PoolClient } from 'pg';
import { calculateRating, INITIAL_RATING } from '../../src/game/rating';
import { Account, FinishedMatch, normalizeUsername, Profile, PurchaseRecord, Settlement, Store } from './store';

const MIGRATION_LOCK = 724_031_117;
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  username_key text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  rating integer NOT NULL DEFAULT ${INITIAL_RATING},
  games_played integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_rating_idx ON users (rating DESC) WHERE games_played > 0;
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);
CREATE TABLE IF NOT EXISTS games (
  id text PRIMARY KEY,
  white_id uuid REFERENCES users(id) ON DELETE SET NULL,
  black_id uuid REFERENCES users(id) ON DELETE SET NULL,
  outcome text NOT NULL CHECK (outcome IN ('white', 'black', 'draw')),
  reason text NOT NULL,
  moves jsonb NOT NULL,
  white_rating_before integer, white_rating_after integer,
  black_rating_before integer, black_rating_after integer,
  ended_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS games_white_idx ON games (white_id);
CREATE INDEX IF NOT EXISTS games_black_idx ON games (black_id);
CREATE TABLE IF NOT EXISTS purchases (
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  transaction_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (platform, transaction_id)
);
CREATE INDEX IF NOT EXISTS purchases_user_idx ON purchases (user_id);
`;

type UserRow = {
  id: string; username: string; password_hash: string; created_at: Date;
  rating: number; games_played: number; wins: number; losses: number; draws: number;
};
const account = (row: UserRow): Account => ({ id: row.id, username: row.username, passwordHash: row.password_hash, createdAt: row.created_at.getTime() });
const profile = (row: UserRow): Profile => ({
  id: row.id, username: row.username, rating: row.rating, gamesPlayed: row.games_played,
  wins: row.wins, losses: row.losses, draws: row.draws, createdAt: row.created_at.getTime(),
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Railway Postgres. Set DATABASE_URL to the Postgres service's private URL. */
export class PostgresStore implements Store {
  readonly pool: Pool;
  constructor(connectionString: string, options: { max?: number } = {}) {
    // Railway's private network (*.railway.internal) is not TLS; public proxy URLs are.
    const internal = /\.railway\.internal(:\d+)?\//.test(connectionString) || /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString) || connectionString.includes('host=/');
    this.pool = new Pool({
      connectionString, max: options.max ?? 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000,
      ...(internal || /sslmode=disable/.test(connectionString) ? {} : { ssl: { rejectUnauthorized: false } }),
    });
    this.pool.on('error', () => console.error('Postgres pool error; the connection will be replaced.'));
  }

  async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
      await client.query(SCHEMA);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => undefined);
      client.release();
    }
  }

  async createAccount(username: string, passwordHash: string) {
    const result = await this.pool.query<UserRow>(
      `INSERT INTO users (username, username_key, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (username_key) DO NOTHING RETURNING *`, [username, normalizeUsername(username), passwordHash]);
    return result.rows[0] ? account(result.rows[0]) : 'taken' as const;
  }
  async findAccountByUsername(username: string) {
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE username_key = $1', [normalizeUsername(username)]);
    return result.rows[0] ? account(result.rows[0]) : null;
  }
  async findAccountById(id: string) {
    if (!UUID.test(id)) return null;
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? account(result.rows[0]) : null;
  }
  async updatePassword(userId: string, passwordHash: string) {
    await this.pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash]);
  }
  async deleteAccount(userId: string) {
    // Sessions and purchases cascade; finished games keep the opponent's history with this player anonymized.
    await this.pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }
  async createSession(userId: string, tokenHash: string, expiresAt: number) {
    await this.pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, new Date(expiresAt)]);
    // Opportunistic cleanup keeps the table small without a cron job.
    if (Math.random() < 0.02) await this.pool.query('DELETE FROM sessions WHERE expires_at < now()').catch(() => undefined);
  }
  async findSession(tokenHash: string, now: number) {
    const result = await this.pool.query<UserRow>(
      `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1 AND sessions.expires_at > $2`, [tokenHash, new Date(now)]);
    return result.rows[0] ? account(result.rows[0]) : null;
  }
  async deleteSession(tokenHash: string) { await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]); }
  async deleteSessionsFor(userId: string) { await this.pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]); }
  async profile(userId: string) {
    if (!UUID.test(userId)) return null;
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0] ? profile(result.rows[0]) : null;
  }
  async leaderboard(limit: number) {
    const result = await this.pool.query<UserRow>(
      'SELECT * FROM users WHERE games_played > 0 ORDER BY rating DESC, username_key ASC LIMIT $1', [limit]);
    return result.rows.map(profile);
  }

  async settleMatch(match: FinishedMatch): Promise<Settlement | 'duplicate'> {
    return this.transaction(async client => {
      // Lock both players FIRST, in a stable order. Inserting the game row before
      // this would take foreign-key share locks that deadlock concurrent settlements.
      const ids = [match.whiteId, match.blackId].filter(id => UUID.test(id)).sort();
      const rows = ids.length ? (await client.query<UserRow>('SELECT * FROM users WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [ids])).rows : [];
      const present = new Set(rows.map(row => row.id));
      const inserted = await client.query(
        `INSERT INTO games (id, white_id, black_id, outcome, reason, moves)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING RETURNING id`,
        [match.matchId, present.has(match.whiteId) ? match.whiteId : null, present.has(match.blackId) ? match.blackId : null,
          match.outcome, match.reason, JSON.stringify(match.moves)]);
      if (!inserted.rowCount) return 'duplicate';
      const white = rows.find(row => row.id === match.whiteId), black = rows.find(row => row.id === match.blackId);
      const settlement: Settlement = {};
      for (const [color, row, opponent] of [['white', white, black], ['black', black, white]] as const) {
        if (!row) continue;
        const outcome = match.outcome === 'draw' ? 'draw' : match.outcome === color ? 'win' : 'loss';
        const change = calculateRating({ value: row.rating, gamesPlayed: row.games_played }, opponent?.rating ?? INITIAL_RATING, outcome);
        settlement[color] = { before: change.before, after: change.after };
      }
      for (const [color, row] of [['white', white], ['black', black]] as const) {
        const change = settlement[color];
        if (!row || !change) continue;
        const outcome = match.outcome === 'draw' ? 'draws' : match.outcome === color ? 'wins' : 'losses';
        await client.query(`UPDATE users SET rating = $2, games_played = games_played + 1, ${outcome} = ${outcome} + 1 WHERE id = $1`, [row.id, change.after]);
        await client.query(`UPDATE games SET ${color}_rating_before = $2, ${color}_rating_after = $3 WHERE id = $1`, [match.matchId, change.before, change.after]);
      }
      return settlement;
    });
  }

  async recordPurchase(userId: string, purchase: PurchaseRecord) {
    // The first account to present a store transaction keeps it.
    await this.pool.query(
      `INSERT INTO purchases (platform, transaction_id, user_id, product_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (platform, transaction_id) DO NOTHING`, [purchase.platform, purchase.transactionId, userId, purchase.productId]);
  }
  async ownedProducts(userId: string) {
    const result = await this.pool.query<{ product_id: string }>('SELECT DISTINCT product_id FROM purchases WHERE user_id = $1', [userId]);
    return result.rows.map(row => row.product_id);
  }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
  async close() { await this.pool.end(); }
}

/** DATABASE_URL set → Postgres; otherwise in-memory for local development only. */
export async function storeFromEnv(): Promise<Store> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production.');
    const { MemoryStore } = await import('./store');
    console.warn('DATABASE_URL not set: using an in-memory store. Data is lost on restart.');
    return new MemoryStore();
  }
  const store = new PostgresStore(url);
  await store.migrate();
  return store;
}
