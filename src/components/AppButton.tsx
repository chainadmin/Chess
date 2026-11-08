import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, theme } from '../styles/theme';
export function AppButton({ title, onPress, secondary, disabled }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  if (secondary) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.secondary, pressed && styles.pressed, disabled && styles.disabled]}>
        <Text style={styles.secondaryText}>{title}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [pressed && styles.pressed, disabled && styles.disabled]}>
      <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
        <Text style={styles.primaryText}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  primary: { paddingVertical: 15, borderRadius: theme.radius.lg, alignItems: 'center', marginVertical: 7, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  primaryText: { color: '#241608', fontWeight: '900', fontSize: 16, letterSpacing: 0.2 },
  secondary: { paddingVertical: 15, borderRadius: theme.radius.lg, alignItems: 'center', marginVertical: 7, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  secondaryText: { color: theme.colors.text, fontWeight: '800', fontSize: 15 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.4 },
});
