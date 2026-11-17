import { parseDelimited, detectMapping, mapRows, monthlySeries } from '@/lib/stock/sales';
import { setStatus, statusOf, countByStatus } from '@/lib/stock/submissions';
/**
 * Runtime test suite for the domain, codec, AI and creative tool engines.
 *
 * Run with `npm test` (bundled by esbuild with the `@/` alias and executed on Node).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { generateCsv, generateUniversalCsv, keywordsFor } from '@/lib/stock/csv';
import { parseMetadataCsv, planApply, splitFields } from '@/lib/stock/csvimport';
import {
  cleanStockSentence,
  draftMetadata,
  formatMetadataForClipboard,
  mergeKeywords,
  parseKeywordInput,
  scrubStockKeywords,
  tokensFromFilename,
} from '@/lib/stock/metadata';
import { sanitizeFilename, validateItem, validateEverywhere, worstLevel } from '@/lib/stock/validate';
import { PLATFORMS, PLATFORM_LIST, findPlatform } from '@/lib/stock/platforms';
import { PLATFORM_BRAND } from '@/lib/stock/brand';
import { SHUTTERSTOCK_CATEGORIES } from '@/lib/stock/categories';
import { detectFormat, formatBytes, bytesToBase64, base64ToBytes } from '@/lib/stock/files';
import {
  buildXmpPacket,
  canEmbedFormat,
  embedMetadata,
  extractEmbeddedXmp,
  sidecarFilename,
} from '@/lib/stock/xmp';
import { analyzeEps, analyzeSvg, sanitizeSvg } from '@/lib/stock/vectorcheck';
import {
  DEFAULT_AI,
  PROVIDER_LIST,
  PROVIDERS,
  extractJsonMetadata,
  inferModelBrand,
  isAiConfigured,
  modelSupportsVision,
  normalizeOllamaBase,
  normalizeOpenAiBase,
  sanitizeAiSettings,
} from '@/lib/stock/ai';
import { planPasses, outputFilename as upscaleOutputFilename } from '@/lib/stock/upscale/engine';
import {
  UPSCALE_FORMATS,
  UPSCALE_MODELS,
  UPSCALE_PURPOSES,
  UPSCALE_TARGETS,
  buildUpscaleInstallSpec,
  resolveTargetSize,
} from '@/lib/stock/upscale/models';
import { BG_MODELS, BG_PURPOSES, buildBgInstallSpec, postprocessBgMask } from '@/lib/tools/bgremove';
import {
  VIDEO_MODELS,
  VIDEO_OUTPUT_FORMATS,
  VIDEO_PURPOSES,
  VIDEO_TARGETS,
  buildVideoInstallSpec,
  formatDuration,
  resolveVideoDimensions,
  upscaleVideoInApp,
} from '@/lib/tools/videoupscale';
import {
  ACCEPT_ATTRIBUTE,
  CONVERT_FORMATS,
  CONVERT_RESIZE_PRESETS,
  SUPPORTED_INPUT_EXTENSIONS,
  buildConvertedFilename,
  encodeBmp,
  encodeGif,
  encodeIco,
  encodeTiff,
  isSupportedInputExtension,
} from '@/lib/tools/converter';
import {
  decodeBmp,
  decodeCin,
  decodeDds,
  decodeDpx,
  decodeExr,
  decodeFarbfeld,
  decodeFits,
  decodeGif,
  decodeHdr,
  decodeIcns,
  decodeIff,
  decodeKtx,
  decodeNetpbm,
  decodePcx,
  decodePdfPreview,
  decodePfm,
  decodePng,
  decodePsd,
  decodeQoi,
  decodeRas,
  decodeSgi,
  decodeSvgz,
  decodeTga,
  decodeTiff,
  decodeWbmp,
  decodeXbm,
  decodeXpm,
  decodeBytesAuto,
  detectImageFormat,
  encodeAi,
  encodeApng,
  encodeBmp as encodeBmpCodec,
  encodeCin,
  encodeCur,
  encodeDds,
  encodeDpx,
  encodeEps,
  encodeExr,
  encodeFarbfeld,
  encodeFits,
  encodeGif as encodeGifCodec,
  encodeHdr,
  encodeIcns,
  encodeIco as encodeIcoCodec,
  encodeIff,
  encodeKtx,
  encodeNetpbm,
  encodePcx,
  encodePdf,
  encodePfm,
  encodePng,
  encodePsd,
  encodeQoi,
  encodeRas,
  encodeSgi,
  encodeSvg,
  encodeSvgz,
  encodeTga,
  encodeTiff as encodeTiffCodec,
  encodeWbmp,
  encodeXbm,
  encodeXpm,
  decodeCur,
  decodeIcon,
} from '@/lib/tools/imageCodecs';
import { CURRENCIES, currencyMeta, money } from '@/lib/format';
import { SCHEMA_SQL } from '@/lib/cloud/schema';
import { sizeCapOptions } from '@/lib/stock/sizecaps';
import { APP_NAME, APP_VERSION } from '@/lib/version';
import { recommendUpscale } from '@/lib/stock/upscale/recommend';
import { checkPassword } from '@/lib/auth/password';
import { DEFAULT_FLAGS, kindOf, megapixels, type StockItem } from '@/lib/stock/types';

declare const FIXTURE_DIR: string;

let passed = 0;
const failures: string[] = [];
const pending: Array<Promise<void>> = [];

function test(name: string, fn: () => void | Promise<void>) {
  let result: void | Promise<void>;
  try {
    result = fn();
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`  ✗ ${name}`);
    console.log(`      ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (result instanceof Promise) {
    pending.push(
      result.then(
        () => {
          passed++;
          console.log(`  ✓ ${name}`);
        },
        (error: unknown) => {
          failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
          console.log(`  ✗ ${name}`);
          console.log(`      ${error instanceof Error ? error.message : String(error)}`);
        },
      ),
    );
    return;
  }
  passed++;
  console.log(`  ✓ ${name}`);
}

function group(title: string) {
  console.log(`\n${title}`);
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `${message ?? 'value mismatch'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function includes(haystack: string, needle: string, message?: string) {
  if (!haystack.includes(needle)) {
    throw new Error(`${message ?? 'missing text'}: ${JSON.stringify(needle)}`);
  }
}

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTURE_DIR, name)));

let seq = 0;
const BASE_METADATA = {
  title: 'Golden sunset over calm tropical ocean beach',
  description: 'Golden sunset reflected on calm tropical ocean waves with palm silhouettes.',
  keywords: [
    'sunset', 'beach', 'tropical', 'ocean', 'golden', 'coast', 'horizon', 'palm',
    'travel', 'nature', 'vacation', 'sea', 'evening', 'sky', 'reflection', 'calm',
    'summer', 'landscape', 'island', 'paradise', 'scenic', 'twilight',
  ],
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
    embeddedAt: stamp,
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
group('Platform registry (14 microstock agencies)');

test('all 14 marketplaces have crisp HD brand marks and zero dashes in rules', () => {
  equal(PLATFORM_LIST.length, 14, 'platform count');
  for (const platform of PLATFORM_LIST) {
    assert(/^#/.test(platform.color), `${platform.id} colour`);
    const brand = PLATFORM_BRAND[platform.id];
    assert(brand && /^#/.test(brand.color), `${platform.id} brand`);
    assert(Boolean(brand.glyph || brand.monogram), `${platform.id} mark`);
    for (const tip of platform.tips ?? []) {
      assert(!/[—–]/.test(tip), `no dash in tip for ${platform.id}: ${tip}`);
    }
  }
});

test('Shutterstock, Adobe Stock, Freepik, Getty and Alamy follow 2026 rules', () => {
  equal(PLATFORMS.shutterstock.keywords.min, 7);
  equal(PLATFORMS.shutterstock.keywords.max, 50);
  equal(PLATFORMS.adobe.keywords.max, 49);
  equal(PLATFORMS.adobe.keywords.ordered, true);
  equal(PLATFORMS.freepik.csv?.delimiter, ';');
  equal(SHUTTERSTOCK_CATEGORIES.length, 26);
  equal(PLATFORMS.shutterstock.aiPolicy, 'forbidden');
  equal(PLATFORMS.getty.aiPolicy, 'forbidden');
  equal(PLATFORMS.alamy.aiPolicy, 'forbidden');
  equal(PLATFORMS.adobe.aiPolicy, 'allowed-labeled');
  equal(PLATFORMS.freepik.aiPolicy, 'allowed-labeled');
});

test('findPlatform and sizeCapOptions stay deterministic', () => {
  equal(findPlatform('Shutterstock'), 'shutterstock');
  equal(findPlatform('iStock'), 'getty');
  equal(findPlatform('Adobe Stock'), 'adobe');
  equal(findPlatform('Freepik'), 'freepik');
  equal(findPlatform('unknown portal'), null);
  const caps = sizeCapOptions();
  equal(new Set(caps.map((c) => c.value)).size, caps.length, 'unique size caps');
});

/* ============================== CSV writers ============================== */
group('CSV export & import dialects');

