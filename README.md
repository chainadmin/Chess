# ShiftChess Expo

ShiftChess is now an Expo React Native / TypeScript mobile app prototype for a 10×8 chess variant with a Shifter piece. It is structured so local play remains offline and pure game rules stay separate from UI, ads, auth, purchases, and multiplayer.

## Run with Expo Go

```bash
npm install
npm start
```

Scan the QR code with Expo Go. The app intentionally avoids native-only AdMob and IAP packages so it can run in Expo Go.

## Implemented Screens

- Welcome: logo/name, login, register, continue as guest.
- Login/Register: local mock account flows.
- Home: Play Local, Multiplayer, Rules, Settings.
- Multiplayer: mock quick match for Blitz 3+0, Bullet 1+1, and Rapid 10+0.
- Game: 10×8 board, local or mock-online mode, turn indicator, clocks, captured pieces, move history, resign, and local reset.
- Settings: remove ads mock purchase, restore purchases, sound toggle, account status, logout.
- Rules: 10×8 setup and Shifter movement explanation.

## Game Rules

- Board: 10 columns × 8 rows.
- Back rank: `R N S B Q K B S N R`.
- Pawn rank: 10 pawns per side.
- The Shifter (`S`) can move like a bishop diagonally any distance without jumping.
- The Shifter can also move exactly one square orthogonally up/down/left/right.
- Captures are allowed on both Shifter movement types.
- Check/checkmate, captures, turns, pawn promotion, resignation, and timeout states are implemented.

Pure rules live in `/src/game`:

- `board.ts`
- `pieces.ts`
- `shifter.ts`
- `legalMoves.ts`
- `moveValidation.ts`
- `gameState.ts`
- `timers.ts`

## Expo Go Mocked Features

### Ads

`/src/services/ads/AdService.ts` defines the ad interface and an Expo Go mock implementation. It displays a React Native modal that says “Mock Ad” instead of using native AdMob.

Completed games are counted in AsyncStorage. After every completed game, the app increments `completedGameCount`; when the count is divisible by 3 and ads have not been removed, it calls `maybeShowInterstitial("game_complete")`. Ads are triggered only after game over, resignation, or timeout—not during active gameplay.

When moving to EAS/native builds, plug real AdMob initialization and ad display calls into the same service without touching game logic.

### Purchases

`/src/services/purchases/PurchaseService.ts` defines purchase entitlements and a mock remove-ads flow. In Settings, Remove Ads stores `adsRemoved=true` in AsyncStorage. Restore Purchases reads the same local entitlement.

For production, replace the mock service with an EAS-compatible IAP approach such as `expo-in-app-purchases`, RevenueCat, or another supported purchase SDK.

### Auth

`/src/services/auth/AuthService.ts` provides local AsyncStorage mock auth. Register stores a local user profile, login validates it locally, and guest mode creates a guest profile. Local play is available to guests.

The interface is ready to be replaced by backend/JWT auth later.

### Multiplayer

`/src/services/multiplayer/MultiplayerService.ts` is WebSocket-ready but currently mock-only in Expo Go. Quick Match waits 2 seconds, then returns a mock match with match id, player color, opponent name, time control, and `mode="mock-online"`.

Production architecture notes:

- Client connects with authenticated user credentials.
- Client sends move requests over WebSocket.
- Backend validates all moves and rejects illegal moves.
- Backend broadcasts accepted moves to both clients.
- Backend owns multiplayer clocks in production to prevent client timer tampering.

## Time Controls

- Blitz 3+0: 3 minutes per player, no increment.
- Bullet 1+1: 1 minute per player, +1 second after each move.
- Rapid 10+0: 10 minutes per player, no increment.
