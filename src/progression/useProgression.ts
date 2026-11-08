import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProgressionStore } from './ProgressionStore';

export const progressionStore = new ProgressionStore(AsyncStorage);
export function useProgression() {
  const snapshot = useSyncExternalStore(progressionStore.subscribe, progressionStore.getSnapshot, progressionStore.getSnapshot);
  useEffect(() => { void progressionStore.ensureLoaded(); }, []);
  return { ...snapshot, retryLoad: progressionStore.load };
}
