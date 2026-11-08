# ShiftChess Expo

ShiftChess is an Expo React Native / TypeScript mobile app for a 10×8 chess variant with a Lancer piece (internal notation `S`). It is structured so local play remains offline and pure game rules stay separate from UI, ads, auth, purchases, and multiplayer.

## Run with Expo Go

```bash
npm install
npm start
```

Scan the QR code with Expo Go, or run `npm run web` to try it in a browser. The app intentionally avoids native-only AdMob and IAP packages so it can run in Expo Go.

## Testing

```bash
npm run typecheck   # tsc --noEmit over the app and the test suite
npm test            # Node's test runner with the tsx loader
npm run check       # type checks and behavior tests
```

The test suites (`src/game/__tests__` and `src/online/__tests__`) cover check/checkmate/stalemate detection, castling, en passant, promotion, the 50-move rule, threefold repetition, insufficient material, pawn attack geometry, repetition identity, Shifter mating material, promotion choices, opponent ownership and cancellation, deterministic computer play, pins, daily-puzzle generation, the password hashing helper, and the Elo rating math — all pure functions with no React Native dependency, so they run under plain Node.

## Implemented Screens

- Welcome: logo/name, login, register, continue as guest.
- Login/Register: local mock account flows with email format and password length validation.
- Home: current rating, Daily Puzzle, local pass-and-play, Easy/Medium/Hard computer games, Multiplayer, Rules, Settings.
- Daily Puzzle: procedurally generates and stores today's and tomorrow's puzzles from a rotating set of tactical templates (knight fork, both Lancer capture styles, back-rank mate-in-one), rotates them by local date, tags each with a difficulty, and remembers completion.
- Multiplayer: one free human 3+2 queue on a configured playtest server. No computer fallback, purchase check, or paid priority. A missing server is shown honestly rather than simulating an opponent.
- Online Game: server-confirmed board and clocks, assigned-color ownership and orientation, move history, promotion, cancellation/reconnection handling, and confirmed resignation. Currently unrated temporary guests.
- Rating: existing local demo Elo display from 0–3500. Real online games never write demo ratings.
- Local Game: 10×8 board, turn/check indicator, clocks, captured pieces/material advantage, move history, promotion picker, resign, and local reset.
- Settings: four board palettes and four complete piece collections with persistent local preferences, device-local practice XP/levels, earned cosmetic locks, premium previews, unavailable billing controls, an ad-placement preview, sound toggle (wired to real Web Audio beeps on web), account status, logout.
- Rules: 10×8 setup, Lancer movement, castling/en passant/promotion, and how games end.

## Board and piece collections

Open **Settings** to mix four boards (Walnut, Forest, Slate, Sandstone) with four original piece sets (Classic, Carved Wood, Forged Metal, Royal Lacquer). The Classic set keeps ivory/charcoal Staunton styling; Carved Wood uses maple/walnut grain and carved details; Forged Metal uses silver/gunmetal facets; Royal Lacquer uses ivory/royal blue with gold inlay. Each set includes both colors of King, Queen, Rook, Bishop, Knight, Pawn, and the spearhead **Lancer**. The starter look is Walnut + Classic. Forest unlocks at practice level 2, Carved Wood at level 3, Sandstone at level 4, and Slate at level 6. Forged Metal and Royal Lacquer are premium previews and cannot be equipped until real store billing and verified entitlements exist. Existing artwork is retained; these two premium collections use the richer sculpted metal and lacquer/gold treatments. Unlocked preferences apply immediately and are saved locally on this device/browser; storage problems are shown in Settings with a retry instruction. Unknown or corrupt saved values fall back safely.

A shared vector renderer covers the main board, daily puzzles, captured pieces, promotion picker, settings previews and welcome screen. SVG artwork is bundled in the app, has no network or font dependency, and scales without bitmap blur. Settings can scroll on small screens, selections have accessible labels and checked state, squares have names/selection state and keyboard focus, and promotion choices wrap instead of overflowing narrow screens.

The Lancer is the former Shifter, with the same legal moves and material value. The internal `S` key, saved puzzles, move notation and rules engine remain compatible; the display name/artwork is Lancer. Old cached puzzle copy is displayed with the new name.

Editable individual SVGs and 7 × 2 SVG sprite sheets are in [`assets/chess`](assets/chess/README.md). `src/appearance/pieceArtwork.ts` is authoritative. Regenerate exports using `node --import tsx scripts/export-chess-artwork.ts`, then render the preview with Inkscape if desired. [`appearance-preview.png`](assets/chess/appearance-preview.png) shows the four paired looks, not a running-app screenshot.

Appearance tests cover all 56 variants, source-export parity, storage fallback, hydration, rapid selection, ordered writes, errors/retry and persistence across store restarts. Run `npm run check` and `EXPO_NO_TELEMETRY=1 CI=1 npx expo export --platform web --clear`. Native device, screen-reader and interactive viewport QA are still required before release.

