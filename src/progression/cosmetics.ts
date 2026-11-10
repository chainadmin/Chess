import { DEFAULT_APPEARANCE, type AppearancePreferences, type BoardThemeId, type PieceSetId } from '../appearance/catalog';
import type { Entitlements, PremiumPieceSet } from '../services/purchases/billing';

export type CosmeticAccess = { kind: 'starter' } | { kind: 'level'; level: number } | { kind: 'premium'; product: PremiumPieceSet };
export const BOARD_ACCESS: Record<BoardThemeId, CosmeticAccess> = {
  walnut: { kind: 'starter' }, forest: { kind: 'level', level: 2 }, sandstone: { kind: 'level', level: 4 }, slate: { kind: 'level', level: 6 },
};
/** Initial playtest tuning. New sets are earned cosmetics, never purchases. */
export const RICH_PIECE_UNLOCK_LEVELS = { jade: 5, crystal: 10 } as const;
export const PIECE_ACCESS: Record<PieceSetId, CosmeticAccess> = {
  classic: { kind: 'starter' }, club: { kind: 'level', level: 3 },
  modern: { kind: 'premium', product: 'modern' }, tournament: { kind: 'premium', product: 'tournament' },
  imperial: { kind: 'starter' },
  jade: { kind: 'level', level: RICH_PIECE_UNLOCK_LEVELS.jade },
  crystal: { kind: 'level', level: RICH_PIECE_UNLOCK_LEVELS.crystal },
};
export function canUseCosmetic(access: CosmeticAccess, level: number, entitlements: Entitlements): boolean {
  if (access.kind === 'starter') return true;
  if (access.kind === 'level') return Number.isFinite(level) && level >= access.level;
  // Only server-verified store purchases count. Local flags never do.
  return entitlements.source !== 'unavailable' && entitlements.premiumPieceSets.includes(access.product);
}
export function cosmeticLabel(access: CosmeticAccess, level: number): string {
  if (access.kind === 'starter') return 'Included';
  if (access.kind === 'premium') return 'Premium collection';
  return level >= access.level ? `Unlocked at level ${access.level}` : `Unlock at level ${access.level}`;
}
export function availableAppearance(preferences: AppearancePreferences, level: number, entitlements: Entitlements): AppearancePreferences {
  return {
    board: canUseCosmetic(BOARD_ACCESS[preferences.board], level, entitlements) ? preferences.board : DEFAULT_APPEARANCE.board,
    pieces: canUseCosmetic(PIECE_ACCESS[preferences.pieces], level, entitlements) ? preferences.pieces : DEFAULT_APPEARANCE.pieces,
  };
}
