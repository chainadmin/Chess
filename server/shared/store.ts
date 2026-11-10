import { randomUUID } from 'node:crypto';
import { calculateRating, INITIAL_RATING } from '../../src/game/rating';

export type Account = {
  id: string; username: string; passwordHash: string; createdAt: number;
  /** Optional; used only for password-reset emails. Stored lowercase. */
  email: string | null;
  /** sha256 of the account's one-time recovery code. */
  recoveryHash: string | null;
};
export type NewAccount = { email?: string | null; recoveryHash: string };
export type Profile = {
  id: string; username: string; rating: number; gamesPlayed: number;
  wins: number; losses: number; draws: number; createdAt: number;
};
export type MatchOutcome = 'white' | 'black' | 'draw';
export type FinishedMatch = {
  matchId: string; whiteId: string; blackId: string;
  outcome: MatchOutcome; reason: string; moves: string[];
};
export type Settlement = { white?: { before: number; after: number }; black?: { before: number; after: number } };
export type PurchaseRecord = { platform: 'ios' | 'android'; productId: string; transactionId: string };

/**
 * Durable storage used by BOTH Railway services. The accounts API owns users,
 * sessions and purchases; the game server only reads sessions and settles results.
 */
export interface Store {
  migrate(): Promise<void>;
  /** 'taken' = username in use; 'email_taken' = email already on another account. */
  createAccount(username: string, passwordHash: string, extra: NewAccount): Promise<Account | 'taken' | 'email_taken'>;
  findAccountByEmail(email: string): Promise<Account | null>;
  setEmail(userId: string, email: string | null): Promise<'ok' | 'email_taken'>;
  setRecoveryHash(userId: string, recoveryHash: string): Promise<void>;
  /** One-time reset links: stored hashed; consuming deletes the token atomically. */
  createPasswordReset(userId: string, tokenHash: string, expiresAt: number): Promise<void>;
  consumePasswordReset(tokenHash: string, now: number): Promise<string | null>;
  /** Peek without consuming (to render the reset form). */
  findPasswordReset(tokenHash: string, now: number): Promise<string | null>;
  findAccountByUsername(username: string): Promise<Account | null>;
  findAccountById(id: string): Promise<Account | null>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
  createSession(userId: string, tokenHash: string, expiresAt: number): Promise<void>;
  /** Returns the account only for an unexpired session. */
  findSession(tokenHash: string, now: number): Promise<Account | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteSessionsFor(userId: string): Promise<void>;
  profile(userId: string): Promise<Profile | null>;
  leaderboard(limit: number): Promise<Profile[]>;
  /** Idempotent by matchId; updates both ratings in one transaction. */
  settleMatch(match: FinishedMatch): Promise<Settlement | 'duplicate'>;
  recordPurchase(userId: string, purchase: PurchaseRecord): Promise<void>;
  ownedProducts(userId: string): Promise<string[]>;
  close(): Promise<void>;
}

export const normalizeUsername = (username: string) => username.trim().toLowerCase();
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

type Row = Account & { rating: number; gamesPlayed: number; wins: number; losses: number; draws: number };

/** In-memory Store for tests and local development without Postgres. */
export class MemoryStore implements Store {
  private users = new Map<string, Row>();
  private sessions = new Map<string, { userId: string; expiresAt: number }>();
  private matches = new Set<string>();
  private purchases = new Map<string, { userId: string } & PurchaseRecord>();
  private resets = new Map<string, { userId: string; expiresAt: number }>();

