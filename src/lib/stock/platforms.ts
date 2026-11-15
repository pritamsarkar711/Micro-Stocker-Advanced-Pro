import type { PlatformId, StockFormat } from './types';

/**
 * Platform requirement registry.
 *
 * Numbers below were researched from official contributor docs and current
 * (2026) contributor guides; `source: 'community'` marks values that are
 * widely documented but not stated on an official page — the Platforms page
 * in the app shows a "verify before large batches" reminder for those.
 */

export interface CsvSpec {
  /** Field delimiter. Freepik uses ';' with single-quoted values, no header. */
  delimiter: ',' | ';';
  quote: '"' | "'";
  withHeader: boolean;
  /** Exact column order expected by the platform importer. */
  columns: string[];
  /** How keywords are joined inside their column. */
  keywordJoin: ', ' | ',';
  /** Freepik's importer expects every field wrapped in the quote character. */
  alwaysQuote?: boolean;
  notes: string;
}

export interface PlatformSpec {
  id: PlatformId;
  name: string;
  site: string;
  color: string;
  formats: Record<'photo' | 'vector', StockFormat[]>;
  /** Megapixel window for raster content. */
  minMP: number;
  maxMP: number | null;
  maxFileMB: number;
  minFileMB?: number;
  keywords: { min: number; max: number; ordered: boolean; sweetSpot: [number, number] };
  title: { maxChars: number; minWords?: number; noCommas?: boolean };
  description: { maxChars: number; minWords?: number };
  csv: CsvSpec | null;
  /** Platform reads embedded IPTC/XMP on ingest. */
  readsEmbeddedMetadata: boolean;
  aiPolicy: 'forbidden' | 'allowed-labeled';
  aiNote: string;
  vectorRules: string;
  filenameRules: string;
  source: 'official' | 'official+community' | 'community';
  highlights: string[];
}

