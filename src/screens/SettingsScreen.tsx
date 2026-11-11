import React, { useCallback, useEffect, useState } from 'react';
import { Text, StyleSheet, Switch, View, ScrollView, Pressable, Modal, TextInput, Linking } from 'react-native';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { purchaseService, StoreProduct } from '../services/purchases/PurchaseService';
import { useEntitlements } from '../services/purchases/entitlements';
import { PIECE_SET_PRODUCTS, PRODUCT_IDS, ProductId } from '../services/purchases/products';
import { PRIVACY_URL, TERMS_URL } from '../services/api/ApiClient';
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
  const owned = useEntitlements();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [storeMessage, setStoreMessage] = useState<string | null>(null);
  const [buying, setBuying] = useState<ProductId | 'restore' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [secure, setSecure] = useState<null | 'email' | 'code'>(null);
  const [securePassword, setSecurePassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [secureError, setSecureError] = useState<string | null>(null);
  const [secureBusy, setSecureBusy] = useState(false);
  const openSecure = (kind: 'email' | 'code') => { setSecure(kind); setSecurePassword(''); setSecureError(null); setNewEmail(user?.email ?? ''); };
  const submitSecure = async () => {
    setSecureBusy(true); setSecureError(null);
    try {
      if (secure === 'email') {
        await authService.setEmail(newEmail, securePassword);
        setUser(await authService.currentUser());
        setSecure(null);
      } else {
        const code = await authService.newRecoveryCode(securePassword);
        setSecure(null);
        navigation.navigate('RecoveryCode', { code, then: 'back' });
      }
    } catch (error) { setSecureError(error instanceof Error ? error.message : 'Something went wrong.'); }
    finally { setSecureBusy(false); }
  };
  useEffect(() => {
    if (!purchaseService.available) return;
    purchaseService.products().then(setProducts).catch(() => setStoreMessage('The store is not reachable right now. Try again later.'));
  }, []);
  const price = (id: ProductId) => products.find(product => product.id === id)?.price;
  const run = async (key: ProductId | 'restore', action: () => Promise<unknown>, success: string) => {
    setBuying(key); setStoreMessage(null);
    try { await action(); setStoreMessage(success); }
    catch (error) { setStoreMessage(error instanceof Error ? error.message : 'Something went wrong.'); }
    finally { setBuying(null); }
  };
  const removeAccount = async () => {
    setDeleteError(null);
    try {
      await authService.deleteAccount(deletePassword);
      setDeleting(false);
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Welcome' }] }));
    } catch (error) { setDeleteError(error instanceof Error ? error.message : 'Could not delete the account.'); }
  };
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
      <Text style={styles.note}>Practice progress is saved on this device. Your online rating comes from rated online games.</Text>
      {progress.error && <><Text accessibilityRole="alert" style={styles.error}>{progress.error}</Text><AppButton title="Retry loading progress" secondary onPress={() => { void progress.retryLoad(); }} /></>}
    </View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Your board, your style</Text>
      <Text style={styles.rowValue}>Mix unlocked boards and pieces. Earn practice looks by playing, or pick up a premium collection. Cosmetics never change the rules.</Text>
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
        const usable = canUseCosmetic(BOARD_ACCESS[id], progress.level, owned);
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
        const usable = canUseCosmetic(access, progress.level, owned);
        const premium = access.kind === 'premium';
        const productId = access.kind === 'premium' ? PIECE_SET_PRODUCTS[access.product] : undefined;
        const label = premium ? (usable ? 'Owned' : price(productId!) ? `Premium · ${price(productId!)}` : 'Premium collection') : cosmeticLabel(access, progress.level);
        return <Pressable key={id} testID={`piece-choice-${id}`} accessibilityRole="radio" accessibilityLabel={`${set.name} pieces, ${set.description}, ${label}`}
          accessibilityState={{ checked: selected, disabled: !appearance.loaded || !usable }} disabled={!appearance.loaded || !usable}
          onPress={() => { void appearance.updateAppearance({ pieces: id }); }}
          style={[styles.pieceChoice, premium && styles.premiumChoice, selected && styles.chosen]}>
          {premium && <Text style={styles.premiumEyebrow}>{usable ? 'PREMIUM COLLECTION · OWNED' : 'PREMIUM COLLECTION'}</Text>}
          <Text style={styles.choiceTitle}>{set.name}{selected ? ' ✓' : ''}</Text>
          <Text style={styles.note}>{set.description}</Text>
          <Text style={premium ? styles.premiumLabel : usable ? styles.unlocked : styles.locked}>{label}</Text>
          {premium && <Text style={styles.note}>{id === 'modern' ? 'Sculpted metal profiles, bright bevels and layered silver/gunmetal finishes.' : 'Royal blue lacquer, ivory enamel and gold inlay with ornate sculpted details.'}</Text>}
          <View style={styles.setPreview} accessible={false} importantForAccessibility="no-hide-descendants">
            {(['white', 'black'] as const).map(color => <View key={color} style={styles.previewRow}>
              {PIECE_ORDER.map(type => <View key={type} style={styles.setPiece}><PieceView type={type} color={color} set={id} /></View>)}
            </View>)}
          </View>
          {premium && !usable && productId && <View style={styles.buy}>
            <AppButton title={!purchaseService.available ? 'Available in the app store version' : buying === productId ? 'Opening store…' : `Buy ${set.name}${price(productId) ? ` · ${price(productId)}` : ''}`}
              disabled={!purchaseService.available || buying !== null}
              onPress={() => { void run(productId, () => purchaseService.purchasePieceSet(access.kind === 'premium' ? access.product : 'modern'), `${set.name} unlocked. Tap it to equip.`); }} />
          </View>}
        </Pressable>;
      })}
    </View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Account</Text>
      <Text style={styles.rowValue}>{user ? (user.guest ? 'Playing as a guest on this device' : `Signed in as ${user.displayName}`) : 'Not signed in'}</Text>
      {user?.profile && <Text style={styles.note}>Rating {user.profile.rating} · {user.profile.wins}W {user.profile.losses}L {user.profile.draws}D</Text>}
      {user?.guest && authService.accountsAvailable && <AppButton title="Create a free account" onPress={() => navigation.navigate('Register')} />}
      <AppButton title={user?.guest ? 'Leave guest mode' : 'Log out'} onPress={logout} secondary />
      {user && !user.guest && <>
        <Text style={styles.note}>Email for password resets: {user.email ?? 'not set'}</Text>
        <AppButton title={user.email ? 'Change email' : 'Add email for password resets'} secondary onPress={() => openSecure('email')} />
        <AppButton title="New recovery code" secondary onPress={() => openSecure('code')} />
      </>}
      {user && !user.guest && <AppButton title="Delete account" secondary onPress={() => { setDeletePassword(''); setDeleteError(null); setDeleting(true); }} />}
      {PRIVACY_URL && <Text accessibilityRole="link" style={styles.link} onPress={() => { void Linking.openURL(PRIVACY_URL!); }}>Privacy Policy</Text>}
      {TERMS_URL && <Text accessibilityRole="link" style={styles.link} onPress={() => { void Linking.openURL(TERMS_URL!); }}>Terms of Service</Text>}
    </View>

    <View style={styles.card}>
      <View style={styles.row}><Text style={styles.rowLabel}>Sound effects</Text><Switch value={sound} onValueChange={toggle} trackColor={{ true: theme.colors.accent }} /></View>

    </View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Free play. Optional extras.</Text>
      <Text style={styles.rowValue}>Online play always stays free. Paid extras are ad removal and premium cosmetics only. No gameplay advantages.</Text>
      {!purchaseService.available && <Text style={styles.note}>{purchaseService.unavailableReason}</Text>}
      {/* Offered only to players who own none of the extras yet, so nobody pays twice for the same item. */}
      {!owned.adsRemoved && owned.premiumPieceSets.length === 0 && <View style={styles.bundle}>
        <Text style={styles.bundleEyebrow}>BEST VALUE</Text>
        <Text style={styles.bundleTitle}>Everything Pack</Text>
        <Text style={styles.rowValue}>Remove ads + Forged Metal + Royal Lacquer pieces</Text>
        <AppButton title={buying === PRODUCT_IDS.everything ? 'Opening store…' : `Get everything${price(PRODUCT_IDS.everything) ? ` · ${price(PRODUCT_IDS.everything)}` : ''}`}
          disabled={!purchaseService.available || buying !== null}
          onPress={() => { void run(PRODUCT_IDS.everything, () => purchaseService.purchaseEverything(), 'Everything unlocked. Thank you!'); }} />
      </View>}
      {owned.adsRemoved ? <Text style={styles.unlocked}>Ads removed. Thank you for supporting ShiftChess!</Text> :
        <AppButton title={buying === PRODUCT_IDS.removeAds ? 'Opening store…' : `Remove ads${price(PRODUCT_IDS.removeAds) ? ` · ${price(PRODUCT_IDS.removeAds)}` : ''}`}
          disabled={!purchaseService.available || buying !== null}
          onPress={() => { void run(PRODUCT_IDS.removeAds, () => purchaseService.purchaseRemoveAds(), 'Ads removed. Thank you!'); }} />}
      <AppButton title={buying === 'restore' ? 'Restoring…' : 'Restore purchases'} secondary disabled={!purchaseService.available || buying !== null}
        onPress={() => { void run('restore', () => purchaseService.restorePurchases(), 'Purchases restored.'); }} />
      {storeMessage && <Text accessibilityLiveRegion="polite" style={styles.note}>{storeMessage}</Text>}
      {__DEV__ && <AppButton title="Preview ad placement (dev)" onPress={() => { void adService.maybeShowInterstitial('manual_test'); }} secondary />}
    </View>
    <Modal visible={secure !== null} transparent animationType="fade" onRequestClose={() => setSecure(null)}>
      <View style={styles.backdrop}><View style={styles.modalCard}>
        <Text style={styles.sectionTitle}>{secure === 'email' ? 'Email for password resets' : 'Make a new recovery code'}</Text>
        <Text style={styles.rowValue}>{secure === 'email' ? 'Used only to send reset links. Leave it empty to remove it.' : 'Your old recovery code will stop working. You will see the new one once.'}</Text>
        {secure === 'email' && <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={theme.colors.textFaint} autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={newEmail} onChangeText={setNewEmail} />}
        <TextInput style={styles.input} placeholder="Current password" placeholderTextColor={theme.colors.textFaint} secureTextEntry value={securePassword} onChangeText={setSecurePassword} autoComplete="password" />
        {secureError && <Text accessibilityRole="alert" style={styles.error}>{secureError}</Text>}
        <AppButton title={secureBusy ? 'Saving…' : secure === 'email' ? 'Save email' : 'Make new code'} onPress={() => { void submitSecure(); }} disabled={!securePassword || secureBusy} />
        <AppButton title="Cancel" secondary onPress={() => setSecure(null)} />
      </View></View>
    </Modal>
    <Modal visible={deleting} transparent animationType="fade" onRequestClose={() => setDeleting(false)}>
      <View style={styles.backdrop}><View style={styles.modalCard}>
        <Text style={styles.sectionTitle}>Delete your account?</Text>
        <Text style={styles.rowValue}>This permanently deletes your username, email, rating, game record and purchase records on our servers. Store purchases can be restored to a new account. This cannot be undone.</Text>
        <TextInput style={styles.input} placeholder="Enter your password" placeholderTextColor={theme.colors.textFaint} secureTextEntry value={deletePassword} onChangeText={setDeletePassword} autoComplete="password" />
        {deleteError && <Text accessibilityRole="alert" style={styles.error}>{deleteError}</Text>}
        <AppButton title="Delete permanently" onPress={() => { void removeAccount(); }} disabled={!deletePassword} />
        <AppButton title="Cancel" secondary onPress={() => setDeleting(false)} />
      </View></View>
    </Modal>
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({
  content: { paddingBottom: 24, width: '100%', maxWidth: 700, alignSelf: 'center' },
  progressTrack: { height: 7, backgroundColor: theme.colors.borderSoft, borderRadius: 4, overflow: 'hidden', marginVertical: 8 },
  progressFill: { height: 7, backgroundColor: theme.colors.accent },
  buy: { marginTop: 10 },
  bundle: { borderWidth: 2, borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg, padding: 14, marginTop: 12, marginBottom: 6 },
  bundleEyebrow: { color: theme.colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  bundleTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '900', marginTop: 2 },
  link: { color: theme.colors.textDim, textDecorationLine: 'underline', marginTop: 12, fontSize: 13, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 20, borderWidth: 1, borderColor: theme.colors.border, maxWidth: 520, width: '100%', alignSelf: 'center' },
  input: { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.text, padding: 13, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, marginTop: 14 },
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
