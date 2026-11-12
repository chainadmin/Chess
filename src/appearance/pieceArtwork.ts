import type { Color, PieceType } from '../game/pieces';

/** Original vector collections. S is the Lancer; artwork never changes its rules. */
export type ArtworkSet = 'classic' | 'club' | 'modern' | 'tournament' | 'marble' | 'rosegold';
type Drawing = { body: string; detail?: string; facets?: string };
const path = (d: string) => `<path d="${d}"/>`;
const circle = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const line = (d: string) => `<path d="${d}" fill="none"/>`;

const bases: Record<ArtworkSet, string> = {
  classic: path('M39 47 H61 C61 60 64 68 69 75 H31 C36 68 39 60 39 47Z') + path('M30 75 H70 Q76 75 76 80 Q76 84 70 84 H30 Q24 84 24 80 Q24 75 30 75Z') + path('M29 84 H71 Q81 84 81 93 H19 Q19 84 29 84Z'),
  club: path('M37 48 H63 C61 59 64 70 70 76 H30 C36 70 39 59 37 48Z') + path('M29 76 H71 Q80 76 80 84 V92 H20 V84 Q20 76 29 76Z'),
  modern: path('M40 46 H60 L66 72 L75 80 V90 H25 V80 L34 72Z') + path('M25 82 H75 V92 H25Z'),
  tournament: path('M41 46 H59 C57 60 60 68 68 75 L64 79 H36 L32 75 C40 68 43 60 41 46Z') + path('M31 79 H69 L74 85 H26Z') + path('M28 85 H72 Q78 86 78 92 H22 Q22 86 28 85Z'),
  // Classical column base: fluted stem, rounded torus moulding and a square plinth.
  marble: path('M38 47 H62 C61 59 64 66 70 72 H30 C36 66 39 59 38 47Z') + path('M28 72 H72 Q78 72 78 77 Q78 82 72 82 H28 Q22 82 22 77 Q22 72 28 72Z') + path('M23 83 H77 V92 H23Z'),
  // Slender jewellery-style stem on a stepped, bevelled foot.
  rosegold: path('M42 46 H58 L62 72 L70 78 V83 H30 V78 L38 72Z') + path('M25 84 H75 L72 92 H28Z'),
};
const collars: Record<ArtworkSet, string> = {
  classic: path('M36 43 H64 Q69 43 69 48 Q69 52 64 52 H36 Q31 52 31 48 Q31 43 36 43Z'),
  club: path('M35 44 H65 Q71 44 71 49 Q71 54 65 54 H35 Q29 54 29 49 Q29 44 35 44Z'),
  modern: path('M33 44 H67 L63 52 H37Z'),
  tournament: path('M35 44 H65 L67 49 L62 53 H38 L33 49Z'),
  marble: path('M34 42 H66 Q70 42 70 46 V49 Q70 52 66 52 H34 Q30 52 30 49 V46 Q30 42 34 42Z'),
  rosegold: path('M36 43 H64 L66 47 L61 51 H39 L34 47Z'),
};
const crowns = {
  classic: {
    K: { body: path('M45 9 H55 V18 H64 V27 H55 V33 H62 L66 43 H34 L38 33 H45 V27 H36 V18 H45Z'), detail: line('M39 34 H61') },
    Q: { body: path('M27 25 L38 32 L50 20 L62 32 L73 25 L65 44 H35Z') + circle(26, 22, 4) + circle(50, 16, 4) + circle(74, 22, 4), detail: line('M36 38 H64') },
    R: { body: path('M29 17 H40 V27 H46 V17 H54 V27 H60 V17 H71 V35 L64 41 V44 H36 V41 L29 35Z'), detail: line('M31 34 H69') },
    B: { body: circle(50, 14, 4) + path('M50 19 C38 27 32 33 36 39 Q40 45 50 45 Q60 45 64 39 C68 33 62 27 50 19Z'), detail: line('M54 25 L47 35') },
    N: { body: path('M34 45 L38 37 L29 40 L22 34 L33 23 L39 13 L44 20 L53 16 C68 23 72 33 68 49 H36Z'), detail: line('M45 25 L42 27 M58 26 Q64 34 57 43 M28 34 L33 34') },
    P: { body: circle(50, 33, 11) + path('M42 43 H58 L63 48 H37Z') },
    S: { body: path('M50 8 L65 31 Q66 33 63 36 L55 43 V45 H45 V43 L37 36 Q34 33 35 31Z'), facets: path('M50 10 L63 32 L53 42 V44 H50Z') },
  },
  club: {
    K: { body: path('M44 10 Q44 8 47 8 H53 Q56 8 56 10 V18 H64 V29 H56 V35 Q65 35 66 45 H34 Q35 35 44 35 V29 H36 V18 H44Z'), detail: line('M40 38 H60') },
    Q: { body: path('M25 27 Q26 23 30 26 L39 33 L50 20 L61 33 L70 26 Q74 23 75 27 L68 45 H32Z') + circle(27, 21, 5) + circle(50, 15, 5) + circle(73, 21, 5), detail: line('M37 39 H63') },
    R: { body: path('M27 19 Q27 16 31 16 H39 V27 H45 V16 H55 V27 H61 V16 H69 Q73 16 73 19 V33 Q73 38 65 41 V45 H35 V41 Q27 38 27 33Z'), detail: line('M32 34 H68') },
    B: { body: circle(50, 14, 5) + path('M50 21 Q71 30 66 40 Q63 46 50 46 Q37 46 34 40 Q29 30 50 21Z'), detail: line('M55 26 L47 35') },
    N: { body: path('M34 47 L38 38 L30 41 Q25 41 22 34 L33 23 L37 13 Q44 13 47 20 L54 18 Q74 24 70 49 H34Z'), detail: circle(43, 27, 1.6) + line('M59 28 Q65 36 57 43 M27 34 H33') },
    P: { body: circle(50, 32, 13) + path('M41 43 H59 L64 48 H36Z') },
    S: { body: path('M50 9 L66 31 Q69 35 64 39 L56 44 H44 L36 39 Q31 35 34 31Z'), facets: path('M50 12 L64 33 Q66 35 61 39 L54 43 H50Z') },
  },
  modern: {
    K: { body: path('M45 10 H55 V20 H64 V29 H55 V35 H61 L66 44 H34 L39 35 H45 V29 H36 V20 H45Z') },
    Q: { body: path('M25 20 L39 32 L50 12 L61 32 L75 20 L66 44 H34Z'), detail: line('M37 38 H63') },
    R: { body: path('M29 16 H39 V26 H45 V16 H55 V26 H61 V16 H71 V34 L63 44 H37 L29 34Z'), detail: line('M31 34 H69') },
    B: { body: path('M50 12 L67 32 L59 44 H41 L33 32Z'), detail: line('M56 23 L47 33') },
    N: { body: path('M35 44 L42 34 L29 39 L22 32 L35 21 L40 12 L46 19 L55 17 L69 29 L66 46 H35Z'), detail: line('M43 26 H46 M58 26 L62 32 L55 40') },
    P: { body: path('M43 22 H57 L64 29 V38 L57 45 H43 L36 38 V29Z') },
    S: { body: path('M50 8 L66 30 L55 41 V44 H45 V41 L34 30Z'), facets: path('M50 10 L64 30 L53 40 V44 H50Z') },
  },
  tournament: {
    K: { body: path('M46 7 H54 V17 H62 V25 H54 V31 C63 32 65 37 62 44 H38 C35 37 37 32 46 31 V25 H38 V17 H46Z'), detail: line('M39 38 H61') },
    Q: { body: path('M27 24 L39 31 L50 19 L61 31 L73 24 L63 44 H37Z') + circle(26, 20, 3.5) + circle(50, 14, 3.5) + circle(74, 20, 3.5), detail: line('M38 39 H62 M39 31 L43 39 M61 31 L57 39') },
    R: { body: path('M31 15 H40 V25 H46 V15 H54 V25 H60 V15 H69 V33 L61 39 V44 H39 V39 L31 33Z'), detail: line('M32 32 H68 M39 39 H61') },
    B: { body: circle(50, 12, 3.5) + path('M50 17 C47 22 34 29 37 37 Q38 43 45 44 H55 Q62 43 63 37 C66 29 53 22 50 17Z'), detail: line('M55 24 L47 34 M42 40 H58') },
    N: { body: path('M36 45 L40 36 L30 39 L23 33 L34 23 L39 11 L45 19 L51 16 C66 20 72 31 66 47 H36Z'), detail: line('M44 25 L41 27 M55 24 C65 30 62 38 56 43 M28 33 H33') },
    P: { body: circle(50, 31, 10) + path('M44 41 H56 L61 45 H39Z') },
    S: { body: path('M50 7 L63 30 Q65 33 61 36 L54 42 V45 H46 V42 L39 36 Q35 33 37 30Z'), facets: path('M50 9 L61 31 L52 41 V44 H50Z') },
  },
} as Record<ArtworkSet, Record<PieceType, Drawing>>;

