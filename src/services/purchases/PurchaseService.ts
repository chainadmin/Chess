import { Platform } from 'react-native';
import { api, ApiError, API_URL } from '../api/ApiClient';
import { authService } from '../auth/AuthService';
import { BILLING_UNAVAILABLE, Entitlements, PurchaseService, StoreProduct, trustedDeviceGrant, UnavailablePurchaseService } from './billing';
import { entitlementStore } from './entitlements';
import { ALL_PRODUCT_IDS, EntitlementGrant, isProductId, PIECE_SET_PRODUCTS, PremiumPieceSet, PRODUCT_IDS, ProductId } from './products';

export type { PremiumPieceSet } from './products';
export { BILLING_UNAVAILABLE, NO_ENTITLEMENTS, UnavailablePurchaseService } from './billing';
export type { Entitlements, PurchaseService, StoreProduct } from './billing';

type Iap = typeof import('expo-iap');
type Purchase = import('expo-iap').Purchase;
type Waiter = { resolve: (value: Entitlements) => void; reject: (error: Error) => void };

/**
 * Apple App Store / Google Play billing through expo-iap. Every purchase is sent
 * to the ShiftChess accounts server, which verifies it with Apple or Google
 * before anything unlocks. Transactions are finished only after verification,
 * so an interrupted purchase is redelivered by the store on the next launch.
 */
export class StorePurchaseService implements PurchaseService {
  readonly available = true;
  readonly unavailableReason = '';
  private ready?: Promise<void>;
  private catalog: StoreProduct[] = [];
  private waiting = new Map<string, Waiter>();

  constructor(private readonly iap: Iap) {}

  init(): Promise<void> {
    this.ready ??= (async () => {
      await entitlementStore.load();
      await this.iap.initConnection();
      this.iap.purchaseUpdatedListener(purchase => { void this.handle(purchase); });
      this.iap.purchaseErrorListener(error => {
        const cancelled = this.iap.isUserCancelledError(error);
        const message = cancelled ? 'Purchase cancelled. You were not charged.' : error.message || 'The purchase did not complete.';
        const ids = error.productId ? [error.productId] : [...this.waiting.keys()];
        for (const id of ids) { this.waiting.get(id)?.reject(new Error(message)); this.waiting.delete(id); }
      });
      // Quietly re-verify anything this store account already owns.
      void this.restore(true).catch(() => undefined);
    })().catch(error => { this.ready = undefined; throw error; });
    return this.ready;
  }

  async products(): Promise<StoreProduct[]> {
    await this.init();
    if (!this.catalog.length) {
      const found = await this.iap.fetchProducts({ skus: [...ALL_PRODUCT_IDS], type: 'in-app' }) ?? [];
      this.catalog = found.filter(product => isProductId(product.id))
        .map(product => ({ id: product.id as ProductId, title: product.title, price: product.displayPrice }));
    }
    return this.catalog;
  }

  private async verify(purchase: Purchase): Promise<EntitlementGrant | null> {
    if (!isProductId(purchase.productId) || !purchase.purchaseToken) return null;
    const token = await authService.token();
    const user = await authService.currentUser();
    try {
      const result = await api<{ entitlements: EntitlementGrant }>('POST', '/purchases/verify', {
        token: user && !user.guest ? token : null,
        body: { platform: Platform.OS === 'ios' ? 'ios' : 'android', productId: purchase.productId, purchaseToken: purchase.purchaseToken },
      });
      return result.entitlements;
    } catch (error) {
      // No Google key on the server yet: rely on Google Play's on-device confirmation (unlocks on this device only).
      if (Platform.OS === 'android' && error instanceof ApiError && error.code === 'not_configured') return trustedDeviceGrant(purchase);
      throw error;
    }
  }

  private async handle(purchase: Purchase) {
    const waiter = this.waiting.get(purchase.productId);
    if (purchase.purchaseState === 'pending') {
      waiter?.reject(new Error('Your purchase is pending approval. It will unlock automatically once it completes.'));
      this.waiting.delete(purchase.productId);
      return;
    }
    try {
      const grant = await this.verify(purchase);
      if (!grant) throw new Error('This purchase could not be verified.');
      entitlementStore.mergeDevice(grant);
      // Only now tell the store we delivered it (also acknowledges it on Google Play).
      await this.iap.finishTransaction({ purchase, isConsumable: false });
      waiter?.resolve(entitlementStore.get());
    } catch (error) {
      waiter?.reject(new Error(`${error instanceof Error ? error.message : 'Verification failed.'} You will not lose this purchase; use Restore purchases later.`));
    } finally { this.waiting.delete(purchase.productId); }
  }

  private async buy(productId: ProductId): Promise<Entitlements> {
    await this.init();
    if (this.waiting.has(productId)) throw new Error('That purchase is already in progress.');
    const result = new Promise<Entitlements>((resolve, reject) => this.waiting.set(productId, { resolve, reject }));
    try {
      await this.iap.requestPurchase({ type: 'in-app', request: { apple: { sku: productId }, google: { skus: [productId] } } });
    } catch (error) {
      this.waiting.get(productId)?.reject(new Error(this.iap.isUserCancelledError(error) ? 'Purchase cancelled. You were not charged.' : 'The purchase could not be started.'));
      this.waiting.delete(productId);
    }
    return result;
  }

  private async restore(quiet: boolean): Promise<Entitlements> {
    const owned = await this.iap.getAvailablePurchases();
    let verified = 0;
    for (const purchase of owned ?? []) {
      try {
        const grant = await this.verify(purchase);
        if (grant) { entitlementStore.mergeDevice(grant); verified++; }
        await this.iap.finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);
      } catch (error) { if (!quiet) throw error; }
    }
    if (!quiet && !verified) throw new Error('No previous purchases were found for this App Store or Google Play account.');
    return entitlementStore.get();
  }

  async getEntitlements() { await entitlementStore.load(); return entitlementStore.get(); }
  purchaseRemoveAds() { return this.buy(PRODUCT_IDS.removeAds); }
  purchaseEverything() { return this.buy(PRODUCT_IDS.everything); }
  purchasePieceSet(id: PremiumPieceSet) { return this.buy(PIECE_SET_PRODUCTS[id]); }
  async restorePurchases() { await this.init(); return this.restore(false); }
}

function createPurchaseService(): PurchaseService {
  const owned = async () => { await entitlementStore.load(); return entitlementStore.get(); };
  if (Platform.OS === 'web') return new UnavailablePurchaseService('Purchases are only available in the iPhone and Android apps.', owned);
  if (!API_URL) return new UnavailablePurchaseService(BILLING_UNAVAILABLE, owned);
  try {
    // Native module: present in EAS builds, missing in Expo Go.
    return new StorePurchaseService(require('expo-iap') as Iap);
  } catch {
    return new UnavailablePurchaseService('Purchases need the App Store or Google Play version of ShiftChess.', owned);
  }
}
export const purchaseService: PurchaseService = createPurchaseService();
