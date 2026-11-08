import { chooseComputerMove } from '../../game/computerPlayer';
import { GameState } from '../../game/gameState';
import { OpponentTurnScheduler, ScheduleTimer, scheduleTimer } from '../../game/opponentFlow';
import { Move, Color, opponent } from '../../game/pieces';
import { TimeControl, TimeControlId, TIME_CONTROLS } from '../../game/timers';

export type Match = { matchId: string; playerColor: Color; opponentName: string; opponentRating: number; timeControl: TimeControl; mode: 'mock-online' };
export interface MultiplayerService {
  connect(): Promise<void>;
  joinQueue(timeControl: TimeControlId, playerRating: number): Promise<Match>;
  cancelQueue(): Promise<void>;
  startMatch(match: Match, state: GameState): void;
  /** Sync complete rule context, also when the opponent moves first or the game ends. */
  updateGame(state: GameState): void;
  sendMove(move: Move, state: GameState): Promise<void>;
  onOpponentMove(callback: (move: Move, expectedState: GameState) => void): () => void;
  resign(): Promise<void>;
  disconnect(): Promise<void>;
}
export class QueueCancelledError extends Error { constructor() { super('Matchmaking was cancelled'); this.name = 'QueueCancelledError'; } }

const opponentNames = ['KnightRider', 'QuietBishop', 'PawnStorm', 'CastleCrew', 'TempoFox', 'OpenFile'];

/** Local demo transport only: no network peer, authoritative server or real rating. */
export class MockMultiplayerService implements MultiplayerService {
  private cancelQueueTimer?: () => void;
  private queueGeneration = 0;
  private rejectQueue?: (reason: QueueCancelledError) => void;
  private opponentMove?: (move: Move, expectedState: GameState) => void;
  private match?: Match;
  private state?: GameState;
  private readonly replies: OpponentTurnScheduler;

  constructor(private readonly schedule: ScheduleTimer = scheduleTimer, private readonly random = Math.random) {
    this.replies = new OpponentTurnScheduler(schedule);
  }

  async connect() { /* Future WebSocket: open socket and authenticate current user. */ }

  joinQueue(timeControl: TimeControlId, playerRating: number) {
    void this.cancelQueue();
    const generation = this.queueGeneration;
    return new Promise<Match>((resolve, reject) => {
      this.rejectQueue = reject;
      this.cancelQueueTimer = this.schedule(() => {
        if (generation !== this.queueGeneration) return;
        const ratingOffset = Math.floor(this.random() * 181) - 90;
        this.cancelQueueTimer = undefined;
        this.rejectQueue = undefined;
        resolve({
          matchId: `mock-${Date.now()}`,
          playerColor: this.random() > .5 ? 'white' : 'black',
          opponentName: opponentNames[Math.floor(this.random() * opponentNames.length)],
          opponentRating: Math.max(0, Math.min(3500, playerRating + ratingOffset)),
          timeControl: TIME_CONTROLS[timeControl],
          mode: 'mock-online',
        });
      }, 2200);
    });
  }

  async cancelQueue() {
    this.queueGeneration++;
    this.cancelQueueTimer?.();
    this.cancelQueueTimer = undefined;
    const reject = this.rejectQueue;
    this.rejectQueue = undefined;
    reject?.(new QueueCancelledError());
  }

  startMatch(match: Match, state: GameState) {
    this.replies.cancel();
    this.match = match;
    this.state = undefined;
    this.updateGame(state);
  }

  updateGame(state: GameState) {
    if (this.state === state) return;
    this.state = state;
    const match = this.match;
    this.replies.cancel();
    if (!match) return;
    this.replies.scheduleTurn({
      state,
      color: opponent(match.playerColor),
      delayMs: 500 + this.random() * 900,
      chooseMove: position => chooseComputerMove(position, 'easy'),
      isCurrent: () => this.match === match && this.state === state && !!this.opponentMove,
      onMove: (move, expectedState) => this.opponentMove?.(move, expectedState),
    });
  }

  async sendMove(_move: Move, state: GameState) {
    // A real transport must validate/broadcast moves on an authoritative backend.
    this.updateGame(state);
  }

  onOpponentMove(callback: (move: Move, expectedState: GameState) => void) {
    this.opponentMove = callback;
    return () => {
      // An older screen's cleanup must not unsubscribe a newer screen.
      if (this.opponentMove === callback) this.opponentMove = undefined;
    };
  }

  async resign() {
    this.replies.cancel();
    this.match = undefined;
    this.state = undefined;
  }

  async disconnect() {
    // Cancel synchronously before any asynchronous teardown can yield.
    void this.cancelQueue();
    this.replies.cancel();
    this.match = undefined;
    this.state = undefined;
    this.opponentMove = undefined;
  }
}

export const multiplayerService: MultiplayerService = new MockMultiplayerService();
