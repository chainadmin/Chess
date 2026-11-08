import React, { memo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Color, PieceType } from '../game/pieces';
import { PIECE_NAMES } from '../game/pieces';
import type { PieceSetId } from '../appearance/catalog';
import { getPieceSvg } from '../appearance/pieceArtwork';

type Props = { type: PieceType; color: Color; set: PieceSetId; size?: number; label?: boolean };
/** The same vector artwork is used on boards, in previews, captures and promotion. */
export const PieceView = memo(function PieceView({ type, color, set, size, label = false }: Props) {
  return <View
    pointerEvents="none"
    accessible={label}
    accessibilityRole={label ? 'image' : undefined}
    accessibilityLabel={label ? `${color} ${PIECE_NAMES[type]}` : undefined}
    accessibilityElementsHidden={!label}
    importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    style={{ width: size ?? '94%', height: size ?? '94%', alignItems: 'center', justifyContent: 'center' }}
  ><SvgXml xml={getPieceSvg(set, type, color)} width="100%" height="100%" /></View>;
});
