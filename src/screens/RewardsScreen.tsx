import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { PieceView } from '../components/PieceView';
import { BOARD_THEMES, PIECE_SETS, type BoardThemeId, type PieceSetId } from '../appearance/catalog';
import { useAppearance } from '../appearance/useAppearance';
import { levelRewards, nextReward, PIECE_ACCESS, type Reward } from '../progression/cosmetics';
import { useProgression } from '../progression/useProgression';
import { MAX_LEVEL, XP_PER_LEVEL } from '../progression/progression';
import { useEntitlements } from '../services/purchases/entitlements';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Rewards'>;

function Preview({ reward }: { reward: Pick<Reward, 'kind' | 'id'> }) {
  if (reward.kind === 'board') {
    const board = BOARD_THEMES[reward.id as BoardThemeId];
    return <View style={styles.swatches}>{[board.light, board.dark, board.light, board.dark].map((color, i) =>
      <View key={i} style={[styles.swatch, { backgroundColor: color }]} />)}</View>;
  }
  return <View style={styles.piecePreview}>
    <PieceView type="K" color="white" set={reward.id as PieceSetId} size={30} />
    <PieceView type="S" color="black" set={reward.id as PieceSetId} size={30} />
  </View>;
}

export function RewardsScreen({ navigation }: Props) {
  const progress = useProgression();
  const owned = useEntitlements();
  const { board, pieces } = useAppearance();
  const inLevel = progress.level === MAX_LEVEL ? XP_PER_LEVEL : progress.xp % XP_PER_LEVEL;
  const next = nextReward(progress.level);
  const xpToNext = next ? Math.max(0, (next.level - 1) * XP_PER_LEVEL - progress.xp) : 0;
  const rewards = levelRewards();
  const levels = [...new Set(rewards.map(reward => reward.level))];
  const premium = (Object.keys(PIECE_ACCESS) as PieceSetId[]).filter(id => PIECE_ACCESS[id].kind === 'premium');

  return <Screen><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.levelCard}>
      <Text style={styles.eyebrow}>PRACTICE LEVEL</Text>
      <Text style={styles.level}>{progress.level}</Text>
      <View accessibilityRole="progressbar" accessibilityLabel="Progress to next level" accessibilityValue={{ min: 0, max: XP_PER_LEVEL, now: inLevel }} style={styles.track}>
        <View style={[styles.fill, { width: `${(inLevel / XP_PER_LEVEL) * 100}%` }]} />
      </View>
      <Text style={styles.xp}>{progress.level === MAX_LEVEL ? `Max level · ${progress.xp} XP` : `${inLevel} / ${XP_PER_LEVEL} XP to level ${progress.level + 1} · ${progress.xp} XP total`}</Text>
    </View>

    {next ? <View style={styles.nextCard}>
      <Preview reward={next} />
      <View style={{ flex: 1 }}>
        <Text style={styles.nextEyebrow}>NEXT REWARD · LEVEL {next.level}</Text>
        <Text style={styles.nextName}>{next.name}</Text>
        <Text style={styles.copy}>{xpToNext} XP to go</Text>
      </View>
    </View> : <View style={styles.nextCard}><Text style={styles.nextName}>Every level reward unlocked 🎉</Text></View>}

    <Text style={styles.section}>How to earn XP</Text>
    <View style={styles.card}>
      {[['Finish a game vs the computer or pass & play (6+ moves)', '+25'], ['Beat the computer', '+25'], ["Solve the daily puzzle (once a day)", '+30']].map(([what, xp]) =>
        <View key={what} style={styles.earnRow}><Text style={styles.earnText}>{what}</Text><Text style={styles.earnXp}>{xp} XP</Text></View>)}
      <View style={styles.earnButtons}>
        <View style={{ flex: 1 }}><AppButton title="Play computer" onPress={() => navigation.navigate('Game', { mode: 'local', computerDifficulty: 'medium' })} /></View>
        <View style={{ flex: 1 }}><AppButton title="Daily puzzle" secondary onPress={() => navigation.navigate('DailyPuzzle')} /></View>
      </View>
    </View>

    <Text style={styles.section}>All rewards</Text>
    {levels.map(level => {
      const unlocked = progress.level >= level;
      return <View key={level} style={[styles.levelGroup, !unlocked && styles.lockedGroup]}>
        <Text style={[styles.groupTitle, unlocked && styles.groupDone]}>{level === 1 ? 'Starter · free' : `Level ${level}`}{unlocked ? '  ✓' : '  🔒'}</Text>
        {rewards.filter(reward => reward.level === level).map(reward => {
          const equipped = reward.kind === 'board' ? board === reward.id : pieces === reward.id;
          const isNext = next?.id === reward.id;
          return <View key={reward.id} style={styles.rewardRow}>
            <Preview reward={reward} />
            <Text style={styles.rewardName}>{reward.name}</Text>
            <View style={[styles.chip, unlocked ? styles.chipDone : isNext ? styles.chipNext : null]}>
              <Text style={[styles.chipText, unlocked && styles.chipDoneText, isNext && styles.chipNextText]}>{equipped ? 'Equipped' : unlocked ? 'Unlocked' : isNext ? 'Next' : 'Locked'}</Text>
            </View>
          </View>;
        })}
      </View>;
    })}

    <Text style={styles.section}>Premium collections</Text>
    <View style={styles.levelGroup}>
      {premium.map(id => {
        const has = owned.premiumPieceSets.includes(id as never);
        return <View key={id} style={styles.rewardRow}>
          <Preview reward={{ kind: 'pieces', id }} />
          <Text style={styles.rewardName}>{PIECE_SETS[id].name} pieces</Text>
          <View style={[styles.chip, has && styles.chipDone]}><Text style={[styles.chipText, has && styles.chipDoneText]}>{has ? 'Owned' : 'Premium'}</Text></View>
        </View>;
      })}
      <AppButton title="Boards & pieces" secondary onPress={() => navigation.navigate('Settings')} />
    </View>
    {progress.error && <Text accessibilityRole="alert" style={styles.error}>{progress.error}</Text>}
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 },
  levelCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.borderSoft, padding: 18, alignItems: 'center' },
  eyebrow: { color: theme.colors.cyan, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  level: { color: theme.colors.text, fontSize: 56, fontWeight: '900', marginVertical: 2 },
  track: { alignSelf: 'stretch', height: 10, borderRadius: 5, backgroundColor: theme.colors.borderSoft, overflow: 'hidden', marginTop: 6 },
  fill: { height: 10, borderRadius: 5, backgroundColor: theme.colors.accent },
  xp: { color: theme.colors.textDim, fontSize: 13, fontWeight: '700', marginTop: 8 },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12, padding: 14, borderRadius: theme.radius.lg, borderWidth: 2, borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceAlt },
  nextEyebrow: { color: theme.colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  nextName: { color: theme.colors.text, fontSize: 18, fontWeight: '900', marginTop: 2 },
  copy: { color: theme.colors.textDim, fontSize: 13, marginTop: 2 },
  section: { color: theme.colors.text, fontSize: 18, fontWeight: '900', marginTop: 22, marginBottom: 10 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.borderSoft, padding: 14 },
  earnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 6 },
  earnText: { color: theme.colors.textDim, fontSize: 14, flex: 1 },
  earnXp: { color: theme.colors.accent, fontWeight: '900', fontSize: 14 },
  earnButtons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  levelGroup: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.borderSoft, padding: 12, marginBottom: 10 },
  lockedGroup: { opacity: 0.75 },
  groupTitle: { color: theme.colors.textDim, fontSize: 13, fontWeight: '900', letterSpacing: 0.6, marginBottom: 6 },
  groupDone: { color: theme.colors.success },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  rewardName: { color: theme.colors.text, fontSize: 15, fontWeight: '800', flex: 1 },
  swatches: { flexDirection: 'row', width: 64, height: 32, borderRadius: 6, overflow: 'hidden' },
  swatch: { flex: 1 },
  piecePreview: { flexDirection: 'row', width: 64, height: 32, justifyContent: 'center', backgroundColor: '#c7b9a1', borderRadius: 6 },
  chip: { borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.colors.surfaceAlt },
  chipText: { color: theme.colors.textDim, fontSize: 12, fontWeight: '800' },
  chipDone: { backgroundColor: '#7fffa022' },
  chipDoneText: { color: theme.colors.success },
  chipNext: { backgroundColor: theme.colors.accentSoft },
  chipNextText: { color: theme.colors.gold },
  error: { color: theme.colors.danger, marginTop: 10 },
});
