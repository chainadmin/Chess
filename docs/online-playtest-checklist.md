# Free online 3+2 playtest

## Verified in the development workspace

- `npm run check`: all app, rule-test, online-test and server TypeScript checks pass; 152 tests pass.
- Tests include two real localhost HTTP clients, server-owned legal moves and clocks, +2 increment, timeout before late moves, resignation, outsider rejection, malformed/forged commands, queue cancellation races and expiry, idempotent retry after lost acknowledgements, initial session retry, rate-limited cancellation, safe resignation at capacity, token expiry, CORS and resource caps. Follow-up regressions cover four same-IP guests polling for two simulated minutes, expired-lease recovery after a lost join acknowledgement, expired guest queue removal, and bounded active-match credential grace.
- Configured Expo web export passes with `EXPO_PUBLIC_ONLINE_URL=http://127.0.0.1:8787`.
- `git diff --check` passes.
- Existing artwork/parity tests still pass. Artwork changes from the previous task are preserved.

## Still requires interactive validation

`python scripts/qa-online.py --output /tmp/shiftchess-online-qa` is a reproducible two-context desktop/390px mobile smoke test. Export with the endpoint above first. Python Playwright and Chromium must be available. It starts/stops its own loopback web and game servers, and refuses occupied ports.

The current workspace blocked Chromium startup with an IPC `socket() failed: Operation not permitted` error before a page loaded. The interactive assertions did not run and no screenshots were produced. Do not interpret compilation/network tests as a visual or native-device pass.

Run this checklist in a browser-capable environment:

1. Alone in queue: no bot fallback; cancellation returns to idle.
2. Two independent guest contexts: same match, opposite colors, Black board rotated correctly.
3. Legal pawn moves arrive on both boards, ownership is enforced, and clocks update.
4. Back Home then Online resumes the same match; leaving does not pause the server clock.
5. Resign / Keep playing dismisses cleanly; confirmed resignation appears on both clients.
6. Promotion, offline/reconnect and lost response flows; no repeated move/increment.
7. Narrow-screen controls and board, keyboard navigation and screen readers.
8. Native devices, foreground/background transitions and realistic network latency.

## Public-release work, not completed here

Public hosting/TLS; verified accounts and recoverable sessions; durable games and transactional results/ratings; multi-instance coordination; abuse and engine-cheat mitigation; identity retirement for hard ticket caps; reconnect-safe ad result IDs and native ad/cosmetic purchase integration. Online entry remains free throughout. This playtest is not a public server deployment.
