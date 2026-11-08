export type PremiumPieceSet = 'modern' | 'tournament';
export type Entitlements = { adsRemoved: boolean; premiumPieceSets: readonly PremiumPieceSet[]; source: 'unavailable' };
export interface PurchaseService {
  readonly available: boolean;
  getEntitlements(): Promise<Entitlements>;
  purchaseRemoveAds(): Promise<Entitlements>;
  purchasePieceSet(id: PremiumPieceSet): Promise<Entitlements>;
  restorePurchases(): Promise<Entitlements>;
}
export const BILLING_UNAVAILABLE = 'Purchases are not available in this build. Nothing has been charged or unlocked.';
export const NO_ENTITLEMENTS: Entitlements = Object.freeze({ adsRemoved: false, premiumPieceSets: Object.freeze([]), source: 'unavailable' });

/** Fail closed until a real store and server-verified receipts are integrated.
 * Never promote the old mock AsyncStorage adsRemoved flag into paid ownership.
 */
export class UnavailablePurchaseService implements PurchaseService {
  readonly available = false;
  async getEntitlements(): Promise<Entitlements> { return NO_ENTITLEMENTS; }
  async purchaseRemoveAds(): Promise<Entitlements> { throw new Error(BILLING_UNAVAILABLE); }
  async purchasePieceSet(_id: PremiumPieceSet): Promise<Entitlements> { throw new Error(BILLING_UNAVAILABLE); }
  async restorePurchases(): Promise<Entitlements> { throw new Error('Restore is unavailable until store billing is connected. No purchases were restored.'); }
}
export const purchaseService: PurchaseService = new UnavailablePurchaseService();
