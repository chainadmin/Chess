import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../storage/keys';
export type User = { id: string; email?: string; guest: boolean; displayName: string; password?: string };
export interface AuthService { currentUser(): Promise<User | null>; register(email: string, password: string): Promise<User>; login(email: string, password: string): Promise<User>; continueAsGuest(): Promise<User>; logout(): Promise<void>; }
class LocalAuthService implements AuthService {
  private async users(): Promise<User[]> { return JSON.parse(await AsyncStorage.getItem(STORAGE_KEYS.users) ?? '[]'); }
  async currentUser() { const raw = await AsyncStorage.getItem(STORAGE_KEYS.currentUser); return raw ? JSON.parse(raw) as User : null; }
  async register(email: string, password: string) { const users = await this.users(); if (users.some(u => u.email === email)) throw new Error('Email already registered'); const user = { id: `user-${Date.now()}`, email, password, guest: false, displayName: email.split('@')[0] }; await AsyncStorage.setItem(STORAGE_KEYS.users, JSON.stringify([...users, user])); await AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user)); return user; }
  async login(email: string, password: string) { const user = (await this.users()).find(u => u.email === email && u.password === password); if (!user) throw new Error('Invalid local credentials'); await AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user)); return user; }
  async continueAsGuest() { const user = { id: `guest-${Date.now()}`, guest: true, displayName: 'Guest' }; await AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user)); return user; }
  async logout() { await AsyncStorage.removeItem(STORAGE_KEYS.currentUser); }
}
// Swap this implementation for JWT-backed API auth when a backend is available.
export const authService: AuthService = new LocalAuthService();
