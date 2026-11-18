import type { StockItem, StockMetadata } from './types';
import type { ImageInsight, SceneKind } from '@/lib/vision/analyse';
import { COLOUR_ADJECTIVES, COMMERCIAL_TERMS, SCENE_PROFILES } from '@/lib/vision/scene-vocabulary';

/**
 * Built in offline Local AI metadata generator, keyword sanitizer and
 * commercial microstock compliance scrubber.
 *
 * Inspects filename vocabulary, composition ratio, resolution class and
 * optional decoded image color/brightness/alpha signals so offline drafting
 * produces genuine commercial titles, descriptions, categories and keywords
 * with zero internet dependency and zero API keys.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'as',
  'is', 'are', 'be', 'it', 'its', 'this', 'that', 'img', 'dsc', 'dscf', 'dscn', 'pxl', 'photo',
  'image', 'pic', 'file', 'final', 'copy', 'edit', 'edited', 'export', 'v1', 'v2', 'v3', 'v4',
  'raw', 'hd', 'uhd', '4k', '8k', 'upscaled', 'converted', 'cutout', 'nobg', 'stock', 'new',
  'shutterstock', 'adobe', 'freepik', 'getty', 'istock', 'vecteezy', 'dreamstime', 'screenshot',
]);

/** Brand names, camera terms and AI prompt spam rejected by stock reviewers. */
const BANNED_STOCK_TERMS = new Set([
  'iphone', 'ipad', 'macbook', 'apple', 'samsung', 'nike', 'adidas', 'gucci', 'tesla', 'disney',
  'marvel', 'lego', 'coca', 'pepsi', 'starbucks', 'google', 'microsoft', 'amazon', 'facebook',
  'instagram', 'tiktok', 'youtube', 'netflix', 'canon', 'nikon', 'sony', 'fujifilm', 'leica',
  'midjourney', 'dalle', 'stable diffusion', 'sdxl', 'flux', 'octane', 'unreal engine',
  'artstation', 'trending', 'hyperrealistic', 'photorealistic', 'masterpiece', 'award winning',
  'best quality', '8k resolution', '4k resolution', 'greg rutkowski',
]);

interface ThemeEntry {
  category: string;
  words: string[];
}

