import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../storage/keys';
import { hashPassword, randomSalt } from './hash';

export type User = { id: string; email?: string; guest: boolean; displayName: string; passwordHash?: string; passwordSalt?: string };
export interface AuthService { currentUser(): Promise<User | null>; register(email: string, password: string): Promise<User>; login(email: string, password: string): Promise<User>; continueAsGuest(): Promise<User>; logout(): Promise<void>; }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

class LocalAuthService implements AuthService {
  private async users(): Promise<User[]> { return JSON.parse(await AsyncStorage.getItem(STORAGE_KEYS.users) ?? '[]'); }
  async currentUser() { const raw = await AsyncStorage.getItem(STORAGE_KEYS.currentUser); return raw ? JSON.parse(raw) as User : null; }

  async register(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) throw new Error('Enter a valid email address');
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    const users = await this.users();
    if (users.some(u => u.email === normalizedEmail)) throw new Error('Email already registered');
    const passwordSalt = randomSalt();
    const user: User = { id: `user-${Date.now()}`, email: normalizedEmail, passwordHash: hashPassword(password, passwordSalt), passwordSalt, guest: false, displayName: normalizedEmail.split('@')[0] };
    await AsyncStorage.setItem(STORAGE_KEYS.users, JSON.stringify([...users, user]));
    await AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
    return user;
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = (await this.users()).find(u => u.email === normalizedEmail);
    if (!user || !user.passwordSalt || hashPassword(password, user.passwordSalt) !== user.passwordHash) throw new Error('Invalid email or password');
    await AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
    return user;
  }

  async continueAsGuest() { const user: User = { id: `guest-${Date.now()}`, guest: true, displayName: 'Guest' }; await AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user)); return user; }
  async logout() { await AsyncStorage.removeItem(STORAGE_KEYS.currentUser); }
}
// Swap this implementation for JWT-backed API auth when a backend is available.
export const authService: AuthService = new LocalAuthService();
