import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { PieceView } from '../components/PieceView';
import { useAppearance } from '../appearance/useAppearance';
import { PIECE_ORDER } from '../appearance/catalog';
import { AppButton } from '../components/AppButton';
import { authService } from '../services/auth/AuthService';
import { theme } from '../styles/theme';
type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;
export function WelcomeScreen({ navigation }: Props) {
  const { pieces } = useAppearance();
  const guest = async () => { await authService.continueAsGuest(); navigation.replace('Home'); };
  return <Screen style={styles.center}>
    <View style={styles.logo}><PieceView type="S" color="white" set={pieces} size={80} /></View>
    <Text style={styles.title}>ShiftChess</Text>
    <Text style={styles.subtitle}>10×8 chess with the Lancer, a new piece, a new game.</Text>
    <View style={styles.pieceRow}>
      {PIECE_ORDER.map(type => <PieceView key={type} type={type} color="white" set={pieces} size={32} label />)}
    </View>
    <View style={styles.buttons}>
      <AppButton title="Login" onPress={() => navigation.navigate('Login')} />
      <AppButton title="Register" onPress={() => navigation.navigate('Register')} secondary />
      <AppButton title="Continue as Guest" onPress={guest} secondary />
    </View>
  </Screen>;
}
const styles = StyleSheet.create({
  center: { justifyContent: 'center' },
  logo: { alignSelf: 'center', width: 96, height: 96, borderRadius: 30, backgroundColor: theme.colors.cyan, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.cyan, shadowOpacity: 0.5, shadowRadius: 20, elevation: 6 },
  logoText: { fontSize: 52, color: '#0c1613' },
  title: { fontSize: 44, fontWeight: '900', color: theme.colors.text, textAlign: 'center', marginTop: 18, letterSpacing: -1 },
  subtitle: { color: theme.colors.textDim, textAlign: 'center', marginTop: 8, marginBottom: 22, fontSize: 15, paddingHorizontal: 12 },
  pieceRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 30 },
  previewPiece: { fontSize: 26, color: theme.colors.text, opacity: 0.85 },
  previewLancer: { color: '#071018', backgroundColor: theme.colors.cyan, borderRadius: 8, paddingHorizontal: 6, opacity: 1, fontWeight: '900' },
  buttons: { paddingHorizontal: 6 },
});
