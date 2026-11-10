import type { PremiumPieceSet, ProductId } from './products';
export type { PremiumPieceSet } from './products';

/** Pure billing types and the fail-closed adapter. No React Native imports, so Node tests can use them. */
export type Entitlements = { adsRemoved: boolean; premiumPieceSets: readonly PremiumPieceSet[]; source: 'unavailable' | 'verified' };
export const NO_ENTITLEMENTS: Entitlements = Object.freeze({ adsRemoved: false, premiumPieceSets: Object.freeze([]), source: 'unavailable' });
export type StoreProduct = { id: ProductId; title: string; price: string };

export interface PurchaseService {
  readonly available: boolean;
  /** Why buying is unavailable, when it is. */
  readonly unavailableReason: string;
  init(): Promise<void>;
  products(): Promise<StoreProduct[]>;
  getEntitlements(): Promise<Entitlements>;
  purchaseRemoveAds(): Promise<Entitlements>;
  purchasePieceSet(id: PremiumPieceSet): Promise<Entitlements>;
  restorePurchases(): Promise<Entitlements>;
}
export const BILLING_UNAVAILABLE = 'Purchases are not available in this build. Nothing has been charged or unlocked.';

/** Web, Expo Go, or no accounts server: purchases fail closed and never fabricate ownership. */
export class UnavailablePurchaseService implements PurchaseService {
  readonly available = false;
  constructor(readonly unavailableReason = BILLING_UNAVAILABLE, private readonly owned: () => Promise<Entitlements> = async () => NO_ENTITLEMENTS) {}
  async init() {}
  async products() { return []; }
  getEntitlements(): Promise<Entitlements> { return this.owned(); }
  async purchaseRemoveAds(): Promise<Entitlements> { throw new Error(this.unavailableReason); }
  async purchasePieceSet(_id: PremiumPieceSet): Promise<Entitlements> { throw new Error(this.unavailableReason); }
  async restorePurchases(): Promise<Entitlements> { throw new Error('Restore is unavailable in this build. No purchases were restored.'); }
}
