import React, { useCallback, useState } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { authService, User } from '../services/auth/AuthService';
import { ratingTitle } from '../services/rating/RatingService';
import { entitlementStore } from '../services/purchases/entitlements';
import { onlineClient } from '../online/onlineService';
import { theme } from '../styles/theme';
import { useProgression } from '../progression/useProgression';
import { MAX_LEVEL, XP_PER_LEVEL } from '../progression/progression';
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
export function HomeScreen({ navigation }: Props) {
  const progress = useProgression();
  const [user, setUser] = useState<User | null>(null);
  const load = useCallback(() => {
    authService.currentUser().then(setUser);
    authService.refresh().then(({ user: fresh, entitlements }) => {
      setUser(fresh);
      if (entitlements) entitlementStore.mergeAccount(entitlements);
    }).catch(() => undefined);
  }, []);
  useFocusEffect(load);
  const profile = user && !user.guest ? user.profile : undefined;
  return <Screen><ScrollView contentContainerStyle={styles.center}>
    <Text style={styles.title}>ShiftChess</Text>
    {profile ? <>
      <View style={styles.ratingCard}>
        <Text style={styles.ratingLabel}>{profile.username.toUpperCase()} · ONLINE RATING</Text>
        <Text style={styles.rating}>{profile.rating}</Text>
        <Text style={styles.ratingTitle}>{ratingTitle(profile.rating)}</Text>
      </View>
      <Text style={styles.caption}>{profile.gamesPlayed ? `${profile.wins}W · ${profile.losses}L · ${profile.draws}D in rated 3+2 games` : 'Play an online 3+2 game to start your rating'}</Text>
    </> : <View style={styles.guestCard}>
      <Text style={styles.ratingLabel}>PLAYING AS GUEST</Text>
      <Text style={styles.progressCopy}>Create a free account to play people online and earn a rating.</Text>
      {authService.accountsAvailable && <View style={styles.computerOptions}>
        <View style={styles.computerOption}><AppButton title="Create account" onPress={() => navigation.navigate('Register')} /></View>
        <View style={styles.computerOption}><AppButton title="Login" secondary onPress={() => navigation.navigate('Login')} /></View>
      </View>}
    </View>}
    <View style={styles.progressCard}>
      <Text style={styles.ratingTitle}>PRACTICE LEVEL {progress.level}</Text>
      <Text style={styles.progressCopy}>{progress.loaded ? `${progress.xp} XP · ${progress.level === MAX_LEVEL ? 'Max level' : `${XP_PER_LEVEL - progress.xp % XP_PER_LEVEL} XP to level ${progress.level + 1}`}` : 'Loading practice progress…'}</Text>
      <Text style={styles.progressCopy}>Earn board colors and Carved Wood pieces. Progress stays on this device, separate from rating.</Text>
      {progress.error && <><Text accessibilityRole="alert" style={styles.progressError}>{progress.error}</Text><AppButton title="Retry loading progress" secondary onPress={() => { void progress.retryLoad(); }} /></>}
    </View>
    <AppButton title="Daily Puzzle" onPress={() => navigation.navigate('DailyPuzzle')} />
    <AppButton title="Pass and Play" onPress={() => navigation.navigate('Game', { mode: 'local' })} />
    <Text style={styles.computerLabel}>PLAY THE COMPUTER · YOU ARE WHITE</Text>
    <View style={styles.computerOptions}>
      {(['easy', 'medium', 'hard'] as const).map(difficulty => <View key={difficulty} style={styles.computerOption}>
        <AppButton title={difficulty[0].toUpperCase() + difficulty.slice(1)} secondary onPress={() => navigation.navigate('Game', { mode: 'local', computerDifficulty: difficulty })} />
      </View>)}
    </View>
    <AppButton title="Online 3+2 · Always free" onPress={() => navigation.navigate('Multiplayer')} />
    <Text style={styles.onlineStatus}>{!onlineClient ? 'Live server not configured in this build' : profile ? 'Rated games against real players' : 'Needs a free account'}</Text>
    {authService.accountsAvailable && <AppButton title="Leaderboard" onPress={() => navigation.navigate('Leaderboard')} secondary />}
    <AppButton title="Rules" onPress={() => navigation.navigate('Rules')} secondary />
    <AppButton title="Settings & Cosmetics" onPress={() => navigation.navigate('Settings')} secondary />
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center', paddingVertical: 16 },
  progressCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSoft, borderRadius: theme.radius.lg, padding: 14, marginBottom: 12 },
  progressCopy: { color: theme.colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 5 },
  progressError: { color: theme.colors.danger, fontSize: 12, marginTop: 6 },
  onlineStatus: { color: theme.colors.textDim, textAlign: 'center', fontSize: 11, lineHeight: 16, marginBottom: 10 },
  computerLabel: { color: theme.colors.textDim, textAlign: 'center', fontSize: 11, fontWeight: '800', marginTop: 12 },
  computerOptions: { flexDirection: 'row', gap: 8 },
  computerOption: { flex: 1 },
  title: { fontSize: 42, fontWeight: '900', color: theme.colors.text, textAlign: 'center', letterSpacing: -1 },
  ratingCard: { alignSelf: 'center', alignItems: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSoft, borderRadius: theme.radius.lg, paddingVertical: 14, paddingHorizontal: 30, marginTop: 14 },
  ratingLabel: { color: theme.colors.textFaint, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  rating: { fontSize: 32, fontWeight: '900', color: theme.colors.cyan, marginTop: 2 },
  ratingTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  guestCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSoft, borderRadius: theme.radius.lg, padding: 14, marginTop: 14, marginBottom: 14 },
  caption: { color: theme.colors.textDim, textAlign: 'center', marginTop: 10, marginBottom: 22 },
});
