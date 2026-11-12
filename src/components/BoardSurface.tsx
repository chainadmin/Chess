import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { COLS, ROWS } from '../game/board';
import type { BoardTexture } from '../appearance/catalog';

// Deterministic hand-placed strokes (no randomness, filters, gradients or IDs), in a
// 100 x 80 viewBox that matches the 10 x 8 board. They run across square boundaries
// so the board reads as one continuous slab of stone or timber.
const MARBLE_LIGHT_VEINS = [
  'M-2 9 C14 4 22 18 37 14 S61 2 74 11 S94 19 103 13',
  'M-2 47 C10 41 19 52 31 46 S53 33 66 40 S88 53 103 44',
  'M6 82 C12 70 26 66 33 58 S44 44 58 47',
  'M64 -2 C61 9 70 16 67 27 S58 41 63 52',
];
const MARBLE_DARK_VEINS = [
  'M-2 28 C9 24 18 33 29 29 S47 19 58 25 S79 36 90 30 S99 24 103 26',
  'M18 -2 C21 10 15 19 20 31',
  'M-2 66 C15 61 27 71 41 66 S66 56 79 63 S95 72 103 68',
  'M84 18 C80 27 88 34 85 45 S77 60 82 71 S88 80 87 83',
];
const MARBLE_FINE_VEINS = [
  'M37 14 C40 19 38 24 42 29', 'M74 11 C72 16 76 20 74 25', 'M31 46 C29 52 33 56 31 61',
  'M66 40 C69 45 66 49 69 54', 'M58 25 C55 30 59 34 56 38', 'M41 66 C44 71 42 75 45 79',
];
const GRAIN_LINES = Array.from({ length: 22 }, (_, i) => {
  const y = 1.8 + i * 3.6;
  const a = (i % 3) - 1;
  return `M-2 ${y} C14 ${y + a * 1.1} 26 ${y - a * 0.9} 40 ${y + a * 0.6} S66 ${y - a * 1.2} 80 ${y + a * 0.8} S96 ${y - a * 0.5} 103 ${y}`;
});
const GRAIN_FIGURE = [
  'M8 18 C14 15 18 21 24 18 S33 14 36 19', 'M52 34 C58 31 61 37 67 34 S77 30 80 35',
  'M22 58 C28 55 31 61 37 58 S46 54 49 59', 'M70 66 C75 63 79 69 84 66 S92 62 96 67',
];

type Props = { texture: BoardTexture; light: string; dark: string };

/** One SVG layer drawn under transparent squares; never intercepts touches. */
export const BoardSurface = memo(function BoardSurface({ texture, light, dark }: Props) {
  const squares: React.ReactElement[] = [];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    squares.push(<Rect key={`${row}-${col}`} x={col * 10} y={row * 10} width={10.05} height={10.05} fill={(row + col) % 2 ? dark : light} />);
  }
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}><Svg width="100%" height="100%" viewBox="0 0 100 80" preserveAspectRatio="none">
    {squares}
    {texture === 'marble' ? <>
      <G fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={0.55} strokeLinecap="round">{MARBLE_LIGHT_VEINS.map(d => <Path key={d} d={d} />)}</G>
      <G fill="none" stroke="#4e5a60" strokeOpacity={0.28} strokeWidth={0.4} strokeLinecap="round">{MARBLE_DARK_VEINS.map(d => <Path key={d} d={d} />)}</G>
      <G fill="none" stroke="#5f6b70" strokeOpacity={0.22} strokeWidth={0.22} strokeLinecap="round">{MARBLE_FINE_VEINS.map(d => <Path key={d} d={d} />)}</G>
    </> : <>
      <G fill="none" stroke="#3b1608" strokeOpacity={0.13} strokeWidth={0.35}>{GRAIN_LINES.map(d => <Path key={d} d={d} />)}</G>
      <G fill="none" stroke="#fff3d6" strokeOpacity={0.12} strokeWidth={0.5}>{GRAIN_FIGURE.map(d => <Path key={d} d={d} />)}</G>
      <Rect x={0.6} y={0.6} width={98.8} height={78.8} fill="none" stroke="#e8c467" strokeOpacity={0.85} strokeWidth={0.45} />
    </>}
  </Svg></View>;
});
