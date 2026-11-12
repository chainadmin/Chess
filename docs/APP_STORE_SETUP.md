# ShiftChess App Store setup, step by step

Everything to fill in on App Store Connect (appstoreconnect.apple.com), in order.
Values are ready to copy and paste.

---

## Step 0: Agreements (do this first, or purchases won't work)
**Business** (or **Agreements, Tax, and Banking**) → **Paid Apps** agreement:
1. Accept the agreement.
2. Add a **bank account**.
3. Fill in the **tax forms** (W-9 for a US business).

Until the Paid Apps agreement shows **Active**, in-app purchases don't load in the app, even in TestFlight.

---

## Step 1: The app record
If `eas submit` didn't already create it: **Apps → + → New App**
| Field | Value |
|---|---|
| Platforms | iOS |
| Name | `ShiftChess` (if it's taken: `ShiftChess: Lancer Chess`) |
| Primary language | English (U.S.) |
| Bundle ID | `com.chainsoftwaregroup.shiftchess` |
| SKU | `shiftchess` |
| User access | Full access |

---

## Step 2: App Information (left menu, under General)
| Field | Value |
|---|---|
| Name | ShiftChess |
| Subtitle (30 chars max) | `Chess with a brand-new piece` |
| Category | Primary: **Games**, sub-categories **Board** and **Strategy**. Secondary: **Entertainment** (optional) |
| Content Rights | **No**, the app doesn't contain third-party content |
| Age Rating | Click **Set Up Age Ratings** (see below) |
| License Agreement | Leave **Apple's Standard License Agreement** |

### Age rating questionnaire
| Question | Answer |
|---|---|
| Parental controls / age assurance | No |
| Unrestricted web access | No |
| User-generated content | No |
| Messaging and chat | No (players only see usernames; there's no chat) |
| Advertising | **Yes** |
| Cartoon/realistic violence, horror, profanity, sexual content, nudity, alcohol/tobacco/drugs, medical | None |
| Simulated gambling, contests, loot boxes | No |
| Gambling with real money | No |

Expected result: **4+** (or 9+).

---

## Step 3: Pricing and Availability
- Price: **Free** (USD 0.00)
- Availability: all countries/regions
- iPad / Mac: the app is iPhone-only, so leave "Make available on Mac/Vision" unchecked if asked

---

## Step 4: App Privacy
**Privacy Policy URL:** `https://shiftchess.chain-developments.com/privacy`

Click **Get Started** → "Do you or your third-party partners collect data from this app?" → **Yes**.

Tick these data types:

| Category → Type | Used for | Linked to user? | Used for tracking? |
|---|---|---|---|
| Contact Info → **Email Address** | App Functionality | Yes | No |
| Identifiers → **User ID** | App Functionality | Yes | No |
| Identifiers → **Device ID** | Third-Party Advertising, Analytics | No | **Yes** |
| Purchases → **Purchase History** | App Functionality | Yes | No |
| User Content → **Gameplay Content** | App Functionality | Yes | No |
| Location → **Coarse Location** | Third-Party Advertising, Analytics | No | No |
| Usage Data → **Advertising Data** | Third-Party Advertising, Analytics | No | **Yes** |
| Usage Data → **Product Interaction** | Analytics | No | No |
| Diagnostics → **Crash Data** | Analytics | No | No |
| Diagnostics → **Performance Data** | Analytics | No | No |

The "tracking" ones are why the app asks iPhone users for permission (the App Tracking Transparency prompt). If they say no, the advertising ID isn't used.

Then click **Publish**.

---

## Step 5: In-App Purchases (left menu → Monetization → In-App Purchases)
Create **four**, each of type **Non-Consumable**:

| Reference name | Product ID | Price | Display name | Description (max 55 chars) |
|---|---|---|---|---|
| Remove Ads | `remove_ads` | $2.99 | Remove Ads | Remove all ads from ShiftChess. |
| Forged Metal Pieces | `pieces_forged_metal` | $1.99 | Forged Metal Pieces | Premium silver and gunmetal piece set. |
| Royal Lacquer Pieces | `pieces_royal_lacquer` | $1.99 | Royal Lacquer Pieces | Premium blue lacquer and gold piece set. |
| Everything Pack | `bundle_everything` | $4.99 | Everything Pack | Remove ads plus both premium piece sets. |

For **each** one:
1. **Availability:** all countries.
2. **Price schedule:** choose the US price; other countries fill in automatically.
3. **App Store Localization:** English (U.S.), with the display name and description above.
4. **Review Information:**
   - **Screenshot:** a screenshot of the in-app store. Use the "Free play. Optional extras." section in Settings, taken in a TestFlight build at any iPhone size.
   - **Review notes:** `Purchased from Settings → Free play. Optional extras. Cosmetic only; no gameplay advantage.`
5. Status should say **Ready to Submit**.

The product IDs must match exactly, or the purchase buttons won't show prices.

---

## Step 6: The version page (left menu → iOS App → 1.0 Prepare for Submission)

### Screenshots
- **iPhone 6.9" Display** (required): 1320 × 2868 or 1290 × 2796, between 3 and 10 images.
  - Take them on an iPhone 15/16/17 Pro Max or Plus from the TestFlight build.
  - Or use the iOS Simulator at that size.
- Good screens: Welcome (Lancer board), Home, a game against the computer, the daily puzzle, an online game, the leaderboard, Settings with piece sets.
- The 6.5" and 5.5" sizes are filled in automatically from 6.9".

### Text
| Field | Value |
|---|---|
| Promotional Text (170) | `Chess, with a new piece. Meet the Lancer on a wider 10×8 board: solve the daily puzzle, beat the computer, or climb the rated online ladder.` |
| Description | The "Full description" from `docs/STORE_LISTING.md` |
| Keywords (100) | `chess,board game,strategy,puzzle,chess variant,blitz,online chess,daily puzzle,lancer,10x8` |
| Support URL | `https://shiftchess.chain-developments.com/support` |
| Marketing URL | `https://shiftchess.chain-developments.com` |
| Version | `1.0.0` |
| Copyright | `2026 Chain Software Group` |

### Build
Click **+** next to Build and choose the newest build. That's the one built **after** the Expo 57 crash fix, uploaded with `npx eas-cli submit --platform ios --profile production --latest`.
- **Export compliance:** already answered in the app (standard HTTPS only). If asked: **None of the algorithms mentioned**, uses only standard encryption.

### In-App Purchases
In the **In-App Purchases and Subscriptions** section of the version page, click **+** and add all four products. The first purchases must be submitted together with the app.

### App Review Information
| Field | Value |
|---|---|
| Sign-in required | **Yes** |
| User name | `play_review` (or your review account; it's a **username**, not an email) |
| Password | its password |
| Contact | your first name, last name, phone, email |
| Notes | see below |

Notes:
```
Sign in with the USERNAME above (not an email). Offline modes (Play the computer, Pass & Play, Daily puzzle) work without signing in. Online 3+2 games match two real players, so starting an online game needs a second device signed in with a second account (e.g. play_review2). In-app purchases are in Settings and are cosmetic only (piece sets) or ad removal. The app asks for App Tracking Transparency permission before personalized ads; declining still allows non-personalized ads.
```

### Version Release
**Manually release this version**, so you choose the launch moment after approval. Or pick automatic if you want it live as soon as it's approved.

---

## Step 7: Before you press Submit for Review
- [ ] The Paid Apps agreement shows **Active**
- [ ] The newest TestFlight build **opens without crashing**, you can sign in, a computer game works, and a purchase shows a price
- [ ] The review account exists and works on the live server
- [ ] All four in-app purchases say **Ready to Submit** and are added to the version
- [ ] App Privacy is **published**
- [ ] `https://shiftchess.chain-developments.com/privacy`, `/terms` and `/support` all load

Then click **Add for Review**, then **Submit to App Review**. Review usually takes 1–3 days.

---

## Step 8: AdMob, after approval
1. AdMob → Apps → **ShiftChess (iOS)** → App settings → **Link to app store** and search for the live app.
2. AdMob → **Privacy & messaging**: publish the **GDPR** and **US state regulations** messages. Optionally also an **IDFA explainer** message, shown before Apple's tracking prompt.
3. app-ads.txt is already live at `https://shiftchess.chain-developments.com/app-ads.txt`. AdMob checks the domain of the Marketing URL above.