// The marble set shares the timeless Staunton heads; rose gold shares the faceted heads.
crowns.marble = crowns.classic;
crowns.rosegold = crowns.modern;

/** No filters, external assets, IDs or fonts: safe to render many pieces together. */
export function getPieceSvg(set: ArtworkSet, type: PieceType, color: Color): string {
  if (set !== 'classic') return getMaterialPieceSvg(set, type, color);
  const drawing = crowns[set][type];
  const fill = color === 'white' ? '#fff0cf' : '#35373c';
  const ink = color === 'white' ? '#292720' : '#15171b';
  const detailInk = color === 'white' ? ink : '#b7b7b3';
  const edge = color === 'white' ? '#fff6df' : '#ddd6c7';
  const width = 3;
  const body = bases[set] + drawing.body + collars[set];
  const facets = drawing.facets ? `<g fill="${color === 'white' ? '#d5c1a0' : '#56585d'}" stroke="none">${drawing.facets}</g>` : '';
  // The first pass creates a fine contrasting perimeter on either board color.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><g stroke-linecap="round" stroke-linejoin="round"><g fill="${fill}" stroke="${edge}" stroke-width="${width + 2.2}">${body}</g><g fill="${fill}" stroke="${ink}" stroke-width="${width}">${body}</g>${facets}<g stroke="${detailInk}" stroke-width="${2.7}" fill="${detailInk}">${drawing.detail ?? ''}</g></g></svg>`;
}

