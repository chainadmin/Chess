import { onlineServerUrl } from '../../online/OnlineClient';

declare const process: { env: { EXPO_PUBLIC_API_URL?: string; EXPO_PUBLIC_GAME_URL?: string; EXPO_PUBLIC_ONLINE_URL?: string } };
const development = typeof __DEV__ !== 'undefined' && __DEV__;
// Expo inlines these exact property reads at build time (see eas.json / .env).
/** The ShiftChess server on Railway: accounts, purchases, privacy page and online games. */
export const API_URL = onlineServerUrl(process.env.EXPO_PUBLIC_API_URL, development);
/** Online games use the same server unless a separate game server is configured (optional). */
export const GAME_URL = onlineServerUrl(process.env.EXPO_PUBLIC_GAME_URL ?? process.env.EXPO_PUBLIC_ONLINE_URL, development) ?? API_URL;
export const PRIVACY_URL = API_URL ? `${API_URL}/privacy` : null;
export const TERMS_URL = API_URL ? `${API_URL}/terms` : null;
export const SUPPORT_URL = API_URL ? `${API_URL}/support` : null;

export class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) { super(message); }
}

export async function api<T>(method: 'GET' | 'POST', path: string, options: { body?: unknown; token?: string | null; timeoutMs?: number } = {}): Promise<T> {
  if (!API_URL) throw new ApiError('not_configured', 'Online accounts are not available in this build.', 0);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method, redirect: 'error', credentials: 'omit', signal: controller.signal,
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError('offline', 'Could not reach ShiftChess. Check your connection and try again.', 0);
  } finally { clearTimeout(timer); }
  let data: unknown = null;
  try { data = await response.json(); } catch { /* handled below */ }
  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(error?.code ?? 'server_error', error?.message ?? 'Something went wrong. Please try again.', response.status);
  }
  return data as T;
}
