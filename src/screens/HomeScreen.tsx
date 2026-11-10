import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { PieceView } from '../components/PieceView';
import { MiniBoard } from '../components/MiniBoard';
import { authService, User } from '../services/auth/AuthService';
import { ratingTitle } from '../services/rating/RatingService';
import { entitlementStore } from '../services/purchases/entitlements';
import { dailyPuzzleService, DailyPuzzle } from '../services/puzzles/DailyPuzzleService';
import { onlineClient } from '../online/onlineService';
import { useAppearance } from '../appearance/useAppearance';
import { BOARD_THEMES, PIECE_SETS } from '../appearance/catalog';
import { BOARD_ACCESS, PIECE_ACCESS } from '../progression/cosmetics';
import { useProgression } from '../progression/useProgression';
import { MAX_LEVEL, XP_PER_LEVEL } from '../progression/progression';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/** The next cosmetic the player earns by levelling up, to give practice a goal. */
function nextUnlock(level: number) {
  const items = [
    ...Object.entries(BOARD_ACCESS).map(([id, access]) => ({ access, name: `${BOARD_THEMES[id as keyof typeof BOARD_THEMES].name} board` })),
    ...Object.entries(PIECE_ACCESS).map(([id, access]) => ({ access, name: `${PIECE_SETS[id as keyof typeof PIECE_SETS].name} pieces` })),
  ].flatMap(item => item.access.kind === 'level' && item.access.level > level ? [{ level: item.access.level, name: item.name }] : [])
    .sort((a, b) => a.level - b.level);
  return items[0];
}

