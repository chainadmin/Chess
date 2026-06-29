import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
export function AppButton({ title, onPress, secondary }: { title: string; onPress: () => void; secondary?: boolean }) { return <Pressable onPress={onPress} style={[styles.button, secondary && styles.secondary]}><Text style={styles.text}>{title}</Text></Pressable>; }
const styles = StyleSheet.create({ button: { backgroundColor: '#f2b95f', padding: 14, borderRadius: 16, marginVertical: 6, alignItems: 'center' }, secondary: { backgroundColor: '#ffffff20', borderWidth: 1, borderColor: '#ffffff30' }, text: { color: '#fff7e8', fontWeight: '800' } });
