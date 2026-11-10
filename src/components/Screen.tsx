import React from 'react';
import { SafeAreaView, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, theme } from '../styles/theme';

/**
 * Padding lives on an inner View: SafeAreaView replaces its own padding with the
 * device's safe-area insets (iOS and web), which made content touch the screen edges.
 */
export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <LinearGradient colors={gradients.app} style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        <View style={[styles.screen, style]}>{children}</View>
      </SafeAreaView>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: theme.space(4), paddingTop: theme.space(3), paddingBottom: theme.space(2), width: '100%', maxWidth: 720, alignSelf: 'center' },
});
