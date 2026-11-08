import type { GameStatus } from '../game/gameState';

export const XP_PER_LEVEL = 100;
export const MAX_LEVEL = 20;
export const MAX_XP = (MAX_LEVEL - 1) * XP_PER_LEVEL;
export const MIN_GAME_PLIES = 6;
export const MAX_RECEIPTS = 10_000;
export type Progress = { version: 1; xp: number; receipts: string[] };
export type ProgressEvent =
  | { kind: 'game'; id: string; mode: 'local' | 'computer'; status: GameStatus; plyCount: number; won: boolean }
  | { kind: 'puzzle'; date: string };
export const emptyProgress = (): Progress => ({ version: 1, xp: 0, receipts: [] });
export const levelForXP = (xp: number) => 1 + Math.floor(Math.max(0, Math.min(MAX_XP, Number.isFinite(xp) ? xp : 0)) / XP_PER_LEVEL);
export const TERMINAL_STATUSES: GameStatus[] = ['checkmate', 'stalemate', 'draw_fifty', 'draw_repetition', 'draw_material', 'resigned', 'timeout'];

/** Device-local practice progress only. This is not a purchase or online authority. */
export function parseProgress(raw: string | null): Progress {
  if (raw === null) return emptyProgress();
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Invalid progress');
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || !Number.isSafeInteger(data.xp) || (data.xp as number) < 0 || (data.xp as number) > MAX_XP ||
      !Array.isArray(data.receipts) || data.receipts.length > MAX_RECEIPTS ||
      !data.receipts.every(id => typeof id === 'string' && id.length > 0 && id.length <= 180)) throw new Error('Invalid progress');
  return { version: 1, xp: data.xp as number, receipts: [...new Set(data.receipts)] };
}

export function rewardFor(event: ProgressEvent): { id: string; xp: number } | null {
  if (event.kind === 'puzzle') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return null;
    const date = new Date(`${event.date}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== event.date) return null;
    return { id: `puzzle:${event.date}`, xp: 30 };
  }
  if (event.kind !== 'game' || !['local', 'computer'].includes(event.mode) ||
      typeof event.id !== 'string' || !/^[\w:-]{1,150}$/.test(event.id) ||
      !TERMINAL_STATUSES.includes(event.status) || !Number.isSafeInteger(event.plyCount) || event.plyCount < MIN_GAME_PLIES) return null;
  // No XP for an unfinished/instant-resigned game; no rating or online rewards.
  return { id: `game:${event.id}`, xp: 25 + (event.mode === 'computer' && event.won === true ? 25 : 0) };
}

export function applyProgressEvent(progress: Progress, event: ProgressEvent): { progress: Progress; awarded: number } {
  const reward = rewardFor(event);
  if (!reward || progress.receipts.includes(reward.id) || progress.xp >= MAX_XP) return { progress, awarded: 0 };
  if (progress.receipts.length >= MAX_RECEIPTS) throw new Error('Progress receipt limit reached');
  const xp = Math.min(MAX_XP, progress.xp + reward.xp);
  return { progress: { version: 1, xp, receipts: [...progress.receipts, reward.id] }, awarded: xp - progress.xp };
}