const THEMES: Record<string, ThemeEntry> = {
  sunset: { category: 'Nature', words: ['sunset', 'golden hour', 'dusk', 'horizon', 'sky', 'warm light', 'evening', 'scenic', 'twilight', 'landscape'] },
  sunrise: { category: 'Nature', words: ['sunrise', 'dawn', 'morning', 'golden light', 'horizon', 'sky', 'new beginning', 'calm', 'landscape'] },
  mountain: { category: 'Nature', words: ['mountain', 'peak', 'alpine', 'landscape', 'nature', 'wilderness', 'outdoor', 'adventure', 'scenic', 'valley', 'summit'] },
  beach: { category: 'Travel', words: ['beach', 'ocean', 'sea', 'coast', 'sand', 'tropical', 'summer', 'vacation', 'travel', 'shore', 'waves', 'holiday'] },
  forest: { category: 'Nature', words: ['forest', 'trees', 'woods', 'nature', 'foliage', 'green', 'environment', 'wilderness', 'canopy', 'ecology', 'trail'] },
  flower: { category: 'Nature', words: ['flower', 'blossom', 'floral', 'botanical', 'petal', 'bloom', 'spring', 'garden', 'fresh', 'natural', 'plant'] },
  nature: { category: 'Nature', words: ['nature', 'outdoor', 'natural', 'environment', 'landscape', 'scenic', 'fresh', 'peaceful', 'organic', 'green'] },
  city: { category: 'Buildings/Landmarks', words: ['city', 'urban', 'skyline', 'architecture', 'downtown', 'cityscape', 'metropolitan', 'building', 'street', 'modern'] },
  architecture: { category: 'Buildings/Landmarks', words: ['architecture', 'building', 'structure', 'facade', 'exterior', 'modern', 'geometric', 'urban', 'design', 'contemporary'] },
  interior: { category: 'Interiors', words: ['interior', 'room', 'home', 'living space', 'decor', 'furniture', 'modern', 'cozy', 'apartment', 'residential', 'design'] },
  coffee: { category: 'Food and drink', words: ['coffee', 'cup', 'cafe', 'espresso', 'morning', 'beverage', 'latte', 'aroma', 'drink', 'roasted', 'breakfast'] },
  food: { category: 'Food and drink', words: ['food', 'meal', 'cuisine', 'fresh', 'healthy', 'delicious', 'gourmet', 'cooking', 'ingredient', 'dish', 'culinary', 'dining'] },
  fruit: { category: 'Food and drink', words: ['fruit', 'fresh', 'organic', 'healthy', 'vitamin', 'nutrition', 'sweet', 'ripe', 'natural', 'produce', 'diet'] },
  business: { category: 'Business/Finance', words: ['business', 'office', 'corporate', 'workplace', 'professional', 'teamwork', 'meeting', 'strategy', 'career', 'company', 'success'] },
  office: { category: 'Business/Finance', words: ['office', 'workspace', 'desk', 'business', 'workplace', 'corporate', 'productivity', 'modern', 'career', 'professional'] },
  finance: { category: 'Business/Finance', words: ['finance', 'money', 'investment', 'economy', 'banking', 'growth', 'profit', 'financial', 'budget', 'wealth', 'analytics'] },
  laptop: { category: 'Technology', words: ['laptop', 'computer', 'technology', 'workspace', 'desk', 'remote work', 'digital', 'online', 'working', 'modern'] },
  tech: { category: 'Technology', words: ['technology', 'digital', 'innovation', 'modern', 'data', 'network', 'futuristic', 'connection', 'cyber', 'interface', 'science'] },
  medical: { category: 'Healthcare/Medical', words: ['medical', 'healthcare', 'health', 'clinic', 'hospital', 'wellness', 'medicine', 'care', 'science', 'treatment', 'doctor'] },
  fitness: { category: 'Sports/Recreation', words: ['fitness', 'workout', 'exercise', 'sport', 'healthy lifestyle', 'training', 'active', 'wellness', 'strength', 'energy'] },
  education: { category: 'Education', words: ['education', 'learning', 'study', 'knowledge', 'school', 'student', 'book', 'academic', 'training', 'research'] },
  travel: { category: 'Transportation', words: ['travel', 'destination', 'tourism', 'journey', 'vacation', 'explore', 'adventure', 'landmark', 'holiday', 'culture'] },
  woman: { category: 'People', words: ['woman', 'female', 'adult', 'portrait', 'person', 'lifestyle', 'confident', 'expression', 'natural light', 'people'] },
  man: { category: 'People', words: ['man', 'male', 'adult', 'portrait', 'person', 'lifestyle', 'confident', 'casual', 'expression', 'people'] },
  portrait: { category: 'People', words: ['portrait', 'person', 'headshot', 'expression', 'lifestyle', 'human', 'authentic', 'natural light', 'studio'] },
  animal: { category: 'Animals/Wildlife', words: ['animal', 'wildlife', 'nature', 'fauna', 'creature', 'wild', 'outdoor', 'habitat', 'portrait', 'natural'] },
  cat: { category: 'Animals/Wildlife', words: ['cat', 'feline', 'pet', 'kitten', 'domestic animal', 'cute', 'fur', 'whiskers', 'companion', 'adorable'] },
  dog: { category: 'Animals/Wildlife', words: ['dog', 'canine', 'pet', 'puppy', 'domestic animal', 'companion', 'loyal', 'cute', 'happy', 'outdoor'] },
  product: { category: 'Objects', words: ['product', 'mockup', 'packaging', 'minimal', 'commercial', 'showcase', 'studio shot', 'clean', 'branding', 'object'] },
  abstract: { category: 'Abstract', words: ['abstract', 'background', 'pattern', 'texture', 'geometric', 'gradient', 'modern', 'wallpaper', 'design', 'backdrop', 'creative'] },
  texture: { category: 'Backgrounds/Textures', words: ['texture', 'surface', 'material', 'background', 'pattern', 'grain', 'detail', 'backdrop', 'natural', 'closeup'] },
  minimal: { category: 'Backgrounds/Textures', words: ['minimal', 'minimalist', 'clean', 'simple', 'copy space', 'modern', 'aesthetic', 'composition', 'neutral', 'contemporary'] },
  icon: { category: 'Signs/Symbols', words: ['icon', 'vector', 'symbol', 'sign', 'flat', 'graphic', 'element', 'illustration', 'interface', 'isolated', 'design'] },
  logo: { category: 'Signs/Symbols', words: ['emblem', 'symbol', 'mark', 'identity', 'vector', 'branding', 'minimal', 'modern', 'geometric', 'graphic', 'template'] },
  pattern: { category: 'Backgrounds/Textures', words: ['pattern', 'seamless', 'ornament', 'decorative', 'textile', 'fabric', 'motif', 'repeat', 'surface', 'design', 'wallpaper'] },
  holiday: { category: 'Holidays', words: ['holiday', 'celebration', 'festive', 'seasonal', 'greeting', 'decoration', 'tradition', 'event', 'joyful', 'occasion'] },
  ramadan: { category: 'Holidays', words: ['ramadan', 'islamic', 'lantern', 'crescent', 'eid', 'celebration', 'festive', 'greeting', 'mosque', 'spiritual', 'ornament'] },
  christmas: { category: 'Holidays', words: ['christmas', 'winter', 'holiday', 'festive', 'decoration', 'celebration', 'seasonal', 'ornament', 'gift', 'cozy'] },
};