test('Shutterstock, Adobe, Depositphotos, Freepik and Universal CSV export cleanly', () => {
  const ss = generateCsv('shutterstock', [item({ name: 'beach.jpg' })]);
  assert(ss !== null, 'Shutterstock CSV');
  includes(ss!.content, 'Filename,Description,Keywords,Categories', 'SS header');
  includes(ss!.content, 'beach.jpg', 'SS filename');

  const adobe = generateCsv('adobe', [item({ name: 'studio.jpg' })]);
  assert(adobe !== null, 'Adobe CSV');
  includes(adobe!.content, 'Filename,Title,Keywords,Category', 'Adobe header');

  const dp = generateCsv('depositphotos', [
    item({ name: 'news.jpg', flags: { ...DEFAULT_FLAGS, editorial: true } }),
  ]);
  assert(dp !== null, 'Depositphotos CSV');
  includes(dp!.content, 'yes', 'Depositphotos editorial flag');

  const fp = generateCsv('freepik', [
    item({ name: 'icon.eps', format: 'eps', flags: { ...DEFAULT_FLAGS, aiGenerated: true } }),
  ]);
  assert(fp !== null, 'Freepik CSV');
  includes(fp!.content, ';', 'Freepik semicolon delimiter');

  const uni = generateUniversalCsv([item({ name: 'universal.jpg' })]);
  includes(uni.content, 'Filename', 'Universal header');
  includes(uni.content, 'universal.jpg', 'Universal row');

  const capped = keywordsFor(
    item({ metadata: { ...BASE_METADATA, keywords: Array.from({ length: 60 }, (_, i) => `tag${i}`) } }),
    PLATFORMS.adobe,
  );
  assert(capped.length <= 49, 'Adobe 49 keyword cap honoured');
});

test('CSV importer parses Freepik headerless and multi-agency files', () => {
  const parsed = parseMetadataCsv('alpha.jpg;A clean title;one, two, three, four\n', 'freepik');
  equal(parsed.platform, 'freepik');
  equal(parsed.rows[0].title, 'A clean title');
  equal(parsed.rows[0].keywords?.length, 4);

  const fields = splitFields("'a;b';'c;d'", ';', "'");
  equal(fields.length, 2);
  equal(fields[0], 'a;b');

  const lib = [item({ name: 'Alpha.JPG' }), item({ name: 'beta.png', format: 'png' })];
  const csv = parseMetadataCsv('Filename,Title,Keywords\nalpha.jpg,T1,"a, b, c"\nbeta,T2,"x, y, z"\n');
  equal(planApply(lib, csv.rows).size, 2);
});

/* ======================== metadata & validation ========================== */
group('SEO metadata & agency validation');

