import { useSyncExternalStore } from 'react';
import { ClientState, OnlineClient, onlineServerUrl } from './OnlineClient';

declare const process: { env: { EXPO_PUBLIC_ONLINE_URL?: string } };
// Expo replaces this exact property access at bundle time. No default server,
// no simulated player, no entitlement check and no hidden network fallback.
const url = onlineServerUrl(process.env.EXPO_PUBLIC_ONLINE_URL, typeof __DEV__ !== 'undefined' && __DEV__);
export const onlineClient = url ? new OnlineClient(url) : null;
const unavailable: ClientState = { online: null, connection: 'idle', pending: false, error: null, receivedAt: 0 };
const noop = () => () => undefined;
export function useOnlineState() {
  return useSyncExternalStore(onlineClient?.subscribe ?? noop, onlineClient?.getSnapshot ?? (() => unavailable), () => unavailable);
}
