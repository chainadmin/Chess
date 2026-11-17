import type { PreferenceStorage } from '../../appearance/AppearanceStore';
import { STORAGE_KEYS } from '../../storage/keys';
import type { Entitlements } from '../purchases/billing';
import type { AdReason, AdService } from './PreviewAdService';

/** The parts of react-native-google-mobile-ads this service uses (kept local so tests need no native types). */
type Interstitial = {
  addAdEventListener(type: never, listener: (payload?: unknown) => void): unknown;
  load(): void;
  show(): Promise<void>;
};
export type Gma = {
  TestIds: { INTERSTITIAL: string };
  AdEventType: { LOADED: unknown; CLOSED: unknown; ERROR: unknown };
  AdsConsent: { gatherConsent(): Promise<{ canRequestAds: boolean }>; getConsentInfo(): Promise<{ canRequestAds: boolean }> };
  default(): { initialize(): Promise<unknown> };
  InterstitialAd: { createForAdRequest(unitId: string, request: { requestNonPersonalizedAdsOnly: boolean }): Interstitial };
};

export const GAMES_BETWEEN_ADS = 3;
const RETRY_LOAD_MS = 30_000;
const GAME_END_DELAY_MS = 900;

/** Device hooks, injected so the start-up rules can be tested without a phone. */
export type AdPlatform = {
  os: 'ios' | 'android';
  /** Real ad unit for this platform; Google's test unit is used when missing or in development. */
  unitId?: string;
  development: boolean;
  /** Resolves once the app is in the foreground. iOS ignores consent/tracking prompts before that. */
  whenActive(): Promise<void>;
  /** Apple's App Tracking Transparency prompt. Resolves true when the player allows tracking. */
  requestTracking(): Promise<boolean>;
  setTimer(callback: () => void, ms: number): void;
};

/**
 * Google AdMob interstitials between finished games, never during play.
 * Consent (Google UMP for EEA/UK/US-state privacy laws) and Apple's tracking
 * prompt are handled before any ad is requested. "Remove Ads" stops all of it.
 * A failed start (offline at launch, a prompt that iOS refused) is retried later
 * instead of switching ads off for the whole session.
 */
export class AdMobAdService implements AdService {
  private starting?: Promise<boolean>;
  private started = false;
  private interstitial?: Interstitial;
  private loaded = false;
  private loading = false;
  private queue: Promise<unknown> = Promise.resolve();
  private personalized = false;
  private lastStatus = 'Not started';

  constructor(private gma: Gma, private storage: PreferenceStorage, private entitlements: () => Promise<Entitlements>, private platform: AdPlatform) {}

  private unitId() {
    return this.platform.development || !this.platform.unitId ? this.gma.TestIds.INTERSTITIAL : this.platform.unitId;
  }

  /** Internal state, for tests and debugging only. Never shown to players. */
  status(): string { return this.lastStatus; }

  private async consentAllowsAds(): Promise<boolean> {
    try {
      return (await this.gma.AdsConsent.gatherConsent()).canRequestAds;
    } catch {
      // Google's guidance: if the consent form fails, consent from an earlier launch may still allow ads.
      try { return (await this.gma.AdsConsent.getConsentInfo()).canRequestAds; } catch { return false; }
    }
  }

  private start(): Promise<boolean> {
    if (this.started) return Promise.resolve(true);
    this.starting ??= (async () => {
      try {
        if (await this.isAdsRemoved()) { this.lastStatus = 'Ads removed by purchase'; return false; }
        await this.platform.whenActive();
        if (!(await this.consentAllowsAds())) { this.lastStatus = 'Waiting for ad consent'; return false; }
        if (this.platform.os === 'ios') {
          try { this.personalized = await this.platform.requestTracking(); } catch { this.personalized = false; }
        } else this.personalized = true;
        await this.gma.default().initialize();
        this.started = true;
        this.lastStatus = 'Loading an ad';
        this.preload();
        return true;
      } catch (error) {
        this.lastStatus = `Start failed: ${error instanceof Error ? error.message : String(error)}`;
        return false; // Ads must never block the game.
      } finally {
        // Let the next call try again if this attempt did not finish starting.
        this.starting = undefined;
      }
    })();
    return this.starting;
  }

  initAds(): Promise<void> {
    return this.start().then(() => undefined);
  }

  private preload() {
    if (this.loading || this.loaded) return;
    this.loading = true;
    const ad = this.gma.InterstitialAd.createForAdRequest(this.unitId(), { requestNonPersonalizedAdsOnly: !this.personalized });
    ad.addAdEventListener(this.gma.AdEventType.LOADED as never, () => { this.loaded = true; this.loading = false; this.lastStatus = 'Ad ready'; });
    ad.addAdEventListener(this.gma.AdEventType.CLOSED as never, () => { this.loaded = false; this.preload(); });
    ad.addAdEventListener(this.gma.AdEventType.ERROR as never, (error?: unknown) => {
      this.loaded = false;
      this.loading = false;
      const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : 'unknown error';
      this.lastStatus = `No ad from AdMob: ${message}`;
      this.platform.setTimer(() => this.preload(), RETRY_LOAD_MS);
    });
    this.interstitial = ad;
    ad.load();
  }

  async isAdsRemoved() { return (await this.entitlements()).adsRemoved; }
  subscribe() { return () => undefined; }

  async maybeShowInterstitial(_reason: AdReason) {
    if (await this.isAdsRemoved()) { this.lastStatus = 'Ads removed by purchase'; return false; }
    if (!(await this.start())) return false;
    if (!this.interstitial || !this.loaded) { this.preload(); return false; }
    try {
      this.loaded = false;
      await this.interstitial.show();
      this.lastStatus = 'Ad shown';
      // Queue the next ad now rather than relying only on the CLOSED event.
      this.preload();
      return true;
    } catch (error) {
      this.lastStatus = `Ad could not show: ${error instanceof Error ? error.message : String(error)}`;
      this.preload();
      return false;
    }
  }

  async showRewardedAd(_reason: AdReason) { return false; }

  recordCompletedGame(): Promise<boolean> {
    const operation = this.queue.then(async () => {
      try {
        const stored = Number(await this.storage.getItem(STORAGE_KEYS.completedGameCount));
        const current = (Number.isSafeInteger(stored) && stored >= 0 ? stored % GAMES_BETWEEN_ADS : 0) + 1;
        await this.storage.setItem(STORAGE_KEYS.completedGameCount, String(current % GAMES_BETWEEN_ADS));
        if (current !== GAMES_BETWEEN_ADS) return false;
        // Let any closing popup (e.g. the resign confirmation) finish first: iOS will not
        // present an ad over a view controller that is still being dismissed.
        await new Promise<void>(resolve => this.platform.setTimer(resolve, GAME_END_DELAY_MS));
        return this.maybeShowInterstitial('game_complete');
      } catch { return false; }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
