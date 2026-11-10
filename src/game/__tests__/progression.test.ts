import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyProgressEvent, emptyProgress, levelForXP, MAX_XP, parseProgress, rewardFor, type ProgressEvent } from '../../progression/progression';
import { PROGRESS_KEY, ProgressionStore } from '../../progression/ProgressionStore';
import { availableAppearance, BOARD_ACCESS, canUseCosmetic, PIECE_ACCESS } from '../../progression/cosmetics';
import { NO_ENTITLEMENTS, UnavailablePurchaseService } from '../../services/purchases/billing';
import { PreviewAdService } from '../../services/ads/PreviewAdService';
import { STORAGE_KEYS } from '../../storage/keys';

const game = (id = 'one', extra = {}): ProgressEvent => ({ kind: 'game', id, mode: 'local', status: 'resigned', plyCount: 6, won: false, ...extra });
const puzzle: ProgressEvent = { kind: 'puzzle', date: '2026-11-08' };
function memory(initial?: string) {
  const data = new Map<string, string>(initial ? [[PROGRESS_KEY, initial]] : []);
  const writes: string[] = [];
  return { data, writes, storage: { async getItem(key: string) { return data.get(key) ?? null; }, async setItem(key: string, value: string) { writes.push(value); data.set(key, value); } } };
}

test('practice rewards only finished qualifying games and real calendar dates', () => {
  assert.equal(rewardFor(game())?.xp, 25);
  assert.equal(rewardFor(game('win', { mode: 'computer', won: true }))?.xp, 50);
  assert.equal(rewardFor(game('loss', { mode: 'computer', won: false }))?.xp, 25);
  assert.equal(rewardFor(puzzle)?.xp, 30);
  for (const extra of [{ status: 'active' }, { status: 'fake' }, { plyCount: 5 }, { plyCount: NaN }, { mode: 'multiplayer' }, { id: '' }]) assert.equal(rewardFor(game('bad', extra)), null);
  for (const date of ['2026-02-30', '2026-13-01', 'bad', '2026-1-02']) assert.equal(rewardFor({ kind: 'puzzle', date }), null);
});

test('levels have exact boundaries and capped XP without over-awarding', () => {
  assert.equal(levelForXP(0), 1); assert.equal(levelForXP(99), 1); assert.equal(levelForXP(100), 2);
  assert.equal(levelForXP(200), 3); assert.equal(levelForXP(MAX_XP), 20);
  assert.equal(levelForXP(-50), 1); assert.equal(levelForXP(NaN), 1);
  const result = applyProgressEvent({ version: 1, xp: MAX_XP - 10, receipts: [] }, game());
  assert.equal(result.awarded, 10); assert.equal(result.progress.xp, MAX_XP);
  assert.equal(applyProgressEvent(result.progress, game('two')).awarded, 0);
});

test('one receipt prevents repeat result awards and puzzle XP is once per date', () => {
  let progress = emptyProgress();
  for (const event of [game(), game(), puzzle, puzzle]) progress = applyProgressEvent(progress, event).progress;
  assert.equal(progress.xp, 55); assert.equal(progress.receipts.length, 2);
  assert.equal(applyProgressEvent(progress, { kind: 'puzzle', date: '2026-11-09' }).awarded, 30);
});

test('storage parser rejects malformed, future and unsafe numeric records', () => {
  assert.deepEqual(parseProgress(null), emptyProgress());
  for (const raw of ['', 'null', '[]', '{}', 'bad', '{"version":2,"xp":0,"receipts":[]}', '{"version":1,"xp":-1,"receipts":[]}', '{"version":1,"xp":5.5,"receipts":[]}', '{"version":1,"xp":0,"receipts":[42]}']) assert.throws(() => parseProgress(raw));
  assert.deepEqual(parseProgress('{"version":1,"xp":30,"receipts":["puzzle:2026-11-08","puzzle:2026-11-08"]}').receipts, ['puzzle:2026-11-08']);
});

