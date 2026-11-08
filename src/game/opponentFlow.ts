import { GameState, createGameState, makeMove, resign, timeout } from './gameState';
import { Color, Move } from './pieces';
import { ClockState, TimeControl, applyMoveClock, createClock, tickClock } from './timers';

export type GameSession = { game: GameState; clock: ClockState };
export type MoveActor = 'player' | 'opponent';
export type ScheduleTimer = (callback: () => void, delayMs: number) => () => void;
export const scheduleTimer: ScheduleTimer = (callback, delayMs) => {
  const timer = setTimeout(callback, delayMs);
  return () => clearTimeout(timer);
};

export function createSession(timeControl: TimeControl): GameSession {
  return { game: createGameState(), clock: createClock(timeControl) };
}

/** An undefined player color means pass-and-play: the human controls both sides. */
export function canPlayerMove(game: GameState, playerColor?: Color): boolean {
  return game.status === 'active' && (!playerColor || game.turn === playerColor);
}

export function playSessionMove(session: GameSession, move: Move, actor: MoveActor, playerColor?: Color): GameSession {
  const { game, clock } = session;
  if (clock.timedOut || game.status !== 'active') return session;
  if (actor === 'player' ? !canPlayerMove(game, playerColor) : !playerColor || game.turn === playerColor) return session;
  const next = makeMove(game, move);
  if (next === game) return session;
  return { game: next, clock: { ...applyMoveClock(clock, game.turn), running: next.status === 'active' } };
}

export function resignSession(session: GameSession, playerColor?: Color): GameSession {
  if (session.game.status !== 'active') return session;
  return { game: resign(session.game, playerColor ?? session.game.turn), clock: { ...session.clock, running: false } };
}

export type ResignRequest = { color: Color; generation: number };
export function createResignRequest(session: GameSession, generation: number, playerColor?: Color): ResignRequest {
  return { color: playerColor ?? session.game.turn, generation };
}
export function confirmResignRequest(session: GameSession, request: ResignRequest, generation: number): GameSession {
  return request.generation === generation ? resignSession(session, request.color) : session;
}

export function tickSession(session: GameSession, elapsedMs: number): GameSession {
  if (session.game.status !== 'active') return session;
  const clock = tickClock(session.clock, elapsedMs);
  if (clock === session.clock) return session;
  return { game: clock.timedOut ? timeout(session.game, clock.timedOut) : session.game, clock };
}

/** Both the local computer and mock transport use this cancellable turn scheduler.
 * The generation check also rejects callbacks already queued when cancelled.
 */
export class OpponentTurnScheduler {
  private generation = 0;
  private cancelTimer?: () => void;

  constructor(private readonly schedule: ScheduleTimer = scheduleTimer) {}

  cancel(): void {
    this.generation++;
    this.cancelTimer?.();
    this.cancelTimer = undefined;
  }

  scheduleTurn(options: {
    state: GameState;
    color: Color;
    delayMs: number;
    chooseMove: (state: GameState) => Move | null;
    isCurrent: () => boolean;
    onMove: (move: Move, state: GameState) => void;
  }): void {
    this.cancel();
    const { state, color, delayMs, chooseMove, isCurrent, onMove } = options;
    if (state.status !== 'active' || state.turn !== color) return;
    const generation = this.generation;
    this.cancelTimer = this.schedule(() => {
      if (generation !== this.generation || !isCurrent()) return;
      this.cancelTimer = undefined;
      // Consume the callback before notifying consumers, which may schedule again.
      this.generation++;
      const move = chooseMove(state);
      if (move && isCurrent()) onMove(move, state);
    }, delayMs);
  }
}