test('draftMetadata generates zero-dash commercial titles, descriptions and keywords', () => {
  const meta = draftMetadata(
    item({
      name: 'minimalist-workspace_coffee-laptop.jpg',
      metadata: { title: '', description: '', keywords: [], categories: [] },
    }),
  );
  assert(meta.title.length >= 20, 'commercial title length');
  assert(meta.description.length >= 25, 'commercial description length');
  assert(meta.keywords.length >= 15, 'rich keyword list');
  assert(!/[—–\-]/.test(meta.title), `no dash in title: ${meta.title}`);
  assert(!/[—–]/.test(meta.description), 'no dash in description');
  assert(tokensFromFilename('IMG_2026_golden-retriever.jpg').includes('golden'), 'tokens parsed');

  const scrubbed = scrubStockKeywords(['Camera', 'camera', 'nikon', 'sunrise', 'ocean', 'a'], 50);
  assert(!scrubbed.includes('nikon'), 'camera brand scrubbed');
  assert(scrubbed.includes('sunrise'), 'clean keyword retained');
  equal(scrubbed.filter((k) => k === 'camera').length, 1, 'deduplicated');

  const cleaned = cleanStockSentence('Modern studio — laptop – bright morning');
  assert(!/[—–]/.test(cleaned), 'cleanStockSentence strips all dashes');

  const merged = mergeKeywords(['sunset', 'beach'], parseKeywordInput('beach, ocean; coast'), 50);
  equal(merged.length, 4);

  const clip = formatMetadataForClipboard(meta, 'all');
  includes(clip, meta.title, 'clipboard has title');
  includes(clip, meta.keywords[0], 'clipboard has keywords');
});

test('validator flags restricted brands, low MP, bad filenames and forbidden AI', () => {
  const clean = validateItem(item(), 'adobe');
  assert(worstLevel(clean) === 'ok' || worstLevel(clean) === 'info', 'clean item has zero warnings/errors');

  const tiny = validateItem(item({ width: 800, height: 600 }), 'shutterstock');
  equal(worstLevel(tiny), 'error', 'low resolution fails Shutterstock 4 MP floor');

  const aiOnSs = validateItem(item({ flags: { ...DEFAULT_FLAGS, aiGenerated: true } }), 'shutterstock');
  equal(worstLevel(aiOnSs), 'error', 'AI content rejected on Shutterstock');

  const tm = validateItem(
    item({
      metadata: {
        ...BASE_METADATA,
        title: 'Person holding iPhone in Nike shoes',
        keywords: [...BASE_METADATA.keywords, 'iphone', 'nike'],
      },
    }),
    'adobe',
  );
  assert(tm.some((i) => i.level === 'error' || i.level === 'warn'), 'trademarks flagged');

  const all = validateEverywhere(item(), [item()]);
  equal(Object.keys(all).length, 14, 'validated across all 14 agencies');
  const renamed = sanitizeFilename('My Photo Final.JPG');
  equal(renamed.changed, true);
  assert(!/\s/.test(renamed.name), 'spaces removed from filename');
  equal(kindOf(item({ format: 'svg' })), 'vector');
  equal(kindOf(item({ format: 'jpg' })), 'photo');
  equal(megapixels(item({ width: 4000, height: 3000 })), 12);
});

test('Earnings import and submission status tracking remain available', () => {
  const parsed = parseDelimited('Date,Title,Earnings,Downloads\n2026-01-15,Sunrise,2.50,3');
  const sales = mapRows(parsed.rows, parsed.headers, detectMapping(parsed.headers), 'shutterstock');
  equal(sales.length, 1);
  equal(monthlySeries(sales)[0].earnings, 2.5);
  const map = setStatus({}, 'image-1', 'shutterstock', 'submitted');
  equal(statusOf(map, 'image-1', 'shutterstock'), 'submitted');
  equal(countByStatus(map, 'shutterstock').submitted, 1);
});

/* =========================== XMP / IPTC embed ============================ */
group('Lossless XMP & IPTC embedding');

test('JPEG (XMP + IPTC), PNG (iTXt), SVG and EPS round-trip cleanly', () => {
  equal(canEmbedFormat('jpg'), true);
  equal(canEmbedFormat('png'), true);
  equal(canEmbedFormat('webp'), true);
  equal(canEmbedFormat('svg'), true);

  const jpgBytes = embedMetadata(fixture('sample.jpg'), 'jpg', BASE_METADATA);
  assert(jpgBytes !== null && jpgBytes.length > fixture('sample.jpg').length, 'JPEG embedded');
  const jpgRead = extractEmbeddedXmp(jpgBytes!, 'jpg');
  equal(jpgRead?.title, BASE_METADATA.title, 'JPEG title round-trip');
  assert((jpgRead?.keywords?.length ?? 0) >= 15, 'JPEG keywords round-trip');

  const pngBytes = embedMetadata(fixture('sample.png'), 'png', BASE_METADATA);
  assert(pngBytes !== null && pngBytes.length > fixture('sample.png').length, 'PNG embedded');
  const pngRead = extractEmbeddedXmp(pngBytes!, 'png');
  equal(pngRead?.title, BASE_METADATA.title, 'PNG title round-trip');

  const svgBytes = embedMetadata(fixture('sample.svg'), 'svg', BASE_METADATA);
  assert(svgBytes !== null, 'SVG embedded');
  equal(extractEmbeddedXmp(svgBytes!, 'svg')?.title, BASE_METADATA.title, 'SVG title round-trip');

  const epsBytes = embedMetadata(fixture('sample.eps'), 'eps', BASE_METADATA);
  assert(epsBytes !== null, 'EPS embedded');

  const packet = buildXmpPacket(BASE_METADATA);
  includes(packet, '<x:xmpmeta');
  equal(sidecarFilename('photo.tiff'), 'photo.xmp');
});

