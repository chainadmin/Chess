import { Color } from './pieces';
export type TimeControlId = 'blitz_3_0' | 'bullet_1_1' | 'rapid_10_0';
export type TimeControl = { id: TimeControlId; label: string; initialMs: number; incrementMs: number };
export const TIME_CONTROLS: Record<TimeControlId, TimeControl> = {
  blitz_3_0: { id: 'blitz_3_0', label: 'Blitz 3+0', initialMs: 180000, incrementMs: 0 },
  bullet_1_1: { id: 'bullet_1_1', label: 'Bullet 1+1', initialMs: 60000, incrementMs: 1000 },
  rapid_10_0: { id: 'rapid_10_0', label: 'Rapid 10+0', initialMs: 600000, incrementMs: 0 },
};
export type ClockState = { whiteMs: number; blackMs: number; active: Color; incrementMs: number; running: boolean; timedOut?: Color };
export const createClock = (tc: TimeControl): ClockState => ({ whiteMs: tc.initialMs, blackMs: tc.initialMs, active: 'white', incrementMs: tc.incrementMs, running: true });
export function applyMoveClock(clock: ClockState, mover: Color): ClockState { const key = mover === 'white' ? 'whiteMs' : 'blackMs'; return { ...clock, [key]: clock[key] + clock.incrementMs, active: mover === 'white' ? 'black' : 'white' }; }
export function tickClock(clock: ClockState, elapsedMs: number): ClockState { if (!clock.running || clock.timedOut) return clock; const key = clock.active === 'white' ? 'whiteMs' : 'blackMs'; const next = Math.max(0, clock[key] - elapsedMs); return { ...clock, [key]: next, running: next > 0, timedOut: next === 0 ? clock.active : undefined }; }
export const formatMs = (ms: number) => `${Math.floor(ms/60000)}:${String(Math.ceil((ms%60000)/1000)).padStart(2,'0')}`;
