import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { PieceView } from '../components/PieceView';
import { useAppearance } from '../appearance/useAppearance';
import { ComputerDifficulty } from '../game/computerPlayer';
import { Color } from '../game/pieces';
import { TimeControlId } from '../game/timers';
import { STORAGE_KEYS } from '../storage/keys';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'GameSetup'>;
type ColorChoice = Color | 'random';
type ClockChoice = TimeControlId | 'untimed';
type Saved = { difficulty?: ComputerDifficulty; color?: ColorChoice; clock?: ClockChoice };

const LEVELS: { id: ComputerDifficulty; label: string; detail: string }[] = [
  { id: 'easy', label: 'Easy', detail: 'Makes mistakes' },
  { id: 'medium', label: 'Medium', detail: 'Sees tactics' },
  { id: 'hard', label: 'Hard', detail: 'Thinks ahead' },
];
const CLOCKS: { id: ClockChoice; label: string; detail: string }[] = [
  { id: 'untimed', label: 'Untimed', detail: 'No clock' },
  { id: 'bullet_1_1', label: '1 + 1', detail: 'Bullet' },
  { id: 'blitz_3_2', label: '3 + 2', detail: 'Blitz' },
  { id: 'blitz_5_3', label: '5 + 3', detail: 'Blitz' },
  { id: 'rapid_10_0', label: '10 + 0', detail: 'Rapid' },
  { id: 'rapid_10_5', label: '10 + 5', detail: 'Rapid' },
];
const isLevel = (v: unknown): v is ComputerDifficulty => LEVELS.some(l => l.id === v);
const isClock = (v: unknown): v is ClockChoice => CLOCKS.some(c => c.id === v);
const isColor = (v: unknown): v is ColorChoice => v === 'white' || v === 'black' || v === 'random';

function Option({ label, detail, selected, onPress, children }: { label: string; detail?: string; selected: boolean; onPress: () => void; children?: React.ReactNode }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={detail ? `${label}, ${detail}` : label} onPress={onPress}
    style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}>
    {children}
    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
    {!!detail && <Text style={styles.optionDetail}>{detail}</Text>}
  </Pressable>;
}

/** Choose level, side and clock before an offline game; the last choices are remembered. */
export function GameSetupScreen({ route, navigation }: Props) {
  const { pieces } = useAppearance();
  const computer = route.params.opponent === 'computer';
  const [difficulty, setDifficulty] = useState<ComputerDifficulty>(route.params.computerDifficulty ?? 'medium');
  const [color, setColor] = useState<ColorChoice>('white');
  const [clock, setClock] = useState<ClockChoice>('untimed');

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(STORAGE_KEYS.gameSetup).then(raw => {
      if (!live || !raw) return;
      const saved = JSON.parse(raw) as Saved;
      if (!route.params.computerDifficulty && isLevel(saved.difficulty)) setDifficulty(saved.difficulty);
      if (isColor(saved.color)) setColor(saved.color);
      if (isClock(saved.clock)) setClock(saved.clock);
    }).catch(() => undefined);
    return () => { live = false; };
  }, [route.params.computerDifficulty]);

  const start = () => {
    const saved: Saved = { difficulty, color, clock };
    void AsyncStorage.setItem(STORAGE_KEYS.gameSetup, JSON.stringify(saved)).catch(() => undefined);
    const playerColor: Color = color === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : color;
    navigation.replace('Game', {
      mode: 'local',
      timeControl: clock === 'untimed' ? null : clock,
      ...(computer ? { computerDifficulty: difficulty, playerColor } : {}),
    });
  };

  return <Screen><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>{computer ? 'PLAY THE COMPUTER' : 'PASS AND PLAY'}</Text>
    <Text style={styles.title}>Game setup</Text>

    {computer && <>
      <Text style={styles.section}>Computer level</Text>
      <View accessibilityRole="radiogroup" style={styles.row}>
        {LEVELS.map(level => <Option key={level.id} label={level.label} detail={level.detail} selected={difficulty === level.id} onPress={() => setDifficulty(level.id)} />)}
      </View>

      <Text style={styles.section}>Your pieces</Text>
      <View accessibilityRole="radiogroup" style={styles.row}>
        <Option label="White" detail="You move first" selected={color === 'white'} onPress={() => setColor('white')}>
          <PieceView type="K" color="white" set={pieces} size={38} />
        </Option>
        <Option label="Black" detail="Computer first" selected={color === 'black'} onPress={() => setColor('black')}>
          <PieceView type="K" color="black" set={pieces} size={38} />
        </Option>
        <Option label="Random" detail="Coin flip" selected={color === 'random'} onPress={() => setColor('random')}>
          <View style={styles.pair}><PieceView type="K" color="white" set={pieces} size={26} /><PieceView type="K" color="black" set={pieces} size={26} /></View>
        </Option>
      </View>
    </>}

    <Text style={styles.section}>Clock</Text>
    <View accessibilityRole="radiogroup" style={[styles.row, styles.wrap]}>
      {CLOCKS.map(option => <View key={option.id} style={styles.third}>
        <Option label={option.label} detail={option.detail} selected={clock === option.id} onPress={() => setClock(option.id)} />
      </View>)}
    </View>
    <Text style={styles.hint}>{clock === 'untimed' ? 'Take as long as you like on every move.'
      : `Minutes each + seconds added after every move.${computer ? ' The computer uses its own clock too.' : ''}`}</Text>

    <AppButton title="Start game" onPress={start} />
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 },
  eyebrow: { color: theme.colors.cyan, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginTop: 4 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '900', marginTop: 2 },
  section: { color: theme.colors.text, fontSize: 16, fontWeight: '900', marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  wrap: { flexWrap: 'wrap' },
  third: { width: '31.5%' },
  option: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surface },
  optionSelected: { borderWidth: 2, borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceAlt },
  pressed: { opacity: 0.82 },
  optionLabel: { color: theme.colors.textDim, fontSize: 15, fontWeight: '900', marginTop: 2 },
  optionLabelSelected: { color: theme.colors.text },
  optionDetail: { color: theme.colors.textFaint, fontSize: 11, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  pair: { flexDirection: 'row' },
  hint: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18, marginTop: 8, marginBottom: 12 },
});