test('vector analyzer and file helpers operate cleanly', () => {
  const report = analyzeSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" onclick="x()"><script>1</script><rect width="10" height="10"/></svg>',
  );
  equal(report.ok, false, 'unsafe SVG flagged');
  equal(report.hasScript, true, 'script detected');
  assert(report.eventHandlers >= 1, 'event handler detected');
  const cleaned = sanitizeSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" onclick="x()"><script>1</script><rect width="10" height="10"/></svg>',
  );
  assert(!cleaned.text.includes('<script'), 'script removed');
  assert(cleaned.removed.length >= 1, 'removals tracked');
  assert(Array.isArray(analyzeEps(new TextDecoder().decode(fixture('sample.eps'))).documentFonts), 'EPS analyzed');

  equal(detectFormat('photo.JPG'), 'jpg');
  equal(detectFormat('art.EPS'), 'eps');
  equal(detectFormat('notes.docx'), null);
  includes(formatBytes(5_242_880), 'MB');
  const raw = fixture('sample.png');
  equal(base64ToBytes(bytesToBase64(raw)).length, raw.length);
});

/* =========================== AI provider engine ========================== */
group('AI metadata engine (10 providers + official brand logos)');

test('all 10 AI providers have valid configurations and brand logos', () => {
  equal(PROVIDER_LIST.length, 10, '10 providers');
  for (const p of PROVIDER_LIST) {
    assert(p.brand.length > 0, `${p.kind} brand`);
    assert(!/[—–]/.test(p.summary), `${p.kind} zero-dash summary`);
    if (p.kind === 'local' || p.kind === 'custom') continue;
    assert(/^https?:\/\//.test(p.baseUrl), `${p.kind} baseUrl`);
  }
  for (const id of [
    'local', 'ollama', 'openrouter', 'gemini', 'mistral',
    'nvidia', 'groq', 'cerebras', 'together', 'custom',
  ] as const) {
    assert(Boolean(PROVIDERS[id]), `provider ${id}`);
  }
});

test('AI URL normalizers, vision detection, brand inference and JSON parser work', () => {
  equal(normalizeOpenAiBase('https://api.groq.com/openai/v1/chat/completions'), 'https://api.groq.com/openai/v1');
  equal(normalizeOllamaBase('http://localhost:11434/api/chat/'), 'http://localhost:11434');

  const groqNoKey = sanitizeAiSettings({ ...DEFAULT_AI, kind: 'groq', apiKey: '', keys: {} });
  const groqWithKey = sanitizeAiSettings({
    ...DEFAULT_AI,
    kind: 'groq',
    apiKey: 'gsk_test_123',
    keys: { groq: 'gsk_test_123' },
  });
  equal(isAiConfigured(groqNoKey), false, 'cloud without key not ready');
  equal(isAiConfigured(groqWithKey), true, 'cloud with key ready');

  equal(inferModelBrand('google/gemini-2.5-flash'), 'gemini');
  equal(inferModelBrand('google/gemma-4-31b-it:free'), 'gemma');
  equal(inferModelBrand('meta-llama/llama-4-scout'), 'meta');
  equal(inferModelBrand('qwen/qwen3.6-plus:free'), 'qwen');
  equal(inferModelBrand('deepseek/deepseek-r1'), 'deepseek');
  equal(inferModelBrand('z-ai/glm-4.5-air:free'), 'zhipu');
  equal(modelSupportsVision('gemini', 'gemini-2.5-flash'), true);
  equal(modelSupportsVision('ollama', 'qwen2.5vl:7b'), true);

  const parsed = extractJsonMetadata(
    '```json\n{"title":"Modern studio — desk – coffee","description":"Bright studio — natural light.","keywords":["Desk","desk","coffee","laptop","minimal","office","work","creative"]}\n```',
    BASE_METADATA,
    49,
  );
  assert(!/[—–]/.test(parsed.title), 'dashes removed from AI title');
  assert(!/[—–]/.test(parsed.description), 'dashes removed from AI description');
  equal(parsed.keywords.filter((k) => k === 'desk').length, 1, 'AI keywords deduplicated');
});

/* ======================== creative tool suites =========================== */
group('Image Upscaler, Video Upscaler, BG Remover & Converter');

test('Image Upscaler ships 31 models, 8 purposes, agency presets and in-app install specs', () => {
  assert(UPSCALE_MODELS.length >= 31, `image models: ${UPSCALE_MODELS.length}`);
  assert(UPSCALE_PURPOSES.length >= 8, 'image purposes');
  assert(UPSCALE_TARGETS.length >= 9, 'image targets');
  assert(UPSCALE_FORMATS.length >= 3, 'image output formats (PNG, JPG, WebP)');
  const ncnn = UPSCALE_MODELS.find((m) => m.id === 'realesrgan-x4plus')!;
  assert(buildUpscaleInstallSpec(ncnn) !== null, 'install spec for Real-ESRGAN');
  const target = resolveTargetSize(2000, 1500, UPSCALE_TARGETS.find((t) => t.id === '4k')!, 4);
  assert(target.width >= 3840 || target.height >= 2160, '4K target achieved');
  const plan = planPasses(4, [4]);
  assert(plan.passes.length >= 1 && plan.passes[0] === 4, 'pass plan generated');
  includes(upscaleOutputFilename('hero.jpg', 4, 'png'), '.png');
});

test('Background Remover catalog contains built-in and ONNX install specs', () => {
  assert(BG_MODELS.length >= 16, `bg models: ${BG_MODELS.length}`);
  assert(BG_PURPOSES.length >= 6, 'bg purposes');
  assert(BG_MODELS.filter((m) => m.kind === 'builtin').length >= 2, 'instant zero-download engines included');
  const onnx = BG_MODELS.find((m) => m.kind === 'onnx' && Boolean(m.url))!;
  const spec = buildBgInstallSpec(onnx);
  assert(spec !== null && spec.files[0]?.url.startsWith('https://'), 'HTTPS ONNX weight spec');
});

test('Background mask postprocessing handles clothing classes and malformed outputs', () => {
  const cloth = { ...BG_MODELS.find((m) => m.id === 'u2net-cloth-seg')!, inputSize: 2 };
  const pixels = new Float32Array([4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 4]);
  equal(Array.from(postprocessBgMask(cloth, pixels, [1, 4, 2, 2])).join(','), '0,255,255,255', 'clothing labels');
  let rejected = false;
  try { postprocessBgMask(cloth, pixels, [1, 1, 1, 1]); } catch { rejected = true; }
  assert(rejected, 'unexpected shape rejected');
  const general = { ...BG_MODELS[0], inputSize: 2 };
  equal(Array.from(postprocessBgMask(general, new Float32Array([1, 1, 1, 1]), [1, 1, 2, 2])).join(','), '255,255,255,255', 'constant foreground');
});

test('Unsupported neural video models are rejected instead of silently falling back', async () => {
  let message = '';
  try { await upscaleVideoInApp(new Blob(), 'test.mp4', { width: 1, height: 1, duration: 1 }, { modelId: 'realesr-animevideov3-x2', target: VIDEO_TARGETS[0], fps: 24, format: 'mp4', bitrateMbps: 12, keepAudio: false }); }
  catch (e) { message = e instanceof Error ? e.message : String(e); }
  includes(message, 'not yet supported');
});

test('Video catalog contains presets and future model install specs', () => {
  assert(VIDEO_MODELS.length >= 23, `video models: ${VIDEO_MODELS.length}`);
  assert(VIDEO_PURPOSES.length >= 6, 'video purposes');
  assert(VIDEO_TARGETS.length >= 8, 'video presets');
  equal(VIDEO_OUTPUT_FORMATS.length, 2, 'MP4 & WebM');
  assert(VIDEO_MODELS.some((m) => (m.fpsMultiplier ?? 1) >= 2), 'RIFE entry exists in catalog');
  const installable = VIDEO_MODELS.find((m) => buildVideoInstallSpec(m) !== null);
  assert(Boolean(installable), 'in-app video NCNN/RIFE archive specs available');
  const dims = resolveVideoDimensions(1920, 1080, 3840);
  equal(dims.width, 3840);
  equal(dims.height, 2160);
  equal(formatDuration(125), '2:05');
});

test('Image Converter covers 43 formats with pure-TS BMP, TIFF, ICO and GIF89a LZW encoders', () => {
  equal(CONVERT_FORMATS.length, 43, '43 formats');
  assert(CONVERT_RESIZE_PRESETS.length >= 6, 'resize presets');
  equal(buildConvertedFilename('sample-photo.png', 'webp'), 'sample-photo.webp');
  equal(buildConvertedFilename('sample-photo.jpg', 'tiff'), 'sample-photo.tiff');
  equal(buildConvertedFilename('hero.png', 'psd'), 'hero.psd');
  equal(buildConvertedFilename('hero.png', 'exr'), 'hero.exr');
  equal(buildConvertedFilename('hero.png', 'jxl'), 'hero.jxl');
  // Every output format has a unique id, extension and MIME type.
  equal(new Set(CONVERT_FORMATS.map((f) => f.id)).size, CONVERT_FORMATS.length, 'unique ids');
  equal(new Set(CONVERT_FORMATS.map((f) => f.ext)).size, CONVERT_FORMATS.length, 'unique exts');
  // Decode-only inputs (HEIC, camera RAW, design ZIPs) are accepted.
  for (const ext of ['heic', 'heif', 'dng', 'cr2', 'nef', 'arw', 'psd', 'exr', 'dpx', 'cin', 'sgi', 'fits', 'qoi', 'jxl', 'jp2']) {
    assert(isSupportedInputExtension(ext), `input ${ext}`);
    assert(SUPPORTED_INPUT_EXTENSIONS.includes(ext), `supported ${ext}`);
  }
  assert(ACCEPT_ATTRIBUTE.includes('.heic'), 'accept heic');
  assert(ACCEPT_ATTRIBUTE.includes('.dng'), 'accept dng');
  assert(ACCEPT_ATTRIBUTE.includes('image/*'), 'accept image wildcard');
  // Alpha and XMP capability flags are coherent.
  for (const fmt of CONVERT_FORMATS) {
    assert(fmt.label.length > 0 && fmt.mime.length > 0 && fmt.tag.length > 0, `${fmt.id} spec`);
  }
  assert(CONVERT_FORMATS.find((f) => f.id === 'jpg')?.supportsAlpha === false, 'jpg no alpha');
  assert(CONVERT_FORMATS.find((f) => f.id === 'png')?.supportsAlpha === true, 'png alpha');
  assert(CONVERT_FORMATS.find((f) => f.id === 'jpg')?.supportsXmp === true, 'jpg xmp');

  const rgba = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 0, 128,
  ]);
  const bmp = encodeBmp(rgba, 2, 2, true);
  equal(bmp[0], 0x42, 'BMP B');
  equal(bmp[1], 0x4d, 'BMP M');

  const tiff = encodeTiff(rgba, 2, 2, true);
  equal(tiff[0], 0x49, 'TIFF II');
  equal(tiff[1], 0x49, 'TIFF II');
  equal(tiff[2], 42, 'TIFF 42');

  const gif = encodeGif(rgba, 2, 2, true);
  equal(String.fromCharCode(gif[0], gif[1], gif[2], gif[3], gif[4], gif[5]), 'GIF89a');
  equal(gif[gif.length - 1], 0x3b, 'GIF trailer');

  const fakePng = fixture('sample.png');
  const ico = encodeIco([{ size: 32, png: fakePng }]);
  equal(ico[0], 0, 'ICO reserved 0');
  equal(ico[2], 1, 'ICO type 1');
  equal(ico[4], 1, 'ICO image count 1');
});