## Game Rules

- Board: 10 columns × 8 rows.
- Back rank: `R N S B Q K B S N R`.
- Pawn rank: 10 pawns per side.
- The Lancer (`S`) can move like a bishop diagonally any distance without jumping.
- The Lancer can also move exactly one square orthogonally up/down/left/right.
- Captures are allowed on both Lancer movement types.
- Full move legality: pins, check, checkmate, stalemate, castling (king + unmoved rook, empty and unattacked squares between/through), en passant, and pawn promotion to Queen, Rook, Bishop, Knight, or Lancer.
- Draws: stalemate, the 50-move rule, threefold repetition, and insufficient material (bare kings, a single ordinary bishop or knight against a bare king, or only bishops all on the same square color) are all detected automatically.
- A Lancer is mating material and never triggers the insufficient-material rule. Repetition includes the initial position, side to move, castling rights, and only legally usable en passant rights.
- Resignation and clock timeout are also implemented; the clock stops ticking once the game is over.

Pure rules live in `/src/game`:

- `board.ts` — board shape, initial setup, algebraic notation helpers.
- `pieces.ts` — piece/move types, symbols, names, and material values.
- `shifter.ts` — the Lancer's bishop + one-square-orthogonal movement.
- `applyRaw.ts` — unconditional move application (castling rook hop, en passant capture, promotion) shared by legality checking and real move application.
- `legalMoves.ts` — pseudo-legal move generation, check detection, castling eligibility, and full legality filtering.
- `moveValidation.ts` — validates a requested move and reports what happened (capture, en passant, castle, new en passant target).
- `gameState.ts` — turn order, move history, and all game-ending conditions (checkmate, stalemate, draws, resignation, timeout).
- `timers.ts` — clock state and time controls.
- `rating.ts` — the Elo-style rating formula.

## Local computer opponents

Easy, Medium, and Hard are deterministic local opponents, adapted from PR #4 to the current rules engine. They use the same legal moves and game-state transitions as human play, including castling, en passant, all five promotions, and draws. Difficulty labels describe search strategies, not calibrated Elo ratings. Computer games are local and do not affect ratings.

## Expo Go Mocked Features

### Practice progression and cosmetic access

`src/progression` contains the pure reward rules, a serializing persistence store, and cosmetic-access policy. Practice levels start at 1, advance each 100 XP, and cap at 20. A completed local/pass-and-play or computer game with at least six plies awards 25 XP; a computer win adds 25 XP. A solved daily puzzle awards 30 XP once per puzzle date. Instant resignation, unfinished games, the legacy mock multiplayer fixture and online play do not award XP. These initial progression values are local playtest tuning, not a finalized economy.

Home and Settings display the level and progress. Results are deduplicated by a stable game-screen/session ID or puzzle date. One write queue serializes duplicate checks and writes. XP and unlocks become visible only after persistence succeeds. Failed writes can be retried on the result screen; puzzle XP also recovers when reopening an already-solved puzzle. A failed/corrupt read never overwrites the stored record. There is no cross-device/account sync, cross-tab transactional safety, tamper resistance, or server award authority. This is explicitly device-local practice progress shared by local profiles, not a secure currency, rating or purchase record.

Both the Settings selector and runtime appearance resolver apply access policy. Legacy saved premium/locked selections fall back to Walnut/Classic without deleting the saved preference. Reaching a high practice level or editing old purchase flags never grants premium ownership. Tests cover reward boundaries, cap, duplicate/replayed results, concurrent writes, hydration, retry, corruption and access fallback.

### Ads

`src/services/ads/PreviewAdService.ts` is placement groundwork only. No ad SDK, ad request, impression, revenue or rewarded unlock is implemented. Normal builds show no automatic placeholder ads. Settings offers an explicit **Preview ad placement** button; the modal labels itself as a local test. Close and Android Back dismiss it.

For local placement QA only, build with `EXPO_PUBLIC_AD_PREVIEW=true` to show this clearly marked preview after every third completed local game. The cadence writes are serialized; storage failure never blocks gameplay. No calls are made during active play. Rewarded-ad methods always return false, so a fake preview cannot claim a completed reward. Online-game ads are not wired until durable result settlement exists.

Production integration still needs a supported native ad SDK, consent/age/privacy flows, real load/show callbacks, failure handling, and verified ad-removal entitlements. Neither ads nor paid extras may gate online entry.

### Purchases

`src/services/purchases/PurchaseService.ts` now fails closed. Remove Ads, premium purchase, and restore methods cannot simulate a purchase. Settings clearly disables these actions until billing exists, with no invented prices. The old `shiftchess.adsRemoved=true` mock flag is ignored and never becomes paid ownership.

