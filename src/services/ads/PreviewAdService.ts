import type { PreferenceStorage } from '../../appearance/AppearanceStore';
import { STORAGE_KEYS } from '../../storage/keys';
import type { Entitlements } from '../purchases/PurchaseService';
export type AdReason = 'game_complete' | 'manual_test';
export interface AdService {
  initAds(): Promise<void>;
  maybeShowInterstitial(reason: AdReason): Promise<boolean>;
  showRewardedAd(reason: AdReason): Promise<boolean>;
  isAdsRemoved(): Promise<boolean>;
  recordCompletedGame(): Promise<boolean>;
  subscribe(listener: (reason: string) => void): () => void;
}

/** No ad network, impressions or revenue. Only manual previews are enabled by default. */
export class PreviewAdService implements AdService {
  private listeners = new Set<(reason: string) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private storage: PreferenceStorage, private entitlements: () => Promise<Entitlements>, private automaticPreview = false) {}
  async initAds() {}
  async isAdsRemoved() { return (await this.entitlements()).adsRemoved; }
  subscribe(listener: (reason: string) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  async maybeShowInterstitial(reason: AdReason) {
    if (await this.isAdsRemoved() || (reason !== 'manual_test' && !this.automaticPreview) || this.listeners.size === 0) return false;
    this.listeners.forEach(listener => listener(reason));
    return true;
  }
  async showRewardedAd(_reason: AdReason) {
    // Never report a successful rewarded view without a real SDK verification callback.
    return false;
  }
  recordCompletedGame(): Promise<boolean> {
    const operation = this.queue.then(async () => {
      try {
        const stored = Number(await this.storage.getItem(STORAGE_KEYS.completedGameCount));
        const current = (Number.isSafeInteger(stored) && stored >= 0 ? stored % 3 : 0) + 1;
        await this.storage.setItem(STORAGE_KEYS.completedGameCount, String(current % 3));
        return current === 3 ? this.maybeShowInterstitial('game_complete') : false;
      } catch { return false; } // An unavailable ad/storage service must never block play.
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
