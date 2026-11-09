import type { Color, PieceType } from '../game/pieces';
import type { PieceSetId } from './catalog';

export const RICH_PIECE_SETS = ['imperial', 'jade', 'crystal'] as const;
export type RichPieceSetId = typeof RICH_PIECE_SETS[number];
export const RICH_ATLAS_SIZE = 1254;
export const RICH_ATLAS_COLUMNS = 4;
export const RICH_ATLAS_ROWS = 4;
export const RICH_PIECE_FRAME_SIZE = RICH_ATLAS_SIZE / RICH_ATLAS_COLUMNS;

// Source sheets have seven white pieces in the first two rows, then black.
// Every color uses precisely the same piece order. The eighth cell is empty.
const RICH_PIECE_INDEX: Record<PieceType, number> = { K: 0, Q: 1, R: 2, B: 3, N: 4, P: 5, S: 6 };

export function isRichPieceSet(set: PieceSetId): set is RichPieceSetId {
  return RICH_PIECE_SETS.some(id => id === set);
}

/** Fractional pixel coordinates deliberately preserve the exact source grid. */
export function richPieceFrame(type: PieceType, color: Color) {
  const index = RICH_PIECE_INDEX[type] + (color === 'black' ? 8 : 0);
  return {
    column: index % RICH_ATLAS_COLUMNS,
    row: Math.floor(index / RICH_ATLAS_COLUMNS),
    x: (index % RICH_ATLAS_COLUMNS) * RICH_PIECE_FRAME_SIZE,
    y: Math.floor(index / RICH_ATLAS_COLUMNS) * RICH_PIECE_FRAME_SIZE,
    size: RICH_PIECE_FRAME_SIZE,
  };
}