Before accepting payment, integrate supported store billing plus server-verified receipts and durable entitlement storage, product IDs/prices, restore/refund/revocation handling, and account linking. `NO_ENTITLEMENTS` is deliberately the only runtime entitlement source in this build; replace that boundary with the verified adapter when it is ready. Paid offerings are optional ad removal and cosmetic extras only, with no paid game advantages or online-play gate.

### Sound

`/src/services/sound/SoundService.ts` respects the Settings sound toggle. On web it synthesizes short move/capture/check/game-over beeps with the Web Audio API, so the toggle is meaningfully testable without shipping audio assets. On native it's currently a no-op placeholder — plug a real SDK (e.g. `expo-audio`) into `play()` for EAS/native builds without touching game logic.

### Auth

`/src/services/auth/AuthService.ts` provides local AsyncStorage mock auth. Passwords are never stored in plaintext — they're salted and hashed with a small dependency-free SHA-256 (`/src/services/auth/hash.ts`) before being written to storage. Register validates the email format and a minimum password length; login validates the hash locally; guest mode creates a guest profile. Local play is available to guests.

The interface is ready to be replaced by backend/JWT auth later (with server-side hashing such as bcrypt/argon2).

### Real online human playtest

The app now uses `src/online/OnlineClient.ts` and a separate `OnlineGameScreen` for real network games. The prior mock multiplayer service remains only as an isolated demo/test fixture; the online lobby never calls it.

Run two terminals:

```bash
# Terminal 1: in-memory authority and HTTP transport, loopback only by default
npm run online:server

# Terminal 2: Expo web app pointed at that server
EXPO_PUBLIC_ONLINE_URL=http://127.0.0.1:8787 npm run web
```

Open `http://localhost:8081` in two separate browser contexts (for example, regular and private windows). Continue as Guest in each, choose **Online 3+2**, and **Find a free 3+2 game**. Both must use the same server. With only one player, the queue waits for another player; it never substitutes a bot. For a configured static web build, set the same environment variable when running `npx expo export --platform web` and serve `dist` on an allowed browser origin. The environment variable is build-time configuration, not a secret.

For a native phone on a trusted LAN, follow [`server/README.md`](server/README.md), explicitly bind the development server to the LAN, and use its private LAN IP in an Expo development build. Public plaintext endpoints are rejected. A public service requires HTTPS, proper hosting and the production work below. This repository does **not** deploy or provision a public server.

Safeguards implemented:

- Server-issued temporary guest identities with unpredictable bearer tokens, unrelated to local mock accounts. Credentials remain only in memory and never go in URLs/logs.
- A single FIFO 3+2 queue, no entitlements or purchases, and two different server identities per match. This is not proof of human identity or an anti-cheat system.
- Server owns legal moves, turn ownership, clock debit, +2-second increment and terminal results. It rejects forged board/clock/identity fields, unsafe coordinates, stale revisions, wrong-turn moves and outsiders.
- Request IDs make accepted moves/resignations safe to retry. Dropped acknowledgements are retried with the same ID, never applied twice. The client never optimistically changes the board or declares a timeout.
- Cancellation handles a join already in flight. If a pairing beats cancellation, the match stays resumable. Queue leases expire after 30 seconds without renewal. A lost join acknowledgement recovered after expiry is reconciled to the server’s current state, without silently starting another search. A disconnected game continues on server time and ends on timeout.
- Exact-origin browser CORS, JSON/body limits, independent authenticated-session request budgets, bounded anonymous/shared-IP traffic, connection limits and hard authority capacity limits. See the server README for operational bounds.
- Opponent snapshots are polled every 750 ms while searching/playing. This is HTTP polling, not WebSockets. Client clock interpolation is display-only.

Limitations before public release:

- Everything is single-process, in-memory and unrated. Restarting the server loses sessions and games. Reloading/closing the app loses its guest credential; leaving a screen does not. Guest credentials expire after 24 hours. An already active match receives bounded same-match-only grace, capped at two hours after that expiry with up to 60 seconds to read/retry its final result; this never permits a new queue.
- No verified accounts, durable match/recovery storage, rating settlement, engine-cheat detection, production abuse controls, TLS termination, multi-instance ownership or public hosting. Tombstones/receipts are hard-capped rather than evicted unsafely.
- Production ads and cosmetic purchases remain separate future integrations. Neither may gate online entry. Online result settlement and ad cadence need persistent result IDs before reconnect-safe monetization is wired.
- Native-device/network-interruption/accessibility testing is still required before release.

### Ratings

The existing Elo service is local demonstration data only, starts at 1200 and is bounded to 0–3500. Local play and the real guest online playtest do not affect it. A production rating system requires transactional server-side result settlement, authenticated players and persistent storage.

## Time Controls

- Online Blitz 3+2: 3 minutes per player, +2 seconds after each accepted move. The only real online queue.
- Local Blitz 3+0: 3 minutes per player, no increment.
- Legacy/demo Bullet 1+1: 1 minute per player, +1 second after each move.
- Legacy/demo Rapid 10+0: 10 minutes per player, no increment.
