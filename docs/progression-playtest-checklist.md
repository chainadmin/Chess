# Practice progression and cosmetic playtest

## Verified automatically

- `npm run check`: app, game-test, online-test and server TypeScript checks plus **152 passing behavior tests** in the final combined branch.
- `EXPO_NO_TELEMETRY=1 CI=1 npx expo export --platform web --output-dir /tmp/shiftchess-progression-web`: passed.
- `git diff --check`: passed.
- The 15 new progression/commerce/ad tests cover reward eligibility, levels/cap, per-result/per-day replay protection, serialized concurrent writes, hydration, save retry, corrupt-read protection, subscriber lifecycle, earned gates, premium fallback, unavailable purchase/restore calls, preview-only ads, placement cadence and storage failures.

## Browser/device checks still required

Interactive QA was attempted but did not run: this executor's Chromium process could not create its socket, including under the reviewed escalation. The available cloud browser could not reach the executor's loopback HTTP server. No screenshots or mobile-device pass are claimed.

Use a fresh local browser profile or test device, without actual store purchases:

1. Enter as Guest. Home should show level 1 / 0 XP and still offer **Online 3+2 · Always free**.
2. Open **Settings & Cosmetics**. Walnut and Classic are included. Forest, Carved Wood, Sandstone and Slate show level gates (2/3/4/6). Forged Metal and Royal Lacquer show their premium artwork and disabled preview-only state. Billing and restore are visibly unavailable, with no prices or purchase-success path.
3. Confirm locked selections cannot be activated with mouse/touch/keyboard. Legacy saved locked/premium preferences should fall back to Walnut/Classic at runtime. Local mock ad-removal flags must not grant ownership.
4. Solve the daily puzzle: +30 practice XP. Reopen, navigate back/forward and reload: no second award. Verify the result survives restart and Home updates.
5. Finish a pass-and-play game after six plies: +25 XP once. Example legal moves: a2–a3, a7–a6, b2–b3, b7–b6, c2–c3, c7–c6, then resign. An immediate resignation before six plies should award nothing. Reset should create a distinct result, not replay the previous reward.
6. Finish a computer game: 25 XP after six plies, plus 25 on a player win. Active/abandoned games must not award XP. Online and legacy mock multiplayer results must not award practice XP.
7. Reach level 2 at 100 XP and level 3 at 200 XP. Forest/Carved Wood should become selectable, persist, and render on boards, puzzles and piece previews. Premium collections remain locked at maximum level.
8. Preview an ad from Settings, close it, reopen, and dismiss with Android Back where applicable. No reward or charge should appear. In a normal build there should be no automatic placeholder. With `EXPO_PUBLIC_AD_PREVIEW=true`, a marked preview should appear only between games, every third completed local game.
9. Simulate unavailable storage: no XP/unlock before a successful save, a useful error, and a working retry. A failed read must not replace the saved progress. On a solved puzzle, reentry must recover an interrupted XP save.
10. Check 320/390 px mobile and desktop widths, keyboard focus, screen-reader labels, disabled controls, scrolling, modal dismissal, and navigation while saves are pending.

## Production limits

Progress is device-local practice data, shared by local profiles and tamperable; it is not account-sync or secure paid ownership. It is not transactional across separate browser tabs/processes. Online rewards and ad cadence require persistent server result IDs and transactional settlement. Real payments need a supported store SDK, server-verified receipts, product configuration, refunds/revocations/restore and durable accounts. Real ads need a provider SDK and consent/privacy/failure handling. These integrations are intentionally unavailable in this playtest; online entry remains free.