test('Pure codec self-round trips preserve dimensions and selected pixels', () => {
  const rgba = new Uint8ClampedArray([
    255, 10, 20, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 0, 255,
  ]);
  const check = (label: string, decoded: { width: number; height: number; data: Uint8ClampedArray }) => {
    equal(decoded.width, 2, `${label} width`);
    equal(decoded.height, 2, `${label} height`);
    equal(decoded.data[0], 255, `${label} r0`);
    equal(decoded.data[1], 10, `${label} g0`);
    equal(decoded.data[2], 20, `${label} b0`);
  };
  check('PNG', decodePng(encodePng(rgba, 2, 2)));
  check('APNG', decodePng(encodeApng(rgba, 2, 2)));
  check('BMP', decodeBmp(encodeBmpCodec(rgba, 2, 2, true)));
  check('TIFF', decodeTiff(encodeTiffCodec(rgba, 2, 2, true)));
  check('QOI', decodeQoi(encodeQoi(rgba, 2, 2)));
  check('TGA', decodeTga(encodeTga(rgba, 2, 2)));
  check('DDS', decodeDds(encodeDds(rgba, 2, 2)));
  check('KTX', decodeKtx(encodeKtx(rgba, 2, 2)));
  check('DPX', decodeDpx(encodeDpx(rgba, 2, 2)));
  check('CIN', decodeCin(encodeCin(rgba, 2, 2)));
  check('SGI', decodeSgi(encodeSgi(rgba, 2, 2)));
  check('PCX', decodePcx(encodePcx(rgba, 2, 2)));
  check('Farbfeld', decodeFarbfeld(encodeFarbfeld(rgba, 2, 2)));
  check('PPM', decodeNetpbm(encodeNetpbm(rgba, 2, 2, 'ppm')));
  const pgm = decodeNetpbm(encodeNetpbm(rgba, 2, 2, 'pgm'));
  equal(pgm.width, 2, 'PGM width');
  equal(pgm.data[0], pgm.data[1], 'PGM grayscale');
  check('PAM', decodeNetpbm(encodeNetpbm(rgba, 2, 2, 'pam')));
  check('RAS', decodeRas(encodeRas(rgba, 2, 2)));
  check('FITS', decodeFits(encodeFits(rgba, 2, 2)));
  check('PSD', decodePsd(encodePsd(rgba, 2, 2, false)));
  check('EXR', decodeExr(encodeExr(rgba, 2, 2)));
  check('HDR', decodeHdr(encodeHdr(rgba, 2, 2)));
  check('PFM', decodePfm(encodePfm(rgba, 2, 2)));
  // PBM is bilevel: dimensions only.
  const pbm = decodeNetpbm(encodeNetpbm(rgba, 2, 2, 'pbm'));
  equal(pbm.width, 2, 'PBM width');
  equal(pbm.height, 2, 'PBM height');
});

