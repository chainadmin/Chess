import { BOARD_THEMES, DEFAULT_APPEARANCE, PIECE_SETS, type AppearancePreferences, type BoardThemeId, type PieceSetId } from '../appearance/catalog';
import type { Entitlements, PremiumPieceSet } from '../services/purchases/billing';

export type CosmeticAccess = { kind: 'starter' } | { kind: 'level'; level: number } | { kind: 'premium'; product: PremiumPieceSet };
/** New players start with two boards and two piece sets; one new reward at levels 2, 3, 4, 5 and 10. */
export const BOARD_ACCESS: Record<BoardThemeId, CosmeticAccess> = {
  walnut: { kind: 'starter' }, forest: { kind: 'starter' }, sandstone: { kind: 'level', level: 2 }, slate: { kind: 'level', level: 4 },
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

export type Reward = { level: number; kind: 'board' | 'pieces'; id: string; name: string };
/** Every cosmetic earned by levelling, in unlock order (starter items count as level 1). */
export function levelRewards(): Reward[] {
  const boards = (Object.keys(BOARD_ACCESS) as BoardThemeId[]).map(id => ({ access: BOARD_ACCESS[id], kind: 'board' as const, id, name: `${BOARD_THEMES[id].name} board` }));
  const pieces = (Object.keys(PIECE_ACCESS) as PieceSetId[]).map(id => ({ access: PIECE_ACCESS[id], kind: 'pieces' as const, id, name: `${PIECE_SETS[id].name} pieces` }));
  return [...boards, ...pieces].flatMap(item => item.access.kind === 'premium' ? [] :
    [{ level: item.access.kind === 'level' ? item.access.level : 1, kind: item.kind, id: item.id, name: item.name }])
    .sort((a, b) => a.level - b.level || (a.kind === b.kind ? 0 : a.kind === 'board' ? -1 : 1));
}
export function nextReward(level: number): Reward | undefined {
  return levelRewards().find(reward => reward.level > level);
}

/** Picker order: usable first (original order), then locked by unlock level, premium last. */
export function splitByAccess<T extends string>(ids: readonly T[], access: Record<T, CosmeticAccess>, level: number, entitlements: Entitlements) {
  const rank = (id: T) => { const a = access[id]; return a.kind === 'level' ? a.level : a.kind === 'premium' ? 1000 : 0; };
  const available = ids.filter(id => canUseCosmetic(access[id], level, entitlements));
  const locked = ids.filter(id => !available.includes(id)).sort((a, b) => rank(a) - rank(b));
  return { available, locked };
}
