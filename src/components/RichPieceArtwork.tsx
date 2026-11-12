import React, { useId } from 'react';
import Svg, { ClipPath, Defs, G, Image, Rect } from 'react-native-svg';
import type { Color, PieceType } from '../game/pieces';
import { richPieceFrame, type RichPieceSetId } from '../appearance/richPieceArtwork';

// Static requires make all three atlases available offline in native/web builds.
const ATLASES = {
  imperial: require('../../assets/chess/rich/imperial-atlas.png'),
  jade: require('../../assets/chess/rich/jade-atlas.png'),
  crystal: require('../../assets/chess/rich/crystal-atlas.png'),
};

/** Viewport clipping uses the untouched atlas; no runtime image processing. */
export function RichPieceArtwork({ set, type, color, cropped = false }: { set: RichPieceSetId; type: PieceType; color: Color; cropped?: boolean }) {
  const clipId = `richPiece${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { column, row } = richPieceFrame(type, color);
  // Give even the tallest king breathing room on a compact 10-file board.
  const cell = 92;
  const inset = (100 - cell) / 2;
  // On the board, show just the artwork cell (no inset margin) so pieces draw larger.
  return <Svg width="100%" height="100%" viewBox={cropped ? `${inset} ${inset} ${cell} ${cell}` : '0 0 100 100'} accessible={false}>
    <Defs><ClipPath id={clipId}><Rect x={inset} y={inset} width={cell} height={cell} /></ClipPath></Defs>
    <G clipPath={`url(#${clipId})`}>
      <Image href={ATLASES[set]} x={inset - column * cell} y={inset - row * cell}
        width={cell * 4} height={cell * 4} preserveAspectRatio="none" />
    </G>
  </Svg>;
}
