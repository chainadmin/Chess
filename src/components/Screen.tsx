import React from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { HeaderHeightContext } from '@react-navigation/elements';
import { gradients, theme } from '../styles/theme';

/** Screens with the navigation header: the header already covers the top inset. */
const BELOW_HEADER: Edge[] = ['left', 'right', 'bottom'];
/** Screens without a header (Welcome, Home) also avoid the notch/status bar. */
export const FULL_SCREEN: Edge[] = ['top', 'left', 'right', 'bottom'];

/**
 * Uses react-native-safe-area-context (works on iOS and Android; React Native's
 * built-in SafeAreaView does nothing on Android). Padding lives on an inner View
 * because SafeAreaView manages its own padding for the insets.
 */
export function Screen({ children, style, edges = BELOW_HEADER }: { children: React.ReactNode; style?: ViewStyle; edges?: Edge[] }) {
  return (
    <LinearGradient colors={gradients.app} style={styles.fill}>
      <SafeAreaView edges={edges} style={styles.fill}>
        <View style={[styles.screen, style]}>{children}</View>
      </SafeAreaView>
    </LinearGradient>
  );
}

/**
 * Screens with text fields: content scrolls, taps outside a field dismiss the
 * keyboard, and the keyboard never covers the focused field or the buttons.
 */
export function FormScreen({ children, edges = BELOW_HEADER }: { children: React.ReactNode; edges?: Edge[] }) {
  // Distance from the top of the window to this screen (the native header).
  const headerHeight = React.useContext(HeaderHeightContext) ?? 0;
  return (
    <Screen edges={edges} style={styles.noPadding}>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: theme.space(4), paddingTop: theme.space(3), paddingBottom: theme.space(2), width: '100%', maxWidth: 720, alignSelf: 'center' },
  noPadding: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  form: { flexGrow: 1, paddingHorizontal: theme.space(4), paddingTop: theme.space(3), paddingBottom: theme.space(8) },
});
