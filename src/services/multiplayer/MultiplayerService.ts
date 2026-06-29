import { Move, Color } from '../../game/pieces';
import { TimeControl, TimeControlId, TIME_CONTROLS } from '../../game/timers';
export type Match = { matchId: string; playerColor: Color; opponentName: string; timeControl: TimeControl; mode: 'mock-online' };
export interface MultiplayerService { connect(): Promise<void>; joinQueue(timeControl: TimeControlId): Promise<Match>; cancelQueue(): Promise<void>; sendMove(move: Move): Promise<void>; onOpponentMove(callback: (move: Move) => void): () => void; resign(): Promise<void>; disconnect(): Promise<void>; }
class MockMultiplayerService implements MultiplayerService {
  private timer?: ReturnType<typeof setTimeout>; private opponentMove?: (move: Move) => void;
  async connect() { /* Future WebSocket: open socket and authenticate current user. */ }
  joinQueue(timeControl: TimeControlId) { return new Promise<Match>(resolve => { this.timer = setTimeout(() => resolve({ matchId: `mock-${Date.now()}`, playerColor: 'white', opponentName: 'Mock Rival', timeControl: TIME_CONTROLS[timeControl], mode: 'mock-online' }), 2000); }); }
  async cancelQueue() { if (this.timer) clearTimeout(this.timer); }
  async sendMove(_move: Move) { /* Future WebSocket: send move request; backend validates and broadcasts accepted moves. */ }
  onOpponentMove(callback: (move: Move) => void) { this.opponentMove = callback; return () => { this.opponentMove = undefined; }; }
  async resign() { /* Future WebSocket: notify server. */ }
  async disconnect() { await this.cancelQueue(); this.opponentMove = undefined; }
}
export const multiplayerService: MultiplayerService = new MockMultiplayerService();
