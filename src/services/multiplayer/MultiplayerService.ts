import { Move, Color } from '../../game/pieces';
import { TimeControl, TimeControlId, TIME_CONTROLS } from '../../game/timers';

export type Match = { matchId: string; playerColor: Color; opponentName: string; opponentRating: number; timeControl: TimeControl; mode: 'mock-online' };
export interface MultiplayerService { connect(): Promise<void>; joinQueue(timeControl: TimeControlId, playerRating: number): Promise<Match>; cancelQueue(): Promise<void>; sendMove(move: Move): Promise<void>; onOpponentMove(callback: (move: Move) => void): () => void; resign(): Promise<void>; disconnect(): Promise<void>; }
export class QueueCancelledError extends Error { constructor() { super('Matchmaking was cancelled'); this.name = 'QueueCancelledError'; } }

const opponentNames = ['KnightRider', 'QuietBishop', 'PawnStorm', 'CastleCrew', 'TempoFox', 'OpenFile'];

class MockMultiplayerService implements MultiplayerService {
  private timer?: ReturnType<typeof setTimeout>;
  private rejectQueue?: (reason: QueueCancelledError) => void;
  private opponentMove?: (move: Move) => void;

  async connect() { /* Future WebSocket: open socket and authenticate current user. */ }

  joinQueue(timeControl: TimeControlId, playerRating: number) {
    void this.cancelQueue();
    return new Promise<Match>((resolve, reject) => {
      this.rejectQueue = reject;
      this.timer = setTimeout(() => {
        const ratingOffset = Math.floor(Math.random() * 181) - 90;
        this.timer = undefined;
        this.rejectQueue = undefined;
        resolve({
          matchId: `mock-${Date.now()}`,
          playerColor: Math.random() > .5 ? 'white' : 'black',
          opponentName: opponentNames[Math.floor(Math.random() * opponentNames.length)],
          opponentRating: Math.max(0, Math.min(3500, playerRating + ratingOffset)),
          timeControl: TIME_CONTROLS[timeControl],
          mode: 'mock-online',
        });
      }, 2200);
    });
  }

  async cancelQueue() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    const reject = this.rejectQueue;
    this.rejectQueue = undefined;
    reject?.(new QueueCancelledError());
  }

  async sendMove(_move: Move) { /* Future WebSocket: send move request; backend validates and broadcasts accepted moves. */ }
  onOpponentMove(callback: (move: Move) => void) { this.opponentMove = callback; return () => { this.opponentMove = undefined; }; }
  async resign() { /* Future WebSocket: notify server. */ }
  async disconnect() { await this.cancelQueue(); this.opponentMove = undefined; }
}

export const multiplayerService: MultiplayerService = new MockMultiplayerService();
