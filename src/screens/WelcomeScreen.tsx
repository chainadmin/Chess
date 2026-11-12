import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { FULL_SCREEN, Screen } from '../components/Screen';
import { PieceView } from '../components/PieceView';
import { LancerShowcase } from '../components/LancerShowcase';
import { useAppearance } from '../appearance/useAppearance';
import { AppButton } from '../components/AppButton';
import { authService } from '../services/auth/AuthService';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { pieces } = useAppearance();
  // Lowest-friction start: play straight away, sign up later for online games.
  const playNow = async () => { await authService.continueAsGuest(); navigation.replace('Home'); };
  return <Screen edges={FULL_SCREEN}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.brand}>
      <View style={styles.mark}><PieceView type="S" color="white" set={pieces} size={26} /></View>
      <Text style={styles.wordmark}>ShiftChess</Text>
    </View>

    <Text style={styles.headline}>Chess, with a{'\n'}<Text style={styles.highlight}>new piece.</Text></Text>
    <Text style={styles.sub}>A wider 10×8 board and the <Text style={styles.strong}>Lancer</Text>: it slides like a bishop and steps one square straight. Same chess you know, brand-new tactics.</Text>

    <View style={styles.boardCard}><LancerShowcase /></View>

    <View style={styles.perks}>
      {['Daily puzzles', 'Play the computer', 'Rated online games'].map(perk =>
        <View key={perk} style={styles.perk}><Text style={styles.perkText}>✓ {perk}</Text></View>)}
    </View>

    <AppButton title="Play now" onPress={() => { void playNow(); }} />
    {authService.accountsAvailable && <>
      <AppButton title="Create free account" secondary onPress={() => navigation.navigate('Register')} />
      <Text style={styles.login}>Already have an account? <Text accessibilityRole="link" style={styles.loginLink} onPress={() => navigation.navigate('Login')}>Log in</Text></Text>
    </>}
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  mark: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.colors.cyan, alignItems: 'center', justifyContent: 'center' },
  wordmark: { color: theme.colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  headline: { color: theme.colors.text, fontSize: 40, lineHeight: 44, fontWeight: '900', letterSpacing: -1 },
  highlight: { color: theme.colors.accent },
  sub: { color: theme.colors.textDim, fontSize: 15, lineHeight: 22, marginTop: 10 },
  strong: { color: theme.colors.text, fontWeight: '800' },
  boardCard: { marginTop: 20, marginBottom: 16, padding: 10, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSoft,
    shadowColor: theme.colors.cyan, shadowOpacity: 0.18, shadowRadius: 24, elevation: 4 },
  perks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 14 },
  perk: { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  perkText: { color: theme.colors.gold, fontSize: 12, fontWeight: '800' },
  login: { color: theme.colors.textDim, textAlign: 'center', marginTop: 10, fontSize: 14 },
  loginLink: { color: theme.colors.cyan, fontWeight: '800' },
});
