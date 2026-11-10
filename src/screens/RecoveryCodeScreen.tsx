import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RecoveryCode'>;

/** Shown once, right after the server issues a recovery code. Only a hash is kept on the server. */
export function RecoveryCodeScreen({ route, navigation }: Props) {
  const { code, then } = route.params;
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const share = async () => {
    try { await Share.share({ message: `My ShiftChess recovery code: ${code}` }); setNote('Saved somewhere safe? Great.'); }
    catch { setNote('Press and hold the code to copy it, or write it down.'); }
  };
  const done = () => {
    if (then === 'Home') navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    else navigation.goBack();
  };
  return <Screen>
    <Text style={styles.eyebrow}>ONE LAST STEP</Text>
    <Text style={styles.title}>Save your recovery code</Text>
    <Text style={styles.copy}>If you ever forget your password, this code lets you set a new one. We can't show it again, so keep it somewhere safe, like your password manager or notes app.</Text>
    <View style={styles.codeCard} accessible accessibilityLabel={`Recovery code ${code.split('').join(' ')}`}>
      <Text selectable numberOfLines={1} adjustsFontSizeToFit style={styles.code}>{code}</Text>
    </View>
    <AppButton title="Share / copy code" secondary onPress={() => { void share(); }} />
    {note && <Text accessibilityLiveRegion="polite" style={styles.note}>{note}</Text>}
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: saved }} onPress={() => setSaved(value => !value)} style={styles.check}>
      <View style={[styles.box, saved && styles.boxOn]}>{saved && <Text style={styles.tick}>✓</Text>}</View>
      <Text style={styles.checkText}>I saved my recovery code</Text>
    </Pressable>
    <AppButton title="Continue" onPress={done} disabled={!saved} />
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: theme.colors.cyan, fontWeight: '900', letterSpacing: 1.6, fontSize: 12, marginTop: 12 },
  title: { fontSize: 30, fontWeight: '900', color: theme.colors.text, marginTop: 4, marginBottom: 10 },
  copy: { color: theme.colors.textDim, fontSize: 15, lineHeight: 22 },
  codeCard: { marginVertical: 22, paddingVertical: 22, paddingHorizontal: 12, borderRadius: theme.radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.colors.accent, backgroundColor: theme.colors.surface, alignItems: 'center' },
  code: { color: theme.colors.text, fontSize: 22, fontWeight: '900', letterSpacing: 1, fontVariant: ['tabular-nums'], fontFamily: 'Courier' },
  note: { color: theme.colors.textDim, textAlign: 'center', marginTop: 6 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  tick: { color: '#1d1406', fontWeight: '900' },
  checkText: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
});