test('simultaneous records serialize reads and writes, dedupe, and survive a restart', async () => {
  const { storage, writes } = memory(); const store = new ProgressionStore(storage);
  const results = await Promise.all([store.record(game()), store.record(game()), store.record(puzzle)]);
  assert.deepEqual(results.map(r => r.awarded), [25, 0, 30]);
  assert.equal(writes.length, 2); assert.equal(store.getSnapshot().xp, 55);
  const restored = new ProgressionStore(storage); await restored.ensureLoaded();
  assert.equal(restored.getSnapshot().xp, 55);
  assert.equal((await restored.record(puzzle)).awarded, 0);
});

test('hydration finishes before awarding and preserves existing progress', async () => {
  let release!: (value: string) => void;
  const read = new Promise<string>(resolve => { release = resolve; });
  const saved: string[] = [];
  const store = new ProgressionStore({ getItem: () => read, async setItem(_key, value) { saved.push(value); } });
  const pending = store.record(game());
  release(JSON.stringify({ version: 1, xp: 100, receipts: [] }));
  await pending;
  assert.equal(store.getSnapshot().xp, 125); assert.equal(store.getSnapshot().level, 2);
  assert.equal(JSON.parse(saved[0]).xp, 125);
});

test('failed writes do not grant XP or consume receipts, retry settles once', async () => {
  const { storage } = memory(); let fail = true;
  const store = new ProgressionStore({ ...storage, async setItem(key, value) { if (fail) throw Error('full'); await storage.setItem(key, value); } });
  assert.equal((await store.record(puzzle)).saved, false); assert.equal(store.getSnapshot().xp, 0);
  assert.match(store.getSnapshot().error!, /could not be saved/);
  fail = false;
  assert.equal((await store.record(puzzle)).awarded, 30); assert.equal(store.getSnapshot().error, null);
  assert.equal((await store.record(puzzle)).awarded, 0);
});

test('failed or corrupt reads never overwrite data and allow later recovery', async () => {
  const { storage, writes, data } = memory('bad'); const store = new ProgressionStore(storage);
  await store.record(game()); assert.equal(writes.length, 0); assert.match(store.getSnapshot().error!, /not been replaced/);
  data.set(PROGRESS_KEY, JSON.stringify({ version: 1, xp: 100, receipts: [] }));
  assert.equal((await store.record(game())).awarded, 25); assert.equal(store.getSnapshot().xp, 125);
});

test('progress subscribers receive stable snapshots and can unsubscribe', async () => {
  const { storage } = memory(); const store = new ProgressionStore(storage); let calls = 0;
  const unsubscribe = store.subscribe(() => { calls++; });
  const first = store.getSnapshot(); assert.equal(store.getSnapshot(), first);
  await store.ensureLoaded(); await store.record(game()); assert.equal(calls, 2);
  unsubscribe(); await store.record(puzzle); assert.equal(calls, 2);
});

test('earned cosmetic gates are explicit and premium stays closed at every level', () => {
  assert.equal(canUseCosmetic(BOARD_ACCESS.walnut, 1, NO_ENTITLEMENTS), true);
  assert.equal(canUseCosmetic(BOARD_ACCESS.forest, 1, NO_ENTITLEMENTS), false);
  assert.equal(canUseCosmetic(BOARD_ACCESS.forest, 2, NO_ENTITLEMENTS), true);
  assert.equal(canUseCosmetic(PIECE_ACCESS.club, 2, NO_ENTITLEMENTS), false);
  assert.equal(canUseCosmetic(PIECE_ACCESS.club, 3, NO_ENTITLEMENTS), true);
  for (const id of ['modern', 'tournament'] as const) {
    assert.equal(canUseCosmetic(PIECE_ACCESS[id], 20, NO_ENTITLEMENTS), false);
    assert.equal(canUseCosmetic(PIECE_ACCESS[id], 20, { ...NO_ENTITLEMENTS, premiumPieceSets: [id] }), false);
  }
});

