import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { purchaseService } from '../purchases/PurchaseService';
import { AdMobAdService, type AdPlatform, type Gma } from './AdMobAdService';
import { PreviewAdService, type AdService } from './PreviewAdService';
export type { AdReason, AdService } from './PreviewAdService';

declare const process: { env: { EXPO_PUBLIC_AD_PREVIEW?: string; EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS?: string; EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID?: string } };
const entitlements = () => purchaseService.getEntitlements();

/** Resolves once the app is in the foreground, plus a short settle so iOS will present prompts. */
function whenActive(): Promise<void> {
  const settle = () => new Promise<void>(resolve => setTimeout(resolve, 600));
  if (AppState.currentState === 'active') return settle();
  return new Promise(resolve => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      subscription.remove();
      void settle().then(resolve);
    });
  });
}

async function requestTracking(): Promise<boolean> {
  const tracking = require('expo-tracking-transparency') as typeof import('expo-tracking-transparency');
  const current = await tracking.getTrackingPermissionsAsync();
  if (current.granted || !current.canAskAgain) return current.granted;
  return (await tracking.requestTrackingPermissionsAsync()).granted;
}

const nativePlatform = (): AdPlatform => ({
  os: Platform.OS === 'ios' ? 'ios' : 'android',
  // Real ad unit IDs come from your AdMob account (Apps → ShiftChess → Ad units), set in eas.json.
  unitId: Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID,
  development: __DEV__,
  whenActive,
  requestTracking,
  setTimer: (callback, ms) => { setTimeout(callback, ms); },
});

function createAdService(): AdService {
  if (Platform.OS !== 'web') {
    try {
      // Native module: present in EAS/App Store builds, missing in Expo Go.
      const gma = require('react-native-google-mobile-ads') as typeof import('react-native-google-mobile-ads');
      if (typeof gma?.default === 'function') return new AdMobAdService(gma as unknown as Gma, AsyncStorage, entitlements, nativePlatform());
    } catch { /* fall through to the placeholder */ }
  }
  // Web and Expo Go: no ad network. A clearly labelled placeholder is available for layout QA.
  return new PreviewAdService(AsyncStorage, entitlements, process.env.EXPO_PUBLIC_AD_PREVIEW === 'true');
}
export const adService: AdService = createAdService();