// Material marks are explicitly drawn inside each silhouette. They need no masks,
// gradients or shared IDs, so hundreds of pieces can coexist in native SvgXml.
const materialHeadMarks: Record<PieceType, string> = {
  K: 'M48 12 V22 H40 M49 23 V34 M43 39 H57',
  Q: 'M37 35 L40 40 M48 27 L48 39 M60 35 L58 40',
  R: 'M34 20 V30 M49 20 V30 M64 20 V30 M37 37 H60',
  B: 'M45 28 Q39 33 43 37 M54 37 L57 34',
  N: 'M48 22 L53 21 M37 30 L31 34 M48 35 Q45 39 45 43',
  P: 'M45 26 Q40 31 43 36 M48 39 H53',
  S: 'M48 20 L41 31 L46 36',
};
const metalHeadFacets: Record<PieceType, string> = {
  K: 'M46 11 H50 V24 H37 V21 H46Z M50 29 H54 V36 L62 42 H50Z',
  Q: 'M29 25 L40 35 L50 16 V41 H36Z',
  R: 'M31 18 H35 V29 H48 V18 H51 V35 H33Z M51 35 H66 L61 42 H51Z',
  B: 'M50 15 V41 H42 L36 32Z',
  N: 'M40 16 L44 23 L36 27 L26 32 L30 36 L43 31 L40 42 H51 V20 L47 22Z',
  P: 'M44 24 H50 V43 H44 L38 37 V30Z',
  S: 'M50 12 V42 H47 V40 L37 30Z',
};
const woodHeadGrain: Record<PieceType, string> = {
  K: 'M51 12 V26 M40 23 H59 M41 41 Q50 36 59 41',
  Q: 'M35 35 Q50 43 65 35 M40 42 Q50 38 60 42',
  R: 'M32 30 Q42 35 51 30 T68 30 M37 38 Q50 34 63 38',
  B: 'M39 35 Q47 41 59 35 M44 40 Q50 37 56 40',
  N: 'M48 24 Q59 27 58 36 M37 32 L32 35 M40 44 Q49 38 55 43',
  P: 'M41 31 Q50 25 59 31 M42 36 Q50 31 58 36 M46 40 Q50 38 54 40',
  S: 'M49 18 Q45 28 48 36 M54 27 Q59 32 54 37',
};

// Natural stone veining drawn inside each head and through the stem.
const marbleHeadVeins: Record<PieceType, string> = {
  K: 'M46 13 Q49 20 45 26 M54 22 Q58 28 55 36 M40 38 Q48 35 56 40',
  Q: 'M33 29 Q41 33 45 41 M55 24 Q52 32 58 39',
  R: 'M33 21 Q38 28 35 34 M55 20 Q61 27 58 36 M41 38 Q50 35 59 39',
  B: 'M47 22 Q41 30 45 39 M55 30 Q58 35 54 41',
  N: 'M44 18 Q48 25 43 31 M55 22 Q63 30 60 40 M31 36 Q37 34 39 39',
  P: 'M45 26 Q41 31 45 37 M53 27 Q57 32 54 38',
  S: 'M50 14 Q46 24 50 31 Q53 36 49 41 M57 27 Q60 31 57 35',
};

