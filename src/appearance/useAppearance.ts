import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppearanceStore } from './AppearanceStore';
import { BOARD_THEMES, type AppearancePreferences } from './catalog';
import { availableAppearance, BOARD_ACCESS, PIECE_ACCESS, canUseCosmetic } from '../progression/cosmetics';
import { progressionStore, useProgression } from '../progression/useProgression';
import { NO_ENTITLEMENTS } from '../services/purchases/PurchaseService';

const store = new AppearanceStore(AsyncStorage);
const updateAppearance = async (change: Partial<AppearancePreferences>) => {
  await progressionStore.ensureLoaded();
  const { level } = progressionStore.getSnapshot();
  if (change.board && !canUseCosmetic(BOARD_ACCESS[change.board], level, NO_ENTITLEMENTS)) return;
  if (change.pieces && !canUseCosmetic(PIECE_ACCESS[change.pieces], level, NO_ENTITLEMENTS)) return;
  await store.update(change);
};
export function useAppearance() {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const progress = useProgression();
  useEffect(() => { void store.load(); }, []);
  // Enforce access at the renderer as well as the picker, including legacy saved preferences.
  const active = availableAppearance(snapshot, progress.level, NO_ENTITLEMENTS);
  return { ...snapshot, ...active, loaded: snapshot.loaded && progress.loaded, boardTheme: BOARD_THEMES[active.board], updateAppearance };
}