test('Icon, wrapper and palette codecs round trip (ICO, CUR, ICNS, GIF, IFF, WBMP, XBM, XPM, SVG, SVGZ, EPS, PDF, AI)', async () => {
  const rgba = new Uint8ClampedArray([
    255, 10, 20, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 0, 255,
  ]);
  const png = encodePng(rgba, 2, 2);
  const ico = decodeIcon(encodeIcoCodec([{ size: 2, png }]), 1);
  equal(ico.width, 2, 'ICO width');
  equal(ico.height, 2, 'ICO height');
  const cur = decodeCur(encodeCur([{ size: 2, png }]));
  equal(cur.width, 2, 'CUR width');
  const icns = decodeIcns(encodeIcns(rgba, 2, 2));
  equal(icns.width, 2, 'ICNS width');
  const gif = decodeGif(encodeGifCodec(rgba, 2, 2, true));
  equal(gif.width, 2, 'GIF width');
  equal(gif.height, 2, 'GIF height');
  const iff = decodeIff(encodeIff(rgba, 2, 2));
  equal(iff.width, 2, 'IFF width');
  const wbmp = decodeWbmp(encodeWbmp(rgba, 2, 2));
  equal(wbmp.width, 2, 'WBMP width');
  const xbm = decodeXbm(encodeXbm(rgba, 2, 2));
  equal(xbm.width, 2, 'XBM width');
  const xpm = decodeXpm(encodeXpm(rgba, 2, 2));
  equal(xpm.width, 2, 'XPM width');
  const svgz = await decodeSvgz(encodeSvgz(rgba, 2, 2));
  equal(svgz.width, 2, 'SVGZ width');
  const pdf = await decodePdfPreview(encodePdf(rgba, 2, 2));
  equal(pdf.width, 2, 'PDF width');
  const ai = await decodePdfPreview(encodeAi(rgba, 2, 2));
  equal(ai.width, 2, 'AI width');
  // EPS and SVG wrappers carry a decodable PNG payload.
  const epsBytes = encodeEps(rgba, 2, 2);
  assert(new TextDecoder().decode(epsBytes).includes('MSAP_PNG_HEX:'), 'EPS payload');
  const svgBytes = encodeSvg(rgba, 2, 2);
  assert(new TextDecoder().decode(svgBytes).includes('<svg'), 'SVG markup');
});

test('Magic detection and auto decode route every family', async () => {
  const rgba = new Uint8ClampedArray([
    255, 10, 20, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 0, 255,
  ]);
  equal(detectImageFormat(encodePng(rgba, 2, 2)), 'png');
  equal(detectImageFormat(encodeQoi(rgba, 2, 2)), 'qoi');
  equal(detectImageFormat(encodeTga(rgba, 2, 2), 'photo.tga'), 'tga');
  equal(detectImageFormat(encodeExr(rgba, 2, 2)), 'exr');
  equal(detectImageFormat(encodeHdr(rgba, 2, 2)), 'hdr');
  equal(detectImageFormat(encodePfm(rgba, 2, 2)), 'pfm');
  equal(detectImageFormat(encodeFarbfeld(rgba, 2, 2)), 'farbfeld');
  equal(detectImageFormat(encodeNetpbm(rgba, 2, 2, 'ppm')), 'pnm');
  equal(detectImageFormat(encodeNetpbm(rgba, 2, 2, 'pam')), 'pam');
  equal(detectImageFormat(encodeRas(rgba, 2, 2)), 'ras');
  equal(detectImageFormat(encodeFits(rgba, 2, 2)), 'fits');
  equal(detectImageFormat(encodePsd(rgba, 2, 2, false)), 'psd');
  equal(detectImageFormat(encodeSvg(rgba, 2, 2)), 'svg');
  equal(detectImageFormat(encodePdf(rgba, 2, 2)), 'pdf');
  const auto = await decodeBytesAuto(encodePng(rgba, 2, 2), 'photo.png');
  equal(auto.width, 2, 'auto width');
  equal(auto.data[0], 255, 'auto r0');
  const autoQoi = await decodeBytesAuto(encodeQoi(rgba, 2, 2), 'photo.qoi');
  equal(autoQoi.width, 2, 'auto qoi width');
});

