import React, { memo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Color, PieceType } from '../game/pieces';
import { PIECE_NAMES } from '../game/pieces';
import type { PieceSetId } from '../appearance/catalog';
import { getPieceSvg } from '../appearance/pieceArtwork';
import { isRichPieceSet } from '../appearance/richPieceArtwork';
import { RichPieceArtwork } from './RichPieceArtwork';

type Props = { type: PieceType; color: Color; set: PieceSetId; size?: number; label?: boolean; fill?: boolean };
/**
 * The vector artwork occupies 4.55-95.6 of its 100-unit canvas (outlines included),
 * so on the board we crop to that square: pieces draw ~10% larger with nothing cut off.
 */
const BOARD_VIEWBOX = 'viewBox="4.4 4.4 91.2 91.2"';
/** All boards, previews, captures and promotion share the same selected artwork. */
export const PieceView = memo(function PieceView({ type, color, set, size, label = false, fill = false }: Props) {
  return <View
    pointerEvents="none"
    accessible={label}
    accessibilityRole={label ? 'image' : undefined}
    accessibilityLabel={label ? `${color} ${PIECE_NAMES[type]}` : undefined}
    accessibilityElementsHidden={!label}
    importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    style={{ width: size ?? (fill ? '100%' : '94%'), height: size ?? (fill ? '100%' : '94%'), alignItems: 'center', justifyContent: 'center' }}
  >{isRichPieceSet(set)
    ? <RichPieceArtwork set={set} type={type} color={color} cropped={fill} />
    : <SvgXml xml={fill ? getPieceSvg(set, type, color).replace('viewBox="0 0 100 100"', BOARD_VIEWBOX) : getPieceSvg(set, type, color)} width="100%" height="100%" />}</View>;
});
