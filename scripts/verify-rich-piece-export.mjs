import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(project, process.argv[2] ?? 'dist');
const expected = ['src/appearance/catalog.ts', 'src/appearance/richPieceArtwork.ts', 'src/components/PieceView.tsx', 'src/components/RichPieceArtwork.tsx', 'src/progression/cosmetics.ts'];
const metadata = JSON.parse(readFileSync(resolve(output, 'metadata.json'), 'utf8'));
for (const platform of ['web', 'ios', 'android']) {
  const directory = resolve(output, '_expo/static/js', platform);
  // Libraries may add lazily loaded web chunks; the app code lives in the AppEntry bundle.
  const maps = readdirSync(directory).filter(name => name.startsWith('AppEntry') && name.endsWith('.map'));
  assert.equal(maps.length, 1);
  const map = JSON.parse(readFileSync(resolve(directory, maps[0]), 'utf8'));
  const sources = new Map(map.sources.map((name, index) => [name, map.sourcesContent?.[index]]));
  for (const path of expected) assert.equal(sources.get(`/${path}`), readFileSync(resolve(project, path), 'utf8'), `${platform}: exact rich-art module ${path}`);
  for (const set of ['imperial', 'jade', 'crystal']) {
    const source = readFileSync(resolve(project, `assets/chess/rich/${set}-atlas.png`));
    const hash = createHash('md5').update(source).digest('hex');
    if (platform !== 'web') {
      const asset = metadata.fileMetadata[platform].assets.find(asset => asset.path === `assets/${hash}` && asset.ext === 'png');
      assert.ok(asset, `${platform}: ${set} bundled for offline use`);
      assert.deepEqual(readFileSync(resolve(output, asset.path)), source);
    } else {
      const relative = `assets/assets/chess/rich/${set}-atlas.${hash}.png`;
      assert.deepEqual(readFileSync(resolve(output, relative)), source);
      const bundle = readFileSync(resolve(directory, maps[0].slice(0, -4)), 'utf8');
      assert.ok(bundle.includes(hash), `web: ${set} static image resolves to its source hash`);
    }
  }
  console.log(`${platform}: five rich-art modules and all three RGBA atlases verified.`);
}
