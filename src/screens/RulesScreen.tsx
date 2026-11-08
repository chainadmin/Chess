import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Screen } from '../components/Screen';
import { theme } from '../styles/theme';
export function RulesScreen() {
  return <Screen>
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Rules</Text>
      <Text style={styles.copy}>ShiftChess is played on a 10 columns × 8 rows board. Each back rank starts: R N S B Q K B S N R, with 10 pawns per side.</Text>

      <View style={styles.card}>
        <Text style={styles.heading}>The Shifter (S)</Text>
        <Text style={styles.copy}>The Shifter may move like a bishop any number of squares diagonally, capturing along the way. It cannot jump over pieces.</Text>
        <Text style={styles.copy}>It may also shift exactly one square orthogonally — up, down, left, or right — and capture on that step too.</Text>
        <Text style={styles.copy}>It is not a queen: it cannot slide more than one square orthogonally. It is not a king: diagonal movement is only legal along a full bishop path.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Standard rules that still apply</Text>
        <Text style={styles.copy}>• Castling: an unmoved king on its starting square and an unmoved corner rook may castle if the squares between them are empty and the king doesn't pass through or land on an attacked square.</Text>
        <Text style={styles.copy}>• En passant: a pawn that advances two squares can be captured in passing by an enemy pawn on the very next move.</Text>
        <Text style={styles.copy}>• Promotion: a pawn reaching the last rank promotes to a Queen, Rook, Bishop, Knight, or Shifter — your choice.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>How games end</Text>
        <Text style={styles.copy}>• Checkmate or resignation ends the game immediately.</Text>
        <Text style={styles.copy}>• Stalemate, the 50-move rule, threefold repetition, and insufficient material are all draws.</Text>
        <Text style={styles.copy}>• A king and Shifter can checkmate, so they are not insufficient material.</Text>
        <Text style={styles.copy}>• In timed games, running out of the clock loses on time.</Text>
      </View>
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({
  title: { fontSize: 34, fontWeight: '900', color: theme.colors.text, marginBottom: 12, marginTop: 8 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.borderSoft, padding: 16, marginTop: 14 },
  heading: { fontSize: 18, fontWeight: '900', color: theme.colors.cyan },
  copy: { color: theme.colors.textDim, fontSize: 15, lineHeight: 22, marginTop: 8 },
});
