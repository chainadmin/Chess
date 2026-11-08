import { AppearancePreferences, DEFAULT_APPEARANCE, parseAppearance } from './catalog';

export type PreferenceStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export type AppearanceSnapshot = AppearancePreferences & { loaded: boolean; error: string | null };
export const APPEARANCE_KEY = 'shiftchess.appearance.v1';

/** One app-wide snapshot, ordered writes and hydration that cannot overwrite a tap. */
export class AppearanceStore {
  private snapshot: AppearanceSnapshot = { ...DEFAULT_APPEARANCE, loaded: false, error: null };
  private listeners = new Set<() => void>();
  private initialization: Promise<void> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private changes = 0;
  constructor(private storage: PreferenceStorage) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(update: Partial<AppearanceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...update };
    this.listeners.forEach(listener => listener());
  }
  load = (): Promise<void> => {
    if (this.initialization) return this.initialization;
    const initialChanges = this.changes;
    this.initialization = this.storage.getItem(APPEARANCE_KEY).then(raw => {
      if (this.changes === initialChanges) this.publish({ ...parseAppearance(raw), loaded: true });
      else this.publish({ loaded: true });
    }).catch(() => {
      this.publish({ loaded: true, error: 'Saved appearance could not be loaded. You can still choose a look for this session.' });
    });
    return this.initialization;
  };
  update = async (change: Partial<AppearancePreferences>): Promise<void> => {
    await this.load();
    // Runtime validation also prevents unknown IDs from breaking the renderer.
    const next = parseAppearance(JSON.stringify({ board: this.snapshot.board, pieces: this.snapshot.pieces, ...change }));
    const revision = ++this.changes;
    this.publish({ ...next, error: null });
    this.writeQueue = this.writeQueue.then(() => this.storage.setItem(APPEARANCE_KEY, JSON.stringify(next)))
      .then(() => { if (revision === this.changes) this.publish({ error: null }); })
      .catch(() => { if (revision === this.changes) this.publish({ error: 'This look is active, but could not be saved. Tap your choice again to retry.' }); });
    return this.writeQueue;
  };
}
