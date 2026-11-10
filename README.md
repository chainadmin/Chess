# ShiftChess Expo

ShiftChess is an Expo React Native / TypeScript mobile app for a 10×8 chess variant with a Lancer piece (internal notation `S`). It is structured so local play remains offline and pure game rules stay separate from UI, ads, auth, purchases, and multiplayer.

> **Going live?** Follow [docs/LAUNCH.md](docs/LAUNCH.md): Railway servers, App Store build, in-app purchases, AdMob and privacy.

## Run with Expo Go

```bash
npm install
npm start
```

Scan the QR code with Expo Go, or run `npm run web` to try it in a browser. AdMob and in-app purchases are native modules: they are skipped in Expo Go and on the web, and work in EAS development, TestFlight and store builds.

## Testing

```bash
npm run typecheck   # tsc --noEmit over the app and the test suite
npm test            # Node's test runner with the tsx loader
npm run check       # type checks and behavior tests
```

The test suites (`src/game/__tests__` and `src/online/__tests__`) cover check/checkmate/stalemate detection, castling, en passant, promotion, the 50-move rule, threefold repetition, insufficient material, pawn attack geometry, repetition identity, Shifter mating material, promotion choices, opponent ownership and cancellation, deterministic computer play, pins, daily-puzzle generation, the password hashing helper, and the Elo rating math — all pure functions with no React Native dependency, so they run under plain Node.

## Implemented Screens

- Welcome: logo/name, login, register, continue as guest.
- Login/Register: username + password accounts on the ShiftChess accounts server, with a privacy policy link.
- Home: current rating, Daily Puzzle, local pass-and-play, Easy/Medium/Hard computer games, Multiplayer, Rules, Settings.
- Daily Puzzle: procedurally generates and stores today's and tomorrow's puzzles from a rotating set of tactical templates (knight fork, both Lancer capture styles, back-rank mate-in-one), rotates them by local date, tags each with a difficulty, and remembers completion.
- Multiplayer: one free, rated human 3+2 queue. Guests are asked to create a free account. No computer fallback, purchase check, or paid priority.
- Online Game: server-confirmed board and clocks, assigned-color ownership and orientation, move history, promotion, cancellation/reconnection handling, and confirmed resignation. Rated; results are saved to the player's account.
- Rating & Leaderboard: online Elo rating (0–3500, starting at 1200) on Home, and a top-50 leaderboard.
- Local Game: 10×8 board, turn/check indicator, clocks, captured pieces/material advantage, move history, promotion picker, resign, and local reset.
- Settings: four board palettes and four complete piece collections with persistent local preferences, device-local practice XP/levels, earned cosmetic locks, premium previews, real Remove Ads / premium piece purchases and Restore, sound toggle (wired to real Web Audio beeps on web), account status, logout, account deletion, privacy policy.
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

### Ads (Google AdMob)

`src/services/ads/AdMobAdService.ts` shows an AdMob interstitial after every third finished local game, never during play or online games. Before any ad request it gathers Google UMP consent and, on iPhone, asks for App Tracking Transparency permission; players who decline still get non-personalized ads. Buying **Remove Ads** turns ads off entirely. Development builds and builds without configured ad unit IDs use Google's test ads. In Expo Go and on the web, the native SDK is missing and the app falls back to the old labelled placeholder (`PreviewAdService`).

### In-app purchases

`src/services/purchases/PurchaseService.ts` uses `expo-iap` (StoreKit 2 / Google Play Billing) for three non-consumables: `remove_ads`, `pieces_forged_metal` and `pieces_royal_lacquer` (`src/services/purchases/products.ts`). Every purchase is verified by the accounts server before it unlocks: offline JWS chain verification for Apple, the Play Developer API for Google. The transaction is only finished after verification. Guests can buy and restore on their device; signed-in purchases are also stored on the account. Web and Expo Go fail closed.

### Accounts

Players create an account with a **username and password** on the accounts server (`server/api`). Passwords are hashed with scrypt; sign-in tokens are random 256-bit values, stored hashed on the server and in the iOS Keychain / Android Keystore on the device (`expo-secure-store`). Settings offers log out, account deletion (required by the App Store) and a link to the privacy policy. Guests can still play everything offline. Online play requires an account.

### Online play and ratings

One Railway service (`server/main.ts`) with a Postgres database runs everything on one address:

- **Accounts** (`server/api`): register/login/logout, `/me`, leaderboard, purchase verification, password resets (Postmark email link or recovery code), account deletion, and the public `/privacy`, `/account-deletion` and `/reset-password` pages.
- **Online games** (`server/httpServer.ts`, `POST /command`): matchmaking and live 3+2 games. It verifies account tokens (cached for a minute so play never waits on the database), long-polls so opponents' moves arrive immediately, and settles each finished game into Elo ratings in one transaction.

The server owns legal moves, clocks and results; the earlier safeguards (request IDs, stale-revision checks, rate limits, exact-origin CORS, capacity limits) still apply. Behind Railway's proxy, rate limits use the client address the proxy forwards (`TRUST_PROXY_HOPS=1`).

**See [docs/LAUNCH.md](docs/LAUNCH.md)** for deploying to Railway, App Store setup, product IDs, AdMob and the App Privacy answers.

## Time Controls

- Online Blitz 3+2: 3 minutes per player, +2 seconds after each accepted move. The only online queue; rated.
- Local Blitz 3+0: 3 minutes per player, no increment.
- Legacy/demo Bullet 1+1: 1 minute per player, +1 second after each move.
- Legacy/demo Rapid 10+0: 10 minutes per player, no increment.