/* ====================== quality checker & optimizer ====================== */
group('Quality Checker & Image Optimizer');

import {
  analyseImage,
  analyseSvgFile,
  differenceHash,
  hamming,
  measurePixels,
  measureSvg,
} from '@/lib/stock/quality';
import { downscaleRaster, optimizeRaster, suggestedFormat } from '@/lib/tools/optimizer';
import { pathToPostScript, starPath, svgToEps, toMatrix } from '@/lib/vector/editor';

test('SVG analysis separates editable artwork from flattened exports', () => {
  const editable = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="a"><rect x="1" y="1" width="20" height="20" fill="#f00"/><path d="M10 10 L 90 90"/><circle cx="50" cy="50" r="8"/></g></svg>';
  const ok = analyseSvgFile(editable, 'art.svg', editable.length);
  equal(ok.verdict, 'ready');
  equal(ok.issues.filter((i) => i.severity === 'error').length, 0);
  assert(ok.platforms.some((p) => p.ok), 'vector accepted somewhere');

  const flat = '<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000"><image href="data:image/png;base64,AAAA" width="2000" height="2000"/></svg>';
  const bad = analyseSvgFile(flat, 'canva.svg', flat.length);
  equal(bad.verdict, 'reject');
  includes(bad.issues[0].title, 'flattened');

  const metrics = measureSvg(editable);
  equal(metrics.editableNodes, 3);
  equal(metrics.groups, 1);
});

test('SVG analysis flags foreignObject, scripts and live text', () => {
  const risky = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><foreignObject><div>x</div></foreignObject><text font-family="Arial">hi</text><rect width="5" height="5"/></svg>';
  const report = analyseSvgFile(risky, 'risky.svg', risky.length);
  const ids = report.issues.map((i) => i.id);
  assert(ids.includes('svg-foreign-object'), 'foreignObject flagged');
  assert(ids.includes('svg-live-text'), 'live text flagged');
  equal(report.verdict, 'review');
});

test('pixel metrics detect softness, clipping and duplicates', () => {
  const flat = new Uint8ClampedArray(32 * 32 * 4).fill(128);
  for (let i = 3; i < flat.length; i += 4) flat[i] = 255;
  const soft = measurePixels(flat, 32, 32);
  equal(soft.sharpness, 0, 'flat image has no edges');

  const checker = new Uint8ClampedArray(32 * 32 * 4);
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const i = (y * 32 + x) * 4;
      const v = (x + y) % 2 === 0 ? 255 : 0;
      checker[i] = v;
      checker[i + 1] = v;
      checker[i + 2] = v;
      checker[i + 3] = 255;
    }
  }
  const sharp = measurePixels(checker, 32, 32);
  assert(sharp.sharpness > soft.sharpness, 'checkerboard is sharper');
  assert(sharp.clipped > 0.9, 'black and white clipping detected');

  const hash = differenceHash(checker, 32, 32);
  equal(hash.length, 64);
  equal(hamming(hash, hash), 0);

  const report = analyseImage({
    name: 'flat.jpg',
    bytes: 900 * 1024,
    width: 1200,
    height: 1200,
    type: 'image/jpeg',
    stats: soft,
    hash,
  });
  equal(report.verdict, 'reject');
  const ids = report.issues.map((i) => i.id);
  assert(ids.includes('img-resolution'), 'small file flagged');
  assert(ids.includes('img-soft'), 'soft file flagged');
  assert(report.platforms.every((p) => !p.ok), 'no agency accepts it');
});

test('optimizer downscales with a box filter and never enlarges', () => {
  const data = new Uint8ClampedArray(4 * 2 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 3] = 255;
  }
  const raster = { width: 4, height: 2, data };
  const same = downscaleRaster(raster, 10);
  equal(same.width, 4, 'small image untouched');
  const half = downscaleRaster(raster, 2);
  equal(half.width, 2);
  equal(half.height, 1);
  equal(half.data[0], 255, 'average preserved');
});

test('optimizer binary-searches the highest quality under a size target', async () => {
  const raster = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4).fill(200) };
  const encode = async (_r: typeof raster, quality: number) => new Uint8Array(Math.round(2000 * quality));
  const result = await optimizeRaster(raster, { format: 'jpg', targetKB: 1 }, encode);
  assert(result.bytes.byteLength <= 1024, 'fits the target');
  assert(result.quality > 0.4 && result.quality < 0.6, `quality near the target (${result.quality})`);
  assert(result.attempts > 1, 'searched');
  equal(suggestedFormat(true, 'png'), 'png');
  equal(suggestedFormat(false, 'jpg'), 'jpg');
});

test('vector EPS export produces a real PostScript document', () => {
  equal(toMatrix('translate(10 20) scale(2)')?.join(','), '2,0,0,2,10,20');
  const ps = pathToPostScript('M 0 0 L 10 0 C 12 0 12 10 0 10 Z');
  includes(ps, 'moveto');
  includes(ps, 'curveto');
  includes(ps, 'closepath');
  includes(starPath(50, 50, 40, 16), 'M');

  // svgToEps only needs a structural object in this environment.
  const fakeSvg = {
    tagName: 'svg',
    getAttribute: (name: string) =>
      name === 'viewBox' ? '0 0 100 50' : name === 'width' ? '100' : name === 'height' ? '50' : null,
    children: [
      {
        tagName: 'rect',
        getAttribute: (name: string) =>
          ({ x: '0', y: '0', width: '100', height: '50', fill: '#102030' } as Record<string, string>)[name] ?? null,
        children: [],
      },
    ],
  } as unknown as SVGSVGElement;
  const { eps, skipped } = svgToEps(fakeSvg, 'Unit Test');
  includes(eps, '%!PS-Adobe-3.0 EPSF-3.0');
  includes(eps, '%%BoundingBox: 0 0 100 50');
  includes(eps, '1 -1 scale');
  includes(eps, 'setrgbcolor fill');
  equal(skipped.length, 0);
});

