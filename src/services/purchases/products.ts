/**
 * Store product catalog shared by the app and the accounts server.
 *
 * Create these EXACT product IDs as **Non-Consumable** in-app purchases in
 * App Store Connect and as one-time **in-app products** in Google Play Console.
 * Prices are set in the stores, never here.
 */
export type PremiumPieceSet = 'modern' | 'tournament';

/** Same as ios.bundleIdentifier and android.package in app.json. */
export const APP_ID = 'com.chainsoftwaregroup.shiftchess';

export const PRODUCT_IDS = {
  removeAds: 'remove_ads',
  forgedMetal: 'pieces_forged_metal',
  royalLacquer: 'pieces_royal_lacquer',
} as const;
export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];
export const ALL_PRODUCT_IDS: readonly ProductId[] = Object.freeze(Object.values(PRODUCT_IDS));

export const PIECE_SET_PRODUCTS: Record<PremiumPieceSet, ProductId> = {
  modern: PRODUCT_IDS.forgedMetal,
  tournament: PRODUCT_IDS.royalLacquer,
};

export type EntitlementGrant = { adsRemoved: boolean; premiumPieceSets: PremiumPieceSet[] };

export function isProductId(value: unknown): value is ProductId {
  return typeof value === 'string' && (ALL_PRODUCT_IDS as readonly string[]).includes(value);
}

/** Converts verified, unrevoked product IDs into what they unlock. */
export function grantsFor(productIds: Iterable<string>): EntitlementGrant {
  const owned = new Set(productIds);
  return {
    adsRemoved: owned.has(PRODUCT_IDS.removeAds),
    premiumPieceSets: (Object.keys(PIECE_SET_PRODUCTS) as PremiumPieceSet[]).filter(id => owned.has(PIECE_SET_PRODUCTS[id])),
  };
}
