import type { PreferenceStorage } from '../appearance/AppearanceStore';
import { applyProgressEvent, emptyProgress, levelForXP, parseProgress, type Progress, type ProgressEvent } from './progression';

export const PROGRESS_KEY = 'shiftchess.practiceProgress.v1';
export type ProgressSnapshot = { xp: number; level: number; loaded: boolean; error: string | null };
export type AwardResult = { awarded: number; saved: boolean };

/** Writes and duplicate checks share one queue. Failed writes never grant an unlock. */
export class ProgressionStore {
  private progress: Progress = emptyProgress();
  private snapshot: ProgressSnapshot = { xp: 0, level: 1, loaded: false, error: null };
  private listeners = new Set<() => void>();
  private initialization: Promise<void> | null = null;
  private readSucceeded = false;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private storage: PreferenceStorage) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(error: string | null = null) {
    this.snapshot = { xp: this.progress.xp, level: levelForXP(this.progress.xp), loaded: true, error };
    this.listeners.forEach(listener => listener());
  }
  load = (): Promise<void> => {
    if (this.readSucceeded) return Promise.resolve();
    if (this.initialization) return this.initialization;
    this.initialization = this.storage.getItem(PROGRESS_KEY).then(raw => {
      this.progress = parseProgress(raw);
      this.readSucceeded = true;
      this.publish();
    }).catch(() => {
      this.readSucceeded = false;
      this.publish('Practice progress could not be loaded. Your saved data has not been replaced. Retry to load it.');
    }).finally(() => { this.initialization = null; });
    return this.initialization;
  };
  ensureLoaded = () => this.readSucceeded ? Promise.resolve() : this.load();
  record = (event: ProgressEvent): Promise<AwardResult> => {
    const operation = this.queue.then(async () => {
      await this.ensureLoaded();
      if (!this.readSucceeded) return { awarded: 0, saved: false };
      try {
        const next = applyProgressEvent(this.progress, event);
        if (next.awarded > 0) {
          await this.storage.setItem(PROGRESS_KEY, JSON.stringify(next.progress));
          this.progress = next.progress;
        }
        this.publish();
        return { awarded: next.awarded, saved: true };
      } catch {
        this.publish('Practice XP could not be saved. Retry this result before leaving the screen.');
        return { awarded: 0, saved: false };
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  };
}
