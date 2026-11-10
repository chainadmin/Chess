# ShiftChess launch guide

This is the checklist for going live: one Railway service, the App Store build, in-app purchases and AdMob.
Every value you still need to fill in is marked **REPLACE** in the repository. Search for `REPLACE` to find them all.

## What runs where

| Piece | Where | What it does |
|---|---|---|
| **ShiftChess server** (`server/main.ts`) | Your one Railway service | Sign-up/login, profiles, leaderboard, purchase checks, password resets, account deletion, the `/privacy` and `/account-deletion` pages, **and** matchmaking and live online games, all on one address. |
| **Postgres** | Railway Postgres database | Users, sessions, finished games, ratings and purchases. Tables are created automatically on first start. |

Live games run in the server's memory, so moves are instant: the server answers the moment the board changes. Each result is saved to Postgres the moment a game ends.

> Keep the service at **1 replica**. A second copy would split players into two separate matchmaking queues. Redeploying ends games that are in progress; finished games and ratings are already saved.

## 1. Railway (about 10 minutes)

Your existing service is the right one; it just needs these settings.

1. **Database**: if the project doesn't have one yet, click **New → Database → PostgreSQL**. (Railway shows the database as its own box. That's normal; it isn't a second server you have to manage.)
2. **Your service** (the one connected to this GitHub repository):
   - The repository now has a `railway.json` at the top level, which tells Railway to build `server/Dockerfile` and start the server. Nothing to click; just redeploy. If Settings → *Config-as-code* points at an old path such as `railway/api.json`, clear it or set it to `railway.json`.
   - **Variables**:
     - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
     - `PRIVACY_CONTACT_EMAIL` = the email address for privacy requests
     - `APPLE_BUNDLE_ID` = `com.chainsoftwaregroup.shiftchess` (or your real bundle ID)
     - `POSTMARK_SERVER_TOKEN` and `EMAIL_FROM`: password-reset emails (step 1b)
     - `GOOGLE_PLAY_PACKAGE_NAME` and `GOOGLE_SERVICE_ACCOUNT_JSON`: only for Android (step 3)
   - Settings → Networking → **Generate Domain** (if it doesn't have one yet).
3. Check that `https://shiftchess.chain-developments.com/health` answers `{"ok":true,"service":"shiftchess",...}` and that `https://shiftchess.chain-developments.com/privacy` shows the policy.
4. **Custom domain**: the app is built for `https://shiftchess.chain-developments.com` (`EXPO_PUBLIC_API_URL` in `eas.json`). In Railway → Networking → **Custom Domain**, add `shiftchess.chain-developments.com` with the same port as the service, add the CNAME record Railway shows at chain-developments.com's DNS provider, and set the variable `PUBLIC_URL` = `https://shiftchess.chain-developments.com`. Online games use the same address automatically.

Optional variables: `ALLOWED_ORIGINS` (only for a web build), `TRUST_PROXY_HOPS` (defaults to 1 on Railway), `MAX_PLAYERS`, `PUBLIC_URL` (only with a custom domain).

## 1b. Password-reset email with Postmark (about 5 minutes)

Players can reset a forgotten password two ways:
- **Email link**, if they added an email address (optional at sign-up, or later in Settings). The link opens a page on your server, works once, and expires after 1 hour.
- **Recovery code**: every player gets a code like `7KQ2-M9XD-4TPA-HV3N` when they sign up, and can make a new one in Settings. It works without email and needs no setup.

To turn on email links with your existing Postmark account:
1. In Postmark, open the **Server** you want to use → **API Tokens** and copy the *Server API token*.
2. Make sure the address you'll send from is a verified **Sender Signature**, or that its domain is verified (Sender Signatures → Domains).
3. On the Railway service, set:
   - `POSTMARK_SERVER_TOKEN` = the server token
   - `EMAIL_FROM` = `ShiftChess <no-reply@yourdomain.com>` (the verified sender)
   - `POSTMARK_MESSAGE_STREAM` is optional; it defaults to `outbound` (Postmark's transactional stream).

Reset emails are tagged `password-reset` in Postmark's activity log. Link tracking is turned off, so Postmark never rewrites the one-time link. Until the token is set, "Email me a link" tells players to use their recovery code instead; nothing else breaks.

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

- **Privacy Policy URL**: `https://shiftchess.chain-developments.com/privacy`
- **App Privacy** ("nutrition label"). Data collected:
  - *User ID* (username): App Functionality, linked to the user
  - *Email address* (optional): App Functionality, linked to the user
  - *Gameplay content* (game moves and results): App Functionality, linked to the user
  - *Purchase history*: App Functionality, linked to the user
  - *Device ID* (advertising identifier) and *Advertising data*: Third-Party Advertising (AdMob). Used for **tracking** only if the user allows it.
  - *Product interaction* / *Crash data*: only if AdMob reports them; check Google's current AdMob disclosure guidance.
- **Account deletion**: built in (Settings → Account → Delete account). Google Play also needs a web URL for this: `https://shiftchess.chain-developments.com/account-deletion`
- **Sign-in for review**: create a test account in the app and give App Review its username and password.
- **Age rating**: no objectionable content, but includes ads and in-app purchases.
- **Export compliance**: `ITSAppUsesNonExemptEncryption` is already set to false (the app only uses standard HTTPS).

## Running everything locally

```bash
npm run server:dev     # the whole server on :8080 (in-memory data unless DATABASE_URL is set)
cp .env.example .env   # points the app at it
npm run web
```

Without `POSTMARK_SERVER_TOKEN`, local reset emails are printed in the server's terminal instead of being sent. `npm run online:server` still starts the old guest-only playtest server.

Tests: `npm run check`. To also run the Postgres tests against a throwaway database:
`TEST_DATABASE_URL=postgresql://user@localhost:5432/scratch npm test`.

## Known limits

- A player who lost their password, never added an email, **and** lost their recovery code can't get back into that account. They can create a new account and restore store purchases on it.
- Online games in progress are lost if the server restarts or redeploys. Finished games and ratings are safe in Postgres.
- One server instance. That is plenty for launch (thousands of concurrent players); running more than one copy would need a shared match store.
