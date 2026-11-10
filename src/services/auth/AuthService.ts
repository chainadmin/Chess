import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../storage/keys';
import { api, ApiError, API_URL } from '../api/ApiClient';
import type { EntitlementGrant } from '../purchases/products';
import { tokenStorage } from './tokenStorage';

export type Profile = { id: string; username: string; rating: number; gamesPlayed: number; wins: number; losses: number; draws: number };
/** A signed-in account (guest: false) or an offline guest on this device. */
export type User = { id: string; guest: boolean; displayName: string; profile?: Profile };
type SessionResponse = { token: string; expiresAt: number; user: Profile; entitlements: EntitlementGrant };

export const USERNAME_RULES = '3–20 letters, numbers or underscores';
export const MIN_PASSWORD_LENGTH = 8;

const fromProfile = (profile: Profile): User => ({ id: profile.id, guest: false, displayName: profile.username, profile });

type Listener = (user: User | null) => void;

/**
 * Real accounts live on the ShiftChess accounts server (username + password).
 * Guests can still play everything offline; online play needs an account.
 */
class AuthService {
  private listeners = new Set<Listener>();
  private cached: User | null | undefined;
  readonly accountsAvailable = !!API_URL;

  subscribe(listener: Listener) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private async publish(user: User | null) {
    this.cached = user;
    if (user) await AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
    else await AsyncStorage.removeItem(STORAGE_KEYS.currentUser);
    this.listeners.forEach(listener => listener(user));
  }

  async currentUser(): Promise<User | null> {
    if (this.cached !== undefined) return this.cached;
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.currentUser).catch(() => null);
    let user: User | null = null;
    try { user = raw ? JSON.parse(raw) as User : null; } catch { user = null; }
    // Old local-only demo accounts have no server session: ask them to sign in again.
    if (user && !user.guest && !(await tokenStorage.get())) user = null;
    this.cached = user;
    return user;
  }
  token(): Promise<string | null> { return tokenStorage.get(); }

  private async begin(path: '/auth/register' | '/auth/login', username: string, password: string) {
    const session = await api<SessionResponse>('POST', path, { body: { username: username.trim(), password } });
    await tokenStorage.set(session.token);
    const user = fromProfile(session.user);
    await this.publish(user);
    return { user, entitlements: session.entitlements };
  }
  async register(username: string, password: string) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username.trim())) throw new Error(`Usernames are ${USERNAME_RULES}.`);
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`);
    return (await this.begin('/auth/register', username, password)).user;
  }
  async login(username: string, password: string) {
    if (!username.trim() || !password) throw new Error('Enter your username and password.');
    return (await this.begin('/auth/login', username, password)).user;
  }
  async continueAsGuest() {
    const user: User = { id: `guest-${Date.now()}`, guest: true, displayName: 'Guest' };
    await tokenStorage.clear();
    await this.publish(user);
    return user;
  }

  /** Refreshes rating/record from the server. Signs out if the session was revoked. */
  async refresh(): Promise<{ user: User | null; entitlements?: EntitlementGrant }> {
    const current = await this.currentUser();
    const token = await this.token();
    if (!current || current.guest || !token) return { user: current };
    try {
      const me = await api<{ user: Profile; entitlements: EntitlementGrant }>('GET', '/me', { token });
      const user = fromProfile(me.user);
      await this.publish(user);
      return { user, entitlements: me.entitlements };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { await this.signOutLocally(); return { user: null }; }
      return { user: current }; // offline: keep the cached profile
    }
  }

  private async signOutLocally() { await tokenStorage.clear(); await this.publish(null); }
  async logout() {
    const token = await this.token();
    if (token) await api('POST', '/auth/logout', { token }).catch(() => undefined);
    await this.signOutLocally();
  }
  async changePassword(currentPassword: string, newPassword: string) {
    if (newPassword.length < MIN_PASSWORD_LENGTH) throw new Error(`Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`);
    const session = await api<{ token: string }>('POST', '/me/password', { token: await this.token(), body: { currentPassword, newPassword } });
    await tokenStorage.set(session.token);
  }
  /** Permanently deletes the account on the server (required by the App Store). */
  async deleteAccount(password: string) {
    await api('POST', '/me/delete', { token: await this.token(), body: { password } });
    await this.signOutLocally();
  }
}

export const authService = new AuthService();
