import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { api } from '../services/api/ApiClient';
import { authService } from '../services/auth/AuthService';
import { ratingTitle } from '../services/rating/RatingService';
import { theme } from '../styles/theme';

type Player = { username: string; rating: number; gamesPlayed: number; wins: number; losses: number; draws: number };
type Props = NativeStackScreenProps<RootStackParamList, 'Leaderboard'>;

export function LeaderboardScreen(_props: Props) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    authService.currentUser().then(user => setMe(user && !user.guest ? user.displayName : null));
    api<{ players: Player[] }>('GET', '/leaderboard').then(result => setPlayers(result.players)).catch(e => setError((e as Error).message));
  }, []);
  useFocusEffect(load);
  return <Screen>
    <Text style={styles.eyebrow}>RATED ONLINE 3+2</Text>
    <Text style={styles.title}>Leaderboard</Text>
    {error ? <View style={styles.card}><Text style={styles.copy}>{error}</Text><AppButton title="Try again" secondary onPress={load} /></View>
      : !players ? <ActivityIndicator color={theme.colors.cyan} style={{ marginTop: 30 }} />
      : !players.length ? <View style={styles.card}><Text style={styles.copy}>No rated games yet. Play an online game to be the first on the board.</Text></View>
      : <FlatList data={players} keyExtractor={player => player.username} contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item, index }) => <View style={[styles.row, item.username === me && styles.mine]} accessible accessibilityLabel={`Rank ${index + 1}, ${item.username}, rating ${item.rating}`}>
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.username}{item.username === me ? ' (you)' : ''}</Text>
              <Text style={styles.copy}>{ratingTitle(item.rating)} · {item.wins}W {item.losses}L {item.draws}D</Text>
            </View>
            <Text style={styles.rating}>{item.rating}</Text>
          </View>} />}
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: theme.colors.cyan, fontWeight: '900', letterSpacing: 1.6, fontSize: 12, marginTop: 12 },
  title: { fontSize: 34, fontWeight: '900', color: theme.colors.text, marginTop: 4, marginBottom: 16 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, borderWidth: 1, borderColor: theme.colors.borderSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.borderSoft },
  mine: { borderColor: theme.colors.accent },
  rank: { color: theme.colors.textDim, fontWeight: '900', fontSize: 18, width: 30, textAlign: 'center' },
  name: { color: theme.colors.text, fontWeight: '800', fontSize: 16 },
  rating: { color: theme.colors.cyan, fontWeight: '900', fontSize: 20, fontVariant: ['tabular-nums'] },
  copy: { color: theme.colors.textDim, fontSize: 13, marginTop: 2 },
});
