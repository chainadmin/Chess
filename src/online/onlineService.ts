import { useSyncExternalStore } from 'react';
import { GAME_URL } from '../services/api/ApiClient';
import { authService } from '../services/auth/AuthService';
import { ClientState, OnlineClient } from './OnlineClient';

// No default server, no simulated player, no entitlement check and no hidden network fallback.
// Online play uses the signed-in account; guests are asked to log in.
export const onlineClient = GAME_URL ? new OnlineClient(GAME_URL, {
  getToken: async () => {
    const user = await authService.currentUser();
    return user && !user.guest ? authService.token() : null;
  },
  longPollMs: 15_000,
}) : null;
// A different person signing in must never inherit the previous player's queue or game view.
authService.subscribe(() => onlineClient?.reset());

const unavailable: ClientState = { online: null, connection: 'idle', pending: false, error: null, receivedAt: 0 };
const noop = () => () => undefined;
export function useOnlineState() {
  return useSyncExternalStore(onlineClient?.subscribe ?? noop, onlineClient?.getSnapshot ?? (() => unavailable), () => unavailable);
}