  async migrate() {}
  async createAccount(username: string, passwordHash: string, extra: NewAccount = { recoveryHash: '' }) {
    if ([...this.users.values()].some(user => normalizeUsername(user.username) === normalizeUsername(username))) return 'taken' as const;
    const email = extra.email ? normalizeEmail(extra.email) : null;
    if (email && [...this.users.values()].some(user => user.email === email)) return 'email_taken' as const;
    const row: Row = { id: randomUUID(), username, passwordHash, createdAt: Date.now(), email, recoveryHash: extra.recoveryHash || null, rating: INITIAL_RATING, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
    this.users.set(row.id, row);
    return this.account(row);
  }
  private account(row: Row): Account {
    return { id: row.id, username: row.username, passwordHash: row.passwordHash, createdAt: row.createdAt, email: row.email, recoveryHash: row.recoveryHash };
  }
  async findAccountByEmail(email: string) {
    const row = [...this.users.values()].find(user => user.email === normalizeEmail(email));
    return row ? this.account(row) : null;
  }
  async setEmail(userId: string, email: string | null) {
    const value = email ? normalizeEmail(email) : null;
    if (value && [...this.users.values()].some(user => user.email === value && user.id !== userId)) return 'email_taken' as const;
    const row = this.users.get(userId); if (row) row.email = value;
    return 'ok' as const;
  }
  async setRecoveryHash(userId: string, recoveryHash: string) { const row = this.users.get(userId); if (row) row.recoveryHash = recoveryHash; }
  async createPasswordReset(userId: string, tokenHash: string, expiresAt: number) {
    for (const [key, reset] of this.resets) if (reset.userId === userId) this.resets.delete(key); // newest link wins
    this.resets.set(tokenHash, { userId, expiresAt });
  }
  async findPasswordReset(tokenHash: string, now: number) {
    const reset = this.resets.get(tokenHash);
    return reset && reset.expiresAt > now && this.users.has(reset.userId) ? reset.userId : null;
  }
  async consumePasswordReset(tokenHash: string, now: number) {
    const userId = await this.findPasswordReset(tokenHash, now);
    this.resets.delete(tokenHash);
    return userId;
  }
  private toProfile(row: Row): Profile {
    return { id: row.id, username: row.username, rating: row.rating, gamesPlayed: row.gamesPlayed, wins: row.wins, losses: row.losses, draws: row.draws, createdAt: row.createdAt };
  }
  async findAccountByUsername(username: string) {
    const row = [...this.users.values()].find(user => normalizeUsername(user.username) === normalizeUsername(username));
    return row ? this.account(row) : null;
  }
  async findAccountById(id: string) { const row = this.users.get(id); return row ? this.account(row) : null; }
  async updatePassword(userId: string, passwordHash: string) { const row = this.users.get(userId); if (row) row.passwordHash = passwordHash; }
  async deleteAccount(userId: string) {
    this.users.delete(userId);
    for (const [key, session] of this.sessions) if (session.userId === userId) this.sessions.delete(key);
    for (const [key, purchase] of this.purchases) if (purchase.userId === userId) this.purchases.delete(key);
    for (const [key, reset] of this.resets) if (reset.userId === userId) this.resets.delete(key);
  }
  async createSession(userId: string, tokenHash: string, expiresAt: number) { this.sessions.set(tokenHash, { userId, expiresAt }); }
  async findSession(tokenHash: string, now: number) {
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= now) return null;
    const row = this.users.get(session.userId);
    return row ? this.account(row) : null;
  }
  async deleteSession(tokenHash: string) { this.sessions.delete(tokenHash); }
  async deleteSessionsFor(userId: string) { for (const [key, session] of this.sessions) if (session.userId === userId) this.sessions.delete(key); }
  async profile(userId: string) { const row = this.users.get(userId); return row ? this.toProfile(row) : null; }
  async leaderboard(limit: number) {
    return [...this.users.values()].filter(row => row.gamesPlayed > 0)
      .sort((a, b) => b.rating - a.rating || a.username.localeCompare(b.username)).slice(0, limit).map(row => this.toProfile(row));
  }
  async settleMatch(match: FinishedMatch) {
    if (this.matches.has(match.matchId)) return 'duplicate' as const;
    this.matches.add(match.matchId);
    const white = this.users.get(match.whiteId), black = this.users.get(match.blackId);
    const result: Settlement = {};
    const apply = (row: Row | undefined, opponent: Row | undefined, color: 'white' | 'black') => {
      if (!row) return;
      const outcome = match.outcome === 'draw' ? 'draw' : match.outcome === color ? 'win' : 'loss';
      const change = calculateRating({ value: row.rating, gamesPlayed: row.gamesPlayed }, opponent?.rating ?? INITIAL_RATING, outcome);
      result[color] = { before: change.before, after: change.after };
      return () => {
        row.rating = change.after; row.gamesPlayed++;
        if (outcome === 'win') row.wins++; else if (outcome === 'loss') row.losses++; else row.draws++;
      };
    };
    // Compute both changes from pre-game ratings, then commit.
    const commits = [apply(white, black, 'white'), apply(black, white, 'black')];
    commits.forEach(commit => commit?.());
    return result;
  }
  async recordPurchase(userId: string, purchase: PurchaseRecord) {
    const key = `${purchase.platform}:${purchase.transactionId}`;
    if (!this.purchases.has(key)) this.purchases.set(key, { userId, ...purchase });
  }
  async ownedProducts(userId: string) {
    return [...new Set([...this.purchases.values()].filter(purchase => purchase.userId === userId).map(purchase => purchase.productId))];
  }
  async close() {}
}
