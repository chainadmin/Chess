import { makeMove, resign } from '../game/gameState';
import { createSession, GameSession, tickSession } from '../game/opponentFlow';
import { Color } from '../game/pieces';
import { applyMoveClock } from '../game/timers';
import {
  AuthenticatedPlayer, MatchSnapshot, ONLINE_QUEUE_ID, ONLINE_TIME_CONTROL,
  OnlineCommand, OnlineError, OnlineState, parseOnlineCommand, QUEUE_LEASE_MS,
} from './protocol';

type QueueEntry = { player: AuthenticatedPlayer; ticket: string; expiresAt: number };
type LiveMatch = {
  id: string;
  players: Record<Color, AuthenticatedPlayer>;
  session: GameSession;
  revision: number;
  lastClockAt: number;
  endedAt?: number;
  receipts: Map<string, string>;
};
type AuthorityLimits = { tickets: number; matches: number; requestsPerMatch: number };
type Options = {
  /** Hard admission limits, not unsafe expiry of consumed request/ticket IDs. */
  limits?: Partial<AuthorityLimits>;
  /** A monotonic server clock (performance.now), never a client timestamp. */
  now?: () => number;
  random?: () => number;
  matchId?: () => string;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const DEFAULT_LIMITS: AuthorityLimits = { tickets: 100_000, matches: 1_000, requestsPerMatch: 2_048 };
const RETAIN_FINISHED_MS = 60 * 60 * 1000;

/**
 * Single-process authoritative foundation. Run on a server, not in the app.
 * Identity is injected AFTER verification by a future authenticated transport.
 * All mutation below is synchronous: there is no await between match selection,
 * validation, clock debit, or commit. Multi-process production needs shared
 * persistence and transactional ownership; this prototype intentionally has none.
 */
export class OnlineAuthority {
  private readonly queue = new Map<string, QueueEntry>();
  private readonly matches = new Map<string, LiveMatch>();
  private readonly currentMatch = new Map<string, string>();
  private readonly usedTickets = new Map<string, Set<string>>();
  // Tickets have no issued-at epoch. Forgetting one would allow a delayed join
  // to undo a cancellation, so retain tombstones and fail closed at capacity.
  // Production should use durable identity epochs and a coordinated retirement policy.
  private ticketCount = 0;
  private readonly limits: AuthorityLimits;
  private lastNow = 0;
  private sequence = 0;
  private readonly clock: () => number;
  private readonly random: () => number;
  private readonly makeId: () => string;

  constructor(options: Options = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };
    if (Object.values(this.limits).some(value => !Number.isSafeInteger(value) || value < 1)) {
      throw new Error('Authority limits must be positive safe integers.');
    }
    this.clock = options.now ?? (() => performance.now());
    this.random = options.random ?? Math.random;
    this.makeId = options.matchId ?? (() => `match-${++this.sequence}`);
  }

  /** Throws OnlineError for rejected input. The caller can then request sync. */
  handle(player: AuthenticatedPlayer | null, raw: unknown): OnlineState {
    if (!player || typeof player.id !== 'string' || !player.id.trim() || player.id.length > 256 ||
        typeof player.displayName !== 'string' || !player.displayName.trim() || player.displayName.length > 80) {
      throw new OnlineError('unauthenticated', 'A verified player identity is required.');
    }
    // Do not let later caller mutations change queue membership or display names.
    const verified = { id: player.id, displayName: player.displayName };
    const command = parseOnlineCommand(raw);
    const now = this.readNow();
    this.sweep(now);

    if (command.type === 'queue.join') return this.join(verified, command.ticket, now);
    if (command.type === 'queue.cancel') {
      // Mark even a not-yet-arrived join as consumed: cancel wins that race.
      this.rememberTicket(verified.id, command.ticket);
      if (this.queue.get(verified.id)?.ticket === command.ticket) this.queue.delete(verified.id);
      // If pairing already won the race, surface the match. Never silently
      // abandon an opponent or resign a game from a stale queue cancellation.
      return this.stateFor(verified.id, now);
    }
    if (command.type === 'sync') {
      if (command.matchId) return this.snapshot(this.authorizedMatch(verified.id, command.matchId), verified.id, now);
      const entry = this.queue.get(verified.id);
      if (entry && entry.ticket === command.ticket) entry.expiresAt = now + QUEUE_LEASE_MS;
      return this.stateFor(verified.id, now);
    }
    return this.mutate(verified.id, command, now);
  }

  /** Call on a server timer even without incoming traffic; publish changed snapshots. */
  tick(): void {
    this.sweep(this.readNow());
  }

  /** Transport-only identity retirement: preserve matches and ticket tombstones. */
  dropQueuedPlayer(playerId: string): void {
    this.queue.delete(playerId);
  }

  /** Transport-only metadata; advance only this player's associated match. */
  currentMatchLifetime(playerId: string): { matchId: string; terminalAgeMs?: number } | undefined {
    const id = this.currentMatch.get(playerId);
    const match = id ? this.matches.get(id) : undefined;
    if (!match) return undefined;
    const now = this.readNow();
    this.advance(match, now);
    return { matchId: match.id, terminalAgeMs: match.endedAt === undefined ? undefined : now - match.endedAt };
  }

  private readNow(): number {
    const value = this.clock();
    if (!Number.isFinite(value) || value < 0) throw new Error('Invalid server clock.');
    // Defend against wall-clock rollback if an integrator supplies Date.now.
    this.lastNow = Math.max(this.lastNow, value);
    return this.lastNow;
  }

  private sweep(now: number): void {
    for (const [id, entry] of this.queue) if (entry.expiresAt <= now) this.queue.delete(id);
    for (const [id, match] of this.matches) {
      this.advance(match, now);
      if (match.endedAt !== undefined && now - match.endedAt >= RETAIN_FINISHED_MS) {
        this.matches.delete(id);
        for (const player of Object.values(match.players)) {
          if (this.currentMatch.get(player.id) === id) this.currentMatch.delete(player.id);
        }
      }
    }
  }

  private advance(match: LiveMatch, now: number): void {
    if (match.session.game.status !== 'active') return;
    const next = tickSession(match.session, now - match.lastClockAt);
    match.lastClockAt = now;
    match.session = next;
    if (next.game.status !== 'active') {
      match.revision++;
      match.endedAt = now;
    }
  }

  private rememberTicket(playerId: string, ticket: string): void {
    let tickets = this.usedTickets.get(playerId);
    if (tickets?.has(ticket)) return;
    if (this.ticketCount >= this.limits.tickets) {
      throw new OnlineError('capacity', 'Search capacity reached. Please try again later.');
    }
    if (!tickets) { tickets = new Set(); this.usedTickets.set(playerId, tickets); }
    tickets.add(ticket);
    this.ticketCount++;
  }

  private join(player: AuthenticatedPlayer, ticket: string, now: number): OnlineState {
    const current = this.currentMatch.get(player.id);
    if (current) {
      const match = this.matches.get(current)!;
      if (match.session.game.status === 'active') return this.snapshot(match, player.id, now);
    }
    const queued = this.queue.get(player.id);
    if (queued) {
      if (queued.ticket !== ticket) throw new OnlineError('already_queued', 'Cancel the existing search before starting another.');
      queued.expiresAt = now + QUEUE_LEASE_MS;
      return this.stateFor(player.id, now);
    }
    if (this.usedTickets.get(player.id)?.has(ticket)) throw new OnlineError('ticket_used', 'Start a new search with a new ticket.');

    if (this.matches.size >= this.limits.matches) {
      throw new OnlineError('capacity', 'Match capacity reached. Please try again later.');
    }

    // FIFO pairs only two different verified people. There is no bot fallback,
    // synthetic rating, premium queue, or paid priority.
    const waiting = this.queue.values().next().value as QueueEntry | undefined;
    if (!waiting) {
      this.rememberTicket(player.id, ticket);
      this.currentMatch.delete(player.id);
      this.queue.set(player.id, { player, ticket, expiresAt: now + QUEUE_LEASE_MS });
      return this.stateFor(player.id, now);
    }
    const id = this.makeId();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || this.matches.has(id)) throw new Error('Match id generator must return a unique valid identifier.');
    const firstIsWhite = this.random() < 0.5;
    const match: LiveMatch = {
      id, players: firstIsWhite ? { white: waiting.player, black: player } : { white: player, black: waiting.player },
      session: createSession(ONLINE_TIME_CONTROL), revision: 0, lastClockAt: now, receipts: new Map(),
    };
    this.rememberTicket(player.id, ticket);
    this.queue.delete(waiting.player.id);
    this.matches.set(id, match);
    this.currentMatch.set(player.id, id);
    this.currentMatch.set(waiting.player.id, id);
    return this.snapshot(match, player.id, now);
  }

  private authorizedMatch(playerId: string, matchId: string): LiveMatch {
    const match = this.matches.get(matchId);
    if (!match || (match.players.white.id !== playerId && match.players.black.id !== playerId)) {
      throw new OnlineError('match_not_found', 'No accessible match found.');
    }
    return match;
  }

  private mutate(playerId: string, command: Extract<OnlineCommand, { type: 'move' | 'resign' }>, now: number): OnlineState {
    const match = this.authorizedMatch(playerId, command.matchId);
    const receiptKey = JSON.stringify([playerId, command.requestId]);
    const signature = JSON.stringify(command);
    const previous = match.receipts.get(receiptKey);
    if (previous !== undefined) {
      if (previous !== signature) throw new OnlineError('request_conflict', 'A request id cannot be reused for a different command.');
      // A retry acknowledges the original command using the CURRENT state.
      return this.snapshot(match, playerId, now);
    }
    if (match.session.game.status !== 'active') throw new OnlineError('game_over', 'The game has ended.');
    if (command.expectedRevision !== match.revision) throw new OnlineError('stale_revision', 'Sync the current position before sending another command.');
    // Retain all accepted IDs so old retries can never become new moves.
    // Reserve one extra receipt for resignation; it is the final mutation.
    if (command.type === 'move' && match.receipts.size >= this.limits.requestsPerMatch) {
      throw new OnlineError('capacity', 'Move request capacity reached. You can still resign this match.');
    }
    const color: Color = match.players.white.id === playerId ? 'white' : 'black';
    const before = match.session;
    if (command.type === 'resign') {
      match.session = { game: resign(before.game, color), clock: { ...before.clock, running: false } };
    } else {
      if (before.game.turn !== color) throw new OnlineError('not_your_turn', 'Wait for your turn.');
      const moving = before.game.board[command.move.from.row][command.move.from.col];
      if (command.move.promotion && (moving?.type !== 'P' || ![0, 7].includes(command.move.to.row))) {
        throw new OnlineError('illegal_move', 'Promotion is only allowed on the last rank.');
      }
      const game = makeMove(before.game, command.move);
      if (game === before.game) throw new OnlineError('illegal_move', 'That move is not legal.');
      match.session = { game, clock: { ...applyMoveClock(before.clock, color), running: game.status === 'active' } };
    }
    match.revision++;
    match.receipts.set(receiptKey, signature);
    if (match.session.game.status !== 'active') match.endedAt = now;
    return this.snapshot(match, playerId, now);
  }

  private stateFor(playerId: string, now: number): OnlineState {
    const matchId = this.currentMatch.get(playerId);
    if (matchId) return this.snapshot(this.authorizedMatch(playerId, matchId), playerId, now);
    const entry = this.queue.get(playerId);
    if (entry) return { version: 1, serverNow: now, status: 'queued', ticket: entry.ticket, queueId: ONLINE_QUEUE_ID, expiresAt: entry.expiresAt };
    return { version: 1, serverNow: now, status: 'idle' };
  }

  private snapshot(match: LiveMatch, playerId: string, now: number): OnlineState {
    const playerColor: Color = match.players.white.id === playerId ? 'white' : 'black';
    const snapshot: MatchSnapshot = {
      matchId: match.id, revision: match.revision, playerColor,
      opponentName: match.players[playerColor === 'white' ? 'black' : 'white'].displayName,
      queueId: ONLINE_QUEUE_ID, timeControl: { ...ONLINE_TIME_CONTROL }, rated: false,
      game: match.session.game, clock: match.session.clock,
    };
    return { version: 1, serverNow: now, status: 'matched', match: clone(snapshot) };
  }
}
