import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../storage/keys';
export type AdReason = 'game_complete' | 'manual_test';
export interface AdService { initAds(): Promise<void>; maybeShowInterstitial(reason: AdReason): Promise<boolean>; showRewardedAd(reason: AdReason): Promise<boolean>; isAdsRemoved(): Promise<boolean>; recordCompletedGame(): Promise<boolean>; subscribe(listener: (reason: string) => void): () => void; }
class ExpoGoMockAdService implements AdService {
  private listeners = new Set<(reason: string) => void>();
  async initAds() { /* Expo Go mock only. Plug real AdMob initialization here after EAS/native builds. */ }
  async isAdsRemoved() { return (await AsyncStorage.getItem(STORAGE_KEYS.adsRemoved)) === 'true'; }
  subscribe(listener: (reason: string) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private open(reason: string) { this.listeners.forEach(listener => listener(reason)); }
  async maybeShowInterstitial(reason: AdReason) { if (await this.isAdsRemoved()) return false; this.open(reason); return true; }
  async showRewardedAd(reason: AdReason) { if (await this.isAdsRemoved()) return false; this.open(`rewarded:${reason}`); return true; }
  async recordCompletedGame() { const current = Number(await AsyncStorage.getItem(STORAGE_KEYS.completedGameCount) ?? '0') + 1; await AsyncStorage.setItem(STORAGE_KEYS.completedGameCount, String(current)); if (current % 3 === 0 && !(await this.isAdsRemoved())) return this.maybeShowInterstitial('game_complete'); return false; }
}
export const adService: AdService = new ExpoGoMockAdService();