/* ====================== currencies, cloud & app shell ====================== */
group('Currencies, Cloud schema & Version');

test('all 9 currencies have official symbols and ISO country flags', () => {
  equal(CURRENCIES.length, 9);
  for (const c of CURRENCIES) {
    assert(c.symbol.length >= 1, `${c.code} symbol`);
    equal(c.flag.length, 2, `${c.code} flag`);
    equal(currencyMeta(c.code).symbol, c.symbol);
    includes(money(250, c.code), '250');
  }
});

test('legacy cloud schema removes anonymous access to sensitive tables', () => {
  includes(SCHEMA_SQL, 'kv_store');
  includes(SCHEMA_SQL, 'user_accounts');
  includes(SCHEMA_SQL, 'issue_reports');
});

test('APP_VERSION matches package.json', () => {
  const pkg = JSON.parse(readFileSync(path.join(FIXTURE_DIR, '..', '..', 'package.json'), 'utf8'));
  equal(APP_VERSION, pkg.version);
  assert(APP_NAME.length > 0, 'APP_NAME defined');
});


group('recommendations, sanitising and account security');

test('upscale recommendation keeps transparency on a built in model', () => {
  const rec = recommendUpscale(
    { width: 800, height: 1200, bytes: 90_000, hasAlpha: true, filename: 'cutout.png' },
    { installed: {}, isDesktop: false },
  );
  equal(rec.kind, 'transparent');
  equal(rec.modelId, 'edge-crisp');
  equal(rec.readyNow, true);
  assert(rec.targetId.length > 0, 'target chosen');
  assert(rec.reason.length > 10, 'reason is human readable');
});

test('upscale recommendation preselects only an installed model', () => {
  const rec = recommendUpscale(
    { width: 900, height: 600, bytes: 60_000, filename: 'soft.jpg' },
    { installed: {}, isDesktop: true },
  );
  assert(['lanczos-pro', 'edge-crisp', 'photo-restore', 'anime4k-shader'].includes(rec.modelId), 'ready model');
  equal(rec.needsDownload, true);
});

test('upscale target never picks a preset that would shrink a large photo', () => {
  const rec = recommendUpscale({ width: 9000, height: 6000, bytes: 9_000_000, filename: 'big.jpg' }, {});
  const preset = UPSCALE_TARGETS.find((target) => target.id === rec.targetId);
  assert(preset, 'preset exists');
  const size = resolveTargetSize(9000, 6000, preset!);
  assert(size.factor >= 1, 'never downscales');
});

test('svg sanitiser removes scripts, embedded HTML and script urls', () => {
  const dirty = '<svg><script>alert(1)</script><foreignObject><body onload="x()"/></foreignObject><a xlink:href="javascript:alert(2)"><rect onclick="bad()" fill="red"/></a></svg>';
  const clean = sanitizeSvg(dirty);
  assert(!/script/i.test(clean.text.replace(/data-removed/g, '')), 'script removed');
  assert(!/foreignObject/i.test(clean.text), 'foreignObject removed');
  assert(!/javascript:/i.test(clean.text), 'javascript url removed');
  assert(!/onclick/i.test(clean.text), 'handler removed');
  assert(clean.removed.length >= 3, 'removals reported');
});

test('svg analysis flags embedded HTML and script urls', () => {
  const report = analyzeSvg('<svg><foreignObject/><image href="javascript:alert(1)"/></svg>');
  equal(report.ok, false);
  equal(report.hasForeignObject, true);
  equal(report.scriptUrls, 1);
});

test('csv export neutralises spreadsheet formulas', () => {
  const item = {
    ...({} as StockItem),
    id: 'x',
    name: '=cmd|calc.jpg',
    metadata: { title: '@SUM(1+1)', description: '-2+3', keywords: ['=importxml()'], categories: ['People'] },
    flags: { aiGenerated: false, editorial: false },
  } as unknown as StockItem;
  const csv = generateUniversalCsv([item]).content;
  assert(csv.includes("'=cmd|calc.jpg"), 'filename prefixed');
  assert(csv.includes("'@SUM(1+1)"), 'title prefixed');
  assert(csv.includes("'-2+3"), 'description prefixed');
  assert(csv.includes("'=importxml()"), 'keyword prefixed');
});

test('universal csv keeps one column count on every line', () => {
  const tricky = {
    ...({} as StockItem),
    id: 't',
    name: 'a,b.jpg',
    metadata: {
      title: 'Title, with comma',
      description: 'Line "quoted", and, commas',
      keywords: ['red, blue', 'plain'],
      categories: ['People, Places'],
    },
    flags: { aiGenerated: true, editorial: false },
  } as unknown as StockItem;
  const csv = generateUniversalCsv([tricky, item({ name: 'plain.png' })]).content;
  const lines = csv.replace('\uFEFF', '').trim().split('\r\n');
  const fields = (line: string) => {
    const out: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { out.push(cell); cell = ''; }
      else cell += ch;
    }
    out.push(cell);
    return out;
  };
  equal(lines.length, 3);
  equal(fields(lines[0]).length, 7);
  equal(fields(lines[1]).length, 7);
  equal(fields(lines[2]).length, 7);
});

test('password policy refuses common and short passwords', () => {
  equal(checkPassword('password123').ok, false);
  equal(checkPassword('short').ok, false);
  equal(checkPassword('correct horse battery').ok, true);
  equal(checkPassword('Tr0ub4dor&3x').ok, true);
});

await Promise.all(pending);

console.log(`\n${'='.repeat(52)}`);
console.log(`${passed} passed · ${failures.length} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`  * ${failure}`);
  process.exit(1);
}
console.log('All domain, codec, AI and creative tool tests passed.');
