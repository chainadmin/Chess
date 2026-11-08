# Original chess artwork

Four original, scalable vector collections for the game's appearance picker:

- **Classic:** outlined ivory/charcoal Staunton shapes, rounded tiered base, spearhead Lancer closest to the approved reference.
- **Carved Wood:** warm maple and dark walnut, visible wood grain and carved/turned details.
- **Forged Metal:** silver and dark gunmetal, faceted highlights and engraved metal bands.
- **Royal Lacquer:** ivory and royal blue with gold inlay and more intricate traditional details.

Each collection has seven pieces (K, Q, R, B, N, P, S) in light-side and dark-side material palettes. Internal `S` is drawn as the Lancer. No piece rules are changed by these assets. Each SVG has a transparent 100 × 100 canvas with common baseline and a contrasting perimeter for both light and dark squares. There are no font dependencies, gradient IDs, filters, external links, or raster dependencies.

## Sources

`src/appearance/pieceArtwork.ts` is the authoritative original vector source and exposes `getPieceSvg(set, type, color)` for `react-native-svg`'s `SvgXml`.

The 56 individual SVGs are source exports. Each `*-spritesheet.svg` has seven columns in K/Q/R/B/N/P/S order and two rows, white then black. `collections-preview.svg` and its rendered PNG show all four sets in the order above, including exact 28px pieces on alternating light and dark squares.

## Visual verification

Rendered using Inkscape's SVG renderer for inspection at both 86px and 28px. Both colors, all seven pieces, all four sets were checked. To refresh a sprite sheet PNG:

    inkscape assets/chess/classic-spritesheet.svg --export-type=png --export-filename=/tmp/classic-preview.png

Original artwork created for this project; no third-party piece artwork or external fonts are incorporated.

## Refreshing exports

Run `node --import tsx scripts/export-chess-artwork.ts` from the repository root to regenerate all 56 sources, four sprite sheets, and the labeled board/set preview. Render the preview with:

    inkscape assets/chess/appearance-preview.svg --export-type=png --export-filename=assets/chess/appearance-preview.png

The paired preview is an artwork illustration, not a running-app screenshot. The app permits all 16 board/piece combinations, not just these four pairings.

Stable storage IDs (`classic`, `club`, `modern`, `tournament`) are preserved for preference compatibility; the latter three now display as Carved Wood, Forged Metal and Royal Lacquer.
