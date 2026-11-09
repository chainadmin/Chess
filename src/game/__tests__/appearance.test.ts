import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APPEARANCE_KEY, AppearanceStore, type PreferenceStorage } from '../../appearance/AppearanceStore';
import { BOARD_THEMES, PIECE_SETS, PIECE_ORDER, DEFAULT_APPEARANCE, parseAppearance, type PieceSetId } from '../../appearance/catalog';
import { getPieceSvg } from '../../appearance/pieceArtwork';
import { isRichPieceSet } from '../../appearance/richPieceArtwork';

const allSets = Object.keys(PIECE_SETS) as PieceSetId[];
const sets = allSets.filter(set => !isRichPieceSet(set));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function memoryStorage(initial: string | null = null) {
  let value = initial;
  const writes: string[] = [];
  const storage: PreferenceStorage = {
    async getItem(key) { assert.equal(key, APPEARANCE_KEY); return value; },
    async setItem(key, next) { assert.equal(key, APPEARANCE_KEY); writes.push(next); value = next; },
  };
  return { storage, writes };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test('appearance catalog contains four distinct boards, seven sets and all seven piece types', () => {
  assert.equal(Object.keys(BOARD_THEMES).length, 4);
  assert.equal(sets.length, 4);
  assert.equal(allSets.length, 7);
  assert.deepEqual(PIECE_ORDER, ['K', 'Q', 'R', 'B', 'N', 'P', 'S']);
  assert.equal(new Set(Object.values(BOARD_THEMES).map(b => `${b.light}/${b.dark}`)).size, 4);
  for (const board of Object.values(BOARD_THEMES)) {
    assert.notEqual(board.light, board.dark);
    for (const key of ['light', 'dark', 'border', 'selected', 'move', 'shift'] as const) assert.match(board[key], /^#[0-9a-f]{6}$/i);
  }
});

test('missing, malformed and invalid saved values fall back independently without prototype keys', () => {
  for (const raw of [null, '', 'garbage', 'null', 'false', '42', '[]', '"forest"', '{}', '{"board":"__proto__","pieces":"constructor"}']) {
    assert.deepEqual(parseAppearance(raw), DEFAULT_APPEARANCE);
  }
  assert.deepEqual(parseAppearance('{"board":"forest","pieces":"future"}'), { board: 'forest', pieces: 'classic' });
  assert.deepEqual(parseAppearance('{"board":[],"pieces":"modern"}'), { board: 'walnut', pieces: 'modern' });
  for (const board of Object.keys(BOARD_THEMES)) for (const pieces of allSets) {
    assert.deepEqual(parseAppearance(JSON.stringify({ board, pieces, ignored: true })), { board, pieces });
  }
});

test('load asynchronously hydrates once and snapshots remain referentially stable between changes', async () => {
  const read = deferred<string | null>();
  let reads = 0;
  const store = new AppearanceStore({ getItem: () => { reads++; return read.promise; }, async setItem() {} });
  const before = store.getSnapshot();
  assert.deepEqual(before, { ...DEFAULT_APPEARANCE, loaded: false, error: null });
  const first = store.load();
  assert.equal(store.load(), first);
  assert.equal(store.getSnapshot(), before);
  read.resolve('{"board":"slate","pieces":"club"}');
  await first;
  assert.equal(reads, 1);
  assert.deepEqual(store.getSnapshot(), { board: 'slate', pieces: 'club', loaded: true, error: null });
  assert.equal(store.getSnapshot(), store.getSnapshot());
});

test('updates merge preferences, validate runtime input and persist across a fresh store', async () => {
  const { storage } = memoryStorage('{"board":"forest","pieces":"tournament"}');
  const store = new AppearanceStore(storage);
  await store.update({ board: 'slate' });
  assert.equal(store.getSnapshot().pieces, 'tournament');
  await store.update({ pieces: 'club' });
  const restored = new AppearanceStore(storage);
  await restored.load();
  assert.deepEqual(restored.getSnapshot(), { board: 'slate', pieces: 'club', loaded: true, error: null });
  await store.update({ pieces: 'unknown' as PieceSetId });
  assert.equal(store.getSnapshot().board, 'slate');
  assert.equal(store.getSnapshot().pieces, DEFAULT_APPEARANCE.pieces);
});

test('rapid updates serialize asynchronous writes without losing merged fields', async () => {
  const gates = [deferred<void>(), deferred<void>(), deferred<void>()];
  const writes: string[] = [];
  let saved: string | null = null;
  const store = new AppearanceStore({ async getItem() { return saved; }, async setItem(_key, value) {
    const index = writes.push(value) - 1;
    await gates[index].promise;
    saved = value;
  } });
  await store.load();
  const a = store.update({ board: 'forest' });
  const b = store.update({ pieces: 'modern' });
  const c = store.update({ board: 'sandstone' });
  await tick();
  assert.equal(writes.length, 1);
  assert.equal(store.getSnapshot().board, 'sandstone');
  assert.equal(store.getSnapshot().pieces, 'modern');
  gates[0].resolve(); await a; await tick();
  assert.equal(writes.length, 2);
  gates[1].resolve(); await b; await tick();
  assert.equal(writes.length, 3);
  gates[2].resolve(); await c;
  assert.deepEqual(writes.map(raw => JSON.parse(raw)), [
    { board: 'forest', pieces: 'classic' }, { board: 'forest', pieces: 'modern' }, { board: 'sandstone', pieces: 'modern' },
  ]);
  assert.deepEqual(JSON.parse(saved!), { board: 'sandstone', pieces: 'modern' });
});

test('failed persistence keeps active choice, exposes error, and same-choice retry saves successfully', async () => {
  const { storage, writes } = memoryStorage();
  let fail = true;
  const store = new AppearanceStore({ ...storage, async setItem(key, value) {
    if (fail) throw new Error('disk full');
    await storage.setItem(key, value);
  } });
  await store.update({ pieces: 'club' });
  assert.equal(store.getSnapshot().pieces, 'club');
  assert.match(store.getSnapshot().error!, /could not be saved/i);
  fail = false;
  await store.update({ pieces: 'club' });
  assert.equal(store.getSnapshot().error, null);
  assert.equal(writes.length, 1);
});

test('an earlier failed write cannot overwrite the status of a later successful choice', async () => {
  const first = deferred<void>();
  let count = 0;
  const store = new AppearanceStore({ async getItem() { return null; }, async setItem() {
    if (++count === 1) await first.promise;
  } });
  await store.load();
  const a = store.update({ board: 'forest' });
  const b = store.update({ board: 'slate' });
  await tick();
  first.reject(new Error('first failed'));
  await Promise.all([a, b]);
  assert.equal(count, 2);
  assert.equal(store.getSnapshot().board, 'slate');
  assert.equal(store.getSnapshot().error, null);
});

test('read errors finish hydration with defaults and still permit successful updates', async () => {
  const { storage, writes } = memoryStorage();
  const store = new AppearanceStore({ ...storage, async getItem() { throw new Error('offline'); } });
  await store.load();
  assert.equal(store.getSnapshot().loaded, true);
  assert.equal(store.getSnapshot().board, DEFAULT_APPEARANCE.board);
  assert.match(store.getSnapshot().error!, /could not be loaded/i);
  await store.update({ board: 'forest' });
  assert.equal(store.getSnapshot().error, null);
  assert.equal(writes.length, 1);
});

test('subscribers see hydration and changes, and can unsubscribe independently', async () => {
  const { storage } = memoryStorage();
  const store = new AppearanceStore(storage);
  let a = 0; let b = 0;
  const unsubscribeA = store.subscribe(() => { a++; });
  const unsubscribeB = store.subscribe(() => { b++; });
  await store.load();
  assert.equal(a, 1); assert.equal(b, 1);
  unsubscribeA(); unsubscribeA();
  await store.update({ board: 'slate' });
  assert.equal(a, 1); assert.ok(b > 1);
  unsubscribeB();
  const last = b;
  await store.update({ pieces: 'modern' });
  assert.equal(b, last);
});

test('an immediate change waits for hydration, preserves saved unrelated fields and wins over saved choice', async () => {
  const read = deferred<string | null>();
  const writes: string[] = [];
  const store = new AppearanceStore({ getItem: () => read.promise, async setItem(_key, value) { writes.push(value); } });
  const load = store.load();
  const update = store.update({ board: 'sandstone' });
  await tick();
  assert.equal(writes.length, 0);
  read.resolve('{"board":"forest","pieces":"tournament"}');
  await Promise.all([load, update]);
  assert.deepEqual(store.getSnapshot(), { board: 'sandstone', pieces: 'tournament', loaded: true, error: null });
  assert.deepEqual(JSON.parse(writes[0]), { board: 'sandstone', pieces: 'tournament' });
});

// The renderer uses only this intentionally tiny SVG vocabulary. Validate the
// balanced structure and numeric geometry without loading native UI packages.
function assertSafeSvg(svg: string) {
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="100" height="100" viewBox="0 0 100 100">/);
  assert.doesNotMatch(svg, /(?:href|id|style|on\w+)\s*=|<\s*(?:text|image|script|foreignObject|filter|use|font)\b|url\(|NaN|Infinity|undefined/i);
  assert.doesNotMatch(svg.replace('http://www.w3.org/2000/svg', ''), /https?:|data:|\/\//);
  const stack: string[] = [];
  const tags = svg.match(/<[^>]+>/g)!;
  assert.equal(tags.join(''), svg);
  for (const tag of tags) {
    const name = /^<\/?([a-z]+)/i.exec(tag)![1];
    assert.ok(['svg', 'g', 'path', 'circle'].includes(name));
    if (tag.startsWith('</')) assert.equal(stack.pop(), name);
    else if (!tag.endsWith('/>')) stack.push(name);
    if (name === 'path') assert.match(tag, /d="[Mm][0-9MmLlHhVvCcSsQqTtAaZz.,\s-]+"/);
  }
  assert.equal(stack.length, 0);
}
function geometry(svg: string) { return svg.match(/<(?:path|circle)\b[^>]*>/g)!.join(''); }

test('all 56 artworks are self-contained SVGs; each piece and collection has unique geometry', () => {
  const all = new Set<string>();
  for (const set of sets) {
    const silhouettes = new Set<string>();
    for (const piece of PIECE_ORDER) {
      const white = getPieceSvg(set, piece, 'white');
      const black = getPieceSvg(set, piece, 'black');
      assertSafeSvg(white); assertSafeSvg(black);
      assert.notEqual(white, black);
      assert.equal(geometry(white), geometry(black));
      silhouettes.add(geometry(white));
      all.add(white); all.add(black);
    }
    assert.equal(silhouettes.size, 7);
  }
  assert.equal(all.size, 56);
  for (const piece of PIECE_ORDER) assert.equal(new Set(sets.map(set => geometry(getPieceSvg(set, piece, 'white')))).size, 4);
});

test('exported sprite sheets exactly match the authoritative runtime artwork in both colors', () => {
  for (const set of sets) {
    const sprite = readFileSync(new URL(`../../../assets/chess/${set}-spritesheet.svg`, import.meta.url), 'utf8');
    const expected = ['white', 'black'].flatMap((color, row) => PIECE_ORDER.map((piece, col) =>
      getPieceSvg(set, piece, color as 'white' | 'black').replace(/^<svg[^>]*>/, `<svg x="${col * 100}" y="${row * 100}" width="100" height="100" viewBox="0 0 100 100">`),
    )).join('');
    assert.equal(sprite.trim(), `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="200" viewBox="0 0 700 200">${expected}</svg>`);
  }
});

function palette(svg: string): string[] { return [...new Set(svg.match(/#[0-9a-f]{6}/gi))].sort(); }
function luminance(hex: string): number {
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string): number {
  const x = luminance(a); const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('material collections retain stable saved IDs and distinct palettes and modeled details', () => {
  assert.deepEqual(sets, ['classic', 'club', 'modern', 'tournament']);
  assert.deepEqual(sets.map(id => PIECE_SETS[id].name), ['Classic', 'Carved Wood', 'Forged Metal', 'Royal Lacquer']);
  for (const color of ['white', 'black'] as const) for (const piece of PIECE_ORDER) {
    const classic = getPieceSvg('classic', piece, color);
    assert.ok(palette(classic).length <= 5, 'Classic should retain its restrained, clean palette');
    const palettes = sets.map(set => palette(getPieceSvg(set, piece, color)).join(','));
    assert.equal(new Set(palettes).size, 4, `${piece}/${color}: material palettes must differ`);
    const basePaths = (classic.match(/<path\b/g) ?? []).length;
    for (const set of sets.filter(id => id !== 'classic')) {
      const svg = getPieceSvg(set, piece, color);
      assert.ok(palette(svg).length >= 6, `${set}/${piece}/${color}: expected material shading and accents`);
      assert.ok((svg.match(/<path\b/g) ?? []).length > basePaths, `${set}/${piece}/${color}: expected added modeled details, not just recoloring`);
    }
  }
});

test('both sides have contrasting primary fills and a readable outline against every board square color', () => {
  for (const set of sets) for (const piece of PIECE_ORDER) {
    const white = getPieceSvg(set, piece, 'white');
    const black = getPieceSvg(set, piece, 'black');
    const primary = (svg: string) => /<g fill="(#[0-9a-f]{6})"/.exec(svg)![1];
    assert.ok(contrast(primary(white), primary(black)) >= 3, `${set}/${piece}: distinguish opposing sides`);
    for (const svg of [white, black]) {
      // The double perimeter must retain at least one strong contrasting edge.
      const outlines = [...svg.matchAll(/<g fill="#[0-9a-f]{6}" stroke="(#[0-9a-f]{6})"/g)].slice(0, 2).map(match => match[1]);
      assert.equal(outlines.length, 2);
      for (const board of Object.values(BOARD_THEMES)) for (const square of [board.light, board.dark]) {
        assert.ok(Math.max(...outlines.map(edge => contrast(edge, square))) >= 3, `${set}/${piece} edge against ${board.name} ${square}`);
      }
    }
  }
});

test('all 56 standalone SVG exports exactly match authoritative runtime artwork', () => {
  for (const set of sets) for (const color of ['white', 'black'] as const) for (const piece of PIECE_ORDER) {
    const exported = readFileSync(new URL(`../../../assets/chess/${set}-${color}-${piece}.svg`, import.meta.url), 'utf8');
    assert.equal(exported.trim(), getPieceSvg(set, piece, color), `${set}/${color}/${piece}`);
  }
});
