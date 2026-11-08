import React, { useState } from 'react';
import { Text, TextInput, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { authService } from '../services/auth/AuthService';
import { theme } from '../styles/theme';
type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = async () => { try { await authService.login(email, password); navigation.replace('Home'); } catch (e) { setError((e as Error).message); } };
  return <Screen>
    <Text style={styles.eyebrow}>WELCOME BACK</Text>
    <Text style={styles.title}>Login</Text>
    <View style={styles.form}>
      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={theme.colors.textFaint} autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
      <Text style={styles.label}>Password</Text>
      <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor={theme.colors.textFaint} secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
    <AppButton title="Login" onPress={login} />
    <AppButton title="Register instead" onPress={() => navigation.navigate('Register')} secondary />
  </Screen>;
}
const styles = StyleSheet.create({
  eyebrow: { color: theme.colors.cyan, fontWeight: '900', letterSpacing: 1.6, fontSize: 12, marginTop: 12 },
  title: { fontSize: 34, fontWeight: '900', color: theme.colors.text, marginTop: 4, marginBottom: 18 },
  form: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, borderWidth: 1, borderColor: theme.colors.borderSoft, marginBottom: 6 },
  label: { color: theme.colors.textFaint, fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.text, padding: 13, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  error: { color: theme.colors.danger, marginTop: 10, fontWeight: '700' },
});
