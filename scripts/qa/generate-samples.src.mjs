// Renders a fixed spread of design specs and fails if any of them misses the
// quality gate. Bundled by generate-samples.mjs because it imports TypeScript.
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderArtwork, artworkToSvg, artworkToVectorFile, artworkMetadata } from '../../src/lib/generate/engine.ts';
import { checkArtwork } from '../../src/lib/generate/quality.ts';

const specs = [
  { motif: 'mountain', style: 'flat', layout: 'panorama', aspect: 'landscape', paletteId: 'terracotta', seed: 11 },
  { motif: 'city', style: 'detailed', layout: 'centered', aspect: 'square', paletteId: 'ocean', seed: 7 },
  { motif: 'coffee', style: 'icon', layout: 'badge', aspect: 'square', paletteId: 'clay', seed: 3 },
  { motif: 'tree', style: 'flat', layout: 'poster', aspect: 'portrait', paletteId: 'festive', seed: 5, word: 'WINTER' },
  { motif: 'arcs', style: 'geometric', layout: 'centered', aspect: 'banner', paletteId: 'citrus', seed: 9 },
  { motif: 'snowflake', style: 'line', layout: 'grid', aspect: 'square', paletteId: 'ice', seed: 4 },
  { motif: 'finance', style: 'minimal', layout: 'centered', aspect: 'square', paletteId: 'deep-teal', seed: 21 },
  { motif: 'hearts', style: 'vector', layout: 'poster', aspect: 'portrait', paletteId: 'berry', seed: 33, word: 'LOVE' },
  { motif: 'lantern', style: 'line', layout: 'centered', aspect: 'square', paletteId: 'midnight', seed: 44 },
  { motif: 'travel', style: 'flat', layout: 'panorama', aspect: 'story', paletteId: 'citrus', seed: 55 },
];

mkdirSync('/tmp/gen', { recursive: true });
let failures = 0;

for (const spec of specs) {
  const art = renderArtwork(spec);
  const meta = artworkMetadata(art, spec.seed);
  const svg = artworkToSvg(art, meta);
  const report = checkArtwork(art, meta, 'svg', svg);
  const eps = artworkToVectorFile(art, 'eps', meta);
  const ai = artworkToVectorFile(art, 'ai', meta);
  if (!/^%!PS-Adobe-3.0 EPSF-3.0/.test(new TextDecoder().decode(eps.bytes.slice(0, 30)))) {
    console.error(`${spec.motif}: EPS header missing`);
    failures += 1;
  }
  if (ai.bytes.length < 1000 || !new TextDecoder().decode(ai.bytes).includes('%%EOF')) {
    console.error(`${spec.motif}: AI file incomplete`);
    failures += 1;
  }
  writeFileSync(`/tmp/gen/${spec.motif}-${spec.style}.svg`, svg);
  if (!report.pass) {
    failures += 1;
    console.error(`${spec.motif}/${spec.style}: ${report.score} ${report.checks.filter((c) => c.status !== 'pass').map((c) => `${c.id}:${c.status}:${c.detail}`).join(' | ')}`);
  }
}

if (failures) {
  console.error(`\n${failures} generator sample(s) failed`);
  process.exit(1);
}
console.log(`Generator samples: ${specs.length} specs rendered, quality gate passed, EPS and AI headers verified`);
