/**
 * Runtime smoke tests for the pure domain layer.
 *
 * Run with `npm test` (esbuild bundles this file with the `@/` alias and node
 * executes it - no test framework dependency). Every assertion below checks a
 * real platform rule or a real binary round-trip, not implementation trivia.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { buildPlatformCsv, withBom, keywordsFor } from '@/lib/stock/csv';
import { parseMetadataCsv, planApply, splitFields } from '@/lib/stock/csvimport';
import { generateMetadata, adaptForPlatform, tokensFromFilename } from '@/lib/stock/metadata';
import { sanitizeFilename, validateItem, validateEverywhere, worstLevel } from '@/lib/stock/validate';
import { PLATFORMS, PLATFORM_LIST, findPlatform } from '@/lib/stock/platforms';
import { SHUTTERSTOCK_CATEGORIES } from '@/lib/stock/categories';
import { detectFormat, formatBytes, bytesToBase64, base64ToBytes } from '@/lib/stock/files';
import { buildXmpPacket, embedMetadata, parseXmpPacket, readEmbeddedMetadata } from '@/lib/stock/xmp';
import { analyzeEps, analyzeSvg, sanitizeSvg } from '@/lib/stock/vectorcheck';
import { detectMapping, mapRows, monthlySeries, parseDelimited, platformTotals, topTitles } from '@/lib/stock/sales';
import { PLATFORM_CAPS, STATUS_ORDER, countByStatus, setStatus, statusOf } from '@/lib/stock/submissions';
import { DEFAULT_FLAGS, EMPTY_METADATA, kindOf, megapixels, type StockItem } from '@/lib/stock/types';

/** Injected by scripts/run-tests.mjs: absolute path to tests/fixtures. */
declare const FIXTURE_DIR: string;

/* ------------------------------- harness ------------------------------- */
let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push(`${name} → ${error instanceof Error ? error.message : String(error)}`);
    console.log(`  ✗ ${name}`);
    console.log(`      ${error instanceof Error ? error.message : String(error)}`);
  }
}

