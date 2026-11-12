import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { onlineClient, useOnlineState } from '../online/onlineService';
import { authService, User } from '../services/auth/AuthService';
import { theme } from '../styles/theme';
import { PieceView } from '../components/PieceView';
import { useAppearance } from '../appearance/useAppearance';

type Props = NativeStackScreenProps<RootStackParamList, 'Multiplayer'>;
export function MultiplayerScreen({ navigation }: Props) {
  const state = useOnlineState();
  const { pieces } = useAppearance();
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
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!queued) { setElapsed(0); return; }
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [queued]);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!queued) { pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [queued, pulse]);
  const me = user && !user.guest ? user : null;
  const status = !onlineClient ? 'Online play is not set up in this build.'
    : needsAccount ? 'Online games are rated, so you need a free username first.'
    : queued ? `Searching for an opponent · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
    : 'You\'ll be paired with the next player who is looking.';

  return <Screen><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.matchup} accessible accessibilityLabel={`${me ? me.displayName : 'You'} versus ${queued ? 'searching' : 'next opponent'}`}>
      <View style={styles.side}>
        <View style={[styles.avatar, styles.avatarMe]}><PieceView type="S" color="white" set={pieces} size={52} /></View>
        <Text style={styles.name} numberOfLines={1}>{me ? me.displayName : 'You'}</Text>
        <Text style={styles.rating}>{me?.profile ? me.profile.rating : needsAccount ? 'Guest' : '—'}</Text>
      </View>
      <View style={styles.vs}><Text style={styles.vsText}>VS</Text></View>
      <View style={styles.side}>
        <View style={styles.avatarWrap}>
          {queued && <Animated.View pointerEvents="none" style={[styles.ring, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] }]} />}
          <View style={styles.avatar}>{queued ? <ActivityIndicator color={theme.colors.cyan} /> : <Text style={styles.question}>?</Text>}</View>
        </View>
        <Text style={styles.name}>{queued ? 'Searching…' : 'Opponent'}</Text>
        <Text style={styles.rating}>Real player</Text>
      </View>
    </View>

    <View style={styles.controlCard}>
      <View>
        <Text style={styles.clock}>3<Text style={styles.plus}> + </Text>2</Text>
        <Text style={styles.controlName}>Blitz · Rated</Text>
      </View>
      <View style={styles.badges}>
        <View style={styles.badge}><Text style={styles.badgeText}>3 min each</Text></View>
        <View style={styles.badge}><Text style={styles.badgeText}>+2 s per move</Text></View>
        <View style={[styles.badge, styles.freeBadge]}><Text style={[styles.badgeText, styles.freeText]}>Always free</Text></View>
      </View>
    </View>

    <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
    {!!state.error && <Text accessibilityRole="alert" style={styles.error}>{state.error}</Text>}

    {needsAccount && onlineClient ? <>
      <AppButton title="Create free account" onPress={() => navigation.navigate('Register')} />
      <AppButton title="Log in" secondary onPress={() => navigation.navigate('Login')} />
    </> : queued || state.pending ? <AppButton title={state.pending && !searching ? 'Finishing request…' : 'Cancel search'} secondary onPress={cancel} disabled={state.pending && !searching} /> : <AppButton title={onlineClient ? 'Find a game' : 'Online server not configured'} onPress={join} disabled={!onlineClient || user === undefined} />}
    {state.connection === 'reconnecting' && <AppButton title="Retry connection" secondary onPress={() => { void onlineClient?.sync().catch(() => undefined); }} disabled={state.pending} />}
    {online?.status === 'matched' && online.match.game.status !== 'active' && <AppButton title="View last game" secondary onPress={() => navigation.navigate('OnlineGame', { matchId: online.match.matchId })} />}
    {queued && <Text style={styles.hint}>Keep this screen open. Most games start within a minute.</Text>}

    <View style={styles.localRow}>
      <Text style={styles.localLabel}>Rather practise first?</Text>
      <View style={styles.localButtons}>
        <Text accessibilityRole="link" style={styles.localLink} onPress={() => navigation.navigate('GameSetup', { opponent: 'computer' })}>Play the computer</Text>
        <Text style={styles.dot}>·</Text>
        <Text accessibilityRole="link" style={styles.localLink} onPress={() => navigation.navigate('DailyPuzzle')}>Daily puzzle</Text>
      </View>
    </View>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 },
  matchup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.borderSoft, paddingVertical: 22, paddingHorizontal: 14, marginTop: 4 },
  side: { flex: 1, alignItems: 'center' },
  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: theme.colors.surfaceAlt, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  avatarMe: { borderColor: theme.colors.accent },
  ring: { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: theme.colors.cyan },
  question: { color: theme.colors.textFaint, fontSize: 32, fontWeight: '900' },
  name: { color: theme.colors.text, fontSize: 15, fontWeight: '900', marginTop: 10, maxWidth: 130 },
  rating: { color: theme.colors.textFaint, fontSize: 13, fontWeight: '700', marginTop: 2 },
  vs: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.bgBottom, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  vsText: { color: theme.colors.accent, fontWeight: '900', fontSize: 14 },
  controlCard: { marginTop: 14, padding: 18, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.accent, borderRadius: theme.radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  clock: { color: theme.colors.text, fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  plus: { color: theme.colors.accent },
  controlName: { color: theme.colors.textDim, fontSize: 14, fontWeight: '800' },
  badges: { gap: 6, alignItems: 'flex-end' },
  badge: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: theme.colors.textDim, fontSize: 12, fontWeight: '800' },
  freeBadge: { backgroundColor: theme.colors.accentSoft },
  freeText: { color: theme.colors.gold },
  status: { color: theme.colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 18, marginBottom: 6, lineHeight: 21 },
  error: { color: theme.colors.danger, textAlign: 'center', fontSize: 13, marginBottom: 6, lineHeight: 19 },
  hint: { color: theme.colors.textFaint, textAlign: 'center', fontSize: 12, marginTop: 4 },
  localRow: { marginTop: 26, paddingTop: 18, borderTopWidth: 1, borderColor: theme.colors.borderSoft, alignItems: 'center' },
  localLabel: { color: theme.colors.textDim, fontSize: 13, fontWeight: '700' },
  localButtons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  localLink: { color: theme.colors.cyan, fontSize: 14, fontWeight: '800', paddingVertical: 6 },
  dot: { color: theme.colors.textFaint, paddingVertical: 6 },
});
