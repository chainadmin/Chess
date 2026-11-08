import React, { useCallback, useState } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { authService } from '../services/auth/AuthService';
import { ratingService, ratingTitle } from '../services/rating/RatingService';
import { theme } from '../styles/theme';
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
export function HomeScreen({ navigation }: Props) {
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
    <AppButton title="Daily Puzzle" onPress={() => navigation.navigate('DailyPuzzle')} />
    <AppButton title="Pass and Play" onPress={() => navigation.navigate('Game', { mode: 'local' })} />
    <Text style={styles.computerLabel}>PLAY THE COMPUTER · YOU ARE WHITE</Text>
    <View style={styles.computerOptions}>
      {(['easy', 'medium', 'hard'] as const).map(difficulty => <View key={difficulty} style={styles.computerOption}>
        <AppButton title={difficulty[0].toUpperCase() + difficulty.slice(1)} secondary onPress={() => navigation.navigate('Game', { mode: 'local', computerDifficulty: difficulty })} />
      </View>)}
    </View>
    <AppButton title="Mock Multiplayer" onPress={() => navigation.navigate('Multiplayer')} />
    <AppButton title="Rules" onPress={() => navigation.navigate('Rules')} secondary />
    <AppButton title="Settings" onPress={() => navigation.navigate('Settings')} secondary />
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center', paddingVertical: 16 },
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
