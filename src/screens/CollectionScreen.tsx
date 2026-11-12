import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { PieceView } from '../components/PieceView';
import { BOARD_THEMES, PIECE_SETS, PIECE_ORDER, BoardThemeId, PieceSetId } from '../appearance/catalog';
import { useAppearance } from '../appearance/useAppearance';
import { BOARD_ACCESS, PIECE_ACCESS, canUseCosmetic, cosmeticLabel, nextReward, splitByAccess, type CosmeticAccess } from '../progression/cosmetics';
import { useProgression } from '../progression/useProgression';
import { MAX_LEVEL, XP_PER_LEVEL } from '../progression/progression';
import { useEntitlements } from '../services/purchases/entitlements';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Collection'>;
type Tab = 'boards' | 'pieces';

/** Boards & pieces: choose your look. No account or purchase controls live here. */
export function CollectionScreen({ navigation }: Props) {
  const appearance = useAppearance();
  const progress = useProgression();
  const owned = useEntitlements();
  const [tab, setTab] = useState<Tab>('boards');
  const boards = splitByAccess(Object.keys(BOARD_THEMES) as BoardThemeId[], BOARD_ACCESS, progress.level, owned);
  const pieces = splitByAccess(Object.keys(PIECE_SETS) as PieceSetId[], PIECE_ACCESS, progress.level, owned);
  const upcoming = nextReward(progress.level);
  const inLevel = progress.level === MAX_LEVEL ? XP_PER_LEVEL : progress.xp % XP_PER_LEVEL;

  const explainLocked = (name: string, access: CosmeticAccess) => {
    if (access.kind === 'level') {
      Alert.alert(`${name} is locked`, `It unlocks at practice level ${access.level}. You're level ${progress.level}.\n\nEarn XP by finishing games against the computer or pass and play, and by solving the daily puzzle.`,
        [{ text: 'OK', style: 'cancel' }, { text: 'See rewards', onPress: () => navigation.navigate('Rewards') }]);
    } else if (access.kind === 'premium') {
      Alert.alert(`${name} is a premium set`, 'You can get it in the Shop, on its own or in the Everything Pack.',
        [{ text: 'Not now', style: 'cancel' }, { text: 'Open Shop', onPress: () => navigation.navigate('Shop') }]);
    }
  };
  const statusLabel = (access: CosmeticAccess, usable: boolean) =>
    access.kind === 'premium' ? (usable ? 'Owned' : 'Premium · in the Shop') : usable ? cosmeticLabel(access, progress.level) : `🔒 ${cosmeticLabel(access, progress.level)}`;

  const boardCard = (id: BoardThemeId) => {
    const board = BOARD_THEMES[id];
    const access = BOARD_ACCESS[id];
    const usable = canUseCosmetic(access, progress.level, owned);
    const selected = appearance.board === id;
    return <Pressable key={id} testID={`board-choice-${id}`} accessibilityRole="radio" accessibilityLabel={`${board.name} board, ${board.description}, ${statusLabel(access, usable)}`}
      accessibilityState={{ checked: selected, disabled: !usable }}
      onPress={() => { if (usable) void appearance.updateAppearance({ board: id }); else explainLocked(`${board.name} board`, access); }}
      style={({ pressed }) => [styles.boardCard, !usable && styles.locked, selected && styles.chosen, pressed && styles.pressed]}>
      <View style={[styles.boardSwatch, { borderColor: board.border }]}>
        {[0, 1].map(row => <View key={row} style={styles.swatchRow}>{[0, 1, 2, 3].map(col =>
          <View key={col} style={[styles.swatchSquare, { backgroundColor: (row + col) % 2 ? board.dark : board.light }]} />)}</View>)}
      </View>
      <Text style={styles.name} numberOfLines={1}>{board.name}{selected ? ' ✓' : ''}</Text>
      <Text style={styles.description} numberOfLines={2}>{board.description}</Text>
      <Text style={[styles.status, usable ? styles.statusOpen : styles.statusLocked]}>{selected ? 'In use' : statusLabel(access, usable)}</Text>
    </Pressable>;
  };

  const pieceCard = (id: PieceSetId) => {
    const set = PIECE_SETS[id];
    const access = PIECE_ACCESS[id];
    const usable = canUseCosmetic(access, progress.level, owned);
    const premium = access.kind === 'premium';
    const selected = appearance.pieces === id;
    return <Pressable key={id} testID={`piece-choice-${id}`} accessibilityRole="radio" accessibilityLabel={`${set.name} pieces, ${set.description}, ${statusLabel(access, usable)}`}
      accessibilityState={{ checked: selected, disabled: !usable }}
      onPress={() => { if (usable) void appearance.updateAppearance({ pieces: id }); else explainLocked(set.name, access); }}
      style={({ pressed }) => [styles.pieceCard, premium && !usable && styles.premium, !usable && !premium && styles.locked, selected && styles.chosen, pressed && styles.pressed]}>
      <View style={styles.pieceHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{set.name}{selected ? ' ✓' : ''}</Text>
          <Text style={styles.description} numberOfLines={2}>{set.description}</Text>
        </View>
        <Text style={[styles.status, premium && !usable ? styles.statusPremium : usable ? styles.statusOpen : styles.statusLocked]}>{selected ? 'In use' : statusLabel(access, usable)}</Text>
      </View>
      <View style={styles.pieceRow} accessible={false} importantForAccessibility="no-hide-descendants">
        {(['K', 'Q', 'S', 'N'] as const).map((type, i) => <View key={type} style={styles.pieceCell}>
          <PieceView type={type} color={i % 2 ? 'black' : 'white'} set={id} />
        </View>)}
      </View>
    </Pressable>;
  };

  const groups = tab === 'boards' ? boards : pieces;
  return <Screen><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.lookCard}>
      <Text style={styles.eyebrow}>YOUR LOOK</Text>
      <Text style={styles.lookName}>{appearance.boardTheme.name} · {PIECE_SETS[appearance.pieces].name}</Text>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.preview, { borderColor: appearance.boardTheme.border }]}>
        {(['black', 'white'] as const).map((color, row) => <View key={color} style={styles.previewRow}>
          {PIECE_ORDER.map((type, col) => <View key={type} style={[styles.previewSquare, { backgroundColor: (row + col) % 2 ? appearance.boardTheme.dark : appearance.boardTheme.light }]}>
            <PieceView type={type} color={color} set={appearance.pieces} />
          </View>)}
        </View>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Levels and rewards" onPress={() => navigation.navigate('Rewards')} style={({ pressed }) => [styles.levelRow, pressed && styles.pressed]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.levelText}>Level {progress.level} · {progress.level === MAX_LEVEL ? 'Max level' : `${inLevel}/${XP_PER_LEVEL} XP`}</Text>
          <Text style={styles.levelHint}>{upcoming ? `Next: ${upcoming.name} at level ${upcoming.level}` : 'Every level reward unlocked'}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      {!!appearance.error && <Text accessibilityRole="alert" style={styles.error}>{appearance.error}</Text>}
    </View>

    <View style={styles.tabs} accessibilityRole="tablist">
      {(['boards', 'pieces'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }}
        onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.tabOn]}>
        <Text style={[styles.tabText, tab === value && styles.tabTextOn]}>{value === 'boards' ? `Boards · ${boards.available.length}/${boards.available.length + boards.locked.length}` : `Pieces · ${pieces.available.length}/${pieces.available.length + pieces.locked.length}`}</Text>
      </Pressable>)}
    </View>

    <Text style={styles.groupTitle}>Available</Text>
    <View style={tab === 'boards' ? styles.boardGrid : undefined} accessibilityRole="radiogroup" accessibilityLabel={tab === 'boards' ? 'Available boards' : 'Available pieces'}>
      {tab === 'boards' ? (groups.available as BoardThemeId[]).map(boardCard) : (groups.available as PieceSetId[]).map(pieceCard)}
    </View>
    {groups.locked.length > 0 && <>
      <Text style={[styles.groupTitle, styles.groupLocked]}>🔒 Locked · unlock by playing{tab === 'pieces' ? ' or in the Shop' : ''}</Text>
      <View style={tab === 'boards' ? styles.boardGrid : undefined} accessibilityRole="radiogroup" accessibilityLabel={tab === 'boards' ? 'Locked boards' : 'Locked pieces'}>
        {tab === 'boards' ? (groups.locked as BoardThemeId[]).map(boardCard) : (groups.locked as PieceSetId[]).map(pieceCard)}
      </View>
    </>}
    <Text style={styles.footnote}>Looks never change the rules. Every set includes the Lancer.</Text>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 },
  lookCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.borderSoft, padding: 14 },
  eyebrow: { color: theme.colors.cyan, fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  lookName: { color: theme.colors.text, fontSize: 18, fontWeight: '900', marginTop: 2, marginBottom: 10 },
  preview: { borderWidth: 2, borderRadius: 6, overflow: 'hidden' },
  previewRow: { flexDirection: 'row' },
  previewSquare: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  levelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: theme.colors.borderSoft },
  levelText: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  levelHint: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  chevron: { color: theme.colors.textDim, fontSize: 26, fontWeight: '700', paddingLeft: 8 },
  error: { color: theme.colors.danger, fontSize: 13, marginTop: 8 },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: theme.radius.pill, padding: 4, marginTop: 16, borderWidth: 1, borderColor: theme.colors.borderSoft },
  tab: { flex: 1, paddingVertical: 11, borderRadius: theme.radius.pill, alignItems: 'center' },
  tabOn: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.accent },
  tabText: { color: theme.colors.textDim, fontWeight: '800', fontSize: 14 },
  tabTextOn: { color: theme.colors.text },
  groupTitle: { color: theme.colors.success, fontSize: 12, fontWeight: '900', letterSpacing: 1.1, marginTop: 18, marginBottom: 8, textTransform: 'uppercase' },
  groupLocked: { color: theme.colors.textFaint },
  boardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  boardCard: { width: '48.5%', backgroundColor: theme.colors.surface, borderWidth: 2, borderColor: theme.colors.borderSoft, borderRadius: 12, padding: 10 },
  boardSwatch: { borderWidth: 2, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  swatchRow: { flexDirection: 'row' },
  swatchSquare: { flex: 1, height: 16 },
  pieceCard: { backgroundColor: theme.colors.surface, borderWidth: 2, borderColor: theme.colors.borderSoft, borderRadius: 12, padding: 12, marginBottom: 10 },
  pieceHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pieceRow: { flexDirection: 'row', marginTop: 10, backgroundColor: '#c7b9a1', borderRadius: 6, padding: 4 },
  pieceCell: { flex: 1, aspectRatio: 1, maxHeight: 56, alignItems: 'center', justifyContent: 'center' },
  chosen: { borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceAlt },
  locked: { opacity: 0.6 },
  premium: { borderColor: '#ab8741' },
  pressed: { opacity: 0.8 },
  name: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  description: { color: theme.colors.textDim, fontSize: 12, lineHeight: 17, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '800', marginTop: 6 },
  statusOpen: { color: theme.colors.success },
  statusLocked: { color: theme.colors.textDim },
  statusPremium: { color: '#e3bf77' },
  footnote: { color: theme.colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 16 },
});
