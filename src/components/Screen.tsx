import React from 'react';
import { SafeAreaView, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, theme } from '../styles/theme';
export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <LinearGradient colors={gradients.app} style={styles.fill}>
      <SafeAreaView style={[styles.screen, style]}>{children}</SafeAreaView>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({ fill: { flex: 1 }, screen: { flex: 1, padding: theme.space(4) } });
