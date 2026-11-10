# ShiftChess launch guide

This is the checklist for going live: two Railway servers, the App Store build, in-app purchases and AdMob.
Every value you still need to fill in is marked **REPLACE** in the repository. Search for `REPLACE` to find them all.

## What runs where

| Piece | Where | What it does |
|---|---|---|
| **Accounts API** (`server/api`) | Railway service `shiftchess-api` | Sign-up/login (username + password), profiles, leaderboard, purchase verification, account deletion, and the public `/privacy` and `/account-deletion` pages. |
| **Game server** (`server/game`) | Railway service `shiftchess-game` | Matchmaking and live 3+2 games only. It checks the same sign-in tokens and saves results and rating changes to Postgres. |
| **Postgres** | Railway Postgres | Users, sessions, finished games, ratings and purchases. Tables are created automatically on first start. |

The two servers are split by job so that sign-ups, logins and purchase checks never slow down live games. Opponent moves arrive by long-polling: the server answers the moment the board changes, instead of the app checking on a timer.

> Keep the game service at **1 replica**. Live games are held in memory, so a second copy would split the matchmaking queue. Redeploying the game server ends games in progress; ratings for finished games are already saved.

## 1. Railway (about 15 minutes)

1. In your Railway project, click **New → Database → PostgreSQL**.
2. Click **New → GitHub Repo**, pick this repository, and name the service `shiftchess-api`.
   - Settings → **Config-as-code** → Railway config file: `railway/api.json`
   - Variables:
     - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
     - `PRIVACY_CONTACT_EMAIL` = the email address for privacy requests
     - `APPLE_BUNDLE_ID` = `com.chainsoftwaregroup.shiftchess` (or your real bundle ID)
     - `GOOGLE_PLAY_PACKAGE_NAME` and `GOOGLE_SERVICE_ACCOUNT_JSON`: only needed for Android (see step 3)
     - `RESEND_API_KEY` and `EMAIL_FROM`: for password-reset emails (see step 1b)
   - Settings → Networking → **Generate Domain**.
3. Add the repository again as a second service named `shiftchess-game`.
   - Railway config file: `railway/game.json`
   - Variables: `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - Generate a domain.
4. Check that `https://<api-domain>/health` and `https://<game-domain>/health` both answer `{"ok":true,...}`, and that `https://<api-domain>/privacy` shows the policy.
5. Put both domains into `eas.json` (`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_GAME_URL`), replacing the `REPLACE-...` placeholders.

Optional variables: `ALLOWED_ORIGINS` (only for a web build), `TRUST_PROXY_HOPS` (defaults to 1 on Railway), `MAX_PLAYERS`.

## 1b. Password-reset email (about 15 minutes, plus DNS time)

Players can reset a forgotten password two ways:
- **Email link**, if they added an email address (optional at sign-up, or later in Settings). The link opens a page on the accounts server, works once, and expires after 1 hour.
- **Recovery code**: every player gets a code like `7KQ2-M9XD-4TPA-HV3N` when they sign up, and can make a new one in Settings. It works with or without email and needs no setup.

To turn on email links:
1. Create a free account at **resend.com** and add your domain (for example `chainsoftwaregroup.com`). Resend shows 3–4 DNS records; add them at your domain registrar and wait until Resend shows the domain as *Verified*. This can take from minutes to a few hours.
2. Create an API key (permission: *Sending access*).
3. On the `shiftchess-api` Railway service, set:
   - `RESEND_API_KEY` = the key
   - `EMAIL_FROM` = `ShiftChess <no-reply@yourdomain.com>` (must be on the verified domain)
   - `PUBLIC_URL` = `https://<api-domain>`. Optional, because Railway's own domain is used automatically; set it if you add a custom domain.

Until this is set up, "Email me a link" tells players to use their recovery code instead. Nothing else breaks.

## 2. App identity (App Store Connect)

- The bundle ID is set to **`com.chainsoftwaregroup.shiftchess`** in `app.json` (`ios.bundleIdentifier` and `android.package`). If your App Store Connect app uses a different ID, change both now. **It cannot be changed after the first upload.**
- Run `npx eas-cli init` once. It links the project to your Expo account and writes `owner` and `extra.eas.projectId` into `app.json`.
- Put your App Store Connect **Apple ID** (the number on App Information) into `eas.json` → `submit.production.ios.ascAppId`.
- Icon: `assets/app/icon.png` (1024×1024, no transparency). Android adaptive icon: `assets/app/adaptive-icon.png`. Splash: `assets/app/splash-icon.png`. Replace these files to change the artwork.

