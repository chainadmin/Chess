export type Color = 'white' | 'black';
export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' | 'S';
export type Piece = { type: PieceType; color: Color };
export type Square = { row: number; col: number };
export type Move = { from: Square; to: Square; captured?: Piece; shift?: boolean; promotion?: PieceType };
export const SYMBOLS: Record<PieceType, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', S: 'S' };
export const opponent = (color: Color): Color => color === 'white' ? 'black' : 'white';
