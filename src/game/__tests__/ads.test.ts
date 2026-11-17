import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdMobAdService, AdPlatform, GAMES_BETWEEN_ADS } from '../../services/ads/AdMobAdService';
import type { Entitlements } from '../../services/purchases/billing';

const NONE: Entitlements = { adsRemoved: false, premiumPieceSets: [], source: 'verified' };
type Listener = (error?: unknown) => void;

function fakeGma(options: { gather?: () => Promise<{ canRequestAds: boolean }>; info?: () => Promise<{ canRequestAds: boolean }>; fill?: () => boolean } = {}) {
  const log: string[] = [];
  let initialized = 0;
  const gma = {
    TestIds: { INTERSTITIAL: 'test-unit' },
    AdEventType: { LOADED: 'loaded', CLOSED: 'closed', ERROR: 'error' },
    AdsConsent: {
      gatherConsent: options.gather ?? (async () => ({ canRequestAds: true })),
      getConsentInfo: options.info ?? (async () => ({ canRequestAds: false })),
    },
    default: () => ({ initialize: async () => { initialized++; log.push('initialize'); } }),
    InterstitialAd: {
      createForAdRequest(unit: string, request: { requestNonPersonalizedAdsOnly: boolean }) {
        const listeners: Record<string, Listener> = {};
        log.push(`create ${unit} np=${request.requestNonPersonalizedAdsOnly}`);
        return {
          addAdEventListener(type: string, listener: Listener) { listeners[type] = listener; },
          load() { (options.fill?.() ?? true) ? listeners.loaded() : listeners.error(new Error('No fill')); },
          async show() { log.push('show'); },
        };
      },
    },
  };
  return { gma: gma as never, log, initialized: () => initialized };
}

function memory() {
  const data = new Map<string, string>();
  return { getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => { data.set(k, v); } };
}

function platform(overrides: Partial<AdPlatform> = {}): AdPlatform & { order: string[] } {
  const order: string[] = [];
  return {
    os: 'ios', unitId: 'live-unit', development: false, order,
    whenActive: async () => { order.push('active'); },
    requestTracking: async () => { order.push('tracking'); return false; },
    setTimer: (callback: () => void) => { callback(); },
    ...overrides,
  };
}

const finishGames = async (ads: AdMobAdService, count: number) => {
  const shown: boolean[] = [];
  for (let i = 0; i < count; i++) shown.push(await ads.recordCompletedGame());
  return shown;
};

test('iOS waits for the foreground, asks consent and tracking, then shows a live ad every third game', async () => {
  const { gma, log } = fakeGma();
  const p = platform();
  const ads = new AdMobAdService(gma, memory(), async () => NONE, p);
  await ads.initAds();
  assert.deepEqual(p.order, ['active', 'tracking']);
  assert.ok(log.includes('create live-unit np=true'), 'declined tracking still gets non-personalized live ads');
  assert.deepEqual(await finishGames(ads, GAMES_BETWEEN_ADS * 2), [false, false, true, false, false, true]);
  assert.equal(log.filter(entry => entry === 'show').length, 2);
});

test('a failed start at launch is retried instead of switching ads off for the session', async () => {
  let online = false;
  const { gma, log } = fakeGma({ gather: async () => { if (!online) throw new Error('offline'); return { canRequestAds: true }; } });
  const ads = new AdMobAdService(gma, memory(), async () => NONE, platform());
  await ads.initAds();
  assert.ok(!log.includes('initialize'));
  online = true;
  assert.deepEqual(await finishGames(ads, GAMES_BETWEEN_ADS), [false, false, true]);
});

test('if the consent form errors, earlier consent still allows ads', async () => {
  const { gma } = fakeGma({ gather: async () => { throw new Error('form unavailable'); }, info: async () => ({ canRequestAds: true }) });
  const ads = new AdMobAdService(gma, memory(), async () => NONE, platform());
  await ads.initAds();
  assert.equal(await ads.maybeShowInterstitial('manual_test'), true);
});

test('no consent means no ad request at all', async () => {
  const { gma, log } = fakeGma({ gather: async () => ({ canRequestAds: false }) });
  const ads = new AdMobAdService(gma, memory(), async () => NONE, platform());
  await ads.initAds();
  assert.equal(await ads.maybeShowInterstitial('manual_test'), false);
  assert.equal(log.length, 0);
});

test('an empty ad slot is refilled, so the next game end can show an ad', async () => {
  let fill = false;
  const { gma } = fakeGma({ fill: () => fill });
  const ads = new AdMobAdService(gma, memory(), async () => NONE, platform({ setTimer: () => undefined }));
  await ads.initAds();
  assert.equal(await ads.maybeShowInterstitial('manual_test'), false);
  fill = true;
  assert.equal(await ads.maybeShowInterstitial('manual_test'), false, 'this call starts a fresh load');
  assert.equal(await ads.maybeShowInterstitial('manual_test'), true);
});

test('Remove Ads skips consent, tracking and every ad request', async () => {
  const { gma, log } = fakeGma();
  const p = platform();
  const ads = new AdMobAdService(gma, memory(), async (): Promise<Entitlements> => ({ adsRemoved: true, premiumPieceSets: [], source: 'verified' }), p);
  await ads.initAds();
  assert.deepEqual(await finishGames(ads, GAMES_BETWEEN_ADS), [false, false, false]);
  assert.deepEqual(p.order, []);
  assert.equal(log.length, 0);
});

test('development builds always use Google test ads', async () => {
  const { gma, log } = fakeGma();
  const ads = new AdMobAdService(gma, memory(), async () => NONE, platform({ development: true }));
  await ads.initAds();
  assert.ok(log.some(entry => entry.startsWith('create test-unit')));
});
