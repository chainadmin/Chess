import { Platform } from 'react-native';
import type { PreferenceStorage } from '../../appearance/AppearanceStore';
import { STORAGE_KEYS } from '../../storage/keys';
import type { Entitlements } from '../purchases/billing';
import type { AdReason, AdService } from './PreviewAdService';

type Gma = typeof import('react-native-google-mobile-ads');
type Interstitial = import('react-native-google-mobile-ads').InterstitialAd;

declare const process: { env: { EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS?: string; EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID?: string } };
// Real ad unit IDs come from your AdMob account (Apps → ShiftChess → Ad units).
// Until they are set, and always in development builds, Google's test ads are used.
const CONFIGURED_UNIT = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID;
const GAMES_BETWEEN_ADS = 3;

/**
 * Google AdMob interstitials between finished local games, never during play.
 * Consent (Google UMP for EEA/UK/US-state privacy laws) and Apple's tracking
 * prompt are handled before any ad is requested. "Remove Ads" stops all of it.
 */
export class AdMobAdService implements AdService {
  private ready?: Promise<boolean>;
  private interstitial?: Interstitial;
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();
  private personalized = false;

  constructor(private gma: Gma, private storage: PreferenceStorage, private entitlements: () => Promise<Entitlements>) {}

  private unitId() {
    return __DEV__ || !CONFIGURED_UNIT ? this.gma.TestIds.INTERSTITIAL : CONFIGURED_UNIT;
  }

  initAds(): Promise<void> {
    this.ready ??= (async () => {
      if (await this.isAdsRemoved()) return false;
      try {
        const consent = await this.gma.AdsConsent.gatherConsent();
        if (!consent.canRequestAds) return false;
        if (Platform.OS === 'ios') {
          try {
            const tracking = require('expo-tracking-transparency') as typeof import('expo-tracking-transparency');
            this.personalized = (await tracking.requestTrackingPermissionsAsync()).granted;
          } catch { this.personalized = false; }
        } else this.personalized = true;
        await this.gma.default().initialize();
        this.preload();
        return true;
      } catch { return false; } // Ads must never block the game.
    })();
    return this.ready.then(() => undefined);
  }

  private preload() {
    this.loaded = false;
    const ad = this.gma.InterstitialAd.createForAdRequest(this.unitId(), { requestNonPersonalizedAdsOnly: !this.personalized });
    ad.addAdEventListener(this.gma.AdEventType.LOADED, () => { this.loaded = true; });
    ad.addAdEventListener(this.gma.AdEventType.CLOSED, () => { this.preload(); });
    ad.addAdEventListener(this.gma.AdEventType.ERROR, () => {
      this.loaded = false;
      const retry = setTimeout(() => this.preload(), 60_000);
      (retry as { unref?: () => void }).unref?.();
    });
    this.interstitial = ad;
    ad.load();
  }

  async isAdsRemoved() { return (await this.entitlements()).adsRemoved; }
  subscribe() { return () => undefined; }

  async maybeShowInterstitial(_reason: AdReason) {
    if (await this.isAdsRemoved()) return false;
    if (!(await this.ready?.catch(() => false))) return false;
    if (!this.interstitial || !this.loaded) return false;
    try { await this.interstitial.show(); return true; } catch { return false; }
  }

  async showRewardedAd(_reason: AdReason) { return false; }

  recordCompletedGame(): Promise<boolean> {
    const operation = this.queue.then(async () => {
      try {
        const stored = Number(await this.storage.getItem(STORAGE_KEYS.completedGameCount));
        const current = (Number.isSafeInteger(stored) && stored >= 0 ? stored % GAMES_BETWEEN_ADS : 0) + 1;
        await this.storage.setItem(STORAGE_KEYS.completedGameCount, String(current % GAMES_BETWEEN_ADS));
        return current === GAMES_BETWEEN_ADS ? this.maybeShowInterstitial('game_complete') : false;
      } catch { return false; }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
