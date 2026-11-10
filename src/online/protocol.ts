import { COLS, ROWS } from '../game/board';
import { GameState } from '../game/gameState';
import { Color, Move, PROMOTION_CHOICES } from '../game/pieces';
import { ClockState, TimeControl, TIME_CONTROLS } from '../game/timers';

/** One human queue. Entitlements, ads and cosmetic purchases never gate entry. */
export const ONLINE_QUEUE_ID = 'human_blitz_3_2' as const;
export const ONLINE_TIME_CONTROL: Readonly<TimeControl> = Object.freeze({ ...TIME_CONTROLS.blitz_3_2 });
export const ONLINE_PROTOCOL_VERSION = 1 as const;
export const QUEUE_LEASE_MS = 30_000;

/** Supplied by a trusted server-side identity verifier, NEVER by request JSON. */
export type AuthenticatedPlayer = { id: string; displayName: string };

/** Only intent crosses the wire; capture and Lancer movement are computed by the server. */
export type OnlineMove = Pick<Move, 'from' | 'to' | 'promotion'>;

export type OnlineCommand =
  | { version: 1; type: 'queue.join'; ticket: string }
  | { version: 1; type: 'queue.cancel'; ticket: string }
  /** waitForRevision asks the server to hold the reply (long-poll) until the match changes. */
  | { version: 1; type: 'sync'; ticket?: string; matchId?: string; waitForRevision?: number }
  | { version: 1; type: 'move'; requestId: string; matchId: string; expectedRevision: number; move: OnlineMove }
  | { version: 1; type: 'resign'; requestId: string; matchId: string; expectedRevision: number };

export type MatchSnapshot = {
  matchId: string;
  revision: number;
  playerColor: Color;
  opponentName: string;
  queueId: typeof ONLINE_QUEUE_ID;
  timeControl: TimeControl;
  /** True when the server settles results into account ratings. */
  rated: boolean;
  game: GameState;
  clock: ClockState;
};

export type OnlineState = { version: 1; serverNow: number } & (
  | { status: 'idle' }
  | { status: 'queued'; ticket: string; queueId: typeof ONLINE_QUEUE_ID; expiresAt: number }
  | { status: 'matched'; match: MatchSnapshot }
);

export type OnlineErrorCode = 'invalid_command' | 'unauthenticated' | 'ticket_used' |
  'already_queued' | 'match_not_found' | 'stale_revision' | 'not_your_turn' |
  'illegal_move' | 'game_over' | 'request_conflict' | 'capacity';

export class OnlineError extends Error {
  constructor(readonly code: OnlineErrorCode, message: string) {
    super(message);
    this.name = 'OnlineError';
  }
}

const invalid = (): never => { throw new OnlineError('invalid_command', 'Invalid online command.'); };
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid();
}
function square(value: unknown) {
  if (!record(value)) return invalid();
  keys(value, ['row', 'col']);
  if (!Number.isInteger(value.row) || !Number.isInteger(value.col) ||
    (value.row as number) < 0 || (value.row as number) >= ROWS ||
    (value.col as number) < 0 || (value.col as number) >= COLS) return invalid();
  return { row: value.row as number, col: value.col as number };
}
function parseMove(value: unknown): OnlineMove {
  if (!record(value)) return invalid();
  keys(value, ['from', 'to', 'promotion']);
  if (value.promotion !== undefined && !PROMOTION_CHOICES.includes(value.promotion as never)) return invalid();
  return {
    from: square(value.from), to: square(value.to),
    ...(value.promotion === undefined ? {} : { promotion: value.promotion as Move['promotion'] }),
  };
}

/** Runtime validation protects the rules engine from untrusted coordinates and state. */
export function parseOnlineCommand(value: unknown): OnlineCommand {
  if (!record(value) || value.version !== ONLINE_PROTOCOL_VERSION) return invalid();
  switch (value.type) {
    case 'queue.join':
    case 'queue.cancel':
      keys(value, ['version', 'type', 'ticket']);
      if (!identifier(value.ticket)) return invalid();
      return { version: 1, type: value.type, ticket: value.ticket };
    case 'sync':
      keys(value, ['version', 'type', 'ticket', 'matchId', 'waitForRevision']);
      if ((value.ticket !== undefined && !identifier(value.ticket)) ||
          (value.matchId !== undefined && !identifier(value.matchId)) ||
          (value.waitForRevision !== undefined && (!Number.isSafeInteger(value.waitForRevision) || (value.waitForRevision as number) < 0 || value.matchId === undefined))) return invalid();
      return { version: 1, type: 'sync',
        ...(value.ticket === undefined ? {} : { ticket: value.ticket as string }),
        ...(value.matchId === undefined ? {} : { matchId: value.matchId as string }),
        ...(value.waitForRevision === undefined ? {} : { waitForRevision: value.waitForRevision as number }),
      };
    case 'move':
    case 'resign': {
      keys(value, ['version', 'type', 'requestId', 'matchId', 'expectedRevision', ...(value.type === 'move' ? ['move'] : [])]);
      if (!identifier(value.requestId) || !identifier(value.matchId) ||
        !Number.isSafeInteger(value.expectedRevision) || (value.expectedRevision as number) < 0) return invalid();
      const base = { version: 1 as const, requestId: value.requestId, matchId: value.matchId, expectedRevision: value.expectedRevision as number };
      return value.type === 'resign' ? { ...base, type: 'resign' } : { ...base, type: 'move', move: parseMove(value.move) };
    }
    default: return invalid();
  }
}
