import React, { useCallback, useState } from 'react';
import { Text, StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { purchaseService } from '../services/purchases/PurchaseService';
import { authService, User } from '../services/auth/AuthService';
import { soundService } from '../services/sound/SoundService';
import { theme } from '../styles/theme';
type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export function SettingsScreen({ navigation }: Props) {
  const [adsRemoved, setAdsRemoved] = useState(false);
  const [sound, setSound] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const load = useCallback(() => {
    purchaseService.getEntitlements().then(e => setAdsRemoved(e.adsRemoved));
    authService.currentUser().then(setUser);
    soundService.isEnabled().then(setSound);
  }, []);
  useFocusEffect(load);
  const remove = async () => setAdsRemoved((await purchaseService.purchaseRemoveAds()).adsRemoved);
  const restore = async () => setAdsRemoved((await purchaseService.restorePurchases()).adsRemoved);
  const toggle = async (v: boolean) => { setSound(v); await soundService.setEnabled(v); };
  const logout = async () => { await authService.logout(); navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Welcome' }] })); };
  return <Screen>
    <Text style={styles.title}>Settings</Text>

    <View style={styles.card}>
      <Text style={styles.rowLabel}>Account</Text>
      <Text style={styles.rowValue}>{user ? `${user.displayName}${user.guest ? ' (Guest)' : ''}` : 'Not signed in'}</Text>
    </View>

    <View style={styles.card}>
      <View style={styles.row}><Text style={styles.rowLabel}>Sound effects</Text><Switch value={sound} onValueChange={toggle} trackColor={{ true: theme.colors.accent }} /></View>
      <View style={styles.row}><Text style={styles.rowLabel}>Ads removed</Text><Text style={styles.rowValue}>{adsRemoved ? 'Yes' : 'No'}</Text></View>
    </View>

    <AppButton title="Remove Ads" onPress={remove} />
    <AppButton title="Restore Purchases" onPress={restore} secondary />
    <AppButton title="Logout" onPress={logout} secondary />
  </Screen>;
}
const styles = StyleSheet.create({
  title: { fontSize: 34, fontWeight: '900', color: theme.colors.text, marginVertical: 16 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.borderSoft, padding: 16, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rowLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  rowValue: { color: theme.colors.textDim, fontSize: 14, marginTop: 4 },
});
