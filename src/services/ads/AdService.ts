import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { purchaseService } from '../purchases/PurchaseService';
import { AdMobAdService } from './AdMobAdService';
import { PreviewAdService, type AdService } from './PreviewAdService';
export type { AdReason, AdService } from './PreviewAdService';

declare const process: { env: { EXPO_PUBLIC_AD_PREVIEW?: string } };
const entitlements = () => purchaseService.getEntitlements();

function createAdService(): AdService {
  if (Platform.OS !== 'web') {
    try {
      // Native module: present in EAS/App Store builds, missing in Expo Go.
      const gma = require('react-native-google-mobile-ads') as typeof import('react-native-google-mobile-ads');
      if (typeof gma?.default === 'function') return new AdMobAdService(gma, AsyncStorage, entitlements);
    } catch { /* fall through to the placeholder */ }
  }
  // Web and Expo Go: no ad network. A clearly labelled placeholder is available for layout QA.
  return new PreviewAdService(AsyncStorage, entitlements, process.env.EXPO_PUBLIC_AD_PREVIEW === 'true');
}
export const adService: AdService = createAdService();
