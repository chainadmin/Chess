import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { PRIVACY_URL, SUPPORT_URL, TERMS_URL } from '../services/api/ApiClient';
import { adService } from '../services/ads/AdService';
import { authService, User } from '../services/auth/AuthService';
import { purchaseService } from '../services/purchases/PurchaseService';
import { soundService } from '../services/sound/SoundService';
import { theme } from '../styles/theme';
import appJson from '../../app.json';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.group}>{children}</View>
  </View>;
}

function Row({ label, detail, onPress, danger, last, right }: { label: string; detail?: string; onPress?: () => void; danger?: boolean; last?: boolean; right?: React.ReactElement }) {
  const content = <>
    <View style={{ flex: 1 }}>
      <Text style={[styles.rowLabel, danger && styles.danger]}>{label}</Text>
      {!!detail && <Text style={styles.rowDetail}>{detail}</Text>}
    </View>
    {right ?? (onPress ? <Text style={styles.chevron}>›</Text> : null)}
  </>;
  if (!onPress) return <View style={[styles.row, !last && styles.divider]}>{content}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={detail ? `${label}. ${detail}` : label} onPress={onPress}
    style={({ pressed }) => [styles.row, !last && styles.divider, pressed && styles.pressed]}>{content}</Pressable>;
}

/** Settings: account, sound, purchases link, help and legal. Looks live in Boards & pieces. */
export function SettingsScreen({ navigation }: Props) {
  const [sound, setSound] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [modal, setModal] = useState<null | 'email' | 'code' | 'delete'>(null);
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    authService.currentUser().then(setUser);
    soundService.isEnabled().then(setSound);
  }, []);
  useFocusEffect(load);

  const signedIn = !!user && !user.guest;
  const toWelcome = () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Welcome' }] }));
  const toggleSound = async (value: boolean) => { setSound(value); await soundService.setEnabled(value); };
  const logout = async () => { await authService.logout(); toWelcome(); };
  const open = (kind: 'email' | 'code' | 'delete') => { setModal(kind); setPassword(''); setModalError(null); setNewEmail(user?.email ?? ''); };
  const restore = async () => {
    setRestoring(true); setRestoreMessage(null);
    try { await purchaseService.restorePurchases(); setRestoreMessage('Purchases restored.'); }
    catch (error) { setRestoreMessage(error instanceof Error ? error.message : 'Nothing to restore.'); }
    finally { setRestoring(false); }
  };
  const submit = async () => {
    setBusy(true); setModalError(null);
    try {
      if (modal === 'email') {
        await authService.setEmail(newEmail, password);
        setUser(await authService.currentUser());
        setModal(null);
      } else if (modal === 'code') {
        const code = await authService.newRecoveryCode(password);
        setModal(null);
        navigation.navigate('RecoveryCode', { code, then: 'back' });
      } else if (modal === 'delete') {
        await authService.deleteAccount(password);
        setModal(null);
        toWelcome();
      }
    } catch (error) { setModalError(error instanceof Error ? error.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  };
  const openUrl = (url: string | null) => { if (url) void Linking.openURL(url); };

  return <Screen><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Section title="Account">
      {signedIn ? <>
        <Row label={user!.displayName} detail={user!.profile ? `Rating ${user!.profile.rating} · ${user!.profile.wins}W ${user!.profile.losses}L ${user!.profile.draws}D` : 'Signed in'} />
        <Row label={user!.email ? 'Change email' : 'Add email for password resets'} detail={user!.email ?? 'Not set: needed for email password resets'} onPress={() => open('email')} />
        <Row label="New recovery code" detail="Replaces your old code" onPress={() => open('code')} />
        <Row label="Log out" onPress={() => { void logout(); }} last />
      </> : <>
        <Row label="Playing as a guest" detail="Create a free account to play online and get a rating." />
        {authService.accountsAvailable && <Row label="Create free account" onPress={() => navigation.navigate('Register')} />}
        {authService.accountsAvailable && <Row label="Log in" onPress={() => navigation.navigate('Login')} />}
        <Row label="Leave guest mode" detail="Back to the welcome screen" onPress={() => { void logout(); }} last />
      </>}
    </Section>

    <Section title="Game">
      <Row label="Sound effects" right={<Switch accessibilityLabel="Sound effects" value={sound} onValueChange={value => { void toggleSound(value); }} trackColor={{ true: theme.colors.accent }} />} />
      <Row label="Boards & pieces" detail="Choose your board and piece set" onPress={() => navigation.navigate('Collection')} />
      <Row label="Levels & rewards" onPress={() => navigation.navigate('Rewards')} last />
    </Section>

    <Section title="Purchases">
      <Row label="Shop" detail="Remove ads · Premium piece sets · Everything Pack" onPress={() => navigation.navigate('Shop')} />
      <Row label={restoring ? 'Restoring…' : 'Restore purchases'} detail={restoreMessage ?? (purchaseService.available ? 'Bought on another phone or reinstalled?' : purchaseService.unavailableReason)}
        onPress={purchaseService.available && !restoring ? () => { void restore(); } : undefined} last />
    </Section>

    <Section title="Help & legal">
      {!!SUPPORT_URL && <Row label="Help & support" onPress={() => openUrl(SUPPORT_URL)} />}
      {!!PRIVACY_URL && <Row label="Privacy Policy" onPress={() => openUrl(PRIVACY_URL)} />}
      {!!TERMS_URL && <Row label="Terms of Service" onPress={() => openUrl(TERMS_URL)} />}
      <Row label="How to play" onPress={() => navigation.navigate('Rules')} last />
    </Section>

    {signedIn && <Section title="Account removal">
      <Row label="Delete account" detail="Permanently deletes your account and data" danger onPress={() => open('delete')} last />
    </Section>}

    {__DEV__ && <AppButton title="Preview ad placement (dev)" secondary onPress={() => { void adService.maybeShowInterstitial('manual_test'); }} />}
    <Text style={styles.version}>ShiftChess {appJson.expo.version} · Chain Software Group</Text>

    <Modal visible={modal !== null} transparent animationType="fade" onRequestClose={() => setModal(null)}>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}><View style={styles.modalCard}>
        <Text style={styles.modalTitle}>{modal === 'email' ? 'Email for password resets' : modal === 'code' ? 'Make a new recovery code' : 'Delete your account?'}</Text>
        <Text style={styles.modalCopy}>{modal === 'email' ? 'Used only to send reset links. Leave it empty to remove it.'
          : modal === 'code' ? 'Your old recovery code will stop working. You will see the new one once.'
          : 'This permanently deletes your username, email, rating, game record and purchase records on our servers. Store purchases can be restored to a new account. This cannot be undone.'}</Text>
        {modal === 'email' && <TextInput underlineColorAndroid="transparent" selectionColor={theme.colors.accent} cursorColor={theme.colors.accent} style={styles.input} placeholder="you@example.com" placeholderTextColor={theme.colors.textFaint} autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={newEmail} onChangeText={setNewEmail} />}
        <TextInput underlineColorAndroid="transparent" selectionColor={theme.colors.accent} cursorColor={theme.colors.accent} style={styles.input} placeholder={modal === 'delete' ? 'Enter your password' : 'Current password'} placeholderTextColor={theme.colors.textFaint} secureTextEntry value={password} onChangeText={setPassword} autoComplete="password" />
        {!!modalError && <Text accessibilityRole="alert" style={styles.error}>{modalError}</Text>}
        <AppButton title={busy ? 'Working…' : modal === 'email' ? 'Save email' : modal === 'code' ? 'Make new code' : 'Delete permanently'} onPress={() => { void submit(); }} disabled={!password || busy} />
        <AppButton title="Cancel" secondary onPress={() => setModal(null)} />
      </View></KeyboardAvoidingView>
    </Modal>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 },
  section: { marginTop: 8, marginBottom: 14 },
  sectionTitle: { color: theme.colors.textFaint, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  group: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.borderSoft, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, minHeight: 52 },
  divider: { borderBottomWidth: 1, borderColor: theme.colors.borderSoft },
  pressed: { backgroundColor: theme.colors.surfaceAlt },
  rowLabel: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  rowDetail: { color: theme.colors.textDim, fontSize: 13, marginTop: 2, lineHeight: 18 },
  danger: { color: theme.colors.danger },
  chevron: { color: theme.colors.textDim, fontSize: 24, fontWeight: '700', paddingLeft: 10 },
  version: { color: theme.colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 10 },
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 20, borderWidth: 1, borderColor: theme.colors.border, maxWidth: 520, width: '100%', alignSelf: 'center' },
  modalTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  modalCopy: { color: theme.colors.textDim, fontSize: 14, lineHeight: 20 },
  input: { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.text, padding: 13, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, marginTop: 14 },
  error: { color: theme.colors.danger, fontSize: 13, marginTop: 8 },
});