const FORMAT_EXTRAS: Record<string, string[]> = {
  eps: ['vector', 'illustration', 'graphic', 'editable', 'scalable', 'design element', 'artwork'],
  ai: ['vector', 'illustration', 'graphic', 'editable', 'scalable', 'design element', 'artwork'],
  svg: ['vector', 'svg', 'scalable', 'icon', 'graphic', 'flat design', 'element'],
  png: ['isolated', 'cutout', 'transparent background', 'element', 'object', 'studio'],
  jpg: ['photography', 'high resolution', 'commercial', 'composition', 'detailed', 'nobody'],
  webp: ['high resolution', 'modern', 'commercial', 'clean', 'composition', 'detailed'],
  tiff: ['high resolution', 'print quality', 'commercial', 'detailed', 'photography'],
};

const GENERIC_COMMERCIAL_FILL = [
  'background', 'concept', 'design', 'modern', 'creative', 'style', 'clean', 'natural',
  'light', 'color', 'detail', 'view', 'scene', 'visual', 'contemporary', 'quality',
  'aesthetic', 'atmosphere', 'texture', 'space',
];

export interface VisualCueSummary {
  mood: string;
  paletteWords: string[];
  lightingWords: string[];
  hasTransparency: boolean;
  isolatedWhite: boolean;
}

/**
 * Inspect an image Blob on a tiny 48x48 offscreen canvas to extract genuine
 * color, lighting, contrast and cutout cues for offline Local AI metadata.
 */
