import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '../../storage/keys';

export type SoundKind = 'move' | 'capture' | 'check' | 'gameEnd';
export interface SoundService {
  isEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
  play(kind: SoundKind): Promise<void>;
}

const TONES: Record<SoundKind, { freq: number; duration: number; type: string }> = {
  move: { freq: 520, duration: 0.07, type: 'sine' },
  capture: { freq: 300, duration: 0.11, type: 'square' },
  check: { freq: 740, duration: 0.09, type: 'triangle' },
  gameEnd: { freq: 220, duration: 0.35, type: 'sawtooth' },
};

// Expo Go mock: on web we synthesize short beeps with the Web Audio API so the sound
// toggle is meaningfully testable without shipping audio assets. On native, plug a real
// SDK (e.g. expo-audio) into `play()` for EAS/native builds without touching game logic.
class ExpoGoSoundService implements SoundService {
  private ctx: any = null;

  async isEnabled() { return (await AsyncStorage.getItem(STORAGE_KEYS.soundEnabled)) !== 'false'; }
  async setEnabled(enabled: boolean) { await AsyncStorage.setItem(STORAGE_KEYS.soundEnabled, String(enabled)); }

  private context(): any {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    const win = window as any;
    const AudioCtx = win.AudioContext || win.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) this.ctx = new AudioCtx();
    return this.ctx;
  }

  async play(kind: SoundKind) {
    if (!(await this.isEnabled())) return;
    const ctx = this.context();
    if (!ctx) return;
    const { freq, duration, type } = TONES[kind];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }
}

export const soundService: SoundService = new ExpoGoSoundService();
