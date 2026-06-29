import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../storage/keys';
export type Entitlements = { adsRemoved: boolean };
export interface PurchaseService { getEntitlements(): Promise<Entitlements>; purchaseRemoveAds(): Promise<Entitlements>; restorePurchases(): Promise<Entitlements>; }
class MockPurchaseService implements PurchaseService {
  async getEntitlements() { return { adsRemoved: (await AsyncStorage.getItem(STORAGE_KEYS.adsRemoved)) === 'true' }; }
  async purchaseRemoveAds() { await AsyncStorage.setItem(STORAGE_KEYS.adsRemoved, 'true'); return { adsRemoved: true }; }
  async restorePurchases() { return this.getEntitlements(); }
}
// TODO: Replace after EAS builds with expo-in-app-purchases, RevenueCat, or another EAS-compatible IAP SDK.
export const purchaseService: PurchaseService = new MockPurchaseService();