function group(title: string) {
  console.log(`\n${title}`);
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(`${message ?? 'value mismatch'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function includes(haystack: string, needle: string, message?: string) {
  if (!haystack.includes(needle)) throw new Error(`${message ?? 'missing text'}: ${JSON.stringify(needle)}`);
}

/* ------------------------------- fixtures ------------------------------- */
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTURE_DIR, name)));

let seq = 0;

const BASE_METADATA = {
  title: 'Golden sunset over a calm tropical beach',
  description: 'A golden sunset reflected on a calm tropical beach with palm silhouettes.',
  keywords: Array.from({ length: 22 }, (_, index) => `keyword${index + 1}`),
  categories: ['Nature', 'Travel'],
};

function item(overrides: Partial<StockItem> = {}): StockItem {
  seq += 1;
  const stamp = new Date().toISOString();
  const base: StockItem = {
    id: `item-${seq}`,
    name: `sunset-beach-${seq}.jpg`,
    format: 'jpg',
    sizeBytes: 3_200_000,
    width: 5000,
    height: 3333,
    metadata: { ...BASE_METADATA },
    flags: { ...DEFAULT_FLAGS },
    embeddedAt: null,
    importedAt: stamp,
    updatedAt: stamp,
  };
  return {
    ...base,
    ...overrides,
    metadata: { ...base.metadata, ...(overrides.metadata ?? {}) },
    flags: { ...base.flags, ...(overrides.flags ?? {}) },
  };
}

/* =========================== platform registry =========================== */
group('Platform registry');

test('ten marketplaces are registered with brand colours', () => {
  equal(PLATFORM_LIST.length, 10, 'platform count');
  assert(PLATFORM_LIST.every((p) => /^#/.test(p.color)), 'every platform has a hex colour');
});

test('Shutterstock keyword window is 7-50 and unordered', () => {
  equal(PLATFORMS.shutterstock.keywords.min, 7);
  equal(PLATFORMS.shutterstock.keywords.max, 50);
  equal(PLATFORMS.shutterstock.keywords.ordered, false);
});

test('Adobe Stock caps keywords at 49 and orders them', () => {
  equal(PLATFORMS.adobe.keywords.max, 49);
  equal(PLATFORMS.adobe.keywords.ordered, true);
  equal(PLATFORMS.adobe.title.noCommas, true);
});

test('Freepik CSV is semicolon-delimited, single-quoted and headerless', () => {
  equal(PLATFORMS.freepik.csv?.delimiter, ';');
  equal(PLATFORMS.freepik.csv?.quote, "'");
  equal(PLATFORMS.freepik.csv?.withHeader, false);
});

test('26 Shutterstock categories are available for the Categories column', () => {
  equal(SHUTTERSTOCK_CATEGORIES.length, 26, 'category list length');
});

test('AI policy split matches the 2026 marketplace rules', () => {
  equal(PLATFORMS.shutterstock.aiPolicy, 'forbidden');
  equal(PLATFORMS.getty.aiPolicy, 'forbidden');
  equal(PLATFORMS.alamy.aiPolicy, 'forbidden');
  equal(PLATFORMS.adobe.aiPolicy, 'allowed-labeled');
  equal(PLATFORMS.freepik.aiPolicy, 'allowed-labeled');
});

test('findPlatform maps portal labels and aliases', () => {
  equal(findPlatform('Shutterstock'), 'shutterstock');
  equal(findPlatform('iStock'), 'getty');
  equal(findPlatform('Magnific'), 'freepik');
  equal(findPlatform('Adobe Stock'), 'adobe');
  equal(findPlatform('some unknown portal'), null);
});

/* ============================== CSV writers ============================== */
group('CSV writers (exact platform dialects)');

test('Shutterstock: Filename,Description,Keywords,Categories with CRLF', () => {
  const result = buildPlatformCsv([item()], 'shutterstock');
  const [header, firstRow] = result.content.split('\r\n');
  assert(
    header.startsWith('Filename,Description,Keywords,Categories'),
    `header should start with the official column order, got: ${header}`,
  );
  includes(firstRow, 'sunset-beach-1.jpg', 'filename present');
  assert(!header.includes('Title'), 'Shutterstock has no Title column');
});

test('Adobe Stock: Filename,Title,Keywords,Category1,Category2', () => {
  const result = buildPlatformCsv([item()], 'adobe');
  equal(result.content.split('\r\n')[0], 'Filename,Title,Keywords,Category1,Category2');
});

test('Depositphotos uses lowercase yes/no flag columns', () => {
  const result = buildPlatformCsv([item({ flags: { ...DEFAULT_FLAGS, editorial: true, mature: false } })], 'depositphotos');
  const [header, firstRow] = result.content.split('\r\n');
  equal(header, 'Filename,Description,Keywords,Editorial,Nudity');
  includes(firstRow, 'yes', 'lowercase editorial flag');
});

test('Dreamstime and 123RF keep their own column sets', () => {
  equal(buildPlatformCsv([item()], 'dreamstime').content.split('\r\n')[0], 'Filename,Title,Description,Keywords,Category');
  equal(buildPlatformCsv([item()], '123rf').content.split('\r\n')[0], 'Filename,Title,Description,Keywords,Country');
});

test('Freepik export has no header row and single-quoted fields', () => {
  const result = buildPlatformCsv([item()], 'freepik');
  const firstLine = result.content.split('\n')[0].trim();
  assert(!/^filename/i.test(firstLine), 'no header row');
  includes(firstLine, "'", 'single quotes');
  includes(firstLine, ';', 'semicolon delimiter');
});

test('Freepik AI content is tagged with _ai_generated', () => {
  const result = buildPlatformCsv([item({ flags: { ...DEFAULT_FLAGS, aiGenerated: true } })], 'freepik');
  includes(result.content, '_ai_generated', 'AI disclosure keyword');
});

test('Portals without a CSV importer still get a copy-paste sheet', () => {
  for (const id of ['pixabay', 'getty', 'alamy'] as const) {
    const result = buildPlatformCsv([item()], id);
    assert(result.rows === 1, `${id} sheet has one row`);
    includes(result.content.split(/\r?\n/)[0], 'Filename', `${id} sheet has a header`);
  }
});

test('exports are UTF-8 with BOM for Excel', () => {
  equal(withBom('a,b').charCodeAt(0), 0xfeff, 'BOM prefix');
});

test('keyword joins follow each platform spec', () => {
  const adobe = keywordsFor(item(), PLATFORMS.adobe).join(PLATFORMS.adobe.csv!.keywordJoin);
  includes(buildPlatformCsv([item()], 'adobe').content, adobe, 'Adobe keyword join');
});

/* ============================== validation ============================== */
group('Validation rules');

test('a 0.8 MP photo is rejected on Adobe Stock', () => {
  const issues = validateItem(item({ width: 1000, height: 800 }), 'adobe');
  assert(issues.some((issue) => issue.level === 'error'), 'resolution error raised');
  equal(worstLevel(issues), 'error');
});

test('a 5000x3333 photo passes Adobe resolution rules', () => {
  const issues = validateItem(item(), 'adobe');
  assert(!issues.some((issue) => issue.level === 'error' && /mp|resolution|pixel/i.test(issue.message)), 'no resolution error');
});

test('too few keywords is an error', () => {
  const issues = validateItem(item({ metadata: { ...EMPTY_METADATA, title: 'Sunset', description: 'A sunset.', keywords: ['sunset', 'sky'], categories: [] } }), 'shutterstock');
  assert(issues.some((issue) => issue.level === 'error'), 'keyword count error');
});

test('AI-generated content is blocked on Shutterstock but allowed on Adobe', () => {
  const ai = item({ flags: { ...DEFAULT_FLAGS, aiGenerated: true } });
  assert(validateItem(ai, 'shutterstock').some((issue) => issue.level === 'error'), 'Shutterstock blocks AI');
  assert(!validateItem(ai, 'adobe').some((issue) => issue.level === 'error' && /ai/i.test(issue.message)), 'Adobe allows labelled AI');
});

test('recognisable people without a linked release raise a warning', () => {
  const noRelease = item({ metadata: { ...EMPTY_METADATA, title: 'Businessman portrait', description: 'A businessman portrait.', keywords: ['businessman', 'man', 'people', 'portrait'], categories: [] } });
  const issues = validateItem(noRelease, 'adobe');
  assert(issues.some((issue) => /release/i.test(issue.message)), 'release warning raised');
  const withRelease = { ...noRelease, releaseIds: ['rel-1'] };
  assert(!validateItem(withRelease, 'adobe').some((issue) => /release/i.test(issue.message)), 'warning clears once linked');
});

test('validateEverywhere reports every platform at once', () => {
  const everywhere = validateEverywhere(item(), [item()]);
  equal(Object.keys(everywhere).length, 10, 'one entry per platform');
});

test('filenames are made platform-safe', () => {
  const result = sanitizeFilename('My Photo, [final] (v2).JPG', PLATFORMS.adobe);
  equal(result.changed, true, 'filename changed');
  assert(!result.name.includes(','), 'comma removed');
  assert(!result.name.includes('['), 'bracket removed');
});

test('kindOf and megapixels classify content', () => {
  equal(kindOf(item({ name: 'icon.svg', format: 'svg' })), 'vector');
  equal(kindOf(item()), 'photo');
  equal(megapixels(item({ width: 4000, height: 3000 })), 12);
  equal(megapixels(item({ width: undefined, height: undefined })), null);
});

/* ============================ metadata engine ============================ */
group('Metadata generation');

test('the offline generator fills title, description and 7+ keywords', () => {
  const generated = generateMetadata(item({ name: 'red-apple-on-wooden-table.jpg', metadata: EMPTY_METADATA }), { style: 'auto', categories: [], concepts: [] });
  assert(generated.title.trim().length > 10, 'title written');
  assert(generated.description.trim().length > 30, 'description written');
  assert(generated.keywords.length >= 7, `keyword count ${generated.keywords.length}`);
  assert(generated.keywords.length <= 50, 'within the 50 keyword cap');
  equal(new Set(generated.keywords).size, generated.keywords.length, 'keywords unique');
  assert(generated.keywords.every((keyword) => keyword === keyword.toLowerCase()), 'keywords lowercase');
});

test('the personal keyword bank expands synonyms', () => {
  const generated = generateMetadata(
    item({ name: 'cat-sleeping.jpg', metadata: EMPTY_METADATA }),
    { style: 'auto', categories: [], concepts: [] },
    { synonyms: { cat: ['kitten', 'feline', 'domestic cat'] } },
  );
  assert(generated.keywords.includes('kitten'), 'bank synonym injected');
});

test('vector files get vector-flavoured copy', () => {
  const generated = generateMetadata(item({ name: 'flat-design-rocket-icon.svg', format: 'svg', metadata: EMPTY_METADATA }), { style: 'auto', categories: [], concepts: [] });
  assert(/icon|illustration|vector|design/i.test(`${generated.title} ${generated.keywords.join(' ')}`), 'vector vocabulary used');
});

test('Adobe adaptation strips commas and caps keywords at 49', () => {
  const adapted = adaptForPlatform(
    { ...EMPTY_METADATA, title: 'Sunset, beach, palm trees', description: 'Desc', keywords: Array.from({ length: 80 }, (_, i) => `kw${i}`), categories: [] },
    PLATFORMS.adobe,
  );
  assert(!adapted.title.includes(','), 'commas removed from Adobe title');
  assert(adapted.keywords.length <= 49, `keywords capped (${adapted.keywords.length})`);
});

test('Freepik adaptation caps the title at 100 characters', () => {
  const adapted = adaptForPlatform({ ...EMPTY_METADATA, title: 'x'.repeat(200), description: 'd', keywords: ['a'], categories: [] }, PLATFORMS.freepik);
  assert(adapted.title.length <= 100, `title length ${adapted.title.length}`);
});

test('filename tokens drop noise words and numbers', () => {
  const tokens = tokensFromFilename('IMG_2049_final-copy_beach_sunset.jpg');
  assert(tokens.includes('beach') && tokens.includes('sunset'), 'real words kept');
  assert(!tokens.includes('final') && !tokens.includes('img') && !tokens.includes('2049'), 'noise dropped');
});

/* ============================ CSV round-trip ============================ */
group('CSV metadata import (round-trip)');

test('a Shutterstock export parses straight back in', () => {
  const rows = [item({ name: 'alpha.jpg' }), item({ name: 'beta.jpg' })];
  const csv = buildPlatformCsv(rows, 'shutterstock').content;
  const parsed = parseMetadataCsv(csv);
  equal(parsed.hasHeader, true, 'header detected');
  equal(parsed.platform, 'shutterstock', 'dialect detected');
  equal(parsed.rows.length, 2, 'row count');
  equal(parsed.rows[0].filename, 'alpha.jpg', 'filename kept');
  assert((parsed.rows[0].keywords?.length ?? 0) > 5, 'keywords parsed');
});

test('a headerless Freepik export parses by dialect', () => {
  const csv = buildPlatformCsv([item({ name: 'vector-icon.eps', format: 'eps' })], 'freepik').content;
  const parsed = parseMetadataCsv(csv);
  equal(parsed.hasHeader, false, 'headerless');
  equal(parsed.platform, 'freepik', 'freepik dialect');
  equal(parsed.rows.length, 1, 'one row');
  equal(parsed.rows[0].filename, 'vector-icon.eps', 'filename');
});

test('a forced dialect overrides positional guessing', () => {
  const parsed = parseMetadataCsv("alpha.jpg;A title;one, two, three, four\n", 'freepik');
  equal(parsed.platform, 'freepik', 'forced platform');
  equal(parsed.rows[0].title, 'A title', 'positional title');
  equal(parsed.rows[0].keywords?.length, 4, 'positional keywords');
});

test('single-quoted fields with embedded delimiters split correctly', () => {
  const fields = splitFields("'a;b';'c;d'", ';', "'");
  equal(fields.length, 2, 'field count');
  equal(fields[0], 'a;b', 'quoted delimiter preserved');
});

test('rows are matched to library items by filename, case-insensitively', () => {
  const library = [item({ name: 'Alpha.JPG' }), item({ name: 'beta.png', format: 'png' })];
  const parsed = parseMetadataCsv('Filename,Title,Keywords\nalpha.jpg,T1,"a, b, c"\nbeta,T2,"x, y, z"\nmissing.jpg,T3,"q"\n');
  const plan = planApply(library, parsed.rows);
  equal(plan.size, 2, 'two matches (exact + stem)');
});

test('rows without a filename are skipped, not guessed', () => {
  const parsed = parseMetadataCsv('Filename,Title,Keywords\n,T1,"a, b"\n');
  equal(parsed.rows.length, 0, 'no rows');
  equal(parsed.skipped, 1, 'skip counted');
});

test('the AI disclosure keyword flips the aiGenerated flag', () => {
  const parsed = parseMetadataCsv('filename;title;keywords\nx.eps;Icon;\'design, _ai_generated\'\n', 'freepik');
  equal(parsed.rows[0].aiGenerated, true, 'flag detected');
});

/* ============================== sales data ============================== */
group('Earnings analytics');

test('delimiter sniffing handles comma, semicolon and quoted commas', () => {
  const comma = parseDelimited('Date,Title,Earnings\n2026-01-05,"Sunset, beach",12.50\n');
  equal(comma.delimiter, ',');
  equal(comma.rows[0][1], 'Sunset, beach', 'quoted comma preserved');
  const semi = parseDelimited('Date;Title;Earnings\n2026-01-05;Sunset;12.50\n');
  equal(semi.delimiter, ';');
});

test('portal headers are auto-mapped from synonyms', () => {
  const mapping = detectMapping(['Download Date', 'Image Title', 'Royalty', 'License Type', 'Buyer Country']);
  equal(mapping.date, 'Download Date');
  equal(mapping.title, 'Image Title');
  equal(mapping.earnings, 'Royalty');
  equal(mapping.license, 'License Type');
  equal(mapping.country, 'Buyer Country');
});

test('rows map into a normalised ledger and aggregate', () => {
  const parsed = parseDelimited('Date,Title,Earnings,Downloads\n2026-01-05,Sunset,12.50,3\n2026-01-20,Sunset,7.50,2\n2026-02-02,City,25.00,5\n');
  const mapping = detectMapping(parsed.headers);
  const sales = mapRows(parsed.rows, parsed.headers, mapping, 'shutterstock');
  equal(sales.length, 3, 'sale count');
  equal(sales[0].earnings, 12.5, 'earnings parsed as number');
  const months = monthlySeries(sales);
  equal(months.length, 2, 'two months');
  equal(months[0].month, '2026-01', 'first month');
  equal(Math.round(months[0].earnings * 100) / 100, 20, 'January total');
  equal(platformTotals(sales)[0].platform, 'shutterstock');
  equal(topTitles(sales, 5)[0].title, 'City', 'best seller first');
});

test('rows with neither date nor earnings are dropped', () => {
  const parsed = parseDelimited('Date,Title,Earnings\n,,\n2026-01-05,Sunset,1.00\n');
  const sales = mapRows(parsed.rows, parsed.headers, detectMapping(parsed.headers), 'adobe');
  equal(sales.length, 1, 'junk row dropped');
});

/* ============================ submission planner ============================ */
group('Submission planner');

test('status transitions and counts are persisted in the map', () => {
  let map = setStatus({}, 'item-1', 'adobe', 'queued');
  map = setStatus(map, 'item-1', 'adobe', 'submitted');
  map = setStatus(map, 'item-2', 'adobe', 'queued');
  equal(statusOf(map, 'item-1', 'adobe'), 'submitted');
  equal(countByStatus(map, 'adobe').submitted, 1);
  equal(countByStatus(map, 'adobe').queued, 1);
  equal(countByStatus(map, 'shutterstock').todo, 0);
});

test('every status exists and Freepik caps are encoded', () => {
  equal(STATUS_ORDER.length, 5);
  equal(PLATFORM_CAPS.freepik?.monthly, 200);
  equal(PLATFORM_CAPS.freepik?.firstBatch?.[0], 150);
  equal(PLATFORM_CAPS.freepik?.firstBatch?.[1], 200);
});

/* ============================== vector hygiene ============================== */
group('Vector hygiene');

test('SVG analysis flags scripts, handlers and editor junk', () => {
  const report = analyzeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" onclick="evil()">
       <script>alert(1)</script>
       <image href="https://example.com/a.png"/>
       <text font-family="Helvetica">Hi</text>
     </svg>`,
  );
  equal(report.hasScript, true, 'script detected');
  assert(report.eventHandlers >= 1, 'event handler detected');
  assert(report.externalRefs.length >= 1, 'external ref detected');
  assert(report.embeddedRasters >= 1, 'raster detected');
  assert(report.fonts.includes('Helvetica'), 'font listed');
  equal(report.ok, false, 'not submission clean');
});

