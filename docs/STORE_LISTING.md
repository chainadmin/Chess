# ShiftChess store listing: everything to fill in

Copy-paste answers for Google Play Console and App Store Connect.

## Links

| What | URL |
|---|---|
| Website / Marketing URL | https://shiftchess.chain-developments.com |
| Privacy policy | https://shiftchess.chain-developments.com/privacy |
| Support URL (Apple) | https://shiftchess.chain-developments.com/support |
| Account deletion (Google) | https://shiftchess.chain-developments.com/account-deletion |
| app-ads.txt (AdMob) | https://shiftchess.chain-developments.com/app-ads.txt |

## App identity

| Field | Value |
|---|---|
| App name | ShiftChess |
| Package name / Bundle ID | `com.chainsoftwaregroup.shiftchess` |
| Developer / Seller | Chain Software Group |
| Category | **Games → Board** |
| Free or paid | **Free** (with in-app purchases) |
| Contains ads | **Yes** (Google AdMob) |
| Default language | English (United States) |

## Short description (Google, max 80 characters)
```
Chess on a 10×8 board with the Lancer: a brand-new piece. Play online free.
```

## Promotional text (Apple, max 170 characters)
```
Chess, with a new piece. Meet the Lancer on a wider 10×8 board: solve the daily puzzle, beat the computer, or climb the rated online ladder.
```

## Full description (both stores, max 4000 characters)
```
Chess, with a new piece.

ShiftChess is the chess you know on a wider 10×8 board, with one brand-new piece: the Lancer. It slides diagonally like a bishop, or steps a single square straight up, down, left or right. It can capture both ways. That one extra piece opens up tactics you've never seen before.

PLAY YOUR WAY
• Play the computer at Easy, Medium or Hard
• Pass and play with a friend on one phone
• Rated online 3+2 blitz against real players, always free
• A new tactical puzzle every day

COMPLETE CHESS RULES
Castling, en passant, promotion (including to a Lancer), check, checkmate, stalemate, threefold repetition, the 50-move rule and insufficient material are all built in.

CLIMB THE LEADERBOARD
Every online game is rated. Win to raise your rating and move up the leaderboard.

MAKE IT YOURS
Earn new boards and piece sets as you level up: Walnut, Forest, Sandstone and Slate boards; Classic, Carved Wood, Imperial Ivory, Jade Dynasty and Frost Crystal pieces. Premium Forged Metal and Royal Lacquer sets are available too.

FREE TO PLAY
ShiftChess is free with ads between games. Optional purchases remove ads or add premium piece sets. Purchases are cosmetic only: no pay-to-win, ever.
```

## Keywords (Apple, max 100 characters, comma-separated)
```
chess,board game,strategy,puzzle,chess variant,blitz,online chess,daily puzzle,lancer,10x8
```

## Contact details
| Field | Value |
|---|---|
| Email | the support inbox you check (also set as `PRIVACY_CONTACT_EMAIL` on Railway) |
| Website | https://shiftchess.chain-developments.com |
| Phone | optional |

## Graphics

| Asset | Size | Where to get it |
|---|---|---|
| App icon (Google) | 512 × 512 PNG | Resize `assets/app/icon.png` |
| App icon (Apple) | 1024 × 1024, no transparency | `assets/app/icon.png`, already built into the app |
| Feature graphic (Google) | 1024 × 500 PNG/JPG | Make one from the icon on a dark background, plus "ShiftChess" |
| Phone screenshots (Google) | 2–8, 16:9 or 9:16, min 320 px | Take on an Android phone from the internal-testing build |
| iPhone 6.9" screenshots (Apple) | 1320 × 2868 (or 1290 × 2796) | Take on a large iPhone from TestFlight |

Good screens to show: Welcome (the Lancer board), Home, a game against the computer, the daily puzzle, an online game, the leaderboard, and Settings with the piece sets.

## In-app products

Same IDs in both stores. Apple: **Non-Consumable**. Google: **one-time product**.

| Product ID | Name | Description | Price (US) |
|---|---|---|---|
| `remove_ads` | Remove Ads | Removes all ads from ShiftChess. | $2.99 |
| `pieces_forged_metal` | Forged Metal Pieces | A premium piece set with sculpted silver and gunmetal finishes. | $1.99 |
| `pieces_royal_lacquer` | Royal Lacquer Pieces | A premium piece set in royal blue lacquer, ivory and gold inlay. | $1.99 |
| `bundle_everything` | Everything Pack | Remove Ads plus the Forged Metal and Royal Lacquer piece sets. | $4.99 |

Google only lets you create products after a build with billing has been uploaded (internal testing is enough).

---

## Google Play Console: App content

### Privacy policy
`https://shiftchess.chain-developments.com/privacy`

### App access
**All or some functionality is restricted** → add instructions:
- Name: `Reviewer account`
- Username: *(create one in the app, e.g. `play_review`)*
- Password: *(its password)*
- Instructions: `Offline modes (computer, pass and play, daily puzzle) need no login. Online games need an account; use these credentials. Online matchmaking pairs two real players, so a second device or account is needed to start a game.`

