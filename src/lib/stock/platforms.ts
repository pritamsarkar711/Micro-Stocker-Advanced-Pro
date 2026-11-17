import type { PlatformId, StockFormat } from './types';

export type AiPolicy = 'allowed' | 'allowed-labeled' | 'forbidden';

export interface CsvSpec {
  delimiter: ',' | ';';
  quote: '"';
  withHeader: boolean;
  columns: string[];
  keywordJoin: ',' | ', ';
  maxRows?: number;
  maxBytes?: number;
  notes: string;
}

export interface VideoSpec {
  formats: string[];
  minHeight: number;
  maxHeight: number;
  durationSec: [number, number];
  maxFileGB: number;
}

export interface PlatformSpec {
  id: PlatformId;
  name: string;
  site: string;
  color: string;
  formats: { photo: StockFormat[]; vector: StockFormat[] };
  video?: VideoSpec;
  minMP: number;
  maxMP: number | null;
  minDimensionPx?: number;
  maxDimensionPx?: number;
  maxFileMB: number;
  minFileMB?: number;
  keywords: { min: number; max: number; ordered: boolean; sweetSpot: [number, number] };
  title: { maxChars: number; recommendedChars?: number; minWords?: number; noCommas?: boolean };
  description: { maxChars: number; recommendedChars?: number; minWords?: number };
  categories?: { list: string[]; max: number; numeric?: Record<string, number> };
  csv: CsvSpec | null;
  readsEmbeddedMetadata: boolean;
  aiPolicy: AiPolicy;
  aiNote: string;
  vectorRules: string;
  filenameRules: string;
  source: 'official' | 'official+community';
  highlights: string[];
}

export const SHUTTERSTOCK_CATEGORIES = [
  'Abstract',
  'Animals/Wildlife',
  'Arts',
  'Backgrounds/Textures',
  'Beauty/Fashion',
  'Buildings/Landmarks',
  'Business/Finance',
  'Celebrities',
  'Education',
  'Food and drink',
  'Healthcare/Medical',
  'Holidays',
  'Industrial',
  'Interiors',
  'Miscellaneous',
  'Nature',
  'Objects',
  'Parks/Outdoor',
  'People',
  'Religion',
  'Science',
  'Signs/Symbols',
  'Sports/Recreation',
  'Technology',
  'Transportation',
  'Vintage',
];

export const ADOBE_CATEGORIES: Record<string, number> = {
  Animals: 1,
  'Buildings and Architecture': 2,
  Business: 3,
  Drinks: 4,
  'The Environment': 5,
  'States of Mind': 6,
  Food: 7,
  'Graphic Resources': 8,
  'Hobbies and Leisure': 9,
  Industry: 10,
  Landscapes: 11,
  Lifestyle: 12,
  People: 13,
  'Plants and Flowers': 14,
  'Culture and Religion': 15,
  Science: 16,
  'Social Issues': 17,
  Sports: 18,
  Technology: 19,
  Transport: 20,
  Travel: 21,
};