test('SVG sanitizer removes the dangerous parts but keeps the artwork', () => {
  const result = sanitizeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" onload="x()"><script>alert(1)</script><circle cx="5" cy="5" r="4"/></svg>`,
  );
  assert(!/<script/i.test(result.text), 'script removed');
  assert(!/onload=/i.test(result.text), 'handler removed');
  assert(!/inkscape/i.test(result.text), 'editor namespace removed');
  includes(result.text, '<circle', 'geometry preserved');
  assert(result.removed.length > 0, 'removals reported');
});

test('EPS analysis reads the Illustrator version, fonts and colour space', () => {
  const report = analyzeEps(
    '%!PS-Adobe-3.0 EPSF-3.0\n%%Creator: Adobe Illustrator(R) 27.0\n%%BoundingBox: 0 0 100 100\n%%DocumentFonts: Helvetica\n1 0 0 0 setcmykcolor\n%%EOF\n',
  );
  includes(report.creator ?? '', 'Illustrator', 'creator read');
  equal(report.illustratorMajor, 27, 'major version');
  equal(report.epsVersion, 'EPSF-3.0', 'eps version');
  assert(report.documentFonts.includes('Helvetica'), 'font listed');
  assert(report.usesCmyk, 'CMYK operators detected');
});

/* ============================== XMP embedding ============================== */
group('Embedded metadata (binary round-trips)');