## 3. In-app purchases

Create these three products with **exactly** these IDs, as **Non-Consumable** in App Store Connect and as one-time **in-app products** in Google Play Console:

| Product ID | Unlocks |
|---|---|
| `remove_ads` | Turns off all AdMob ads |
| `pieces_forged_metal` | Forged Metal piece collection |
| `pieces_royal_lacquer` | Royal Lacquer piece collection |

Prices, names and descriptions are set in the stores; the app shows the store's localized price. Every purchase is verified by the accounts server before anything unlocks:

- **iOS**: the StoreKit 2 signed transaction is checked offline against Apple's root certificate and must match `APPLE_BUNDLE_ID`. No Apple API key is needed. Sandbox and TestFlight purchases are accepted, because App Review buys in the sandbox.
- **Android**: the server calls the Google Play Developer API. Create a Google Cloud service account, enable the *Google Play Android Developer API*, invite the service account in Play Console (Users and permissions → *View financial data*), and paste its JSON key into `GOOGLE_SERVICE_ACCOUNT_JSON`.

Guests can buy too: the purchase unlocks on that device, and **Restore purchases** brings it back. Signed-in players also have purchases saved to their account.

## 4. AdMob

1. In AdMob, add the iOS app and the Android app. Copy each **App ID** (`ca-app-pub-…~…`) into `app.json` → `plugins` → `react-native-google-mobile-ads` → `iosAppId` / `androidAppId`. The values there now are Google's public **test** App IDs.
2. Create one **Interstitial** ad unit per platform and put the unit IDs (`ca-app-pub-…/…`) into `eas.json` → `production.env` → `EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS` / `_ANDROID`.
3. In AdMob → **Privacy & messaging**, publish a GDPR message and a US state regulations message. The app shows these through Google's consent SDK before requesting ads.
4. Add an `app-ads.txt` file to your developer website once AdMob gives you the line for it.

How ads behave: an interstitial ad shows after every **3rd finished local game**, never during play or during online games. iPhone players are asked for tracking permission and still get ads if they say no; those ads are just not personalized. Buying `remove_ads` stops ads completely. Development builds always use Google's test ads.

## 5. Build and submit

```bash
npm install
npx eas-cli login
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

In-app purchases and ads use native code, so they **do not work in Expo Go**. To test them on a phone, use `eas build --profile development` (a development build) or a TestFlight build.

## 6. App Store Connect answers

- **Privacy Policy URL**: `https://<api-domain>/privacy`
- **App Privacy** ("nutrition label"). Data collected:
  - *User ID* (username): App Functionality, linked to the user
  - *Email address* (optional): App Functionality, linked to the user
  - *Gameplay content* (game moves and results): App Functionality, linked to the user
  - *Purchase history*: App Functionality, linked to the user
  - *Device ID* (advertising identifier) and *Advertising data*: Third-Party Advertising (AdMob). Used for **tracking** only if the user allows it.
  - *Product interaction* / *Crash data*: only if AdMob reports them; check Google's current AdMob disclosure guidance.
- **Account deletion**: built in (Settings → Account → Delete account). Google Play also needs a web URL for this: `https://<api-domain>/account-deletion`
- **Sign-in for review**: create a test account in the app and give App Review its username and password.
- **Age rating**: no objectionable content, but includes ads and in-app purchases.
- **Export compliance**: `ITSAppUsesNonExemptEncryption` is already set to false (the app only uses standard HTTPS).

## Running everything locally

```bash
npm run api:dev        # accounts API on :8788 (in-memory store unless DATABASE_URL is set)
npm run game:dev       # game server on :8787 (needs the same DATABASE_URL to share accounts)
cp .env.example .env   # points the app at both
npm run web
```

Both servers need the **same** `DATABASE_URL` locally, or the game server will not recognize accounts created on the API. `npm run online:server` still starts the old guest-only playtest server.

Tests: `npm run check`. To also run the Postgres tests against a throwaway database:
`TEST_DATABASE_URL=postgresql://user@localhost:5432/scratch npm test`.

## Known limits

- A player who lost their password, never added an email, **and** lost their recovery code can't get back into that account. They can create a new account and restore store purchases on it.
- Online games in progress are lost if the game server restarts or redeploys. Finished games and ratings are safe in Postgres.
- One game-server instance. That is plenty for launch (thousands of concurrent players); scaling past one instance needs a shared match store.
