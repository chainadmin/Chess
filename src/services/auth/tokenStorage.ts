import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY = 'shiftchess.sessionToken';

/** Sign-in token: iOS Keychain / Android Keystore via expo-secure-store; browser storage on web. */
type Secure = { getItemAsync(key: string): Promise<string | null>; setItemAsync(key: string, value: string): Promise<void>; deleteItemAsync(key: string): Promise<void> };
let secure: Secure | null = null;
if (Platform.OS !== 'web') {
  try { secure = require('expo-secure-store') as Secure; } catch { secure = null; }
}

export const tokenStorage = {
  async get(): Promise<string | null> {
    try { return secure ? await secure.getItemAsync(KEY) : await AsyncStorage.getItem(KEY); } catch { return null; }
  },
  async set(token: string): Promise<void> {
    if (secure) await secure.setItemAsync(KEY, token); else await AsyncStorage.setItem(KEY, token);
  },
  async clear(): Promise<void> {
    try { if (secure) await secure.deleteItemAsync(KEY); else await AsyncStorage.removeItem(KEY); } catch { /* already gone */ }
  },
};
