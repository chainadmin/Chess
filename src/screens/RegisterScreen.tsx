import React, { useState } from 'react';
import { Text, TextInput, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { authService, MIN_PASSWORD_LENGTH, USERNAME_RULES } from '../services/auth/AuthService';
import { PRIVACY_URL } from '../services/api/ApiClient';
import { Linking } from 'react-native';
import { theme } from '../styles/theme';
type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;
export function RegisterScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const register = async () => {
    setBusy(true); setError('');
    try {
      if (password !== confirm) throw new Error('Passwords do not match.');
      const { recoveryCode } = await authService.register(username, password, email);
      // Show the recovery code once before entering the app.
      navigation.reset({ index: 0, routes: [{ name: 'RecoveryCode', params: { code: recoveryCode, then: 'Home' } }] });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <Screen>
    <Text style={styles.eyebrow}>JOIN SHIFTCHESS</Text>
    <Text style={styles.title}>Register</Text>
    <View style={styles.form}>
      <Text style={styles.label}>Username</Text>
      <TextInput style={styles.input} placeholder="Pick a username" placeholderTextColor={theme.colors.textFaint} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" textContentType="username" maxLength={20} value={username} onChangeText={setUsername} />
      <Text style={styles.hint}>{USERNAME_RULES}. Other players will see it.</Text>
      <Text style={styles.label}>Email <Text style={styles.optional}>(optional)</Text></Text>
      <TextInput style={styles.input} placeholder="For password resets only" placeholderTextColor={theme.colors.textFaint} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" value={email} onChangeText={setEmail} />
      <Text style={styles.hint}>Never shown to other players. No marketing email.</Text>
      <Text style={styles.label}>Password</Text>
      <TextInput style={styles.input} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} placeholderTextColor={theme.colors.textFaint} secureTextEntry autoComplete="password-new" textContentType="newPassword" value={password} onChangeText={setPassword} />
      <Text style={styles.label}>Confirm Password</Text>
      <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor={theme.colors.textFaint} secureTextEntry autoComplete="password-new" textContentType="newPassword" value={confirm} onChangeText={setConfirm} onSubmitEditing={register} />
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </View>
    <AppButton title={busy ? 'Creating account…' : 'Create Account'} onPress={register} disabled={busy} />
    <AppButton title="I already have an account" onPress={() => navigation.replace('Login')} secondary />
    <Text style={styles.legal}>By creating an account you agree to our{' '}
      <Text accessibilityRole="link" style={styles.link} onPress={() => { if (PRIVACY_URL) void Linking.openURL(PRIVACY_URL); }}>Privacy Policy</Text>.
    </Text>
  </Screen>;
}
const styles = StyleSheet.create({
  eyebrow: { color: theme.colors.cyan, fontWeight: '900', letterSpacing: 1.6, fontSize: 12, marginTop: 12 },
  title: { fontSize: 34, fontWeight: '900', color: theme.colors.text, marginTop: 4, marginBottom: 18 },
  form: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, borderWidth: 1, borderColor: theme.colors.borderSoft, marginBottom: 6 },
  label: { color: theme.colors.textFaint, fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.text, padding: 13, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  optional: { color: theme.colors.textDim, fontWeight: '600' },
  hint: { color: theme.colors.textDim, fontSize: 12, marginTop: 6 },
  legal: { color: theme.colors.textDim, textAlign: 'center', marginTop: 14, fontSize: 13, lineHeight: 19 },
  link: { color: theme.colors.text, textDecorationLine: 'underline' },
  error: { color: theme.colors.danger, marginTop: 10, fontWeight: '700' },
});
