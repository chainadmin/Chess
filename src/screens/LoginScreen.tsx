import React, { useState } from 'react';
import { Text, TextInput, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { FormScreen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { authService } from '../services/auth/AuthService';
import { PRIVACY_URL } from '../services/api/ApiClient';
import { Linking } from 'react-native';
import { theme } from '../styles/theme';
type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
export function LoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const login = async () => {
    setBusy(true); setError('');
    try { await authService.login(username, password); navigation.reset({ index: 0, routes: [{ name: 'Home' }] }); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <FormScreen>
    <Text style={styles.eyebrow}>WELCOME BACK</Text>
    <Text style={styles.title}>Login</Text>
    <View style={styles.form}>
      <Text style={styles.label}>Username</Text>
      <TextInput underlineColorAndroid="transparent" selectionColor={theme.colors.accent} cursorColor={theme.colors.accent} style={styles.input} placeholder="Your username" placeholderTextColor={theme.colors.textFaint} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" value={username} onChangeText={setUsername} />
      <Text style={styles.label}>Password</Text>
      <TextInput underlineColorAndroid="transparent" selectionColor={theme.colors.accent} cursorColor={theme.colors.accent} style={styles.input} placeholder="••••••••" placeholderTextColor={theme.colors.textFaint} secureTextEntry autoComplete="password" textContentType="password" value={password} onChangeText={setPassword} onSubmitEditing={login} />
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </View>
    <Text accessibilityRole="link" style={styles.forgot} onPress={() => navigation.navigate('ForgotPassword')}>Forgot password?</Text>
    <AppButton title={busy ? 'Logging in…' : 'Login'} onPress={login} disabled={busy} />
    <AppButton title="Create an account instead" onPress={() => navigation.replace('Register')} secondary />
    {!!PRIVACY_URL && <Text accessibilityRole="link" style={styles.link} onPress={() => { void Linking.openURL(PRIVACY_URL!); }}>Privacy Policy</Text>}
  </FormScreen>;
}
const styles = StyleSheet.create({
  eyebrow: { color: theme.colors.cyan, fontWeight: '900', letterSpacing: 1.6, fontSize: 12, marginTop: 12 },
  title: { fontSize: 34, fontWeight: '900', color: theme.colors.text, marginTop: 4, marginBottom: 18 },
  form: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, borderWidth: 1, borderColor: theme.colors.borderSoft, marginBottom: 6 },
  label: { color: theme.colors.textFaint, fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.text, padding: 13, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  forgot: { color: theme.colors.cyan, fontWeight: '800', textAlign: 'right', marginBottom: 8, marginTop: 2, paddingVertical: 6 },
  link: { color: theme.colors.textDim, textAlign: 'center', textDecorationLine: 'underline', marginTop: 14, fontSize: 13 },
  error: { color: theme.colors.danger, marginTop: 10, fontWeight: '700' },
});