export const PLATFORMS: Record<PlatformId, PlatformSpec> = {
  shutterstock: {
    id: 'shutterstock',
    name: 'Shutterstock',
    site: 'https://submit.shutterstock.com',
    color: '#EE2B24',
    formats: { photo: ['jpg'], vector: ['eps'] },
    minMP: 4,
    maxMP: 100,
    maxFileMB: 50,
    keywords: { min: 7, max: 50, ordered: false, sweetSpot: [20, 30] },
    title: { maxChars: 2048, minWords: 5 },
    description: { maxChars: 2048, minWords: 5 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: ['Filename', 'Description', 'Keywords', 'Categories', 'Editorial', 'Mature content', 'Illustration'],
      keywordJoin: ', ',
      notes:
        'Column names are case-sensitive. "Description" is also the title (there is no separate title field). Categories = 1-2 names from the fixed list. Optional flag columns accept only Yes/No. Upload the CSV on the Submit page, never via FTPS.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'forbidden',
    aiNote: 'Contributor generative-AI content is rejected and removed. Upscaling your own photo is retouching, not generation — but label honestly if asked.',
    vectorRules: 'EPS with embedded preview; keep fonts outlined or licensed; no rasterised effects.',
    filenameRules: 'Exact, case-sensitive match in CSV. No commas, [ ], < >, quotes or non-ASCII. Extension included.',
    source: 'official+community',
    highlights: ['CSV bulk metadata', 'min 7 keywords', 'description = title'],
  },

  adobe: {
    id: 'adobe',
    name: 'Adobe Stock',
    site: 'https://contributor.stock.adobe.com',
    color: '#FA0F00',
    formats: { photo: ['jpg'], vector: ['eps'] },
    minMP: 4,
    maxMP: 100,
    maxFileMB: 45,
    keywords: { min: 5, max: 49, ordered: true, sweetSpot: [15, 35] },
    title: { maxChars: 70, noCommas: true },
    description: { maxChars: 200 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: ['Filename', 'Title', 'Keywords', 'Category1', 'Category2'],
      keywordJoin: ', ',
      notes:
        'Header must match the template exactly. Max 5,000 rows and 1 MB per CSV. Filename ≤ 30 chars. Title ≤ 70 chars with NO commas. First 10 keywords carry the most search weight — keep title words inside them.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'allowed-labeled',
    aiNote: 'Tick "Created using generative AI tools". Photoreal AI goes in as Photos, everything else as Illustrations.',
    vectorRules: 'EPS; RGB; organised named layers; editable licensed fonts.',
    filenameRules: 'Exact match incl. extension; ≤ 30 characters for CSV import.',
    source: 'official+community',
    highlights: ['CSV bulk metadata', 'ordered keywords (top 10)', '4-100 MP, ≤ 45 MB'],
  },

  freepik: {
    id: 'freepik',
    name: 'Freepik (Magnific)',
    site: 'https://contributor.freepik.com',
    color: '#1273EB',
    formats: { photo: ['jpg'], vector: ['eps'] },
    minMP: 4,
    maxMP: 100,
    maxFileMB: 250,
    minFileMB: 0.5,
    keywords: { min: 5, max: 50, ordered: false, sweetSpot: [20, 40] },
    title: { maxChars: 100 },
    description: { maxChars: 200 },
    csv: {
      delimiter: ';',
      quote: "'",
      withHeader: false,
      columns: ['filename', 'title', 'keywords'],
      keywordJoin: ',',
      alwaysQuote: true,
      notes:
        'Semicolon-separated with SINGLE-QUOTED fields and NO header row; keywords joined with commas inside the quoted field. Title ≤ 100 chars, ≤ 50 tags. AI files need the _ai_generated keyword. Metadata must ALSO be embedded in the file.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'allowed-labeled',
    aiNote: 'Flag AI in the panel and add the _ai_generated keyword; include prompt/model where asked.',
    vectorRules: 'EPS (CC; CS6 over FTP) in RGB, 0.5-80 MB, paired with a same-name JPG preview 2000-8000 px. Layers named in English, fonts free for commercial use.',
    filenameRules: 'ASCII only, single _ or - separators; EPS and its JPG preview share the same base name.',
    source: 'official+community',
    highlights: ['semicolon CSV, no header', 'embedded metadata required', 'EPS + JPG pair'],
  },

  pixabay: {
    id: 'pixabay',
    name: 'Pixabay',
    site: 'https://pixabay.com',
    color: '#4EA64E',
    formats: { photo: ['jpg', 'png'], vector: ['svg', 'png'] },
    minMP: 2,
    maxMP: 100,
    maxFileMB: 100,
    keywords: { min: 3, max: 20, ordered: false, sweetSpot: [8, 15] },
    title: { maxChars: 120 },
    description: { maxChars: 200 },
    csv: null,
    readsEmbeddedMetadata: false,
    aiPolicy: 'allowed-labeled',
    aiNote: 'AI-generated work must be disclosed at upload; undisclosed AI is removed.',
    vectorRules: 'Vectors upload as SVG/PNG; keep clean paths and no embedded rasters.',
    filenameRules: 'Plain ASCII names; no branding or watermarks.',
    source: 'community',
    highlights: ['no CSV - portal form', 'tags ≤ 20', 'copy-paste sheet exported instead'],
  },

  dreamstime: {
    id: 'dreamstime',
    name: 'Dreamstime',
    site: 'https://www.dreamstime.com',
    color: '#7AB800',
    formats: { photo: ['jpg', 'png'], vector: ['eps'] },
    minMP: 3,
    maxMP: 100,
    maxFileMB: 50,
    keywords: { min: 7, max: 50, ordered: false, sweetSpot: [15, 35] },
    title: { maxChars: 250, minWords: 5 },
    description: { maxChars: 500 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: ['Filename', 'Title', 'Description', 'Keywords', 'Category'],
      keywordJoin: ',',
      notes: 'UTF-8 CSV only (no XLSX). Quote any field containing commas. 7-50 keywords; repeated word forms count as spam.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'allowed-labeled',
    aiNote: 'AI accepted when disclosed in the description and the AI category is selected.',
    vectorRules: 'EPS/AI vectors accepted; pair with previews where asked.',
    filenameRules: 'Exact case-sensitive filename match in CSV.',
    source: 'official+community',
    highlights: ['CSV bulk metadata', 'min 7 keywords', 'title+description separate'],
  },

  '123rf': {
    id: '123rf',
    name: '123RF',
    site: 'https://submit.123rf.com',
    color: '#1B62C9',
    formats: { photo: ['jpg'], vector: ['eps'] },
    minMP: 6,
    maxMP: 100,
    maxFileMB: 30,
    keywords: { min: 10, max: 50, ordered: false, sweetSpot: [25, 40] },
    title: { maxChars: 150, minWords: 5 },
    description: { maxChars: 400 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: ['Filename', 'Title', 'Description', 'Keywords', 'Country'],
      keywordJoin: ', ',
      notes: 'JPEG quality ≥ 80%. Vectors: EPS saved compatible with Illustrator 8, unflattened, all layers present.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'allowed-labeled',
    aiNote: 'AI content accepted when disclosed at submission.',
    vectorRules: 'EPS compatible with Illustrator 8; do not flatten; keep every layer.',
    filenameRules: 'ASCII names; no brand names, trademarks or dates inside metadata.',
    source: 'official+community',
    highlights: ['min 6 MP', 'EPS = Illustrator 8', 'Country column'],
  },

  depositphotos: {
    id: 'depositphotos',
    name: 'Depositphotos',
    site: 'https://depositphotos.com',
    color: '#A92B2B',
    formats: { photo: ['jpg', 'png'], vector: ['eps'] },
    minMP: 3.8,
    maxMP: 100,
    maxFileMB: 50,
    keywords: { min: 8, max: 50, ordered: false, sweetSpot: [15, 35] },
    title: { maxChars: 200 },
    description: { maxChars: 250 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: ['Filename', 'Description', 'Keywords', 'Editorial', 'Nudity'],
      keywordJoin: ', ',
      notes: 'UTF-8. Field names case-insensitive, order free, but Filename + at least one other field required. Delimiter/enclosure/escape options are chosen at upload time. Values English letters/digits/spaces only.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'forbidden',
    aiNote: 'Depositphotos guidance says do not submit AI-generated images.',
    vectorRules: 'Vectors packaged as ZIP with a high-resolution preview (also ≥ 3.8 MP).',
    filenameRules: 'Plain ASCII (A-Z a-z 0-9 - _). Transliterate accents yourself.',
    source: 'official+community',
    highlights: ['min 3.8 MP (2400×1600)', 'min 8 keywords', 'ZIP vectors'],
  },

  vecteezy: {
    id: 'vecteezy',
    name: 'Vecteezy',
    site: 'https://contributors.vecteezy.com',
    color: '#1BA9CB',
    formats: { photo: ['jpg', 'png'], vector: ['eps', 'svg'] },
    minMP: 4,
    maxMP: 50,
    maxFileMB: 50,
    minFileMB: 1,
    keywords: { min: 5, max: 50, ordered: true, sweetSpot: [20, 30] },
    title: { maxChars: 200 },
    description: { maxChars: 300 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: ['Filename', 'Title', 'Description', 'Keywords', 'License'],
      keywordJoin: ',',
      notes: 'Only Filename is required. License = pro | free | editorial (lowercase) or blank. The Keywords field must be wrapped in double quotes because it contains commas. First 5 keywords weigh most; no special characters in keywords.',
    },
    readsEmbeddedMetadata: false,
    aiPolicy: 'allowed-labeled',
    aiNote: 'Tick "AI-Generated?" and pick the program. AI photos must look photographic; near-duplicates rejected; AI never editorial.',
    vectorRules: 'EPS/SVG vectors with clean editable paths.',
    filenameRules: 'ASCII; avoid symbols that break CSV matching.',
    source: 'official+community',
    highlights: ['License column', 'first 5 keywords matter', 'AI dropdown'],
  },

  getty: {
    id: 'getty',
    name: 'Getty Images / iStock',
    site: 'https://contributors.gettyimages.com',
    color: '#000000',
    formats: { photo: ['jpg'], vector: ['eps'] },
    minMP: 3,
    maxMP: 256,
    maxFileMB: 50,
    keywords: { min: 5, max: 50, ordered: true, sweetSpot: [20, 40] },
    title: { maxChars: 200 },
    description: { maxChars: 500 },
    csv: null,
    readsEmbeddedMetadata: true,
    aiPolicy: 'forbidden',
    aiNote: 'Generative AI is banned outright (no disclosure option). Retouching your own capture — including AI-assisted retouch — is allowed.',
    vectorRules: 'EPS CS6-compatible, closed shapes, expanded effects, paired with same-name JPEG ≥ 1900×2800 (4075×4075 recommended).',
    filenameRules: 'Vector + raster pair must share the exact filename.',
    source: 'official',
    highlights: ['no CSV - ESP portal', 'reads IPTC caption+keywords', '3-256 MP'],
  },

  alamy: {
    id: 'alamy',
    name: 'Alamy',
    site: 'https://www.alamy.com',
    color: '#00A5A5',
    formats: { photo: ['jpg'], vector: [] },
    minMP: 6,
    maxMP: 256,
    maxFileMB: 500,
    keywords: { min: 5, max: 50, ordered: false, sweetSpot: [20, 40] },
    title: { maxChars: 200 },
    description: { maxChars: 500 },
    csv: null,
    readsEmbeddedMetadata: true,
    aiPolicy: 'forbidden',
    aiNote: 'Generative AI is classed as unsuitable material and rejected.',
    vectorRules: 'Photos only via the standard route.',
    filenameRules: 'Measured as > 17 MB UNCOMPRESSED (≈ 6 MP at 8-bit RGB); JPEG quality 8+.',
    source: 'official+community',
    highlights: ['uncompressed-size rule', 'reads IPTC', 'no AI'],
  },

  pond5: {
    id: 'pond5',
    name: 'Pond5',
    site: 'https://www.pond5.com/artist',
    color: '#1DB954',
    formats: { photo: ['jpg'], vector: ['eps'] },
    minMP: 4,
    maxMP: 100,
    maxFileMB: 500,
    keywords: { min: 5, max: 50, ordered: false, sweetSpot: [10, 20] },
    title: { maxChars: 80 },
    description: { maxChars: 2000 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: ['Filename', 'Title', 'Description', 'Keywords', 'Category', 'Editorial', 'Location'],
      keywordJoin: ', ',
      notes: 'Bulk CSV via Uploads → Apply CSV. Titles max 80 chars, 5-50 keywords (10-20 strong ones beat 50 weak). Avoid quote marks in any cell.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'forbidden',
    aiNote: 'Generative AI uploads are not accepted for the marketplace catalogue.',
    vectorRules: 'EPS plus a same-name JPEG preview; vectors only through the standard uploader.',
    filenameRules: 'Exact original filename with extension; no special characters inside CSV cells.',
    source: 'official+community',
    highlights: ['80-char titles', '10-20 strong keywords', 'bulk CSV'],
  },

  vectorstock: {
    id: 'vectorstock',
    name: 'VectorStock',
    site: 'https://www.vectorstock.com/artist',
    color: '#F5A623',
    formats: { photo: [], vector: ['eps'] },
    minMP: 0,
    maxMP: null,
    maxFileMB: 500,
    keywords: { min: 1, max: 60, ordered: false, sweetSpot: [20, 40] },
    title: { maxChars: 200 },
    description: { maxChars: 200 },
    csv: null,
    readsEmbeddedMetadata: true,
    aiPolicy: 'forbidden',
    aiNote: 'Vector-only marketplace: submit original artwork you authored (no AI-generated vectors).',
    vectorRules: 'EPS only, RGB, closed paths, text outlined (except Google Fonts), no raster effects. Paired with an RGB JPEG preview >= 1000 px.',
    filenameRules: 'ZIP the EPS folder; the archive name becomes the title. Preview IPTC/XMP is read automatically.',
    source: 'official',
    highlights: ['vector only (EPS)', 'up to 60 keywords', 'FTP for 100+ files'],
  },

  canva: {
    id: 'canva',
    name: 'Canva Creators',
    site: 'https://www.canva.com/creators/',
    color: '#00C4CC',
    formats: { photo: ['jpg', 'png'], vector: ['svg'] },
    minMP: 4,
    maxMP: null,
    maxFileMB: 50,
    keywords: { min: 5, max: 20, ordered: false, sweetSpot: [8, 15] },
    title: { maxChars: 150 },
    description: { maxChars: 500 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: ['filename', 'title', 'description', 'keywords', 'locale'],
      keywordJoin: ', ',
      notes: 'CSV uses lowercase headers. Title must be unique per asset; keywords comma+space separated (UI caps at 20). locale = en.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'allowed-labeled',
    aiNote: 'AI-assisted assets are accepted when they follow the Creators content rules; disclose inside the asset where required.',
    vectorRules: 'SVG only (max 10 MB, 500x500 artboard). No .ai files and no ZIPs. PNG cutouts: 1500x1500 artboard, transparent background.',
    filenameRules: 'filename column must match the uploaded asset exactly, extension included.',
    source: 'official+community',
    highlights: ['SVG + PNG cutouts', 'unique titles', '20-keyword UI cap'],
  },

  envato: {
    id: 'envato',
    name: 'Envato Elements',
    site: 'https://elements.envato.com',
    color: '#82B440',
    formats: { photo: ['jpg'], vector: ['eps', 'ai', 'svg'] },
    minMP: 3,
    maxMP: 100,
    maxFileMB: 100,
    keywords: { min: 5, max: 50, ordered: false, sweetSpot: [15, 30] },
    title: { maxChars: 100 },
    description: { maxChars: 500 },
    csv: null,
    readsEmbeddedMetadata: true,
    aiPolicy: 'allowed-labeled',
    aiNote: 'AI-generated content is allowed only in the AI category and must follow the Author terms; label it honestly.',
    vectorRules: 'EPS/AI/SVG items are uploaded per-item after review; keep layers named and fonts outlined or licensed.',
    filenameRules: 'Upload through the author dashboard; metadata is entered per item.',
    source: 'official+community',
    highlights: ['50 tags max', 'author dashboard', 'AI category'],
  },
};

export const PLATFORM_LIST = Object.values(PLATFORMS);

export function platformName(id: PlatformId): string {
  return PLATFORMS[id].name;
}

/** Aggregators that simply redistribute the per-platform exports. */
/** Portal labels used in sales CSVs that are not the internal id. */
export const PLATFORM_ALIASES: Record<string, PlatformId> = {
  istock: 'getty',
  'istockphoto': 'getty',
  'getty images': 'getty',
  magnific: 'freepik',
  'adobe stock': 'adobe',
  '123 rf': '123rf',
  'deposit photos': 'depositphotos',
  'shutterstock.com': 'shutterstock',
  'pond 5': 'pond5',
  'pond5.com': 'pond5',
  'vector stock': 'vectorstock',
  'canva creators': 'canva',
  'canva elements': 'canva',
  'envato elements': 'envato',
  'elements': 'envato',
};

/** Match a free-text platform label (usually from a sales CSV) to a marketplace. */
export function findPlatform(label: string): PlatformId | null {
  const needle = label.trim().toLowerCase();
  if (!needle) return null;
  const exact = PLATFORM_LIST.find(
    (platform) => platform.id === needle || platform.name.toLowerCase() === needle,
  );
  if (exact) return exact.id;
  if (PLATFORM_ALIASES[needle]) return PLATFORM_ALIASES[needle];
  const partial = PLATFORM_LIST.find(
    (platform) => needle.includes(platform.id) || needle.includes(platform.name.toLowerCase()),
  );
  if (partial) return partial.id;
  for (const [alias, id] of Object.entries(PLATFORM_ALIASES)) {
    if (needle.includes(alias)) return id;
  }
  return null;
}

export const AGGREGATORS = [
  {
    name: 'Wirestock',
    note: 'One upload, many agencies: use each platform export from this app and let Wirestock distribute, or upload the embedded files directly.',
  },
  {
    name: 'Blackbox / StockSubmit-style tools',
    note: 'Any tool that ingests IPTC/XMP will pick up metadata embedded by this app.',
  },
];