const metadata = {
  ...EMPTY_METADATA,
  title: 'Round trip title',
  description: 'A description used to prove the packet survives the file format.',
  keywords: ['round', 'trip', 'xmp', 'metadata', 'test', 'stock', 'keyword'],
  categories: ['Technology'],
};

test('PNG: XMP is written into iTXt and read back', () => {
  const original = fixture('sample.png');
  const result = embedMetadata(original, 'png', metadata);
  equal(result.ok, true, `embed failed: ${result.message}`);
  const read = readEmbeddedMetadata(result.bytes!, 'png');
  equal(read?.title, metadata.title, 'title round-trip');
  assert((read?.keywords?.length ?? 0) >= 5, 'keywords round-trip');
  assert(result.bytes!.length > original.length, 'file grew');
});

test('JPEG: XMP is written into APP1 and read back', () => {
  const original = fixture('sample.jpg');
  const result = embedMetadata(original, 'jpg', metadata);
  equal(result.ok, true, `embed failed: ${result.message}`);
  const read = readEmbeddedMetadata(result.bytes!, 'jpg');
  equal(read?.title, metadata.title, 'title round-trip');
});

test('SVG: XMP lands inside <metadata>', () => {
  const result = embedMetadata(fixture('sample.svg'), 'svg', metadata);
  equal(result.ok, true, `embed failed: ${result.message}`);
  includes(result.text!, '<x:xmpmeta', 'xmp packet present');
  const read = readEmbeddedMetadata(new TextEncoder().encode(result.text!), 'svg');
  equal(read?.title, metadata.title, 'title round-trip');
});

