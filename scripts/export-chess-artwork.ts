import { mkdirSync, writeFileSync } from 'node:fs';
import { getPieceSvg } from '../src/appearance/pieceArtwork';
import { BOARD_THEMES, PIECE_SETS, PIECE_ORDER, BoardThemeId, PieceSetId } from '../src/appearance/catalog';
import type { PieceType } from '../src/game/pieces';
import { isRichPieceSet } from '../src/appearance/richPieceArtwork';

// Raster collections have their own source atlases and preview exporter.
const vectorSets = (Object.keys(PIECE_SETS) as PieceSetId[]).filter(set => !isRichPieceSet(set));

const inner = (svg: string) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const cardWidth = 560, cardHeight = 512, gap = 32;
// Sized for however many vector collections exist (two cards per row).
const lookRows = Math.ceil(vectorSets.length / 2);
const lookHeight = 116 + lookRows * (cardHeight + gap) + 30;
const svg: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="1216" height="${lookHeight}" viewBox="0 0 1216 ${lookHeight}">`, `<rect width="1216" height="${lookHeight}" fill="#15121e"/>`, '<g font-family="sans-serif" fill="#f7ead2"><text x="32" y="52" font-size="32" font-weight="bold">ShiftChess · Boards and piece sets</text><text x="32" y="85" font-size="18" fill="#cdbfe0">Mix any board with any piece set in Settings. All sets include the Lancer.</text></g>'];
const backRank: PieceType[] = ['R', 'N', 'S', 'B', 'Q', 'K', 'B', 'S', 'N', 'R'];
vectorSets.forEach((set, i) => {
  const boardIds = Object.keys(BOARD_THEMES) as BoardThemeId[];
  const boardId = boardIds[i % boardIds.length];
  const board = BOARD_THEMES[boardId];
  const x = 32 + i % 2 * (cardWidth + gap), y = 116 + Math.floor(i / 2) * (cardHeight + gap);
  svg.push(`<g transform="translate(${x} ${y})"><rect width="${cardWidth}" height="${cardHeight}" rx="16" fill="#241d33"/><text x="24" y="38" font-family="sans-serif" font-size="22" font-weight="bold" fill="#f7ead2">${PIECE_SETS[set].name} pieces · ${board.name}</text><text x="24" y="65" font-family="sans-serif" font-size="15" fill="#cdbfe0">${PIECE_SETS[set].description}</text><g transform="translate(30 88)"><rect x="-4" y="-4" width="508" height="408" rx="5" fill="${board.border}"/>`);
  for(let row=0;row<8;row++) for(let col=0;col<10;col++) {
    svg.push(`<rect x="${col*50}" y="${row*50}" width="50" height="50" fill="${(row+col)%2?board.dark:board.light}"/>`);
    const type = row === 0 || row === 7 ? backRank[col] : row === 1 || row === 6 ? 'P' : null;
    if(type) svg.push(`<g transform="translate(${col*50+3.5} ${row*50+1}) scale(.43)">${inner(getPieceSvg(set,type,row<4?'black':'white'))}</g>`);
  }
  svg.push('</g></g>');
});
svg.push(`<text x="32" y="${lookHeight - 19}" font-family="sans-serif" font-size="15" fill="#cdbfe0">Actual game artwork · ${vectorSets.length * 14} pieces · Mix any board and piece set · Preview, not an app screenshot</text></svg>`);
mkdirSync('assets/chess', { recursive: true });
writeFileSync('assets/chess/appearance-preview.svg', svg.join(''));
// Export editable, sprite-sheet-ready sources from the runtime artwork.
for (const set of vectorSets) {
  const cells: string[] = [];
  for (const [row, color] of (['white', 'black'] as const).entries()) for (const [col, type] of PIECE_ORDER.entries()) {
    const piece = getPieceSvg(set, type, color);
    writeFileSync(`assets/chess/${set}-${color}-${type}.svg`, `${piece}\n`);
    cells.push(piece.replace(/^<svg[^>]*>/, `<svg x="${col*100}" y="${row*100}" width="100" height="100" viewBox="0 0 100 100">`));
  }
  writeFileSync(`assets/chess/${set}-spritesheet.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="200" viewBox="0 0 700 200">${cells.join('')}</svg>\n`);
}

// Large, labeled source-art preview for comparing the four material treatments.
const pieceNames = ['King', 'Queen', 'Rook', 'Bishop', 'Knight', 'Pawn', 'Lancer'];
const collectionHeight = 108 + Math.ceil(vectorSets.length / 2) * 466 + 24;
const preview = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="1420" height="${collectionHeight}" viewBox="0 0 1420 ${collectionHeight}">`,
  `<rect width="1420" height="${collectionHeight}" fill="#15121e"/>`,
  '<g font-family="sans-serif" fill="#f7ead2"><text x="32" y="49" font-size="31" font-weight="bold">ShiftChess · Vector piece collections</text><text x="32" y="81" font-size="18" fill="#cdbfe0">Actual game artwork. Every set includes light and dark versions of all seven pieces.</text></g>',
];
vectorSets.forEach((set, i) => {
  const x = 32 + i % 2 * 694, y = 108 + Math.floor(i / 2) * 466;
  preview.push(`<g transform="translate(${x} ${y})"><rect width="662" height="438" rx="16" fill="#241d33"/><text x="24" y="39" font-family="sans-serif" font-size="25" font-weight="bold" fill="#f7ead2">${PIECE_SETS[set].name}</text><text x="24" y="67" font-family="sans-serif" font-size="17" fill="#cdbfe0">${PIECE_SETS[set].description}</text>`);
  for (const [row, color] of (['white', 'black'] as const).entries()) {
    for (const [col, type] of PIECE_ORDER.entries()) {
      preview.push(`<g transform="translate(${24 + col * 88} ${88 + row * 112})"><rect width="86" height="106" rx="5" fill="${(col + row) % 2 ? '#9ba69c' : '#d8d0b9'}"/><g transform="translate(0 6) scale(.86)">${inner(getPieceSvg(set, type, color))}</g></g>`);
    }
  }
  pieceNames.forEach((name, col) => preview.push(`<text x="${67 + col * 88}" y="329" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#d8cde3">${name}</text>`));
  preview.push('<text x="24" y="362" font-family="sans-serif" font-size="14" fill="#cdbfe0">Small board-size check</text>');
  for (const [row, color] of (['white', 'black'] as const).entries()) for (const [col, type] of PIECE_ORDER.entries()) {
    preview.push(`<g transform="translate(${228 + col * 38} ${350 + row * 38})"><rect width="38" height="38" fill="${(row + col) % 2 ? '#76935b' : '#eef0d5'}"/><g transform="translate(5 5) scale(.28)">${inner(getPieceSvg(set, type, color))}</g></g>`);
  }
  preview.push('</g>');
});
preview.push(`<text x="32" y="${collectionHeight - 18}" font-family="sans-serif" font-size="15" fill="#cdbfe0">Flat 2D pieces · Spearhead Lancer · Material and color differences · Not an app screenshot</text></svg>`);
writeFileSync('assets/chess/collections-preview.svg', preview.join(''));