function getMaterialPieceSvg(set: Exclude<ArtworkSet, 'classic'>, type: PieceType, color: Color): string {
  const white = color === 'white';
  const drawing = crowns[set][type];
  const body = bases[set] + drawing.body + collars[set];
  const group = (fill: string, content: string, stroke = 'none', width = 1) =>
    `<g fill="${fill}" stroke="${stroke}" stroke-width="${width}">${content}</g>`;
  let fill: string;
  let ink: string;
  let edge: string;
  let material = '';
  let details: string;

  if (set === 'club') {
    // Honey maple and polished walnut, with actual carved rings and flowing grain.
    fill = white ? '#e8b568' : '#68371f';
    ink = white ? '#513019' : '#2b190f';
    edge = white ? '#ffe0a2' : '#d6a470';
    const shade = white ? '#bc7c38' : '#422617';
    const light = white ? '#ffdb91' : '#a16639';
    material += group(shade, path('M54 55 H61 Q61 67 67 74 H55 Q51 65 54 55Z') + path('M66 79 H71 Q77 79 77 85 V89 H66Z'));
    material += group(light, path('M40 55 H46 Q43 65 39 73 H34 Q39 65 40 55Z'));
    material += group('none', line('M46 57 C53 61 42 68 48 73 M53 58 C60 63 49 67 54 72 M33 81 Q50 77 69 81 M26 87 Q46 83 73 87'), white ? '#9d632f' : '#b27b4d', 1.6);
    material += group('none', line(woodHeadGrain[type]), white ? '#a66d33' : '#c38a54', 1.65);
    // Dark carved annuli make the wood collection read as turned timber at 26px.
    material += group(shade, path('M34 47 H66 V50 H34Z') + path('M27 81 H73 V83 H27Z'));
    material += group('none', line('M37 46 H63 M28 85 H72'), light, 1.5);
    if (type === 'S') material += group(shade, path('M51 14 L64 33 L54 41 H51Z'));
    details = group('none', drawing.detail ?? '', white ? '#513019' : '#e0b07b', 2.8);
  } else if (set === 'modern') {
    // Hard-cut silver / blue gunmetal. Broad alternating facets survive tiny renders.
    fill = white ? '#bccbd6' : '#344b60';
    ink = white ? '#273b4c' : '#101e2b';
    edge = white ? '#f5fbff' : '#a2bccb';
    const bright = white ? '#f7fcff' : '#829bad';
    const shade = white ? '#738b9e' : '#192b3c';
    material += group(shade, path('M50 54 H60 L64 73 L72 79 H50Z') + path('M53 85 H72 V89 H53Z'));
    material += group(bright, path('M41 54 H48 L43 73 L30 79 H36 L47 70Z') + path('M28 85 H48 V88 H28Z'));
    material += group(bright, path(metalHeadFacets[type]));
    material += group('none', line(materialHeadMarks[type]), white ? '#ffffff' : '#b2cbd7', 1.5);
    material += group(shade, path('M37 46 H63 L61 50 H39Z'));
    material += group('none', line('M38 46 H62 M28 82 H72 M45 74 H58'), bright, 1.6);
    // Small steel fasteners on the machined collar and rectangular foot.
    material += group(bright, circle(42, 48, 1.25) + circle(58, 48, 1.25) + circle(32, 87, 1.3) + circle(68, 87, 1.3));
    details = group('none', drawing.detail ?? '', white ? '#273b4c' : '#c4d6e0', 2.6);
  } else if (set === 'marble') {
    // White Carrara / black Nero Marquina marble with grey and white veins and brushed brass.
    fill = white ? '#f4f1eb' : '#26292e';
    ink = white ? '#3a3c40' : '#0d0e10';
    edge = white ? '#fffdf8' : '#d9d4c9';
    const shade = white ? '#d8d3ca' : '#15171a';
    const sheen = white ? '#ffffff' : '#474b52';
    const vein = white ? '#9da3a7' : '#e6e1d6';
    const brass = white ? '#b8913f' : '#d3ac57';
    material += group(shade, path('M53 55 H59 Q59 64 65 71 H55 Q51 64 53 55Z') + path('M60 84 H76 V91 H60Z'));
    material += group(sheen, path('M41 55 H46 Q44 64 39 71 H34 Q39 64 41 55Z') + path('M24 84 H38 V87 H24Z'));
    material += group('none', line('M45 56 Q50 62 46 67 Q44 70 47 72 M56 58 Q53 64 57 69 M27 76 Q37 74 46 78 T70 76 M31 88 Q42 85 50 89 T73 87'), vein, 1.1);
    material += group('none', line(marbleHeadVeins[type]), vein, 1.15);
    material += group(brass, path('M33 47 H67 V49 H33Z') + path('M24 82 H76 V84 H24Z'));
    material += group('none', line('M36 44 H64'), white ? '#e2c27a' : '#f0d58f', 1.1);
    if (type === 'S') material += group(sheen, path('M51 13 L62 32 L53 40 H51Z'));
    details = group('none', drawing.detail ?? '', white ? '#5f6164' : '#e8e3d8', 2.4);
  } else if (set === 'rosegold') {
    // Polished rose gold against black chrome with rose-gold trim: faceted like jewellery.
    fill = white ? '#e2a98f' : '#2a2d34';
    ink = white ? '#6b3b2b' : '#0c0d10';
    edge = white ? '#fff1ea' : '#e7b39c';
    const bright = white ? '#fde3d6' : '#8e96a5';
    const shade = white ? '#b2735c' : '#14161b';
    const trim = white ? '#fff6f1' : '#e0a088';
    material += group(shade, path('M50 54 H58 L61 71 L68 77 H50Z') + path('M52 86 H72 L70 90 H52Z'));
    material += group(bright, path('M42 54 H48 L44 71 L33 77 H38 L46 69Z') + path('M29 86 H48 V88 H29Z'));
    material += group(bright, path(metalHeadFacets[type]));
    material += group('none', line(materialHeadMarks[type]), white ? '#ffffff' : '#c4cad6', 1.4);
    material += group(trim, path('M38 46 H62 L60 50 H40Z') + path('M30 79 H70 V81 H30Z'));
    material += group(white ? '#c98a72' : '#e0a088', circle(50, 48, 1.6) + circle(29, 88, 1.3) + circle(71, 88, 1.3));
    details = group('none', drawing.detail ?? '', white ? '#6b3b2b' : '#e7b39c', 2.5);
  } else {
    // Enamel-like ivory / midnight blue with gold inlay and chiseled ornament.
    fill = white ? '#fff5de' : '#182d58';
    ink = white ? '#5c4a2c' : '#0b1732';
    edge = white ? '#fff9e8' : '#e2c078';
    const gold = white ? '#b58a32' : '#e6bd60';
    const shade = white ? '#d9c8a3' : '#0d1b3b';
    const sheen = white ? '#ffffff' : '#426197';
    material += group(shade, path('M52 55 H58 Q57 66 64 74 H54 Q50 65 52 55Z'));
    material += group(sheen, path('M43 55 H47 Q46 64 40 73 H36 Q42 65 43 55Z'));
    material += group(gold, path('M36 46 H64 L62 50 H38Z') + path('M36 76 H64 L62 79 H38Z') + path('M30 81 H70 L72 83 H28Z') + path('M25 88 H75 V90 H25Z'));
    material += group('none', line('M40 47 L42 49 L44 47 L46 49 L48 47 L50 49 L52 47 L54 49 L56 47 L58 49 L60 47 M35 86 V88 M41 86 V88 M47 86 V88 M53 86 V88 M59 86 V88 M65 86 V88'), ink, 1.1);
    material += group('none', line('M50 57 L54 62 L50 68 L46 62Z M50 68 V73'), gold, 1.6);
    material += group('none', line(materialHeadMarks[type]), gold, 1.8);
    if (type === 'S') material += group(sheen, path('M50 11 L60 31 L52 40 V43 H50Z')) + group('none', line('M50 17 V36'), gold, 1.4);
    if (type === 'Q') material += group(gold, circle(26, 20, 2) + circle(50, 14, 2) + circle(74, 20, 2));
    if (type === 'K') material += group(gold, path('M48 10 H52 V19 H59 V23 H52 V29 H48 V23 H41 V19 H48Z'));
    if (type === 'P') material += group('none', line('M43 35 Q50 39 57 35'), gold, 2.2);
    details = group('none', drawing.detail ?? '', white ? '#7c602c' : '#e6bd60', 2.5);
  }
  const strokeWidth = set === 'club' ? 3.6 : set === 'modern' || set === 'rosegold' ? 3 : set === 'marble' ? 2.9 : 2.7;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><g stroke-linecap="round" stroke-linejoin="round">${group(fill, body, edge, strokeWidth + 2.2)}${group(fill, body, ink, strokeWidth)}${material}${details}</g></svg>`;
}
