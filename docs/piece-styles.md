# Additional piece styles

The piece-style-only patch adds Imperial Ivory, Jade Dynasty and Frost Crystal to
the existing Settings picker. It keeps the four original collections, default
Classic selection, saved preferences, board themes and game rules unchanged.

- Imperial Ivory is available immediately.
- Jade Dynasty unlocks at practice level 5.
- Frost Crystal unlocks at practice level 10.

Unlock levels are centralized in `src/progression/cosmetics.ts`. This patch does
not change practice rewards or the level curve. On the current main branch's
100-XP-per-level curve, those thresholds correspond to 400 and 900 XP.

## How selection is connected

The existing Settings screen enumerates `PIECE_SETS`, renders a preview for every
collection and calls `useAppearance().updateAppearance({ pieces: id })`. The
existing appearance store immediately publishes changes and persists them. Both
the picker and runtime enforce access policy, including restored preferences.

`PieceView` now routes the three new IDs to `RichPieceArtwork`; original IDs keep
their existing SVG artwork. Local/online boards, daily puzzles, captured pieces,
promotion choices, Settings previews and the welcome screen already use this
shared component. No extra screen wiring or new dependency is necessary.

## Images and mapping

The three PNG atlases in `assets/chess/rich` are required runtime assets, not
optional examples. They are pre-rendered 2D art with a sculpted appearance, not
interactive 3D models. Each 1254 x 1254 RGBA atlas has a 4 x 4 grid:

1. White King, Queen, Rook, Bishop.
2. White Knight, Pawn, Lancer, empty.
3. Black King, Queen, Rook, Bishop.
4. Black Knight, Pawn, Lancer, empty.

`richPieceArtwork.ts` owns the mapping. `RichPieceArtwork.tsx` statically bundles
each image, clips the selected cell and applies a 4% inset. All 42 variants work
offline. The Lancer keeps its `S` identifier and its existing movement/value.

The PNGs are the approved replacement artwork from combined source commit
`2133ecd069dd0358196e7ec3c54dc014dc9a2cb6`. They are recreated replacements,
not recovered originals. Existing metal/lacquer premium previews stay locked.

## Checks and manual smoke test

Run `npm ci`, `npm run check`, then:

```sh
EXPO_NO_TELEMETRY=1 CI=1 npx expo export --platform all --clear --source-maps
node scripts/verify-rich-piece-export.mjs
```

The verification script checks exact renderer/catalog/access source and all
three atlas byte sequences in web, iOS and Android exports. Exported bundles are
not compiled native apps or proof of interactive/device behavior.

In Settings, select Imperial Ivory, start a local game, then reload the app and
confirm the choice remains. Check the pieces on the daily puzzle, both sides of
the board, captured-piece list and promotion picker. Verify Jade/Frost show their
unlock levels, stay blocked below those levels and can be selected once earned.
Also test rapid switching, small screens, online orientation and native devices.

For the existing four SVG collections, `scripts/export-chess-artwork.ts` now
explicitly skips raster styles so the original export command remains usable.

This patch adds no accounts, ads, billing, backend, challenge, tutorial or
dependency changes. It does not publish, merge or deploy the project.
