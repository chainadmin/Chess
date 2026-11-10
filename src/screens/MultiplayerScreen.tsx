import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { onlineClient, useOnlineState } from '../online/onlineService';
import { authService, User } from '../services/auth/AuthService';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Multiplayer'>;
export function MultiplayerScreen({ navigation }: Props) {
  const state = useOnlineState();
  const focused = useIsFocused();
  const [searching, setSearching] = useState(false);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useFocusEffect(useCallback(() => { authService.currentUser().then(setUser); }, []));
  const needsAccount = user !== undefined && (!user || user.guest);
  const leaving = useRef(false);
  const online = state.online;
  useFocusEffect(useCallback(() => {
    leaving.current = false;
    void onlineClient?.sync().catch(() => undefined);
    return () => {
      leaving.current = true;
      // A lease is the fallback when the cancel cannot reach the server. A
      // pairing that wins the race stays resumable, never silently resigned.
      void onlineClient?.cancel().catch(() => undefined);
    };
  }, []));
  useEffect(() => {
    if (!focused || state.pending || leaving.current) return;
    if (online?.status === 'matched') {
      setSearching(false);
      if (online.match.game.status === 'active') navigation.replace('OnlineGame', { matchId: online.match.matchId });
    } else if (online?.status === 'idle') setSearching(false);
  }, [focused, navigation, online, state.pending]);
  const queued = online?.status === 'queued' || searching;
  function join() {
    if (onlineClient?.getSnapshot().connection === 'expired') onlineClient.reset();
    setSearching(true);
    void onlineClient?.join().catch(() => {
      if (onlineClient?.getSnapshot().connection !== 'reconnecting') setSearching(false);
    });
  }
  function cancel() {
    setSearching(false);
    void onlineClient?.cancel().catch(() => undefined);
  }
  return <Screen style={styles.screen}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}>
      <Text style={styles.eyebrow}>REAL PLAYERS · ALWAYS FREE</Text>
      <Text style={styles.title}>Online 3+2</Text>
      <Text style={styles.intro}>A quick game. A human opponent. No paid access.</Text>
    </View>
    <View style={styles.controlCard}>
      <View style={styles.controlHeader}><Text style={styles.controlLabel}>ONE ONLINE TIME CONTROL</Text><View style={styles.freeBadge}><Text style={styles.freeText}>Always free</Text></View></View>
      <Text style={styles.clock}>3 <Text style={styles.plus}>+</Text> 2</Text><Text style={styles.controlName}>Blitz</Text>
      <Text style={styles.controlDetail}>3 minutes per player, plus 2 seconds after each move.</Text>
    </View>
    <View style={styles.statusCard}>
      <Text style={styles.statusLabel}>{!onlineClient ? 'SERVER NOT CONFIGURED' : needsAccount ? 'FREE ACCOUNT NEEDED' : `RATED · ${user?.profile ? `YOUR RATING ${user.profile.rating}` : 'REAL PLAYERS'}`}</Text>
      <Text style={styles.statusTitle}>{queued ? 'Looking for another player…' : !onlineClient ? 'Live matchmaking needs a server' : needsAccount ? 'Create an account to play online' : 'Find a real opponent'}</Text>
      <Text style={styles.body}>{!onlineClient ? 'This build has no online server address. Local games work now.' : needsAccount ? 'Online games are rated, so each player needs a username. It is free and takes a few seconds.' : 'You will be paired with the next player looking for a game. No computer takes an empty seat.'}</Text>
      {queued && <Text style={styles.body}>Keep this screen open while searching. You can cancel at any time.</Text>}
      {state.error && <Text accessibilityRole="alert" style={styles.body}>{state.error}</Text>}
    </View>
    {needsAccount && onlineClient ? <>
      <AppButton title="Create free account" onPress={() => navigation.navigate('Register')} />
      <AppButton title="Login" secondary onPress={() => navigation.navigate('Login')} />
    </> : queued || state.pending ? <AppButton title={state.pending && !searching ? 'Finishing request…' : 'Cancel search'} secondary onPress={cancel} disabled={state.pending && !searching} /> : <AppButton title={onlineClient ? 'Find a free 3+2 game' : 'Online server not configured'} onPress={join} disabled={!onlineClient || user === undefined} />}
    {state.connection === 'reconnecting' && <AppButton title="Retry connection" secondary onPress={() => { void onlineClient?.sync().catch(() => undefined); }} disabled={state.pending} />}
    {online?.status === 'matched' && online.match.game.status !== 'active' && <AppButton title="View last game" secondary onPress={() => navigation.navigate('OnlineGame', { matchId: online.match.matchId })} />}
    <Text style={styles.freePromise}>Online play will always be free. Optional purchases will be for removing ads and extra cosmetics.</Text>
    <View style={styles.localSection}>
      <Text style={styles.sectionTitle}>Play locally</Text><Text style={styles.localCopy}>Computer practice stays separate from human matchmaking.</Text>
      <AppButton title="Practice against the computer" onPress={() => navigation.navigate('Game', { mode: 'local', computerDifficulty: 'medium' })} />
      <Text style={styles.practiceDetail}>Medium difficulty · You play White · Offline</Text>
      <AppButton title="Pass and Play" secondary onPress={() => navigation.navigate('Game', { mode: 'local' })} />
    </View>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  content: { padding: 20, paddingBottom: 34 },
  header: { marginTop: 8, marginBottom: 24 },
  eyebrow: { color: theme.colors.cyan, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  title: { color: theme.colors.text, fontSize: 36, fontWeight: '900' },
  intro: { color: theme.colors.textDim, fontSize: 14, lineHeight: 21, marginTop: 8 },
  controlCard: { padding: 22, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.accent, borderRadius: theme.radius.lg },
  controlHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' },
  controlLabel: { color: theme.colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  freeBadge: { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  freeText: { color: theme.colors.gold, fontSize: 12, fontWeight: '800' },
  clock: { color: theme.colors.text, fontSize: 64, fontWeight: '900', marginTop: 12 },
  plus: { color: theme.colors.accent },
  controlName: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  controlDetail: { color: theme.colors.textDim, fontSize: 14, lineHeight: 21, marginTop: 6 },
  statusCard: { padding: 18, marginTop: 20, marginBottom: 20, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSoft },
  statusLabel: { color: theme.colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  statusTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 },
  body: { color: theme.colors.textDim, fontSize: 13, lineHeight: 20, marginTop: 8 },
  disabledButton: { minHeight: 58, padding: 16, borderRadius: 18, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  disabledText: { color: theme.colors.textDim, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  freePromise: { color: theme.colors.textDim, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 12, paddingHorizontal: 8 },
  localSection: { marginTop: 28, paddingTop: 22, borderTopWidth: 1, borderColor: theme.colors.borderSoft },
  sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  localCopy: { color: theme.colors.textDim, fontSize: 13, marginTop: 6, marginBottom: 8 },
  practiceDetail: { color: theme.colors.textDim, fontSize: 11, textAlign: 'center', marginBottom: 4 },
});
