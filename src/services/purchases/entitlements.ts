import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { authService } from '../auth/AuthService';
import type { EntitlementGrant } from './products';

import { Entitlements, NO_ENTITLEMENTS } from './billing';
export type { Entitlements } from './billing';
export { NO_ENTITLEMENTS } from './billing';

const KEY = 'shiftchess.verifiedEntitlements';
const empty = (): EntitlementGrant => ({ adsRemoved: false, premiumPieceSets: [] });
const union = (a: EntitlementGrant, b: EntitlementGrant): EntitlementGrant => ({
  adsRemoved: a.adsRemoved || b.adsRemoved,
  premiumPieceSets: [...new Set([...a.premiumPieceSets, ...b.premiumPieceSets])],
});
const valid = (value: unknown): value is EntitlementGrant => !!value && typeof value === 'object' &&
  typeof (value as EntitlementGrant).adsRemoved === 'boolean' && Array.isArray((value as EntitlementGrant).premiumPieceSets) &&
  (value as EntitlementGrant).premiumPieceSets.every(id => id === 'modern' || id === 'tournament');

/**
 * What this player owns. Only grants returned by the ShiftChess server after it
 * verified an Apple/Google receipt are ever added. Purchases made on this device
 * (even as a guest) and purchases attached to the signed-in account both count.
 * The verified result is cached so premium items keep working offline.
 */
class EntitlementStore {
  private device = empty();
  private account = empty();
  private snapshot: Entitlements = NO_ENTITLEMENTS;
  private listeners = new Set<() => void>();
  private loading?: Promise<void>;

  constructor() {
    authService.subscribe(user => { if (!user || user.guest) { this.account = empty(); this.publish(); } });
  }
  load(): Promise<void> {
    this.loading ??= (async () => {
      try {
        const saved = JSON.parse(await AsyncStorage.getItem(KEY) ?? 'null') as { device?: unknown; account?: unknown } | null;
        if (valid(saved?.device)) this.device = union(this.device, saved.device);
        if (valid(saved?.account)) this.account = union(this.account, saved.account);
      } catch { /* corrupt cache: re-verify via restore */ }
      this.publish(false);
    })();
    return this.loading;
  }
  private publish(persist = true) {
    const grant = union(this.device, this.account);
    const owned = grant.adsRemoved || grant.premiumPieceSets.length > 0;
    this.snapshot = owned ? { ...grant, source: 'verified' } : NO_ENTITLEMENTS;
    if (persist) void AsyncStorage.setItem(KEY, JSON.stringify({ device: this.device, account: this.account })).catch(() => undefined);
    this.listeners.forEach(listener => listener());
  }
  mergeDevice(grant: EntitlementGrant) { if (valid(grant)) { this.device = union(this.device, grant); this.publish(); } }
  /** The server's full list for the signed-in account (replaces the previous account list). */
  mergeAccount(grant: EntitlementGrant) { if (valid(grant)) { this.account = { ...grant }; this.publish(); } }
  get = (): Entitlements => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); void this.load(); return () => { this.listeners.delete(listener); }; };
}

export const entitlementStore = new EntitlementStore();
export function useEntitlements(): Entitlements {
  return useSyncExternalStore(entitlementStore.subscribe, entitlementStore.get, entitlementStore.get);
}