### Ads
**Yes, my app contains ads.**

### Content rating (IARC questionnaire)
- Category: **Game**
- Violence, sexuality, language, controlled substances, crude humor: **No**
- Gambling or simulated gambling: **No**
- Users can interact or exchange information: **Yes**. Players see each other's usernames in online games and on the leaderboard; there is **no chat**, no user-generated content and no location sharing.
- Shares user location: **No**
- Allows purchases of digital goods: **Yes**
- Unrestricted internet access (web browser): **No**

Expected result: Everyone / PEGI 3 (with "In-app purchases" and "Users interact" notes).

### Target audience and content
- Target age groups: **13–15, 16–17, 18 and over** (don't select under 13; the privacy policy says the app isn't for children under 13)
- Appeals to children: **No**

### News app: **No**
### COVID-19 contact tracing: **No**
### Government app: **No**
### Financial features: **None**
### Health: **None**

### Data safety

**Does your app collect or share user data?** Yes
**Is all data encrypted in transit?** Yes
**Can users request deletion?** Yes, in the app (Settings → Account → Delete account) and at https://shiftchess.chain-developments.com/account-deletion

| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Personal info → **User IDs** (username) | Yes | No | Required for online play (accounts are optional) | Account management, App functionality |
| Personal info → **Email address** | Yes | No | **Optional** | Account management (password resets) |
| Financial info → **Purchase history** | Yes | No | Only if they buy | App functionality |
| App activity → **Other user-generated content / In-app actions** (game moves and results) | Yes | No | Required for online play | App functionality |
| Device or other IDs → **Advertising ID** | Yes | **Yes** (Google AdMob) | Required for ads | Advertising or marketing |
| App info and performance → **Diagnostics / Crash logs** | Yes (by AdMob SDK) | Yes (Google) | Required | Analytics |

Data processed only on the device (settings, practice level, offline games) isn't "collected" and doesn't need to be listed.

### Account deletion
- Delete account URL: `https://shiftchess.chain-developments.com/account-deletion`
- Users can also delete in the app: **Yes**
- Data deleted: username, email, password, sessions, rating and records, purchase records. Data kept: finished online games stay in opponents' history without the deleted username.

### Advertising ID
**Yes, the app uses advertising ID** → purpose: **Advertising or marketing**. The app already declares the `AD_ID` permission.

---

## App Store Connect

### App Information
- Name: ShiftChess · Subtitle (30 chars): `Chess with a brand-new piece`
- Category: **Games**, sub-categories **Board**, **Strategy**
- Content rights: **No** third-party content
- Age rating questionnaire: everything **None**, except **Unrestricted web access: No**, **Gambling: No**, **Contests: No**. Then mark "In-app purchases: Yes" and "User-generated content / messaging: No". Expected **4+**.

### Pricing and Availability
Free, all countries.

### App Privacy
**Privacy Policy URL:** `https://shiftchess.chain-developments.com/privacy`

Data types (all **linked to the user**, except where noted):

| Type | Used for | Tracking? |
|---|---|---|
| Contact Info → **Email Address** (optional) | App Functionality | No |
| Identifiers → **User ID** (username) | App Functionality | No |
| Purchases → **Purchase History** | App Functionality | No |
| User Content → **Gameplay Content** (moves and results) | App Functionality | No |
| Identifiers → **Device ID** (advertising identifier) | Third-Party Advertising | **Yes**, only if the player allows tracking |
| Usage Data → **Advertising Data** | Third-Party Advertising | **Yes**, same |
| Diagnostics → **Crash Data**, **Performance Data** (AdMob SDK) | Analytics | No (**not** linked to the user) |

### App Review Information
- Sign-in required: **Yes** → username and password of a review account
- Notes: `Offline modes need no login. Online matchmaking pairs two real players. To see a game, sign in on two devices or simulators with two accounts. In-app purchases are cosmetic (piece sets) and ad removal.`
- Contact: your name, phone and email

### Version information
- Support URL: `https://shiftchess.chain-developments.com/support`
- Marketing URL: `https://shiftchess.chain-developments.com`
- Copyright: `2026 Chain Software Group`
- In-App Purchases: add all four products to the version before submitting.

### Export compliance
Already answered in the app: it uses only standard HTTPS encryption (`ITSAppUsesNonExemptEncryption = false`).

---

## AdMob
1. **app-ads.txt**: already published at `https://shiftchess.chain-developments.com/app-ads.txt`. AdMob checks it on the domain of the **website listed on your store page**, so make sure the Play listing's *Website* is `https://shiftchess.chain-developments.com`. If AdMob still reports it as missing after a day, also upload the same line to `https://chain-developments.com/app-ads.txt`:
   ```
   google.com, pub-1580761947831808, DIRECT, f08c47fec0942fa0
   ```
2. **Link the apps** once they're live: AdMob → Apps → ShiftChess (Android / iOS) → App settings → **Link to app store**.
3. **Privacy & messaging**: publish a **GDPR** message and a **US state regulations** message. The app shows them through Google's consent SDK.
