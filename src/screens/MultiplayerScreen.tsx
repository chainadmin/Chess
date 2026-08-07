import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { multiplayerService, QueueCancelledError } from '../services/multiplayer/MultiplayerService';
import { TimeControlId, TIME_CONTROLS } from '../game/timers';
import { authService } from '../services/auth/AuthService';
import { INITIAL_RATING, ratingService } from '../services/rating/RatingService';

type Props = NativeStackScreenProps<RootStackParamList, 'Multiplayer'>;

const choices: Array<{ id: TimeControlId; icon: string; name: string; detail: string }> = [
  { id: 'bullet_1_1', icon: '⚡', name: 'Bullet', detail: '1 min  +  1 sec' },
  { id: 'blitz_3_0', icon: '🔥', name: 'Blitz', detail: '3 min' },
  { id: 'rapid_10_0', icon: '⏱', name: 'Rapid', detail: '10 min' },
];

export function MultiplayerScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<TimeControlId>('blitz_3_0');
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rating, setRating] = useState(INITIAL_RATING);

  useEffect(() => {
    authService.currentUser().then(user => user && ratingService.getRating(user.id).then(current => setRating(current.value)));
    return () => { void multiplayerService.cancelQueue(); };
  }, []);

  useEffect(() => {
    if (!searching) return;
    const timer = setInterval(() => setElapsed(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [searching]);

  const ratingWindow = useMemo(() => Math.min(400, 100 + Math.floor(elapsed / 5) * 50), [elapsed]);

  const findMatch = async () => {
    setElapsed(0);
    setSearching(true);
    try {
      await multiplayerService.connect();
      const match = await multiplayerService.joinQueue(selected, rating);
      setSearching(false);
      navigation.replace('Game', { mode: 'multiplayer', match });
    } catch (error) {
      if (!(error instanceof QueueCancelledError)) throw error;
    }
  };

  const cancel = async () => {
    await multiplayerService.cancelQueue();
    setSearching(false);
    setElapsed(0);
  };

  if (searching) {
    const control = TIME_CONTROLS[selected];
    return <Screen style={styles.searchScreen}>
      <View style={styles.searchTop}>
        <Text style={styles.eyebrow}>MATCHMAKING</Text>
        <Text style={styles.searchTitle}>Finding your opponent</Text>
        <Text style={styles.searchCopy}>Searching for a fair, rated game</Text>
      </View>
      <View style={styles.radar}>
        <View style={styles.ringOuter}><View style={styles.ringMiddle}><View style={styles.avatar}><Text style={styles.avatarPiece}>♞</Text></View></View></View>
        <View style={styles.pulse}><ActivityIndicator size="small" color="#0e1914" /></View>
      </View>
      <View style={styles.queueCard}>
        <View style={styles.queueRow}><Text style={styles.queueLabel}>Game</Text><Text style={styles.queueValue}>{control.label}</Text></View>
        <View style={styles.divider} />
        <View style={styles.queueRow}><Text style={styles.queueLabel}>Rating range</Text><Text style={styles.queueValue}>{Math.max(0, rating-ratingWindow)} – {Math.min(3500, rating+ratingWindow)}</Text></View>
        <View style={styles.divider} />
        <View style={styles.queueRow}><Text style={styles.queueLabel}>Time searching</Text><Text style={styles.queueValue}>0:{String(elapsed).padStart(2, '0')}</Text></View>
      </View>
      <Text style={styles.expandCopy}>The rating range expands while you wait.</Text>
      <Pressable accessibilityRole="button" onPress={cancel} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel search</Text></Pressable>
    </Screen>;
  }

  return <Screen style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ONLINE PLAY</Text>
          <Text style={styles.title}>Find a match</Text>
        </View>
        <View style={styles.onlinePill}><View style={styles.onlineDot}/><Text style={styles.onlineText}>2,481 online</Text></View>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.miniAvatar}><Text style={styles.miniAvatarText}>♞</Text></View>
        <View style={styles.profileCopy}><Text style={styles.profileLabel}>YOUR RATING</Text><Text style={styles.rating}>{rating}</Text></View>
        <View style={styles.ratedBadge}><Text style={styles.ratedText}>RATED</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Choose a time control</Text>
      <View style={styles.options}>
        {choices.map(choice => {
          const active = selected === choice.id;
          return <Pressable key={choice.id} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => setSelected(choice.id)} style={[styles.option, active && styles.optionActive]}>
            <Text style={styles.optionIcon}>{choice.icon}</Text>
            <View style={styles.optionCopy}><Text style={styles.optionName}>{choice.name}</Text><Text style={styles.optionDetail}>{choice.detail}</Text></View>
            <View style={[styles.radio, active && styles.radioActive]}>{active && <View style={styles.radioCenter}/>}</View>
          </Pressable>;
        })}
      </View>

      <View style={styles.fairPlay}><Text style={styles.shield}>♜</Text><View style={styles.fairCopy}><Text style={styles.fairTitle}>Fair matchmaking</Text><Text style={styles.fairDetail}>We start with players within 100 rating points and gradually widen the search.</Text></View></View>
      <Pressable accessibilityRole="button" onPress={findMatch} style={({ pressed }) => [styles.findButton, pressed && styles.pressed]}><Text style={styles.findText}>Find Match</Text><Text style={styles.findArrow}>→</Text></Pressable>
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { padding: 0 }, content: { padding: 20, paddingBottom: 34 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8, marginBottom: 24 },
  eyebrow: { color: '#83b59b', fontSize: 11, fontWeight: '900', letterSpacing: 1.8, marginBottom: 5 },
  title: { color: '#f5f1e8', fontSize: 32, lineHeight: 38, fontWeight: '900' },
  onlinePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1d2a24', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 8 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#7ed79e', marginRight: 6 }, onlineText: { color: '#b9c9bf', fontSize: 11, fontWeight: '700' },
  profileCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 16, backgroundColor: '#1b211e', borderWidth: 1, borderColor: '#2b342f', marginBottom: 26 },
  miniAvatar: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#d9a85c', alignItems: 'center', justifyContent: 'center', marginRight: 13 }, miniAvatarText: { fontSize: 28, color: '#182019' },
  profileCopy: { flex: 1 }, profileLabel: { color: '#839087', fontSize: 10, letterSpacing: 1.3, fontWeight: '800' }, rating: { color: '#f5f1e8', fontSize: 23, fontWeight: '900', marginTop: 2 },
  ratedBadge: { backgroundColor: '#29352e', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }, ratedText: { color: '#8fc9a7', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: '#d9ded9', fontSize: 14, fontWeight: '800', marginBottom: 11 }, options: { gap: 10 },
  option: { minHeight: 74, borderRadius: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#191e1b', borderWidth: 1.5, borderColor: '#29312d' }, optionActive: { backgroundColor: '#222a25', borderColor: '#d8aa5c' },
  optionIcon: { width: 38, fontSize: 23 }, optionCopy: { flex: 1 }, optionName: { color: '#f5f1e8', fontSize: 17, fontWeight: '900' }, optionDetail: { color: '#8e9992', fontSize: 12, marginTop: 3 },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: '#59635d', alignItems: 'center', justifyContent: 'center' }, radioActive: { borderColor: '#d8aa5c' }, radioCenter: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d8aa5c' },
  fairPlay: { flexDirection: 'row', marginTop: 22, marginBottom: 20, paddingHorizontal: 4 }, shield: { color: '#81aa91', fontSize: 20, marginRight: 12 }, fairCopy: { flex: 1 }, fairTitle: { color: '#cbd4ce', fontSize: 13, fontWeight: '800' }, fairDetail: { color: '#78857e', fontSize: 11, lineHeight: 16, marginTop: 3 },
  findButton: { height: 58, borderRadius: 18, backgroundColor: '#d8a64f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, pressed: { opacity: .82 }, findText: { color: '#162019', fontSize: 17, fontWeight: '900' }, findArrow: { color: '#162019', position: 'absolute', right: 20, fontSize: 22, fontWeight: '700' },
  searchScreen: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 30, paddingBottom: 26 }, searchTop: { alignItems: 'center' }, searchTitle: { color: '#f5f1e8', fontSize: 27, fontWeight: '900', textAlign: 'center' }, searchCopy: { color: '#89958e', marginTop: 7, fontSize: 13 },
  radar: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center' }, ringOuter: { width: 180, height: 180, borderRadius: 90, borderWidth: 1, borderColor: '#6bb48725', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6bb48708' }, ringMiddle: { width: 126, height: 126, borderRadius: 63, borderWidth: 1, borderColor: '#6bb48740', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6bb4870d' }, avatar: { width: 78, height: 78, borderRadius: 25, backgroundColor: '#d8a64f', alignItems: 'center', justifyContent: 'center' }, avatarPiece: { fontSize: 47, color: '#172019' }, pulse: { position: 'absolute', right: '24%', top: '30%', width: 27, height: 27, borderRadius: 14, backgroundColor: '#75cf98', alignItems: 'center', justifyContent: 'center' },
  queueCard: { width: '100%', borderRadius: 20, backgroundColor: '#1a211d', borderColor: '#29342e', borderWidth: 1, paddingHorizontal: 17 }, queueRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, queueLabel: { color: '#849189', fontSize: 12 }, queueValue: { color: '#e7e9e5', fontSize: 13, fontWeight: '800' }, divider: { height: 1, backgroundColor: '#29312d' }, expandCopy: { color: '#707d75', fontSize: 11, marginTop: 13, marginBottom: 20 }, cancelButton: { width: '100%', height: 54, borderRadius: 17, borderWidth: 1, borderColor: '#3b4540', alignItems: 'center', justifyContent: 'center' }, cancelText: { color: '#d9ded9', fontWeight: '800' },
});