export async function analyzeImageVisuals(blob?: Blob | null): Promise<VisualCueSummary | null> {
  if (!blob || typeof createImageBitmap !== 'function') return null;
  if (!blob.type.startsWith('image/') || blob.type.includes('svg')) return null;
  let bmp: ImageBitmap | null = null;
  try {
    bmp = await createImageBitmap(blob);
    const size = 48;
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(size, size)
        : Object.assign(document.createElement('canvas'), { width: size, height: size });
    const ctx = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let lumSum = 0;
    let lumSq = 0;
    let satSum = 0;
    let transparent = 0;
    let borderWhite = 0;
    let borderCount = 0;
    let warmCount = 0;
    let coolCount = 0;
    let greenCount = 0;
    let opaqueCount = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        if (a < 220) {
          transparent++;
          continue;
        }
        opaqueCount++;
        rSum += r;
        gSum += g;
        bSum += b;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        lumSum += lum;
        lumSq += lum * lum;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;
        satSum += sat;
        if (sat > 0.22) {
          if (r > b + 28 && g >= b - 10) warmCount++;
          else if (b > r + 22) coolCount++;
          if (g > r + 15 && g > b + 15) greenCount++;
        }
        if (x < 3 || x >= size - 3 || y < 3 || y >= size - 3) {
          borderCount++;
          if (r > 238 && g > 238 && b > 238) borderWhite++;
        }
      }
    }

    const total = size * size;
    const hasTransparency = transparent / total > 0.08;
    if (opaqueCount === 0) {
      return {
        mood: 'isolated transparent',
        paletteWords: ['transparent background', 'isolated', 'cutout'],
        lightingWords: ['clean', 'studio'],
        hasTransparency: true,
        isolatedWhite: false,
      };
    }

    const avgLum = lumSum / opaqueCount;
    const stdLum = Math.sqrt(Math.max(0, lumSq / opaqueCount - avgLum * avgLum));
    const avgSat = satSum / opaqueCount;
    const isolatedWhite = !hasTransparency && borderCount > 0 && borderWhite / borderCount > 0.72;

    const paletteWords: string[] = [];
    const lightingWords: string[] = [];
    let mood = 'natural balanced';

    if (hasTransparency) {
      mood = 'isolated cutout';
      paletteWords.push('isolated', 'transparent background', 'cutout');
    } else if (isolatedWhite) {
      mood = 'clean white studio';
      paletteWords.push('white background', 'isolated', 'studio shot', 'copy space');
    } else if (avgSat < 0.09) {
      mood = 'monochrome minimalist';
      paletteWords.push('monochrome', 'neutral tones', 'minimalist');
    } else if (greenCount / opaqueCount > 0.28) {
      mood = 'fresh lush green';
      paletteWords.push('green', 'lush', 'natural color', 'organic');
    } else if (warmCount > coolCount * 1.4 && warmCount / opaqueCount > 0.2) {
      mood = 'warm golden';
      paletteWords.push('warm tones', 'golden', 'vibrant');
    } else if (coolCount > warmCount * 1.3 && coolCount / opaqueCount > 0.2) {
      mood = 'cool blue';
      paletteWords.push('blue tones', 'cool color', 'calm', 'serene');
    } else if (avgSat > 0.45) {
      mood = 'vibrant colorful';
      paletteWords.push('colorful', 'vibrant', 'vivid', 'rich color');
    } else {
      const avgR = rSum / opaqueCount;
      const avgB = bSum / opaqueCount;
      const avgG = gSum / opaqueCount;
      if (avgR > avgB + 15 && avgG > avgB) paletteWords.push('warm tones', 'soft color');
      else paletteWords.push('balanced color', 'natural tones');
    }

    if (avgLum > 188) {
      lightingWords.push('bright', 'airy', 'soft light');
      if (mood === 'natural balanced') mood = 'bright airy';
    } else if (avgLum < 72) {
      lightingWords.push('dark', 'moody', 'dramatic lighting', 'low key');
      if (mood === 'natural balanced') mood = 'dramatic moody';
    } else {
      lightingWords.push('natural light', 'well lit');
    }
    if (stdLum > 65) lightingWords.push('high contrast');

    return { mood, paletteWords, lightingWords, hasTransparency, isolatedWhite };
  } catch {
    return null;
  } finally {
    bmp?.close();
  }
}

export function tokensFromFilename(name: string): string[] {
  const base = name.replace(/\.[^.]+$/, '');
  const split = base
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return split.filter((word) => word.length > 2 && !/^\d+$/.test(word) && !STOP_WORDS.has(word));
}

function sentenceCase(words: string[]): string {
  if (!words.length) return '';
  const joined = words.join(' ').replace(/[-–—]+/g, ' ').replace(/\s+/g, ' ').trim();
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

export function scrubStockKeywords(words: string[], limit = 49): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of words) {
    const clean = raw
      .trim()
      .toLowerCase()
      .replace(/[-–—_/]+/g, ' ')
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean || clean.length < 2 || clean.length > 40) continue;
    if (seen.has(clean) || BANNED_STOCK_TERMS.has(clean)) continue;
    const tokens = clean.split(' ');
    if (tokens.some((t) => BANNED_STOCK_TERMS.has(t))) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

