# ShiftChess launch guide

This is the checklist for going live: one Railway service, the App Store build, in-app purchases and AdMob.
Every value you still need to fill in is marked **REPLACE** in the repository. Search for `REPLACE` to find them all.

## What runs where

Two Railway services, both built from this repository with the same `railway.json`. The variable **`SHIFTCHESS_ROLE`** decides which job each one does:

| Service | `SHIFTCHESS_ROLE` | Address | In charge of |
|---|---|---|---|
| **Accounts** | `accounts` | `https://shiftchess.chain-developments.com` | Sign-up/login, profiles, leaderboard, purchases, password resets, account deletion, `/privacy`, `/account-deletion`, `/reset-password` |
| **Online** | `online` | `https://shiftchess-online.chain-developments.com` | Matchmaking and live online games (`/command`) only |
| **Postgres** | (none) | private | Users, sessions, games, ratings, purchases. Both services use it. |

How a game works across them:
1. The app logs in on **Accounts**, which saves a sign-in token (hashed) in Postgres and gives it to the app.
2. The app sends that same token to **Online** to find and play games. Online looks the token up in the shared Postgres (once a minute at most, then it's cached) to know who the player is.
3. Games run in Online's memory, so moves are instant. When a game ends, Online writes the result and both new ratings to Postgres.
4. Home, Leaderboard and Settings read those ratings back from **Accounts**.

The two never call each other directly; the database is the only link. If Accounts is busy (sign-ups, password hashing, purchase checks), games on Online are not slowed down. If Online restarts, logins and purchases keep working.

> Keep **Online at 1 replica**: live games and the matchmaking queue are held in its memory, and a second copy would split the queue. Accounts can be scaled freely. Redeploying Online ends games in progress; finished games and ratings are already saved.
> Leaving `SHIFTCHESS_ROLE` empty runs both jobs in one service. That is useful for a single-service setup or local development.

## 1. Railway

1. **Postgres**: one database in the project (already done).
2. **Accounts service** (your existing `chess` service):
   - Variables:
     - `SHIFTCHESS_ROLE` = `accounts`
     - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
     - `PORT` = `8081` (must match the port shown on the service's domains)
     - `PUBLIC_URL` = `https://shiftchess.chain-developments.com`
     - `PRIVACY_CONTACT_EMAIL`, `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM`
     - Android purchases only: `GOOGLE_SERVICE_ACCOUNT_JSON` (step 3)
     - The app ID `com.chainsoftwaregroup.shiftchess` is built in; `APPLE_BUNDLE_ID` / `GOOGLE_PLAY_PACKAGE_NAME` are only needed if you change it.
   - Custom domain: `shiftchess.chain-developments.com`
3. **Online service** (new): **+ New → GitHub Repo → this repository** (same repo, same branch `main`). Name it `online`.
   - Variables:
     - `SHIFTCHESS_ROLE` = `online`
     - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
     - `PORT` = `8081`
   - Settings → Deploy → **Replicas: 1**.
   - Custom domain: `shiftchess-online.chain-developments.com` (port 8081). Add the CNAME Railway shows at your DNS provider.
4. Check both:
   - `https://shiftchess.chain-developments.com/health` → `{"ok":true,"service":"accounts"}`
   - `https://shiftchess-online.chain-developments.com/health` → `{"ok":true,"service":"online",...}`

The app already points at both addresses (`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_GAME_URL` in `eas.json`).

Optional variables: `ALLOWED_ORIGINS` (only for a web build), `TRUST_PROXY_HOPS` (defaults to 1 on Railway), `MAX_PLAYERS` (online).

## 1b. Password-reset email with Postmark (about 5 minutes)

Players can reset a forgotten password two ways:
- **Email link**, if they added an email address (optional at sign-up, or later in Settings). The link opens a page on your server, works once, and expires after 1 hour.
- **Recovery code**: every player gets a code like `7KQ2-M9XD-4TPA-HV3N` when they sign up, and can make a new one in Settings. It works without email and needs no setup.

To turn on email links with your existing Postmark account:
1. In Postmark, open the **Server** you want to use → **API Tokens** and copy the *Server API token*.
2. Make sure the address you'll send from is a verified **Sender Signature**, or that its domain is verified (Sender Signatures → Domains).
3. On the **Accounts** Railway service, set:
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
npm run server:dev     # both jobs in one process on :8080 (in-memory data unless DATABASE_URL is set)
cp .env.example .env   # points the app at it
npm run web
```

Without `POSTMARK_SERVER_TOKEN`, local reset emails are printed in the server's terminal instead of being sent. `npm run online:server` still starts the old guest-only playtest server.

Tests: `npm run check`. To also run the Postgres tests against a throwaway database:
`TEST_DATABASE_URL=postgresql://user@localhost:5432/scratch npm test`.

## Known limits

- A player who lost their password, never added an email, **and** lost their recovery code can't get back into that account. They can create a new account and restore store purchases on it.
- Online games in progress are lost if the Online service restarts or redeploys. Finished games and ratings are safe in Postgres.
- One Online instance. That is plenty for launch (thousands of concurrent players); running more than one copy would need a shared match store.
