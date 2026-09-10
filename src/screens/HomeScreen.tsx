import React, { useCallback, useState } from 'react';
import { Text, StyleSheet, View } from 'react-native';
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
  return <Screen style={styles.center}>
    <Text style={styles.title}>ShiftChess</Text>
    <View style={styles.ratingCard}>
      <Text style={styles.ratingLabel}>YOUR RATING</Text>
      <Text style={styles.rating}>{rating}</Text>
      <Text style={styles.ratingTitle}>{ratingTitle(rating)}</Text>
    </View>
    <Text style={styles.caption}>Rated multiplayer • 0–3500</Text>
    <AppButton title="Daily Puzzle" onPress={() => navigation.navigate('DailyPuzzle')} />
    <AppButton title="Play Local" onPress={() => navigation.navigate('Game', { mode: 'local' })} />
    <AppButton title="Multiplayer" onPress={() => navigation.navigate('Multiplayer')} />
    <AppButton title="Rules" onPress={() => navigation.navigate('Rules')} secondary />
    <AppButton title="Settings" onPress={() => navigation.navigate('Settings')} secondary />
  </Screen>;
}
const styles = StyleSheet.create({
  center: { justifyContent: 'center' },
  title: { fontSize: 42, fontWeight: '900', color: theme.colors.text, textAlign: 'center', letterSpacing: -1 },
  ratingCard: { alignSelf: 'center', alignItems: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSoft, borderRadius: theme.radius.lg, paddingVertical: 14, paddingHorizontal: 30, marginTop: 14 },
  ratingLabel: { color: theme.colors.textFaint, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  rating: { fontSize: 32, fontWeight: '900', color: theme.colors.cyan, marginTop: 2 },
  ratingTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  caption: { color: theme.colors.textDim, textAlign: 'center', marginTop: 10, marginBottom: 22 },
});