export function cleanStockSentence(text: string, maxChars: number, noCommas = false): string {
  let out = text
    .replace(/[\r\n]+/g, ' ')
    .replace(/[-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (noCommas) out = out.replace(/,/g, '');
  out = out.replace(/^["']+|["']+$/g, '').trim();
  if (out.length > maxChars) {
    const cut = out.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(' ');
    out = (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
  }
  return out;
}

/** Primary colour word that is worth putting in a title, or an empty string. */
function titleColour(insight: ImageInsight): string {
  const top = insight.palette.find(
    (colour) => colour.share > 0.16 && !['grey', 'silver', 'white', 'black', 'charcoal'].includes(colour.name),
  );
  return top ? (COLOUR_ADJECTIVES[top.name] ?? top.name) : '';
}

function lightWord(insight: ImageInsight): string {
  const { meanLuma, contrast } = insight.quality;
  if (meanLuma > 182) return 'bright airy light';
  if (meanLuma < 74) return 'dramatic low light';
  if (contrast > 72) return 'high contrast light';
  return 'soft natural light';
}

/** Pick one phrasing from a list, stable for a given file. */
function pick<T>(options: T[], variant: number, salt = 0): T {
  return options[(variant + salt) % options.length];
}

/** Composition phrase that reflects where the subject actually sits. */
function compositionPhrase(insight: ImageInsight): string {
  const space = insight.negativeSpace;
  const side = space === 'left' ? 'left' : space === 'right' ? 'right' : '';
  if (space === 'top') return 'with clear space above';
  if (space === 'bottom') return 'with clear space below';
  if (side) return `with copy space on the ${side}`;
  if (insight.subjectPosition === 'left') return 'subject placed to the left';
  if (insight.subjectPosition === 'right') return 'subject placed to the right';
  return insight.orientation === 'portrait' ? 'vertical framing' : 'balanced framing';
}

/**
 * Titles are assembled from several measured facts, and each scene offers more
 * than one sentence shape, so a batch of files never reads like one template.
 */
function sceneTitle(insight: ImageInsight, isVector: boolean): string {
  const colour = titleColour(insight);
  const light = lightWord(insight);
  const detail = insight.details;
  const has = (tag: string) => detail.includes(tag);
  const withColour = (word: string) => (colour ? `${colour} ${word}` : word);
  const v = insight.variant;
  let title: string;

  switch (insight.kind) {
    case 'cutout':
      title = pick(
        [
          `Isolated ${withColour('object')} on a transparent background`,
          `Clean ${withColour('cutout')} with a sharp edge and no background`,
          `${withColour('Single object')} isolated for instant layout use`,
        ],
        v,
      );
      break;
    case 'product':
      title = insight.backgroundHex && /^#f/i.test(insight.backgroundHex)
        ? pick(
            [
              'Product still life on a seamless white background',
              `Clean studio product shot in ${light}`,
            ],
            v,
          )
        : pick(
            [
              `Studio still life on a ${colour ? `${colour} ` : ''}backdrop`,
              `Product composition lit with ${light}`,
            ],
            v,
            1,
          );
      break;
    case 'portrait':
      title = pick(
        [
          `Portrait of a person in ${light}`,
          `Close portrait with ${light} and a calm expression`,
          `Editorial headshot photographed in ${light}`,
        ],
        v,
      );
      break;
    case 'people':
      title = pick(
        [
          `People together in ${light}`,
          `Group scene captured in ${light}`,
          `Candid people moment in ${light}`,
        ],
        v,
      );
      break;
    case 'landscape':
      title = pick(
        [
          `Wide ${withColour('landscape')} under an open sky`,
          `${withColour('Horizon')} view with ${light} and room for copy`,
          `Open ${withColour('vista')} stretching to the horizon`,
        ],
        v,
      );
      break;
    case 'nature':
      title = pick(
        [
          `${withColour('Foliage')} close up with natural texture`,
          `Natural ${withColour('detail')} in ${light}`,
          `Leafy ${withColour('undergrowth')} with fine texture`,
        ],
        v,
      );
      break;
    case 'architecture':
      title = pick(
        [
          `Modern building facade with clean ${colour || 'geometric'} lines`,
          `Architectural detail in ${light}`,
          `${withColour('Structural')} geometry against the sky`,
        ],
        v,
      );
      break;
    case 'food':
      title = pick(
        [
          `Warm tabletop food scene in ${light}`,
          `Freshly plated dish in ${light}`,
          `Overhead food still life with ${colour || 'rich'} tones`,
        ],
        v,
      );
      break;
    case 'screenshot':
      title = 'Clean interface screenshot with crisp readable text';
      break;
    case 'document':
      title = 'Printed document page on a plain white surface';
      break;
    case 'illustration':
      title = pick(
        [
          `Flat ${withColour('vector illustration')} with bold shapes`,
          `${withColour('Graphic')} composition with clean vector edges`,
          `Modern flat artwork in ${colour || 'bold'} tones`,
        ],
        v,
      );
      break;
    case 'pattern':
      title = pick(
        [
          `Seamless ${withColour('geometric pattern')} for surface design`,
          `Repeat ${withColour('motif')} that tiles without a seam`,
          `Decorative ${withColour('pattern')} for print and web`,
        ],
        v,
      );
      break;
    case 'abstract':
      title = pick(
        [
          `Abstract ${withColour('composition')} with soft gradients`,
          `Abstract ${withColour('background')} with fluid shapes`,
          `Modern abstract artwork in ${colour || 'layered'} tones`,
        ],
        v,
      );
      break;
    default:
      title = pick(
        [
          `${colour ? `${colour} toned ` : ''}Photograph in ${light}`,
          `${colour ? `${colour} ` : ''}Scene captured in ${light}`,
          `${has('fine detail') ? 'Detailed' : 'Natural'} photograph with ${light}`,
        ],
        v,
      );
  }

  // Only add a composition tail when the title stays inside the 70 character
  // marketplace sweet spot.
  const tail = compositionPhrase(insight);
  if (title.length + tail.length + 1 <= 70 && !/copy space|framing/.test(title)) {
    title = `${title} ${tail}`;
  }
  if (isVector && !/vector|illustration|graphic|pattern/i.test(title)) {
    title = `${title} as a scalable vector graphic`;
  }
  return title;
}

/** Category to marketplace copy: what a buyer would actually do with the file. */
function useCaseFor(kind: SceneKind): string {
  switch (kind) {
    case 'cutout':
    case 'product':
      return 'Ready for product pages, advertising layouts and mockups.';
    case 'portrait':
    case 'people':
      return 'Suited to editorial features, brand storytelling and campaigns.';
    case 'landscape':
    case 'nature':
      return 'Works for travel promotion, editorial features and wide banners.';
    case 'architecture':
      return 'Fits real estate listings, architectural features and corporate decks.';
    case 'food':
      return 'Ideal for menus, delivery apps and food blog features.';
    case 'document':
    case 'screenshot':
      return 'Useful for documentation, tutorials and interface presentations.';
    case 'illustration':
    case 'pattern':
    case 'abstract':
      return 'Built for branding, packaging, social posts and background use.';
    default:
      return 'Suitable for commercial and editorial layouts.';
  }
}

function sceneDescription(insight: ImageInsight, isVector: boolean): string {
  const colour = titleColour(insight);
  const light = lightWord(insight);
  const detail = insight.details.filter((tag) => !/subject|centred/.test(tag)).slice(0, 2);
  const kindPhrase: Record<string, string> = {
    cutout: 'The subject is isolated with a clean edge, so it drops straight into any layout.',
    product: 'Shot on a clean background with even, controlled light.',
    portrait: 'Natural expression and even light keep the frame usable for editorial and commercial work.',
    people: 'An honest, unposed moment between people.',
    landscape: 'The frame opens onto a wide horizon and holds plenty of room for headline copy.',
    nature: 'Fine natural texture stays readable at full size.',
    architecture: 'Straight lines and repeating structure give the frame a calm, graphic rhythm.',
    food: 'Fresh texture and warm colour make the dish look appetising at any size.',
    screenshot: 'Interface elements and text stay legible at full resolution.',
    document: 'Text and margins are sharp enough to read at full size.',
    illustration: 'Flat shapes and clean outlines stay crisp at any scale.',
    pattern: 'The repeat tiles seamlessly across packaging, fabric and web backgrounds.',
    abstract: 'Layered shapes and soft gradients leave space for type.',
    photo: 'Balanced exposure and honest colour keep the frame easy to crop.',
  };
  const toneSentence = colour
    ? `${colour[0].toUpperCase()}${colour.slice(1)} tones in ${light}${detail.length ? `, with ${detail.join(' and ')}` : ''}.`
    : `Even exposure in ${light}${detail.length ? `, with ${detail.join(' and ')}` : ''}.`;
  const parts = [
    kindPhrase[insight.kind] ?? kindPhrase.photo,
    toneSentence,
    isVector ? 'Delivered as a scalable vector that stays sharp at any size.' : useCaseFor(insight.kind),
  ];
  return cleanStockSentence(parts.join(' '), 195, false);
}

function draftFromInsight(
  item: Pick<StockItem, 'name' | 'format' | 'width' | 'height' | 'flags'>,
  insight: ImageInsight,
  targetKeywordCount: number,
): StockMetadata {
  const profile = SCENE_PROFILES[insight.kind];
  const isVector = item.format === 'eps' || item.format === 'ai' || item.format === 'svg';
  const title = cleanStockSentence(sceneTitle(insight, isVector), 70, true);
  const description = sceneDescription(insight, isVector);

  const paletteWords = insight.palette
    .slice(0, 4)
    .map((colour) => (COLOUR_ADJECTIVES[colour.name] ? `${COLOUR_ADJECTIVES[colour.name]} tones` : ''))
    .filter(Boolean);
  const lightTerms =
    insight.quality.meanLuma > 182
      ? ['bright', 'airy', 'high key', 'natural light']
      : insight.quality.meanLuma < 74
        ? ['dark', 'moody', 'low key', 'dramatic lighting']
        : ['natural light', 'well lit'];
  const composition = [
    insight.orientation === 'landscape' ? 'horizontal' : insight.orientation === 'portrait' ? 'vertical' : 'square',
    'copy space',
    insight.negativeSpace ? `negative space ${insight.negativeSpace}` : '',
    insight.subjectPosition === 'centre' ? 'centred' : `subject on the ${insight.subjectPosition}`,
  ].filter(Boolean);
  const detailWords = insight.details
    .map((tag) => tag.replace('subject on the ', ''))
    .filter((tag) => tag && !/centred subject/.test(tag));

  const pool = [
    ...profile.keywords,
    ...detailWords,
    ...paletteWords,
    ...lightTerms,
    ...composition,
    ...(insight.hasTransparency ? ['isolated', 'transparent background', 'cutout'] : []),
    ...(insight.uniformBackground ? ['studio backdrop', 'seamless background'] : []),
    ...(insight.labels.includes('soft focus') ? [] : ['sharp detail']),
    ...COMMERCIAL_TERMS,
  ];
  const keywords = scrubStockKeywords(pool, Math.min(49, Math.max(12, targetKeywordCount)));
  const categories = [profile.category, ...(profile.secondary ? [profile.secondary] : [])].slice(0, 2);

  return { title, description, keywords, categories };
}

export function draftMetadata(
  item: Pick<StockItem, 'name' | 'format' | 'width' | 'height' | 'flags'>,
  targetKeywordCount = 35,
  visuals?: VisualCueSummary | null,
  insight?: ImageInsight | null,
): StockMetadata {
  if (insight && !['eps', 'ai', 'svg'].includes(item.format)) {
    return draftFromInsight(item, insight, targetKeywordCount);
  }
  const tokens = tokensFromFilename(item.name).filter((t) => !BANNED_STOCK_TERMS.has(t));
  const pool: string[] = [...tokens];
  const categories: string[] = [];

  for (const token of tokens) {
    for (const [key, theme] of Object.entries(THEMES)) {
      if (token === key || (token.length >= 4 && (token.startsWith(key) || key.startsWith(token)))) {
        pool.push(...theme.words);
        if (!categories.includes(theme.category)) categories.push(theme.category);
      }
    }
  }

  if (visuals) {
    pool.push(...visuals.paletteWords, ...visuals.lightingWords);
  }

  let orientationPhrase = '';
  if (item.width && item.height) {
    const ratio = item.width / item.height;
    if (ratio > 1.2) {
      pool.push('horizontal', 'landscape orientation', 'wide shot', 'copy space');
      orientationPhrase = 'horizontal composition with copy space';
    } else if (ratio < 0.85) {
      pool.push('vertical', 'portrait orientation', 'story format');
      orientationPhrase = 'vertical composition';
    } else {
      pool.push('square', 'balanced composition', 'centered');
      orientationPhrase = 'balanced square composition';
    }
  }

  pool.push(...(FORMAT_EXTRAS[item.format] ?? FORMAT_EXTRAS.jpg));
  if (item.flags.illustration && !pool.includes('illustration')) {
    pool.push('illustration', 'digital art', 'artwork', 'creative');
  }
  pool.push(...GENERIC_COMMERCIAL_FILL);

  const keywords = scrubStockKeywords(pool, Math.min(49, Math.max(12, targetKeywordCount)));

  const isVector = item.format === 'eps' || item.format === 'ai' || item.format === 'svg';
  const subjectWords = tokens.length
    ? tokens.slice(0, 6)
    : visuals
      ? [visuals.mood, isVector ? 'vector graphic' : 'commercial scene']
      : [isVector ? 'modern vector graphic illustration' : 'commercial high resolution scene'];

  const baseSubject = sentenceCase(subjectWords);
  const titleSuffix = visuals?.hasTransparency
    ? 'isolated on transparent background'
    : visuals?.isolatedWhite
      ? 'isolated on clean white background'
      : isVector
        ? 'scalable vector illustration'
        : visuals
          ? `in ${visuals.mood} light`
          : 'for commercial design';

  let title = `${baseSubject} ${titleSuffix}`;
  if (title.split(/\s+/).length < 5) {
    title = `${title} with clean modern detail`;
  }
  title = cleanStockSentence(title, 70, true);

  const mediumLabel = isVector
    ? 'scalable vector graphic'
    : item.flags.illustration
      ? 'detailed digital illustration'
      : visuals?.hasTransparency
        ? 'clean isolated cutout image'
        : 'high resolution commercial photograph';

  const description = cleanStockSentence(
    `${title}. Professional ${mediumLabel}${
      orientationPhrase ? ` in a ${orientationPhrase}` : ''
    } suited for editorial layouts, branding, web and print projects.`,
    200,
    false,
  );

  if (!categories.length) {
    categories.push(isVector ? 'Signs/Symbols' : visuals?.isolatedWhite ? 'Objects' : 'Backgrounds/Textures');
  }

  return {
    title,
    description,
    keywords,
    categories: categories.slice(0, 2),
  };
}

export function parseKeywordInput(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((word) => word.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean);
}

export function mergeKeywords(existing: string[], incoming: string[], cap = 50): string[] {
  return scrubStockKeywords([...existing, ...incoming], cap);
}

/** Format metadata cleanly for one click clipboard copy. */
export function formatMetadataForClipboard(meta: StockMetadata): string {
  const lines = [
    `Title: ${meta.title.trim()}`,
    `Description: ${(meta.description || meta.title).trim()}`,
    `Keywords (${meta.keywords.length}): ${meta.keywords.join(', ')}`,
  ];
  if (meta.categories.length) {
    lines.push(`Categories: ${meta.categories.join(', ')}`);
  }
  return lines.join('\n');
}
