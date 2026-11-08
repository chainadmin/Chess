import AsyncStorage from '@react-native-async-storage/async-storage';
import { purchaseService } from '../purchases/PurchaseService';
import { PreviewAdService, type AdService } from './PreviewAdService';
export type { AdReason, AdService } from './PreviewAdService';

declare const process: { env: { EXPO_PUBLIC_AD_PREVIEW?: string } };
// Optional local placement QA only. This flag never activates a real ad provider.
export const adService: AdService = new PreviewAdService(
  AsyncStorage, () => purchaseService.getEntitlements(), process.env.EXPO_PUBLIC_AD_PREVIEW === 'true',
);
