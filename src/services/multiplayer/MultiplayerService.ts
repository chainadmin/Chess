import { Board } from '../../game/board';
import { allLegalMoves } from '../../game/legalMoves';
import { Move, Color } from '../../game/pieces';
import { TimeControl, TimeControlId, TIME_CONTROLS } from '../../game/timers';

export type Match = { matchId: string; playerColor: Color; opponentName: string; opponentRating: number; timeControl: TimeControl; mode: 'mock-online' };
export interface MultiplayerService {
  connect(): Promise<void>;
  joinQueue(timeControl: TimeControlId, playerRating: number): Promise<Match>;
  cancelQueue(): Promise<void>;
  /** Tells the mock opponent what just happened so it can reply; pass the resulting board and whose turn it now is. */
  sendMove(move: Move, board: Board, turnColor: Color): Promise<void>;
  onOpponentMove(callback: (move: Move) => void): () => void;
  resign(): Promise<void>;
  disconnect(): Promise<void>;
}
export class QueueCancelledError extends Error { constructor() { super('Matchmaking was cancelled'); this.name = 'QueueCancelledError'; } }

const opponentNames = ['KnightRider', 'QuietBishop', 'PawnStorm', 'CastleCrew', 'TempoFox', 'OpenFile'];

class MockMultiplayerService implements MultiplayerService {
  private queueTimer?: ReturnType<typeof setTimeout>;
  private replyTimer?: ReturnType<typeof setTimeout>;
  private rejectQueue?: (reason: QueueCancelledError) => void;
  private opponentMove?: (move: Move) => void;

  async connect() { /* Future WebSocket: open socket and authenticate current user. */ }

  joinQueue(timeControl: TimeControlId, playerRating: number) {
    void this.cancelQueue();
    return new Promise<Match>((resolve, reject) => {
      this.rejectQueue = reject;
      this.queueTimer = setTimeout(() => {
        const ratingOffset = Math.floor(Math.random() * 181) - 90;
        this.queueTimer = undefined;
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
    if (this.queueTimer) clearTimeout(this.queueTimer);
    this.queueTimer = undefined;
    const reject = this.rejectQueue;
    this.rejectQueue = undefined;
    reject?.(new QueueCancelledError());
  }

  async sendMove(_move: Move, board: Board, turnColor: Color) {
    // Future WebSocket: send the move request; the backend validates it and broadcasts the accepted move to both clients.
    // Locally we stand in for the opponent by picking a random legal reply for whichever color is now on the move.
    if (this.replyTimer) clearTimeout(this.replyTimer);
    const candidates = allLegalMoves(board, turnColor);
    if (candidates.length === 0) return;
    this.replyTimer = setTimeout(() => {
      this.replyTimer = undefined;
      const reply = candidates[Math.floor(Math.random() * candidates.length)];
      this.opponentMove?.(reply);
    }, 500 + Math.random() * 900);
  }

  onOpponentMove(callback: (move: Move) => void) { this.opponentMove = callback; return () => { this.opponentMove = undefined; }; }
  async resign() { /* Future WebSocket: notify server. */ }
  async disconnect() {
    await this.cancelQueue();
    if (this.replyTimer) clearTimeout(this.replyTimer);
    this.replyTimer = undefined;
    this.opponentMove = undefined;
  }
}

export const multiplayerService: MultiplayerService = new MockMultiplayerService();
