import { Move } from '../game/pieces';
import { ClockState } from '../game/timers';
import { MatchSnapshot, OnlineCommand, OnlineState } from './protocol';

export type ClientState = {
  online: OnlineState | null;
  connection: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'expired';
  pending: boolean;
  error: string | null;
  receivedAt: number;
};
export class OnlineTransportError extends Error {
  constructor(readonly code: string, message: string, readonly status = 409, readonly retryAfterMs = 0) { super(message); }
}

type Options = {
  fetch?: typeof fetch; now?: () => number; pollMs?: number; timeoutMs?: number;
  /** Production: use the signed-in account's token instead of creating a guest session. */
  getToken?: () => Promise<string | null>;
  /** During an active match, hold a sync open until the position changes (0 = plain polling). */
  longPollMs?: number;
};

/** Reject accidental token delivery to a URL with credentials, paths or redirects.
 * Plain HTTP is for loopback/LAN development only. Public endpoints require TLS. */
export function onlineServerUrl(value: string | undefined, development = false): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    const octets = url.hostname.split('.');
    const ipv4 = octets.length === 4 && octets.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
    const lan = ipv4 && (Number(octets[0]) === 10 || (Number(octets[0]) === 192 && Number(octets[1]) === 168) || (Number(octets[0]) === 172 && Number(octets[1]) >= 16 && Number(octets[1]) <= 31));
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        (url.protocol !== 'https:' && !(url.protocol === 'http:' && (local || (development && lan))))) return null;
    return url.origin;
  } catch { return null; }
}

/** Interpolation is display-only. A client never declares timeout or awards a win. */
export function displayedClock(match: MatchSnapshot, receivedAt: number, now: number): ClockState {
  const clock = { ...match.clock };
  if (clock.running && match.game.status === 'active') {
    const key = clock.active === 'white' ? 'whiteMs' : 'blackMs';
    clock[key] = Math.max(0, clock[key] - Math.max(0, now - receivedAt));
  }
  return clock;
}

/** A single serialized connection. Guest credentials live only in memory, never
 * in URLs, logs, local mock accounts, or persistent browser/device storage. */
export class OnlineClient {
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private readonly pollMs: number;
  private readonly timeoutMs: number;
  private listeners = new Set<() => void>();
  private value: ClientState = { online: null, connection: 'idle', pending: false, error: null, receivedAt: 0 };
  private token?: string;
  private ticket?: string;
  private sequence = 0;
  private operations: Promise<unknown> = Promise.resolve();
  private pendingCount = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private unconfirmed?: OnlineCommand;
  private stopped = false;
  private retryAfterMs = 0;
  private readonly getToken?: () => Promise<string | null>;
  private readonly longPollMs: number;
  private longPoll?: AbortController;
  private pollEpoch = 0;

  constructor(readonly url: string, options: Options = {}) {
    // Call the global through a wrapper: browsers throw "Illegal invocation" for a detached fetch.
    this.fetcher = options.fetch ?? ((input, init) => fetch(input, init));
    this.now = options.now ?? (() => performance.now());
    this.pollMs = options.pollMs ?? 750;
    this.timeoutMs = options.timeoutMs ?? 6000;
    this.getToken = options.getToken;
    this.longPollMs = options.longPollMs ?? 0;
  }

  /** Call after login/logout: forget the old identity and any local view of its games. */
  reset() {
    this.clearTimer();
    this.token = undefined; this.ticket = undefined; this.unconfirmed = undefined; this.retryAfterMs = 0;
    this.update({ online: null, connection: 'idle', pending: false, error: null, receivedAt: 0 });
  }