test('EPS: XMP is attached to the PostScript header', () => {
  const result = embedMetadata(fixture('sample.eps'), 'eps', metadata);
  equal(result.ok, true, `embed failed: ${result.message}`);
  includes(result.text!, 'x:xmpmeta', 'packet present');
});

test('PDF-based .ai files report a clear, actionable failure', () => {
  const result = embedMetadata(new TextEncoder().encode('%PDF-1.7\ntrailer\n'), 'ai', metadata);
  equal(result.ok, false, 'must not claim success');
  includes(result.message, 'EPS', 'advice mentions re-saving as EPS');
});

test('WebP without an XMP chunk is never silently rewritten', () => {
  const result = embedMetadata(new TextEncoder().encode('RIFF\x00\x00\x00\x00WEBPVP8 '), 'webp', metadata);
  equal(result.ok, false, 'must fail cleanly');
});

test('XMP packet build/parse is lossless for title, description and keywords', () => {
  const packet = buildXmpPacket(metadata);
  includes(packet, '<x:xmpmeta', 'packet wrapper');
  const parsed = parseXmpPacket(packet);
  equal(parsed.title, metadata.title);
  equal(parsed.keywords?.length, metadata.keywords.length);
});

/* ============================== file helpers ============================== */
group('File helpers');

test('format detection is case-insensitive and rejects unknown types', () => {
  equal(detectFormat('photo.JPG'), 'jpg');
  equal(detectFormat('art.EPS'), 'eps');
  equal(detectFormat('notes.docx'), null);
});

test('byte formatting is human readable', () => {
  includes(formatBytes(1536), 'KB');
  includes(formatBytes(5_242_880), 'MB');
});

test('base64 conversion round-trips binary data', () => {
  const bytes = fixture('sample.png');
  const restored = base64ToBytes(bytesToBase64(bytes));
  equal(restored.length, bytes.length, 'length preserved');
  equal(restored[0], bytes[0], 'first byte preserved');
});

/* ================================ summary ================================ */
console.log(`\n${'─'.repeat(52)}`);
console.log(`${passed} passed · ${failures.length} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`  • ${failure}`);
  process.exit(1);
}
console.log('All domain-layer checks passed.');
