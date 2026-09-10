# ShiftChess Expo

ShiftChess is an Expo React Native / TypeScript mobile app for a 10×8 chess variant with a Shifter piece. It is structured so local play remains offline and pure game rules stay separate from UI, ads, auth, purchases, and multiplayer.

## Run with Expo Go

```bash
npm install
npm start
```

Scan the QR code with Expo Go, or run `npm run web` to try it in a browser. The app intentionally avoids native-only AdMob and IAP packages so it can run in Expo Go.

## Testing

```bash
npm run typecheck   # tsc --noEmit over the app and the test suite
npm test            # node's test runner (via tsx) over the pure game logic
```

The test suite (`src/game/__tests__`) covers check/checkmate/stalemate detection, castling, en passant, promotion, the 50-move rule, threefold repetition, insufficient material, pins, daily-puzzle generation, the password hashing helper, and the Elo rating math — all pure functions with no React Native dependency, so they run under plain Node.

## Implemented Screens

- Welcome: logo/name, login, register, continue as guest.
- Login/Register: local mock account flows with email format and password length validation.
- Home: current rating, Daily Puzzle, Play Local, Multiplayer, Rules, Settings.
- Daily Puzzle: procedurally generates and stores today's and tomorrow's puzzles from a rotating set of tactical templates (knight fork, both Shifter capture styles, back-rank mate-in-one), rotates them by local date, tags each with a difficulty, and remembers completion.
- Multiplayer: mobile-first rated matchmaking for Blitz 3+0, Bullet 1+1, and Rapid 10+0, including a cancellable queue, an expanding rating range, and a mock opponent that actually replies with legal moves.
- Rating: persistent Elo-style multiplayer ratings from 0–3500, with a 1200 starting rating and rating-based matchmaking.
- Game: 10×8 board, local or mock-online mode, turn/check indicator, clocks that stop when the game ends, captured pieces with a material-advantage indicator, move history, a promotion piece picker, resign, and local reset.
- Settings: remove ads mock purchase, restore purchases, sound toggle (wired to real Web Audio beeps on web), account status, logout.
- Rules: 10×8 setup, Shifter movement, castling/en passant/promotion, and how games end.

## Game Rules

- Board: 10 columns × 8 rows.
- Back rank: `R N S B Q K B S N R`.
- Pawn rank: 10 pawns per side.
- The Shifter (`S`) can move like a bishop diagonally any distance without jumping.
- The Shifter can also move exactly one square orthogonally up/down/left/right.
- Captures are allowed on both Shifter movement types.
- Full move legality: pins, check, checkmate, stalemate, castling (king + unmoved rook, empty and unattacked squares between/through), en passant, and pawn promotion to Queen, Rook, Bishop, Knight, or Shifter.
- Draws: stalemate, the 50-move rule, threefold repetition, and insufficient material (lone kings plus at most one minor piece each) are all detected automatically.
- Resignation and clock timeout are also implemented; the clock stops ticking once the game is over.

Pure rules live in `/src/game`:

- `board.ts` — board shape, initial setup, algebraic notation helpers.
- `pieces.ts` — piece/move types, symbols, names, and material values.
- `shifter.ts` — the Shifter's bishop + one-square-orthogonal movement.
- `applyRaw.ts` — unconditional move application (castling rook hop, en passant capture, promotion) shared by legality checking and real move application.
- `legalMoves.ts` — pseudo-legal move generation, check detection, castling eligibility, and full legality filtering.
- `moveValidation.ts` — validates a requested move and reports what happened (capture, en passant, castle, new en passant target).
- `gameState.ts` — turn order, move history, and all game-ending conditions (checkmate, stalemate, draws, resignation, timeout).
- `timers.ts` — clock state and time controls.
- `rating.ts` — the Elo-style rating formula.

## Expo Go Mocked Features

### Ads

`/src/services/ads/AdService.ts` defines the ad interface and an Expo Go mock implementation. It displays a React Native modal that says "Mock Ad" instead of using native AdMob.

Completed games are counted in AsyncStorage. After every completed game, the app increments `completedGameCount`; when the count is divisible by 3 and ads have not been removed, it calls `maybeShowInterstitial("game_complete")`. Ads are triggered only after game over, resignation, or timeout—not during active gameplay.

When moving to EAS/native builds, plug real AdMob initialization and ad display calls into the same service without touching game logic.

### Purchases

`/src/services/purchases/PurchaseService.ts` defines purchase entitlements and a mock remove-ads flow. In Settings, Remove Ads stores `adsRemoved=true` in AsyncStorage. Restore Purchases reads the same local entitlement.

For production, replace the mock service with an EAS-compatible IAP approach such as `expo-in-app-purchases`, RevenueCat, or another supported purchase SDK.

### Sound

`/src/services/sound/SoundService.ts` respects the Settings sound toggle. On web it synthesizes short move/capture/check/game-over beeps with the Web Audio API, so the toggle is meaningfully testable without shipping audio assets. On native it's currently a no-op placeholder — plug a real SDK (e.g. `expo-audio`) into `play()` for EAS/native builds without touching game logic.

### Auth

`/src/services/auth/AuthService.ts` provides local AsyncStorage mock auth. Passwords are never stored in plaintext — they're salted and hashed with a small dependency-free SHA-256 (`/src/services/auth/hash.ts`) before being written to storage. Register validates the email format and a minimum password length; login validates the hash locally; guest mode creates a guest profile. Local play is available to guests.

The interface is ready to be replaced by backend/JWT auth later (with server-side hashing such as bcrypt/argon2).

### Multiplayer

`/src/services/multiplayer/MultiplayerService.ts` is WebSocket-ready but currently mock-only in Expo Go. Matchmaking pairs the player with a nearby-rated mock opponent, randomizes color, and returns a match id, opponent profile, time control, and `mode="mock-online"`. After each of your moves, the mock opponent picks a random legal reply and plays it after a short delay; the Game screen also enforces that you can only move your own assigned color while it's mock-online. Queue cancellation is handled explicitly so a cancelled search cannot launch a game later.

Production architecture notes:

- Client connects with authenticated user credentials.
- Client sends move requests over WebSocket.
- Backend validates all moves and rejects illegal moves.
- Backend broadcasts accepted moves to both clients.
- Backend owns multiplayer clocks in production to prevent client timer tampering.

### Ratings

Rated multiplayer games use the standard Elo expected-score formula. New players start
at 1200, ratings are clamped to 0–3500, and a larger provisional K-factor is used for
the first 30 games. Draws (stalemate, repetition, 50-move rule, insufficient material) count
as a half-point result. Local games and daily puzzles do not affect ratings.

## Time Controls

- Blitz 3+0: 3 minutes per player, no increment.
- Bullet 1+1: 1 minute per player, +1 second after each move.
- Rapid 10+0: 10 minutes per player, no increment.
