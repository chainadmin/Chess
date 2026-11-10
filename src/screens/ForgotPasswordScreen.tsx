import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { authService, MIN_PASSWORD_LENGTH } from '../services/auth/AuthService';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;
type Mode = 'email' | 'code';

export function ForgotPasswordScreen({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>('email');
  const [login, setLogin] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const sendLink = async () => {
    setBusy(true); setError(null);
    try { setSent(await authService.forgotPassword(login)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const useCode = async () => {
    setBusy(true); setError(null);
    try {
      if (password !== confirm) throw new Error('Passwords do not match.');
      const next = await authService.recoverWithCode(username, code, password);
      // The old code is used up; show the replacement once.
      navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'RecoveryCode', params: { code: next, then: 'Home' } }] });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const input = (props: React.ComponentProps<typeof TextInput>) =>
    <TextInput placeholderTextColor={theme.colors.textFaint} autoCapitalize="none" autoCorrect={false} style={styles.input} {...props} />;

  return <Screen><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>ACCOUNT RECOVERY</Text>
    <Text style={styles.title}>Forgot password?</Text>
    <View style={styles.tabs} accessibilityRole="tablist">
      {([['email', 'Email me a link'], ['code', 'Use recovery code']] as const).map(([value, label]) =>
        <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: mode === value }} onPress={() => { setMode(value); setError(null); }}
          style={[styles.tab, mode === value && styles.tabOn]}>
          <Text style={[styles.tabText, mode === value && styles.tabTextOn]}>{label}</Text>
        </Pressable>)}
    </View>

    {mode === 'email' ? <View style={styles.card}>
      {sent ? <>
        <Text style={styles.big}>📬 Check your email</Text>
        <Text style={styles.copy}>{sent}</Text>
        <Text style={styles.copy}>Open the link, choose a new password, then come back and log in.</Text>
      </> : <>
        <Text style={styles.copy}>Enter your username or the email on your account. We'll send a link to choose a new password.</Text>
        <Text style={styles.label}>Username or email</Text>
        {input({ value: login, onChangeText: setLogin, placeholder: 'Username or email', autoComplete: 'username', keyboardType: 'email-address', onSubmitEditing: sendLink })}
      </>}
    </View> : <View style={styles.card}>
      <Text style={styles.copy}>Use the recovery code you saved when you created your account.</Text>
      <Text style={styles.label}>Username</Text>
      {input({ value: username, onChangeText: setUsername, placeholder: 'Your username', autoComplete: 'username' })}
      <Text style={styles.label}>Recovery code</Text>
      {input({ value: code, onChangeText: setCode, placeholder: 'XXXX-XXXX-XXXX-XXXX', autoCapitalize: 'characters' })}
      <Text style={styles.label}>New password</Text>
      {input({ value: password, onChangeText: setPassword, placeholder: `At least ${MIN_PASSWORD_LENGTH} characters`, secureTextEntry: true, autoComplete: 'password-new' })}
      <Text style={styles.label}>Confirm new password</Text>
      {input({ value: confirm, onChangeText: setConfirm, placeholder: '••••••••', secureTextEntry: true, autoComplete: 'password-new', onSubmitEditing: useCode })}
    </View>}

    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {mode === 'email'
      ? sent ? <AppButton title="Back to login" onPress={() => navigation.goBack()} /> : <AppButton title={busy ? 'Sending…' : 'Send reset link'} onPress={sendLink} disabled={busy} />
      : <AppButton title={busy ? 'Resetting…' : 'Reset password'} onPress={useCode} disabled={busy} />}
    <Text style={styles.hint}>{mode === 'email' ? 'No email on your account? Use your recovery code instead.' : "Lost your code too? Create a new account. Store purchases can be restored to it."}</Text>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 },
  eyebrow: { color: theme.colors.cyan, fontWeight: '900', letterSpacing: 1.6, fontSize: 12, marginTop: 12 },
  title: { fontSize: 32, fontWeight: '900', color: theme.colors.text, marginTop: 4, marginBottom: 16 },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: theme.radius.pill, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: theme.colors.borderSoft },
  tab: { flex: 1, paddingVertical: 11, borderRadius: theme.radius.pill, alignItems: 'center' },
  tabOn: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.accent },
  tabText: { color: theme.colors.textDim, fontWeight: '800', fontSize: 13 },
  tabTextOn: { color: theme.colors.text },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, borderWidth: 1, borderColor: theme.colors.borderSoft, marginBottom: 8 },
  big: { color: theme.colors.text, fontSize: 20, fontWeight: '900', marginBottom: 6 },
  copy: { color: theme.colors.textDim, fontSize: 14, lineHeight: 21, marginBottom: 6 },
  label: { color: theme.colors.textFaint, fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.text, padding: 13, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  error: { color: theme.colors.danger, marginVertical: 8, fontWeight: '700' },
  hint: { color: theme.colors.textDim, textAlign: 'center', fontSize: 13, marginTop: 12, lineHeight: 19 },
});