function Tile({ label, detail, onPress, children, testID }: { label: string; detail: string; onPress: () => void; children: React.ReactNode; testID?: string }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${label}. ${detail}`} onPress={onPress}
    style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
    <View style={styles.tileIcon}>{children}</View>
    <Text style={styles.tileLabel}>{label}</Text>
    <Text style={styles.tileDetail}>{detail}</Text>
  </Pressable>;
}

export function HomeScreen({ navigation }: Props) {
  const progress = useProgression();
  const { pieces } = useAppearance();
  const [user, setUser] = useState<User | null>(null);
  const [puzzle, setPuzzle] = useState<{ puzzle: DailyPuzzle; completed: boolean } | null>(null);
  const load = useCallback(() => {
    authService.currentUser().then(setUser);
    authService.refresh().then(({ user: fresh, entitlements }) => {
      setUser(fresh);
      if (entitlements) entitlementStore.mergeAccount(entitlements);
    }).catch(() => undefined);
    dailyPuzzleService.getDaily().then(setPuzzle).catch(() => undefined);
  }, []);
  useFocusEffect(load);
  const profile = user && !user.guest ? user.profile : undefined;
  const levelPct = progress.level === MAX_LEVEL ? 100 : progress.xp % XP_PER_LEVEL;
  const unlock = nextUnlock(progress.level);
  const online = !!onlineClient;

  return <Screen><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.mark}><PieceView type="S" color="white" set={pieces} size={22} /></View>
        <Text style={styles.wordmark}>ShiftChess</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Settings and cosmetics" onPress={() => navigation.navigate('Settings')} style={styles.iconButton}>
        <Text style={styles.iconText}>⚙︎</Text>
      </Pressable>
    </View>
    <Text style={styles.greeting}>{profile ? `Welcome back, ${profile.username}` : 'Ready for a game?'}</Text>

    <Pressable accessibilityRole="button" accessibilityLabel={profile ? 'Play online. Find a rated 3 plus 2 game against a real player.' : 'Play online. Create a free account to play real people.'}
      onPress={() => navigation.navigate(profile || !authService.accountsAvailable ? 'Multiplayer' : 'Register')}
      style={({ pressed }) => [pressed && styles.pressed]}>
      <LinearGradient colors={['#f6cf7d', '#e09a3a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.heroEyebrow}>{online ? '● LIVE · RATED 3+2' : 'ONLINE · 3+2'}</Text>
          <Text style={styles.heroTitle}>Play a real{'\n'}opponent</Text>
          <Text style={styles.heroDetail}>{profile ? `Rating ${profile.rating} · ${ratingTitle(profile.rating)}` : 'Free account · Always free'}</Text>
          <View style={styles.heroButton}><Text style={styles.heroButtonText}>{profile || !authService.accountsAvailable ? 'Find a game  →' : 'Create free account  →'}</Text></View>
        </View>
        <View style={styles.heroArt} accessible={false}>
          <View style={styles.heroPieceBack}><PieceView type="K" color="black" set={pieces} size={70} /></View>
          <View style={styles.heroPieceFront}><PieceView type="S" color="white" set={pieces} size={92} /></View>
        </View>
      </LinearGradient>
    </Pressable>

    {puzzle && <Pressable accessibilityRole="button" accessibilityLabel={`Daily puzzle: ${puzzle.puzzle.title}. ${puzzle.completed ? 'Solved' : `${puzzle.puzzle.difficulty}, 30 XP`}`}
      onPress={() => navigation.navigate('DailyPuzzle')} style={({ pressed }) => [styles.puzzle, pressed && styles.pressed]}>
      <MiniBoard board={puzzle.puzzle.board} width={122} />
      <View style={styles.puzzleText}>
        <Text style={styles.sectionEyebrow}>DAILY PUZZLE</Text>
        <Text style={styles.puzzleTitle} numberOfLines={2}>{puzzle.puzzle.title}</Text>
        <View style={styles.pills}>
          <View style={styles.pill}><Text style={styles.pillText}>{puzzle.puzzle.difficulty}</Text></View>
          <View style={[styles.pill, puzzle.completed && styles.pillDone]}><Text style={[styles.pillText, puzzle.completed && styles.pillDoneText]}>{puzzle.completed ? 'Solved ✓' : '+30 XP'}</Text></View>
        </View>
      </View>
    </Pressable>}

    <Text style={styles.section}>Play the computer</Text>
    <View style={styles.row}>
      {([['easy', 'Easy', 'P'], ['medium', 'Medium', 'N'], ['hard', 'Hard', 'Q']] as const).map(([level, label, piece]) =>
        <Tile key={level} label={label} detail="You play white" onPress={() => navigation.navigate('Game', { mode: 'local', computerDifficulty: level })}>
          <PieceView type={piece} color="black" set={pieces} size={40} />
        </Tile>)}
    </View>
    <View style={styles.row}>
      <Tile label="Pass & Play" detail="Two players, one phone" onPress={() => navigation.navigate('Game', { mode: 'local' })}>
        <View style={styles.pair}><PieceView type="K" color="white" set={pieces} size={34} /><PieceView type="K" color="black" set={pieces} size={34} /></View>
      </Tile>
      {authService.accountsAvailable && <Tile label="Leaderboard" detail="Top rated players" onPress={() => navigation.navigate('Leaderboard')}>
        <Text style={styles.emoji}>🏆</Text>
      </Tile>}
    </View>

    <Pressable accessibilityRole="button" accessibilityLabel={`Practice level ${progress.level}. Open cosmetics.`} onPress={() => navigation.navigate('Settings')} style={styles.levelCard}>
      <View style={styles.levelTop}>
        <Text style={styles.levelTitle}>Level {progress.level}</Text>
        <Text style={styles.levelXp}>{progress.level === MAX_LEVEL ? 'Max level' : `${progress.xp % XP_PER_LEVEL} / ${XP_PER_LEVEL} XP`}</Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: levelPct }} style={styles.track}><View style={[styles.fill, { width: `${levelPct}%` }]} /></View>
      <Text style={styles.levelHint}>{unlock ? `Next unlock: ${unlock.name} at level ${unlock.level}` : 'Every practice look unlocked'}</Text>
      {progress.error && <Text accessibilityRole="alert" style={styles.error}>{progress.error}</Text>}
    </Pressable>

    <View style={styles.footer}>
      <Text accessibilityRole="link" style={styles.footerLink} onPress={() => navigation.navigate('Rules')}>How to play</Text>
      <Text style={styles.footerDot}>·</Text>
      <Text accessibilityRole="link" style={styles.footerLink} onPress={() => navigation.navigate('Settings')}>Boards & pieces</Text>
    </View>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 28 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 34, height: 34, borderRadius: 11, backgroundColor: theme.colors.cyan, alignItems: 'center', justifyContent: 'center' },
  wordmark: { color: theme.colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: theme.colors.text, fontSize: 20 },
  greeting: { color: theme.colors.text, fontSize: 28, fontWeight: '900', marginTop: 18, marginBottom: 14, letterSpacing: -0.5 },
  hero: { borderRadius: theme.radius.xl, padding: 20, flexDirection: 'row', overflow: 'hidden', minHeight: 190 },
  heroText: { flex: 1, zIndex: 1 },
  heroEyebrow: { color: '#5a3207', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: '#1d1406', fontSize: 28, lineHeight: 31, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 },
  heroDetail: { color: '#4a2c0b', fontSize: 13, fontWeight: '700', marginTop: 6 },
  heroButton: { alignSelf: 'flex-start', backgroundColor: '#1d1406', borderRadius: theme.radius.pill, paddingHorizontal: 18, paddingVertical: 11, marginTop: 14 },
  heroButtonText: { color: theme.colors.text, fontWeight: '900', fontSize: 14 },
  heroArt: { width: 110, alignItems: 'center', justifyContent: 'flex-end' },
  heroPieceBack: { position: 'absolute', right: -6, bottom: 34, opacity: 0.55, transform: [{ rotate: '12deg' }] },
  heroPieceFront: { marginBottom: -6 },
  puzzle: { flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 14, padding: 12, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSoft },
  puzzleText: { flex: 1 },
  sectionEyebrow: { color: theme.colors.cyan, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  puzzleTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '900', marginTop: 4 },
  pills: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  pill: { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: theme.colors.textDim, fontSize: 12, fontWeight: '800' },
  pillDone: { backgroundColor: '#7fffa022' },
  pillDoneText: { color: theme.colors.success },
  section: { color: theme.colors.text, fontSize: 18, fontWeight: '900', marginTop: 22, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  tile: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.borderSoft, padding: 12, minHeight: 112 },
  tileIcon: { height: 46, justifyContent: 'center', alignItems: 'flex-start' },
  tileLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '900', marginTop: 6 },
  tileDetail: { color: theme.colors.textFaint, fontSize: 12, fontWeight: '600', marginTop: 2 },
  pair: { flexDirection: 'row' },
  emoji: { fontSize: 32 },
  levelCard: { marginTop: 4, padding: 14, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSoft },
  levelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  levelTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '900' },
  levelXp: { color: theme.colors.textDim, fontSize: 13, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, backgroundColor: theme.colors.borderSoft, overflow: 'hidden', marginTop: 10 },
  fill: { height: 8, borderRadius: 4, backgroundColor: theme.colors.accent },
  levelHint: { color: theme.colors.textFaint, fontSize: 12, fontWeight: '600', marginTop: 8 },
  error: { color: theme.colors.danger, fontSize: 12, marginTop: 6 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 20 },
  footerLink: { color: theme.colors.textDim, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline', paddingVertical: 6 },
  footerDot: { color: theme.colors.textFaint, paddingVertical: 6 },
});