export const PLATFORMS: Record<PlatformId, PlatformSpec> = {
  shutterstock: {
    id: 'shutterstock',
    name: 'Shutterstock',
    site: 'https://submit.shutterstock.com',
    color: '#EE2B24',
    formats: { photo: ['jpg', 'tiff'], vector: ['eps'] },
    video: { formats: ['mp4', 'mov'], minHeight: 1080, maxHeight: 4320, durationSec: [5, 60], maxFileGB: 10 },
    minMP: 4,
    maxMP: 100,
    maxFileMB: 50,
    keywords: { min: 7, max: 50, ordered: false, sweetSpot: [25, 45] },
    title: { maxChars: 200, minWords: 5 },
    description: { maxChars: 2048, recommendedChars: 200, minWords: 5 },
    categories: { list: SHUTTERSTOCK_CATEGORIES, max: 2 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: [
        'Filename',
        'Description',
        'Keywords',
        'Categories',
        'Editorial',
        'Mature content',
        'Illustration',
      ],
      keywordJoin: ',',
      notes:
        'Filename must match the uploaded asset with extension. Description requires at least 5 descriptive words (up to 200 recommended, 2048 maximum). Up to 2 official categories separated by a comma, with yes or no flags.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'forbidden',
    aiNote:
      'Contributor generative AI submissions are strictly prohibited, including AI upscaled derivatives of synthetic renders. Only original photography, vectors and authored illustrations are accepted.',
    vectorRules:
      'Illustrator 8 or 10 EPS, sRGB, 4 to 25 MP artboard, up to 100 MB, all fonts outlined, no embedded raster bitmaps.',
    filenameRules: 'ASCII letters, digits and underscores; exact match with uploaded filename and extension.',
    source: 'official',
    highlights: ['4 to 100 MP sRGB', '7 to 50 keywords', 'No generative AI'],
  },

  adobe: {
    id: 'adobe',
    name: 'Adobe Stock',
    site: 'https://contributor.stock.adobe.com',
    color: '#EB1000',
    formats: { photo: ['jpg'], vector: ['eps', 'ai', 'svg'] },
    video: { formats: ['mp4', 'mov'], minHeight: 1080, maxHeight: 4320, durationSec: [5, 60], maxFileGB: 3.9 },
    minMP: 4,
    maxMP: 100,
    maxFileMB: 45,
    keywords: { min: 5, max: 49, ordered: true, sweetSpot: [15, 35] },
    title: { maxChars: 200, recommendedChars: 70, noCommas: true },
    description: { maxChars: 200 },
    categories: { list: Object.keys(ADOBE_CATEGORIES), max: 1, numeric: ADOBE_CATEGORIES },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: ['Filename', 'Title', 'Keywords', 'Category', 'Releases'],
      keywordJoin: ', ',
      maxRows: 5000,
      maxBytes: 1_000_000,
      notes:
        'Category uses numeric IDs 1 through 21. Place your 10 strongest keywords first and include key title words in the top 10. Keep titles concise under 70 characters without commas, up to 49 keywords and 5000 rows per CSV.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'allowed-labeled',
    aiNote:
      'Generative AI is accepted when Created using generative AI tools is checked. Never reference artist names, brand trademarks, real individuals or protected properties in titles or prompts.',
    vectorRules:
      'AI, EPS or SVG up to 45 MB with organized layers, outlined text and clean paths. Separate JPG preview is optional.',
    filenameRules: 'ASCII characters only, maximum 30 characters including extension.',
    source: 'official',
    highlights: ['4 to 100 MP JPG', 'Top 10 of 49 tags ranked', 'Disclosed AI allowed'],
  },

  freepik: {
    // The marketplace rebranded from Freepik to Magnific; the id stays stable so
    // existing projects, CSV presets and stored submissions keep resolving.
    id: 'freepik',
    name: 'Magnific',
    site: 'https://www.magnific.com',
    color: '#111114',
    formats: { photo: ['jpg'], vector: ['eps', 'svg'] },
    video: { formats: ['mp4', 'mov'], minHeight: 1080, maxHeight: 2160, durationSec: [5, 60], maxFileGB: 1.5 },
    minMP: 4,
    maxMP: 100,
    minDimensionPx: 2000,
    maxDimensionPx: 10000,
    minFileMB: 1.5,
    maxFileMB: 250,
    keywords: { min: 5, max: 50, ordered: true, sweetSpot: [20, 45] },
    title: { maxChars: 100, minWords: 3 },
    description: { maxChars: 200 },
    csv: {
      delimiter: ';',
      quote: '"',
      withHeader: true,
      columns: ['filename', 'title', 'keywords', 'prompt', 'model'],
      keywordJoin: ',',
      notes:
        'Semicolon separated CSV with lowercase headers. Titles cap at 100 characters with 5 to 50 comma separated tags. Fill prompt and model for generative AI submissions and embed IPTC or XMP directly in each JPG.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'allowed-labeled',
    aiNote:
      'Generative AI is accepted when labeled as AI generated with prompt and model declared in the CSV or contributor portal. Avoid trademarked brands, watermarks and anatomy artifacts.',
    vectorRules:
      'EPS between 0.5 MB and 80 MB in RGB color mode paired with a matching JPG preview bearing the identical base filename.',
    filenameRules: 'Alphanumeric and underscore characters only; vector and preview pairs must match identically.',
    source: 'official',
    highlights: ['4 to 100 MP (2000 px min)', 'Semicolon CSV format', 'Reads embedded XMP'],
  },

  pixabay: {
    id: 'pixabay',
    name: 'Pixabay',
    site: 'https://pixabay.com',
    color: '#00AB6C',
    formats: { photo: ['jpg', 'png'], vector: ['svg'] },
    video: { formats: ['mp4', 'mov'], minHeight: 1080, maxHeight: 2160, durationSec: [5, 60], maxFileGB: 0.5 },
    minMP: 3,
    maxMP: 100,
    maxFileMB: 40,
    keywords: { min: 3, max: 40, ordered: false, sweetSpot: [10, 25] },
    title: { maxChars: 100 },
    description: { maxChars: 300 },
    csv: null,
    readsEmbeddedMetadata: true,
    aiPolicy: 'allowed-labeled',
    aiNote: 'Check the AI generated indicator during upload; assets must be clean and free of watermarks or third party IP.',
    vectorRules: 'Clean SVG under 40 MB with outlined fonts and closed vector shapes.',
    filenameRules: 'Descriptive ASCII filename; embedded IPTC and XMP tags auto populate during web upload.',
    source: 'official',
    highlights: ['Reads embedded IPTC', 'JPG, PNG and SVG', 'Disclosed AI allowed'],
  },

  dreamstime: {
    id: 'dreamstime',
    name: 'Dreamstime',
    site: 'https://www.dreamstime.com/upload-images',
    color: '#50A901',
    formats: { photo: ['jpg'], vector: ['eps', 'ai', 'svg'] },
    video: { formats: ['mp4', 'mov'], minHeight: 1080, maxHeight: 2160, durationSec: [5, 60], maxFileGB: 2 },
    minMP: 3,
    maxMP: 150,
    maxFileMB: 100,
    keywords: { min: 10, max: 80, ordered: true, sweetSpot: [25, 50] },
    title: { maxChars: 130, minWords: 3 },
    description: { maxChars: 500, minWords: 5 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: [
        'Filename',
        'Image Name',
        'Description',
        'Category 1',
        'Category 2',
        'Category 3',
        'Keywords',
        'Free',
        'W-EL',
        'P-EL',
        'SR-EL',
        'SR-Price',
        'Editorial',
        'MR doc Ids',
        'Pr Docs',
      ],
      keywordJoin: ', ',
      notes:
        'Minimum 10 keywords and up to 80 ordered by relevance. Description must differ slightly from Image Name and contain at least 5 words.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'allowed-labeled',
    aiNote: 'AI content is permitted when labeled during submission and accompanied by proper commercial clearance.',
    vectorRules: 'EPS, AI or SVG submitted alongside a high resolution 3 MP or larger JPG preview.',
    filenameRules: 'Exact ASCII filename matching FTP or web batch upload.',
    source: 'official',
    highlights: ['3 to 150 MP', '10 to 80 keywords', 'FTP and CSV workflow'],
  },

  '123rf': {
    id: '123rf',
    name: '123RF',
    site: 'https://www.123rf.com/contributor/',
    color: '#E4002B',
    formats: { photo: ['jpg'], vector: ['eps'] },
    video: { formats: ['mp4', 'mov'], minHeight: 1080, maxHeight: 2160, durationSec: [5, 60], maxFileGB: 1 },
    minMP: 6,
    maxMP: 100,
    maxFileMB: 100,
    keywords: { min: 7, max: 50, ordered: false, sweetSpot: [20, 45] },
    title: { maxChars: 150, minWords: 4 },
    description: { maxChars: 300, minWords: 5 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: ['oldfilename', '123rf_filename', 'description', 'keywords', 'country'],
      keywordJoin: ', ',
      notes: 'Requires at least 6 MP JPGs, 7 to 50 English keywords and a complete descriptive sentence.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'allowed-labeled',
    aiNote: 'Generative AI images are accepted when explicitly flagged as AI generated during submission.',
    vectorRules: 'Illustrator EPS paired with an identical base filename high resolution RGB JPG preview.',
    filenameRules: 'ASCII filenames without spaces or punctuation.',
    source: 'official',
    highlights: ['6 MP minimum', '7 to 50 keywords', 'Disclosed AI allowed'],
  },

  depositphotos: {
    id: 'depositphotos',
    name: 'Depositphotos',
    site: 'https://depositphotos.com/contributor.html',
    color: '#0F9D58',
    formats: { photo: ['jpg'], vector: ['eps'] },
    video: { formats: ['mp4', 'mov'], minHeight: 1080, maxHeight: 2160, durationSec: [3, 60], maxFileGB: 4 },
    minMP: 3.8,
    maxMP: 100,
    maxFileMB: 50,
    keywords: { min: 8, max: 50, ordered: false, sweetSpot: [20, 40] },
    title: { maxChars: 200, minWords: 3 },
    description: { maxChars: 200, minWords: 5 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: ['Filename', 'description', 'Keywords', 'Nudity', 'Editorial'],
      keywordJoin: ', ',
      notes: 'Minimum 3.8 MP (such as 2400 by 1600), 8 to 50 keywords, and yes or no values for Nudity and Editorial.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'forbidden',
    aiNote: 'Contributor uploads of generative AI images and vectors are not accepted in the commercial catalog.',
    vectorRules: 'ZIP archive holding the EPS vector and an identically named high resolution JPG preview.',
    filenameRules: 'Clean ASCII filename matching the uploaded archive or JPG.',
    source: 'official',
    highlights: ['3.8 MP minimum', '8 to 50 keywords', 'No generative AI'],
  },

  vecteezy: {
    id: 'vecteezy',
    name: 'Vecteezy',
    site: 'https://contributors.vecteezy.com',
    color: '#FF5A1F',
    formats: { photo: ['jpg', 'png'], vector: ['eps', 'svg'] },
    video: { formats: ['mp4', 'mov'], minHeight: 1080, maxHeight: 2160, durationSec: [5, 60], maxFileGB: 2 },
    minMP: 4,
    maxMP: 50,
    maxFileMB: 50,
    minFileMB: 1,
    keywords: { min: 5, max: 50, ordered: true, sweetSpot: [20, 35] },
    title: { maxChars: 200, minWords: 3 },
    description: { maxChars: 300 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: ['Filename', 'Title', 'Description', 'Keywords', 'License'],
      keywordJoin: ',',
      notes:
        'License accepts pro, free or editorial in lowercase. Your first 5 keywords carry the strongest search ranking and must use only letters, digits and spaces.',
    },
    readsEmbeddedMetadata: false,
    aiPolicy: 'allowed-labeled',
    aiNote:
      'Mark AI generated during upload and specify the generator software. Near duplicate series and editorial AI assets are rejected.',
    vectorRules: 'Clean editable EPS or SVG paths without stray points or locked layers.',
    filenameRules: 'ASCII characters without commas or special punctuation.',
    source: 'official+community',
    highlights: ['First 5 keywords weighted', '4 to 50 MP', 'Disclosed AI allowed'],
  },

  getty: {
    id: 'getty',
    name: 'Getty Images & iStock',
    site: 'https://contributors.gettyimages.com',
    color: '#1565C0',
    formats: { photo: ['jpg'], vector: ['eps'] },
    video: { formats: ['mov', 'mp4'], minHeight: 1080, maxHeight: 2160, durationSec: [5, 30], maxFileGB: 5 },
    minMP: 3,
    maxMP: 256,
    maxFileMB: 50,
    keywords: { min: 5, max: 50, ordered: true, sweetSpot: [20, 40] },
    title: { maxChars: 200 },
    description: { maxChars: 500, minWords: 5 },
    csv: null,
    readsEmbeddedMetadata: true,
    aiPolicy: 'forbidden',
    aiNote:
      'Generative AI uploads are strictly prohibited across Getty Images and iStock. Standard photographic retouching on authentic camera captures is allowed.',
    vectorRules:
      'Illustrator CS6 compatible EPS with closed shapes and expanded strokes paired with a same name JPG at least 1900 by 2800 pixels.',
    filenameRules: 'Vector and JPG preview pair must share the exact base filename.',
    source: 'official',
    highlights: ['ESP portal workflow', 'Reads IPTC & XMP', 'No generative AI'],
  },

  alamy: {
    id: 'alamy',
    name: 'Alamy',
    site: 'https://www.alamy.com',
    color: '#009B77',
    formats: { photo: ['jpg'], vector: [] },
    video: { formats: ['mp4', 'mov'], minHeight: 1080, maxHeight: 2160, durationSec: [5, 60], maxFileGB: 4 },
    minMP: 6,
    maxMP: 256,
    maxFileMB: 500,
    keywords: { min: 5, max: 50, ordered: false, sweetSpot: [20, 40] },
    title: { maxChars: 200 },
    description: { maxChars: 500, minWords: 5 },
    csv: null,
    readsEmbeddedMetadata: true,
    aiPolicy: 'forbidden',
    aiNote: 'Generative AI content is prohibited and rejected during quality inspection.',
    vectorRules: 'Photographic and raster assets via the standard contributor portal.',
    filenameRules: 'Requires over 17 MB uncompressed size (around 6 MP in 8 bit sRGB) saved as high quality JPG.',
    source: 'official+community',
    highlights: ['6 MP minimum (17 MB raw)', 'Reads IPTC & XMP', 'No generative AI'],
  },

  pond5: {
    id: 'pond5',
    name: 'Pond5',
    site: 'https://www.pond5.com/artist',
    color: '#1DB954',
    formats: { photo: ['jpg'], vector: ['eps'] },
    video: { formats: ['mov', 'mp4'], minHeight: 1080, maxHeight: 4320, durationSec: [5, 60], maxFileGB: 10 },
    minMP: 4,
    maxMP: 100,
    maxFileMB: 500,
    keywords: { min: 5, max: 50, ordered: false, sweetSpot: [12, 25] },
    title: { maxChars: 80 },
    description: { maxChars: 2000, minWords: 5 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: ['Filename', 'Title', 'Description', 'Keywords', 'Category', 'Editorial', 'Location'],
      keywordJoin: ', ',
      notes:
        'Apply bulk CSV inside Uploads. Titles cap at 80 characters with 12 to 25 focused keywords outperforming padded lists.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'forbidden',
    aiNote: 'Generative AI submissions are not accepted in the Pond5 marketplace catalog.',
    vectorRules: 'EPS accompanied by an identically named RGB JPG preview.',
    filenameRules: 'Exact original filename with extension; avoid quotation marks inside text fields.',
    source: 'official+community',
    highlights: ['80 char title cap', 'HD, 4K and 8K footage', 'No generative AI'],
  },

  vectorstock: {
    id: 'vectorstock',
    name: 'VectorStock',
    site: 'https://www.vectorstock.com/artist',
    color: '#1565C0',
    formats: { photo: [], vector: ['eps'] },
    minMP: 0,
    maxMP: null,
    maxFileMB: 500,
    keywords: { min: 5, max: 60, ordered: false, sweetSpot: [20, 40] },
    title: { maxChars: 200 },
    description: { maxChars: 200 },
    csv: null,
    readsEmbeddedMetadata: true,
    aiPolicy: 'forbidden',
    aiNote: 'Original human authored vectors only; generative AI vector traces are not permitted.',
    vectorRules:
      'RGB EPS with closed paths, outlined text and zero raster effects, paired with an RGB JPG preview at least 1000 px wide.',
    filenameRules: 'Preview JPG IPTC and XMP metadata is imported automatically during upload.',
    source: 'official',
    highlights: ['Dedicated EPS vectors', 'Up to 60 keywords', 'No generative AI'],
  },

  canva: {
    id: 'canva',
    name: 'Canva Creators',
    site: 'https://www.canva.com/creators/',
    color: '#00C4CC',
    formats: { photo: ['jpg', 'png'], vector: ['svg'] },
    video: { formats: ['mp4', 'mov'], minHeight: 1080, maxHeight: 2160, durationSec: [5, 60], maxFileGB: 1 },
    minMP: 4,
    maxMP: null,
    maxFileMB: 50,
    keywords: { min: 5, max: 20, ordered: false, sweetSpot: [8, 16] },
    title: { maxChars: 150 },
    description: { maxChars: 500 },
    csv: {
      delimiter: ',',
      quote: '"',
      withHeader: true,
      columns: ['filename', 'title', 'description', 'keywords', 'locale'],
      keywordJoin: ', ',
      notes: 'Lowercase column headers, unique title per item, 5 to 20 keywords and locale set to en.',
    },
    readsEmbeddedMetadata: true,
    aiPolicy: 'allowed-labeled',
    aiNote: 'AI assisted assets must comply with Canva Creators rules and carry accurate disclosure.',
    vectorRules: 'SVG under 10 MB on a clean artboard; transparent PNG cutouts at 1500 by 1500 px or larger.',
    filenameRules: 'Exact filename match including extension.',
    source: 'official+community',
    highlights: ['SVG and PNG cutouts', 'Unique titles required', '5 to 20 keywords'],
  },

  envato: {
    id: 'envato',
    name: 'Envato Elements',
    site: 'https://elements.envato.com',
    color: '#6CA12B',
    formats: { photo: ['jpg', 'png'], vector: ['eps', 'ai', 'svg'] },
    video: { formats: ['mov', 'mp4'], minHeight: 1080, maxHeight: 2160, durationSec: [5, 60], maxFileGB: 3 },
    minMP: 4,
    maxMP: 100,
    maxFileMB: 100,
    keywords: { min: 5, max: 50, ordered: false, sweetSpot: [15, 30] },
    title: { maxChars: 100 },
    description: { maxChars: 500 },
    csv: null,
    readsEmbeddedMetadata: true,
    aiPolicy: 'allowed-labeled',
    aiNote: 'Permitted inside eligible AI categories when accurately disclosed under Envato Author terms.',
    vectorRules: 'Clean EPS, AI or SVG files with organized named layers and outlined or open licensed fonts.',
    filenameRules: 'Uploaded via Author Dashboard; embedded metadata speeds up item tagging.',
    source: 'official+community',
    highlights: ['4 to 100 MP', 'Up to 50 tags', 'Author dashboard'],
  },
};

export const PLATFORM_LIST = Object.values(PLATFORMS);

export function platformName(id: PlatformId): string {
  return PLATFORMS[id].name;
}

export const PLATFORM_ALIASES: Record<string, PlatformId> = {
  istock: 'getty',
  istockphoto: 'getty',
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
  elements: 'envato',
};

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
