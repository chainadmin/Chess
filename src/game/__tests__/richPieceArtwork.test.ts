import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AppearanceStore } from '../../appearance/AppearanceStore';
import { PIECE_ORDER, PIECE_SETS, DEFAULT_APPEARANCE, parseAppearance } from '../../appearance/catalog';
import { RICH_PIECE_SETS, RICH_ATLAS_SIZE, RICH_PIECE_FRAME_SIZE, isRichPieceSet, richPieceFrame } from '../../appearance/richPieceArtwork';
import { canUseCosmetic, availableAppearance, cosmeticLabel, PIECE_ACCESS, RICH_PIECE_UNLOCK_LEVELS } from '../../progression/cosmetics';
import { NO_ENTITLEMENTS } from '../../services/purchases/billing';

test('three additional complete rich sets retain all existing collection IDs', () => {
  // Existing saved IDs keep their order; newer collections are appended after them.
  assert.deepEqual(Object.keys(PIECE_SETS), ['classic', 'club', 'modern', 'tournament', 'imperial', 'jade', 'crystal', 'marble', 'rosegold']);
  assert.deepEqual(RICH_PIECE_SETS, ['imperial', 'jade', 'crystal']);
  for (const set of RICH_PIECE_SETS) assert.equal(isRichPieceSet(set), true);
  for (const set of ['classic', 'club', 'modern', 'tournament', 'marble', 'rosegold'] as const) assert.equal(isRichPieceSet(set), false);
});

test('all 14 sprite frames are unique, within the atlas and skip both empty cells', () => {
  const frames = new Set<string>();
  for (const color of ['white', 'black'] as const) for (const piece of PIECE_ORDER) {
    const frame = richPieceFrame(piece, color);
    assert.equal(frame.size, RICH_PIECE_FRAME_SIZE);
    assert.ok(frame.x >= 0 && frame.y >= 0);
    assert.ok(frame.x + frame.size <= RICH_ATLAS_SIZE && frame.y + frame.size <= RICH_ATLAS_SIZE);
    assert.ok(!(frame.column === 3 && (frame.row === 1 || frame.row === 3)));
    assert.equal(frame.row < 2, color === 'white');
    frames.add(`${frame.x}/${frame.y}`);
  }
  assert.equal(frames.size, 14);
  assert.deepEqual([richPieceFrame('S', 'white').column, richPieceFrame('S', 'white').row], [2, 1]);
  assert.deepEqual([richPieceFrame('S', 'black').column, richPieceFrame('S', 'black').row], [2, 3]);
});

test('bundled atlases are full-color RGBA PNGs with the exact dimensions used by the renderer', () => {
  const hashes = new Set<string>();
  for (const set of RICH_PIECE_SETS) {
    const png = readFileSync(new URL(`../../../assets/chess/rich/${set}-atlas.png`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), RICH_ATLAS_SIZE);
    assert.equal(png.readUInt32BE(20), RICH_ATLAS_SIZE);
    assert.equal(png[24], 8, '8-bit color channels');
    assert.equal(png[25], 6, 'truecolor with alpha');
    assert.ok(png.byteLength > 100_000 && png.byteLength < 3_000_000);
    hashes.add(png.toString('base64'));
  }
  assert.equal(hashes.size, 3);
});

test('Imperial is included; Jade and Crystal unlock through practice, never purchase flags', () => {
  assert.equal(PIECE_ACCESS.imperial.kind, 'starter');
  for (const level of [1, 4, 5, 9, 10, 20]) assert.equal(canUseCosmetic(PIECE_ACCESS.imperial, level, NO_ENTITLEMENTS), true);
  for (const set of ['jade', 'crystal'] as const) {
    const threshold = RICH_PIECE_UNLOCK_LEVELS[set];
    assert.equal(PIECE_ACCESS[set].kind, 'level');
    assert.equal(canUseCosmetic(PIECE_ACCESS[set], threshold - 1, NO_ENTITLEMENTS), false);
    assert.equal(canUseCosmetic(PIECE_ACCESS[set], threshold, NO_ENTITLEMENTS), true);
    assert.equal(canUseCosmetic(PIECE_ACCESS[set], NaN, NO_ENTITLEMENTS), false);
    assert.equal(cosmeticLabel(PIECE_ACCESS[set], threshold - 1), `Unlock at level ${threshold}`);
    assert.equal(cosmeticLabel(PIECE_ACCESS[set], threshold), `Unlocked at level ${threshold}`);
    assert.equal(availableAppearance({ board: 'walnut', pieces: set }, threshold - 1, NO_ENTITLEMENTS).pieces, DEFAULT_APPEARANCE.pieces);
    assert.equal(availableAppearance({ board: 'walnut', pieces: set }, threshold, NO_ENTITLEMENTS).pieces, set);
  }
  for (const set of ['modern', 'tournament'] as const) {
    assert.equal(PIECE_ACCESS[set].kind, 'premium');
    assert.equal(canUseCosmetic(PIECE_ACCESS[set], 20, NO_ENTITLEMENTS), false);
  }
});

test('each rich selection persists, restores and remains subject to access checks', async () => {
  let saved: string | null = null;
  const storage = { async getItem() { return saved; }, async setItem(_key: string, value: string) { saved = value; } };
  for (const set of RICH_PIECE_SETS) {
    const store = new AppearanceStore(storage);
    await store.update({ pieces: set });
    const restored = new AppearanceStore(storage);
    await restored.load();
    assert.equal(restored.getSnapshot().pieces, set);
    assert.equal(parseAppearance(saved).pieces, set);
  }
});
