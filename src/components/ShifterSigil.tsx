import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function ShifterSigil({ color = 'white', size = 30 }: { color?: 'white' | 'black'; size?: number }) {
  const isBlack = color === 'black';
  return <View style={[styles.frame, { width: size, height: size }, isBlack && styles.blackFrame]}><View style={[styles.diamond, isBlack && styles.blackDiamond]} /><Text style={[styles.spark, { fontSize: size * 0.62 }, isBlack && styles.blackSpark]}>✦</Text></View>;
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#32e5f2', borderWidth: 2, borderColor: '#f8ffff', shadowColor: '#32e5f2', shadowOpacity: 0.9, shadowRadius: 9, overflow: 'hidden' },
  blackFrame: { backgroundColor: '#7657ff', borderColor: '#d9c7ff' },
  diamond: { position: 'absolute', width: '68%', height: '68%', transform: [{ rotate: '45deg' }], backgroundColor: '#7657ff', borderWidth: 1, borderColor: '#f8ffff88' },
  blackDiamond: { backgroundColor: '#32e5f2', borderColor: '#07101866' },
  spark: { color: '#fffaf0', fontWeight: '900', textShadowColor: '#071018aa', textShadowRadius: 3, lineHeight: 22 },
  blackSpark: { color: '#071018', textShadowColor: '#f8ffff99' }
});
