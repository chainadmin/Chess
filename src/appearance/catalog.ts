import type { PieceType } from '../game/pieces';

export const BOARD_THEMES = {
  walnut: { name: 'Walnut', description: 'Warm ivory and walnut', light: '#efd9b5', dark: '#9b6b43', border: '#523a29', selected: '#ffdf67', move: '#153d2b', shift: '#135072' },
  forest: { name: 'Forest', description: 'Classic cream and green', light: '#eef0d5', dark: '#76935b', border: '#3c5131', selected: '#ffe36a', move: '#173c35', shift: '#173e73' },
  slate: { name: 'Slate', description: 'Cool porcelain and blue', light: '#e0e8ed', dark: '#6d889d', border: '#34495b', selected: '#ffe078', move: '#163d2c', shift: '#152d65' },
  sandstone: { name: 'Sandstone', description: 'Soft parchment and clay', light: '#f4e8d6', dark: '#b6957d', border: '#6e5445', selected: '#ffdf67', move: '#16462d', shift: '#1b416d' },
  carrara: { name: 'Carrara Marble', description: 'Veined white and blue-grey marble slab', light: '#eeeae3', dark: '#7c8a90', border: '#4b5559', selected: '#ffd95a', move: '#163d2c', shift: '#173a6b' },
  mahogany: { name: 'Mahogany & Gold', description: 'Maple and mahogany in a gilded frame', light: '#e3c18e', dark: '#a65b3a', border: '#c3963c', selected: '#ffe27a', move: '#143a28', shift: '#16345f' },
} as const;
/** Boards drawn with a continuous surface texture under the squares. */
export type BoardTexture = 'marble' | 'grain';
export const BOARD_TEXTURES: Partial<Record<keyof typeof BOARD_THEMES, BoardTexture>> = { carrara: 'marble', mahogany: 'grain' };
export const PIECE_SETS = {
  classic: { name: 'Classic', description: 'Sculpted Staunton silhouettes' },
  club: { name: 'Carved Wood', description: 'Maple and walnut with carved grain' },
  modern: { name: 'Forged Metal', description: 'Silver and gunmetal with crisp facets' },
  tournament: { name: 'Royal Lacquer', description: 'Ivory and royal blue with gold inlay' },
  imperial: { name: 'Imperial Ivory', description: 'Sculpted ivory and obsidian, finished with antique gold' },
  jade: { name: 'Jade Dynasty', description: 'Luminous celadon and deep emerald with brass accents' },
  crystal: { name: 'Frost Crystal', description: 'Faceted pearl and smoky sapphire with polished silver' },
  marble: { name: 'Carrara Marble', description: 'White Carrara and black Nero Marquina marble with brass collars' },
  rosegold: { name: 'Rose Gold', description: 'Polished rose gold against black chrome, faceted like jewellery' },
} as const;
export type BoardThemeId = keyof typeof BOARD_THEMES;
export type PieceSetId = keyof typeof PIECE_SETS;
export type AppearancePreferences = { board: BoardThemeId; pieces: PieceSetId };
export const DEFAULT_APPEARANCE: AppearancePreferences = { board: 'walnut', pieces: 'classic' };
export const PIECE_ORDER: PieceType[] = ['K', 'Q', 'R', 'B', 'N', 'P', 'S'];

/** Invalid or future values fall back independently so a valid preference survives. */
export function parseAppearance(raw: string | null): AppearancePreferences {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== 'object') return { ...DEFAULT_APPEARANCE };
    const { board, pieces } = value as Record<string, unknown>;
    return {
      board: typeof board === 'string' && Object.prototype.hasOwnProperty.call(BOARD_THEMES, board) ? board as BoardThemeId : DEFAULT_APPEARANCE.board,
      pieces: typeof pieces === 'string' && Object.prototype.hasOwnProperty.call(PIECE_SETS, pieces) ? pieces as PieceSetId : DEFAULT_APPEARANCE.pieces,
    };
  } catch { return { ...DEFAULT_APPEARANCE }; }
}