test('legacy saved premium/locked appearance cannot bypass renderer access', () => {
  assert.deepEqual(availableAppearance({ board: 'slate', pieces: 'tournament' }, 1, NO_ENTITLEMENTS), { board: 'walnut', pieces: 'classic' });
  assert.deepEqual(availableAppearance({ board: 'forest', pieces: 'club' }, 3, NO_ENTITLEMENTS), { board: 'forest', pieces: 'club' });
});

test('billing adapter neither fabricates purchases nor restores local flags', async () => {
  const billing = new UnavailablePurchaseService();
  assert.equal(billing.available, false); assert.deepEqual(await billing.getEntitlements(), NO_ENTITLEMENTS);
  await assert.rejects(billing.purchaseRemoveAds(), /Nothing has been charged or unlocked/);
  await assert.rejects(billing.purchasePieceSet('modern'), /Nothing has been charged or unlocked/);
  await assert.rejects(billing.restorePurchases(), /No purchases were restored/);
  assert.deepEqual(await billing.getEntitlements(), NO_ENTITLEMENTS);
});

test('ads default to no automatic placeholders and never claim rewarded completion', async () => {
  const { storage, data } = memory(); data.set(STORAGE_KEYS.adsRemoved, 'true');
  const ads = new PreviewAdService(storage, async () => NO_ENTITLEMENTS); const events: string[] = [];
  ads.subscribe(reason => events.push(reason));
  assert.equal(await ads.isAdsRemoved(), false, 'ignore old mock purchase flag');
  assert.deepEqual(await Promise.all([ads.recordCompletedGame(), ads.recordCompletedGame(), ads.recordCompletedGame()]), [false, false, false]);
  assert.equal(await ads.showRewardedAd('manual_test'), false); assert.deepEqual(events, []);
  assert.equal(await ads.maybeShowInterstitial('manual_test'), true); assert.deepEqual(events, ['manual_test']);
});

test('optional development placement cadence serializes rapid completions', async () => {
  const { storage } = memory(); const ads = new PreviewAdService(storage, async () => NO_ENTITLEMENTS, true); let count = 0;
  ads.subscribe(() => { count++; });
  const results = await Promise.all(Array.from({ length: 6 }, () => ads.recordCompletedGame()));
  assert.deepEqual(results, [false, false, true, false, false, true]); assert.equal(count, 2);
});

test('ad storage failure and missing listeners never block gameplay', async () => {
  const { storage } = memory(); const ads = new PreviewAdService({ ...storage, async setItem() { throw Error('full'); } }, async () => NO_ENTITLEMENTS, true);
  assert.equal(await ads.recordCompletedGame(), false);
  assert.equal(await ads.maybeShowInterstitial('manual_test'), false);
});

test('Android on-device fallback only trusts completed purchases of our products for this app', async () => {
  const { trustedDeviceGrant } = await import('../../services/purchases/billing');
  assert.deepEqual(trustedDeviceGrant({ productId: 'remove_ads', purchaseState: 'purchased', packageNameAndroid: 'com.chainsoftwaregroup.shiftchess' }), { adsRemoved: true, premiumPieceSets: [] });
  assert.deepEqual(trustedDeviceGrant({ productId: 'pieces_royal_lacquer', purchaseState: 'purchased' }), { adsRemoved: false, premiumPieceSets: ['tournament'] });
  assert.equal(trustedDeviceGrant({ productId: 'remove_ads', purchaseState: 'pending' }), null);
  assert.equal(trustedDeviceGrant({ productId: 'free_gold', purchaseState: 'purchased' }), null);
  assert.equal(trustedDeviceGrant({ productId: 'remove_ads', purchaseState: 'purchased', packageNameAndroid: 'com.other.app' }), null);
});

test('the Everything Pack unlocks ads removal and both premium piece sets', async () => {
  const { grantsFor, isProductId } = await import('../../services/purchases/products');
  assert.equal(isProductId('bundle_everything'), true);
  assert.deepEqual(grantsFor(['bundle_everything']), { adsRemoved: true, premiumPieceSets: ['modern', 'tournament'] });
  assert.deepEqual(grantsFor(['pieces_forged_metal']), { adsRemoved: false, premiumPieceSets: ['modern'] });
});
