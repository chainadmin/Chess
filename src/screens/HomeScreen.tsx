import React, { useCallback, useState } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { authService } from '../services/auth/AuthService';
import { ratingService, ratingTitle } from '../services/rating/RatingService';
import { onlineClient } from '../online/onlineService';
import { theme } from '../styles/theme';
import { useProgression } from '../progression/useProgression';
import { MAX_LEVEL, XP_PER_LEVEL } from '../progression/progression';
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
export function HomeScreen({ navigation }: Props) {
  const progress = useProgression();
  const [rating, setRating] = useState(1200);
  const load = useCallback(() => { authService.currentUser().then(user => user && ratingService.getRating(user.id).then(current => setRating(current.value))); }, []);
  useFocusEffect(load);
  return <Screen><ScrollView contentContainerStyle={styles.center}>
    <Text style={styles.title}>ShiftChess</Text>
    <View style={styles.ratingCard}>
      <Text style={styles.ratingLabel}>YOUR RATING</Text>
      <Text style={styles.rating}>{rating}</Text>
      <Text style={styles.ratingTitle}>{ratingTitle(rating)}</Text>
    </View>
    <Text style={styles.caption}>Local demo rating • 0–3500</Text>
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
    <Text style={styles.onlineStatus}>{onlineClient ? 'Human opponents · Unrated 3+2 playtest' : 'Live server not configured in this build'}</Text>
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
  caption: { color: theme.colors.textDim, textAlign: 'center', marginTop: 10, marginBottom: 22 },
});
