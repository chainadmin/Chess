import React, { useCallback, useState } from 'react';
import { Text, StyleSheet, Switch, View, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { NO_ENTITLEMENTS } from '../services/purchases/PurchaseService';
import { adService } from '../services/ads/AdService';
import { useProgression } from '../progression/useProgression';
import { BOARD_ACCESS, PIECE_ACCESS, canUseCosmetic, cosmeticLabel } from '../progression/cosmetics';
import { MAX_LEVEL, XP_PER_LEVEL } from '../progression/progression';
import { authService, User } from '../services/auth/AuthService';
import { soundService } from '../services/sound/SoundService';
import { BOARD_THEMES, PIECE_SETS, PIECE_ORDER, BoardThemeId, PieceSetId } from '../appearance/catalog';
import { useAppearance } from '../appearance/useAppearance';
import { PieceView } from '../components/PieceView';
import { theme } from '../styles/theme';
type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export function SettingsScreen({ navigation }: Props) {
  const appearance = useAppearance();
  const progress = useProgression();
  const [sound, setSound] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const load = useCallback(() => {
    authService.currentUser().then(setUser);
    soundService.isEnabled().then(setSound);
  }, []);
  useFocusEffect(load);
  const toggle = async (v: boolean) => { setSound(v); await soundService.setEnabled(v); };
  const logout = async () => { await authService.logout(); navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Welcome' }] })); };
  return <Screen>
    <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>Settings</Text>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Practice level {progress.level}</Text>
      <Text style={styles.currentLook}>{progress.xp} XP · {progress.level === MAX_LEVEL ? 'Max level' : `${XP_PER_LEVEL - progress.xp % XP_PER_LEVEL} XP to your next level`}</Text>
      <View accessibilityRole="progressbar" accessibilityLabel="Practice level progress" accessibilityValue={{ min: 0, max: 100, now: progress.level === MAX_LEVEL ? 100 : progress.xp % XP_PER_LEVEL }} style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress.level === MAX_LEVEL ? 100 : progress.xp % XP_PER_LEVEL}%` }]} /></View>
      <Text style={styles.note}>Finish a local or computer game with at least 6 moves: 25 XP. Beat the computer: +25 XP. Solve the daily puzzle: 30 XP once per day.</Text>
      <Text style={styles.note}>Practice progress is shared on this device only. It is not an online rating, a secure account balance, or proof of a purchase. Online rewards are not connected yet.</Text>
      {progress.error && <><Text accessibilityRole="alert" style={styles.error}>{progress.error}</Text><AppButton title="Retry loading progress" secondary onPress={() => { void progress.retryLoad(); }} /></>}
    </View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Your board, your style</Text>
      <Text style={styles.rowValue}>Mix unlocked boards and pieces. Earn practice looks by playing; premium collections are preview-only until billing is connected. All cosmetics leave the rules unchanged.</Text>
      <Text style={styles.currentLook}>{appearance.boardTheme.name} · {PIECE_SETS[appearance.pieces].name}</Text>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.livePreview, { borderColor: appearance.boardTheme.border }]}>
        {(['black', 'white'] as const).map((color, row) => <View key={color} style={styles.previewRow}>
          {PIECE_ORDER.map((type, col) => <View key={type} style={[styles.previewSquare, { backgroundColor: (row + col) % 2 ? appearance.boardTheme.dark : appearance.boardTheme.light }]}><PieceView type={type} color={color} set={appearance.pieces} /></View>)}
        </View>)}
      </View>
      <Text style={styles.note}>Includes the Lancer, with the same bishop + one-step movement as before.</Text>
      {!appearance.loaded && <Text accessibilityLiveRegion="polite" style={styles.note}>Loading your saved look…</Text>}
      {appearance.error && <Text accessibilityRole="alert" style={styles.error}>{appearance.error}</Text>}
    </View>

    <Text style={styles.sectionTitle}>Board colors</Text>
    <View style={styles.boardChoices} accessibilityRole="radiogroup" accessibilityLabel="Board colors">
      {(Object.keys(BOARD_THEMES) as BoardThemeId[]).map(id => {
        const board = BOARD_THEMES[id];
        const selected = appearance.board === id;
        const usable = canUseCosmetic(BOARD_ACCESS[id], progress.level, NO_ENTITLEMENTS);
        const label = cosmeticLabel(BOARD_ACCESS[id], progress.level);
        return <Pressable key={id} testID={`board-choice-${id}`} accessibilityRole="radio" accessibilityLabel={`${board.name} board, ${board.description}, ${label}`}
          accessibilityState={{ checked: selected, disabled: !appearance.loaded || !usable }} disabled={!appearance.loaded || !usable}
          onPress={() => { void appearance.updateAppearance({ board: id }); }}
          style={[styles.boardChoice, selected && styles.chosen]}>
          <View style={styles.swatches} accessible={false}>{[board.light, board.dark, board.light, board.dark].map((color, i) => <View key={i} style={[styles.swatch, { backgroundColor: color }]} />)}</View>
          <Text style={styles.choiceTitle}>{board.name}{selected ? ' ✓' : ''}</Text>
          <Text style={styles.note}>{board.description}</Text>
          <Text style={usable ? styles.unlocked : styles.locked}>{label}</Text>
        </Pressable>;
      })}
    </View>

    <Text style={styles.sectionTitle}>Chess pieces</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Chess pieces">
      {(Object.keys(PIECE_SETS) as PieceSetId[]).map(id => {
        const set = PIECE_SETS[id];
        const selected = appearance.pieces === id;
        const access = PIECE_ACCESS[id];
        const usable = canUseCosmetic(access, progress.level, NO_ENTITLEMENTS);
        const premium = access.kind === 'premium';
        const label = cosmeticLabel(access, progress.level);
        return <Pressable key={id} testID={`piece-choice-${id}`} accessibilityRole="radio" accessibilityLabel={`${set.name} pieces, ${set.description}, ${label}`}
          accessibilityState={{ checked: selected, disabled: !appearance.loaded || !usable }} disabled={!appearance.loaded || !usable}
          onPress={() => { void appearance.updateAppearance({ pieces: id }); }}
          style={[styles.pieceChoice, premium && styles.premiumChoice, selected && styles.chosen]}>
          {premium && <Text style={styles.premiumEyebrow}>PREMIUM COLLECTION · PREVIEW</Text>}
          <Text style={styles.choiceTitle}>{set.name}{selected ? ' ✓' : ''}</Text>
          <Text style={styles.note}>{set.description}</Text>
          <Text style={premium ? styles.premiumLabel : usable ? styles.unlocked : styles.locked}>{label}</Text>
          {premium && <Text style={styles.note}>{id === 'modern' ? 'Sculpted metal profiles, bright bevels and layered silver/gunmetal finishes.' : 'Royal blue lacquer, ivory enamel and gold inlay with ornate sculpted details.'}</Text>}
          <View style={styles.setPreview} accessible={false} importantForAccessibility="no-hide-descendants">
            {(['white', 'black'] as const).map(color => <View key={color} style={styles.previewRow}>
              {PIECE_ORDER.map(type => <View key={type} style={styles.setPiece}><PieceView type={type} color={color} set={id} /></View>)}
            </View>)}
          </View>
        </Pressable>;
      })}
    </View>

    <View style={styles.card}>
      <Text style={styles.rowLabel}>Account</Text>
      <Text style={styles.rowValue}>{user ? `${user.displayName}${user.guest ? ' (Guest)' : ''}` : 'Not signed in'}</Text>
    </View>

    <View style={styles.card}>
      <View style={styles.row}><Text style={styles.rowLabel}>Sound effects</Text><Switch value={sound} onValueChange={toggle} trackColor={{ true: theme.colors.accent }} /></View>

    </View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Free play. Optional extras.</Text>
      <Text style={styles.rowValue}>Online play always stays free. Paid extras are ad removal and premium cosmetics only. No gameplay advantages.</Text>
      <Text style={styles.note}>Purchases and live ads are not connected in this build. Premium items cannot be bought or equipped yet, and no prices have been set. Old demo purchase flags do not represent ownership.</Text>
      <AppButton title="Remove ads · Not available yet" onPress={() => {}} disabled />
      <AppButton title="Restore purchases · Not available yet" onPress={() => {}} secondary disabled />
      <Text style={styles.note}>Preview the between-games ad placement below. This shows a clearly marked placeholder, never a live ad.</Text>
      <AppButton title="Preview ad placement" onPress={() => { void adService.maybeShowInterstitial('manual_test'); }} secondary />
    </View>
    <AppButton title="Logout" onPress={logout} secondary />
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({
  content: { paddingBottom: 24, width: '100%', maxWidth: 700, alignSelf: 'center' },
  progressTrack: { height: 7, backgroundColor: theme.colors.borderSoft, borderRadius: 4, overflow: 'hidden', marginVertical: 8 },
  progressFill: { height: 7, backgroundColor: theme.colors.accent },
  premiumChoice: { borderColor: '#ab8741', backgroundColor: '#202735' },
  premiumEyebrow: { color: '#e3bf77', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  premiumLabel: { color: '#e3bf77', fontWeight: '800', fontSize: 12, marginTop: 6 },
  unlocked: { color: theme.colors.success, fontSize: 12, fontWeight: '700', marginTop: 6 },
  locked: { color: theme.colors.textDim, fontSize: 12, fontWeight: '700', marginTop: 6 },
  sectionTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '800', marginBottom: 10 },
  currentLook: { color: theme.colors.accent, fontSize: 14, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  livePreview: { borderWidth: 2, borderRadius: 6, overflow: 'hidden' },
  previewRow: { flexDirection: 'row' },
  previewSquare: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  note: { color: theme.colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 4 },
  error: { color: theme.colors.danger, fontSize: 13, marginTop: 8 },
  boardChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  boardChoice: { flexGrow: 1, flexBasis: '45%', backgroundColor: theme.colors.surface, borderWidth: 2, borderColor: theme.colors.borderSoft, borderRadius: 12, padding: 12, minHeight: 112 },
  chosen: { borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceAlt },
  swatches: { flexDirection: 'row', borderRadius: 4, overflow: 'hidden', height: 26, marginBottom: 8 },
  swatch: { flex: 1 },
  choiceTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  pieceChoice: { backgroundColor: theme.colors.surface, borderWidth: 2, borderColor: theme.colors.borderSoft, borderRadius: 12, padding: 12, marginBottom: 12 },
  setPreview: { marginTop: 10, backgroundColor: '#c7b9a1', borderRadius: 6, padding: 4, maxWidth: 420 },
  setPiece: { width: `${100 / 7}%`, aspectRatio: 1, maxHeight: 52, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 34, fontWeight: '900', color: theme.colors.text, marginVertical: 16 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.borderSoft, padding: 16, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rowLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  rowValue: { color: theme.colors.textDim, fontSize: 14, marginTop: 4 },
});