  getSnapshot = (): ClientState => this.value;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.schedule();
    return () => { this.listeners.delete(listener); if (!this.listeners.size) this.clearTimer(); };
  };
  private update(next: Partial<ClientState>) {
    this.value = { ...this.value, ...next };
    this.listeners.forEach(listener => listener());
  }
  private id(prefix: string) { return `${prefix}-${++this.sequence}`; }
  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.longPoll) { this.pollEpoch++; this.longPoll.abort(); this.longPoll = undefined; }
  }
  private schedule() {
    this.clearTimer();
    if (this.stopped || !this.listeners.size || !this.token || this.value.connection === 'expired') return;
    const online = this.value.online;
    if (!this.unconfirmed && this.value.connection !== 'reconnecting' && online?.status !== 'queued' && !(online?.status === 'matched' && online.match.game.status === 'active')) return;
    if (this.longPollMs > 0 && !this.unconfirmed && !this.pendingCount && this.value.connection === 'connected' &&
        !this.retryAfterMs && online?.status === 'matched' && online.match.game.status === 'active') {
      this.startLongPoll(online.match.matchId, online.match.revision);
      return;
    }
    const delay = Math.max(this.retryAfterMs, this.value.error && this.value.connection === 'reconnecting' ? Math.max(this.pollMs, 3000) : this.pollMs);
    this.timer = setTimeout(() => { this.timer = undefined; void this.sync().catch(() => undefined); }, delay);
  }
  /** Waits on the server for the next revision; any user action aborts it first. */
  private startLongPoll(matchId: string, revision: number) {
    const epoch = ++this.pollEpoch;
    const controller = new AbortController();
    this.longPoll = controller;
    const body: OnlineCommand = { version: 1, type: 'sync', matchId, waitForRevision: revision };
    this.post('/command', body, true, { signal: controller.signal, timeoutMs: this.longPollMs + 8000 })
      .then(data => {
        if (epoch !== this.pollEpoch || this.stopped) return;
        this.longPoll = undefined;
        this.accept(data);
        this.schedule();
      })
      .catch(error => {
        if (epoch !== this.pollEpoch || this.stopped) return;
        this.longPoll = undefined;
        // Hand the failure to the ordinary, serialized sync path after a short pause.
        this.retryAfterMs = error instanceof OnlineTransportError ? error.retryAfterMs : 0;
        this.timer = setTimeout(() => { this.timer = undefined; void this.sync().catch(() => undefined); }, Math.max(this.pollMs, this.retryAfterMs));
      });
  }

  /** Test/teardown only: stopping observation does not pause a server game. */
  dispose() { this.stopped = true; this.clearTimer(); this.listeners.clear(); }

  private accept(data: unknown): OnlineState {
    const state = data as OnlineState;
    if (!state || state.version !== 1 || !Number.isFinite(state.serverNow) ||
        !['idle', 'queued', 'matched'].includes(state.status)) throw new Error('Invalid server response.');
    this.unconfirmed = undefined;
    this.retryAfterMs = 0;
    this.update({ online: state, connection: 'connected', error: null, receivedAt: this.now() });
    if (state.status !== 'queued') this.ticket = undefined;
    return state;
  }

  private enqueue<T>(work: () => Promise<T>, userAction = false): Promise<T> {
    if (userAction) { this.pendingCount++; this.update({ pending: true }); }
    this.clearTimer();
    const operation = this.operations.then(work);
    this.operations = operation.catch(() => undefined);
    return operation.finally(() => {
      if (userAction) { this.pendingCount--; this.update({ pending: this.pendingCount > 0 }); }
      this.schedule();
    });
  }

  private async post(path: string, body: unknown, authenticated: boolean, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? this.timeoutMs);
    options.signal?.addEventListener('abort', () => controller.abort());
    try {
      const response = await this.fetcher(`${this.url}${path}`, {
        method: 'POST', redirect: 'error', credentials: 'omit', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${this.token}` } : {}) },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { error?: { code?: string; message?: string } };
      if (!response.ok) throw new OnlineTransportError(data.error?.code ?? 'server_error', data.error?.message ?? 'The online server rejected the request.', response.status, Math.min(60000, Math.max(0, Number(response.headers.get('Retry-After')) || 0) * 1000));
      return data;
    } finally { clearTimeout(timer); }
  }

  private fail(error: unknown) {
    this.retryAfterMs = error instanceof OnlineTransportError ? error.retryAfterMs : 0;
    if (error instanceof OnlineTransportError && error.status !== 429 && (error.status < 500 || error.code === 'capacity')) {
      const expired = error.code === 'unauthenticated' || error.code === 'login_required';
      if (expired) this.token = undefined;
      this.update({ connection: expired ? 'expired' : 'connected', error: error.message });
    } else {
      this.update({ connection: 'reconnecting', error: 'Connection interrupted. Reconnecting safely; the server clock keeps running.' });
    }
  }

  private async connect() {
    if (this.token) return;
    this.update({ connection: 'connecting', error: null });
    if (this.getToken) {
      try {
        const token = await this.getToken();
        if (!token) throw new OnlineTransportError('login_required', 'Log in or create a free account to play online.', 401);
        this.token = token;
        this.update({ connection: 'connected' });
        return;
      } catch (error) { this.fail(error); throw error; }
    }
    try {
      const data = await this.post('/session', {}, false) as { token?: unknown };
      if (typeof data.token !== 'string' || !data.token) throw new Error('Invalid session response.');
      this.token = data.token;
      this.update({ connection: 'connected' });
    } catch (error) { this.fail(error); throw error; }
  }

  private async command(command: OnlineCommand): Promise<OnlineState> {
    try {
      return this.accept(await this.post('/command', command, true));
    } catch (error) {
      if (command.type === 'queue.join' && error instanceof OnlineTransportError && error.code === 'ticket_used') {
        // A lost join acknowledgement can outlive its queue lease. Never retry
        // that consumed ticket forever or silently create a fresh search. Sync
        // without renewing the expired queue so the lobby can show idle, or a
        // real match/result that was created while this client was offline.
        this.ticket = undefined;
        this.unconfirmed = undefined;
        const current = await this.command({ version: 1, type: 'sync' });
        if (current.status === 'idle') this.update({ error: 'Your earlier search expired. You can start a new search.' });
        return current;
      }
      // A dropped response may hide a successful commit. Retain the identical
      // command/request id until acknowledged. Never make up a new move id.
      if (!(error instanceof OnlineTransportError) || (error.status >= 500 && error.code !== 'capacity') || (command.type === 'queue.cancel' && error.status === 429)) this.unconfirmed = command;
      else this.unconfirmed = undefined;
      this.fail(error);
      throw error;
    }
  }

  async join(): Promise<OnlineState> {
    if (this.pendingCount) throw new Error('An online request is already pending.');
    return this.enqueue(async () => {
      this.ticket = this.ticket ?? this.id('queue');
      await this.connect();
      if (this.unconfirmed) await this.command(this.unconfirmed);
      this.ticket = this.ticket ?? this.id('queue');
      return this.command({ version: 1, type: 'queue.join', ticket: this.ticket });
    }, true);
  }
  async cancel(): Promise<OnlineState | null> {
    return this.enqueue(async () => {
      // The captured queue ticket is retained through an uncertain join.
      const ticket = this.ticket;
      if (!this.token) {
        this.ticket = undefined;
        this.update({ connection: 'idle', error: null });
        return this.value.online;
      }
      if (!ticket) return this.value.online;
      return this.command({ version: 1, type: 'queue.cancel', ticket });
    }, true);
  }
  async sync(): Promise<OnlineState | null> {
    return this.enqueue(async () => {
      if (this.value.connection === 'expired') return this.value.online;
      if (!this.token) {
        if (!this.ticket) return this.value.online;
        await this.connect();
        return this.command({ version: 1, type: 'queue.join', ticket: this.ticket });
      }
      // Every acknowledgement already includes current authoritative state.
      // Returning it also preserves an expired-ticket reconciliation notice.
      if (this.unconfirmed) return this.command(this.unconfirmed);
      return this.command({ version: 1, type: 'sync', ...(this.ticket ? { ticket: this.ticket } : {}) });
    });
  }
  async move(move: Move): Promise<OnlineState> {
    return this.mutate('move', move);
  }
  async resign(): Promise<OnlineState> { return this.mutate('resign'); }
  private mutate(type: 'move' | 'resign', move?: Move): Promise<OnlineState> {
    const online = this.value.online;
    if (this.pendingCount || this.unconfirmed || this.value.connection !== 'connected' || online?.status !== 'matched') {
      return Promise.reject(new Error('Wait for the current server position.'));
    }
    const base = { version: 1 as const, matchId: online.match.matchId, expectedRevision: online.match.revision, requestId: this.id('request') };
    // Strip locally derived capture/shift metadata. Only the server decides it.
    const command: OnlineCommand = type === 'resign' ? { ...base, type } : {
      ...base, type, move: { from: { ...move!.from }, to: { ...move!.to }, ...(move!.promotion ? { promotion: move!.promotion } : {}) },
    };
    return this.enqueue(() => this.command(command), true);
  }
}
