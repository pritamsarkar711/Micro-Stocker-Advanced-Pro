/**
 * High quality procedural avatars.
 *
 * Every account gets a visually rich avatar instead of a single initial
 * letter. The avatar is a deterministic SVG generated from the account id:
 * a gradient backdrop, layered geometric shapes and a stylised face or
 * abstract mark. The same id always produces the same avatar, so the picture
 * is stable across devices without storing an image, and the user can
 * shuffle to a new one or upload their own photo at any time.
 *
 * The SVG is returned as a data URI so it can be used directly in an <img>
 * tag and stored in Supabase user metadata as a small string.
 */

export interface AvatarSpec {
  /** Stable seed (user id or email). */
  seed: string;
  /** Palette index 0..PALETTES.length-1 */
  palette: number;
  /** Pattern index 0..PATTERNS-1 */
  pattern: number;
  /** Custom image data URI when the user uploaded a photo. */
  customUrl?: string;
}

const PALETTES: Array<[string, string, string]> = [
  ['#6366f1', '#8b5cf6', '#ec4899'],
  ['#0ea5e9', '#06b6d4', '#22d3ee'],
  ['#f59e0b', '#f97316', '#ef4444'],
  ['#10b981', '#34d399', '#a3e635'],
  ['#ec4899', '#f43f5e', '#fb7185'],
  ['#8b5cf6', '#6366f1', '#3b82f6'],
  ['#14b8a6', '#0ea5e9', '#6366f1'],
  ['#f43f5e', '#f97316', '#facc15'],
  ['#3b82f6', '#06b6d4', '#10b981'],
  ['#a855f7', '#ec4899', '#f59e0b'],
  ['#22c55e', '#84cc16', '#eab308'],
  ['#64748b', '#94a3b8', '#cbd5e1'],
];

const PATTERNS = 6;

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic spec for a seed. `salt` lets the user shuffle to a new look. */
export function avatarSpecFor(seed: string, salt = 0): AvatarSpec {
  const h = hashSeed(`${seed}:${salt}`);
  return {
    seed,
    palette: h % PALETTES.length,
    pattern: Math.floor(h / PALETTES.length) % PATTERNS,
  };
}

/** Parse a stored avatar string ("seed:palette:pattern" or a data URI). */
export function parseAvatar(value: string | null | undefined): AvatarSpec | null {
  if (!value) return null;
  if (value.startsWith('data:image/')) return { seed: '', palette: 0, pattern: 0, customUrl: value };
  const parts = value.split(':');
  if (parts.length >= 3) {
    return {
      seed: parts[0],
      palette: Number(parts[1]) % PALETTES.length,
      pattern: Number(parts[2]) % PATTERNS,
    };
  }
  return null;
}

export function serializeAvatar(spec: AvatarSpec): string {
  if (spec.customUrl) return spec.customUrl;
  return `${spec.seed}:${spec.palette}:${spec.pattern}`;
}

/** Build a rich SVG data URI for the given spec. */
export function avatarDataUri(spec: AvatarSpec): string {
  if (spec.customUrl) return spec.customUrl;
  const [c1, c2, c3] = PALETTES[spec.palette % PALETTES.length];
  const rand = mulberry32(hashSeed(spec.seed) + spec.palette * 131 + spec.pattern * 17);
  const angle = Math.floor(rand() * 360);
  const cx = 32 + Math.floor(rand() * 24) - 12;
  const cy = 30 + Math.floor(rand() * 20) - 10;
  const r = 14 + Math.floor(rand() * 10);
  const ringR = r + 8 + Math.floor(rand() * 6);
  const dotX = 12 + Math.floor(rand() * 40);
  const dotY = 12 + Math.floor(rand() * 40);
  const dotR = 3 + Math.floor(rand() * 4);
  const triX = 14 + Math.floor(rand() * 36);
  const triY = 14 + Math.floor(rand() * 36);

  let pattern = '';
  switch (spec.pattern % PATTERNS) {
    case 0:
      pattern = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" opacity="0.95"/><circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.55"/><circle cx="${dotX}" cy="${dotY}" r="${dotR}" fill="#ffffff" opacity="0.7"/>`;
      break;
    case 1:
      pattern = `<rect x="14" y="14" width="36" height="36" rx="10" fill="#ffffff" opacity="0.92"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c1}"/><path d="M${triX} ${triY} l10 0 l-5 9 Z" fill="#ffffff" opacity="0.85"/>`;
      break;
    case 2:
      pattern = `<circle cx="32" cy="32" r="20" fill="#ffffff" opacity="0.95"/><circle cx="25" cy="29" r="3.2" fill="${c1}"/><circle cx="39" cy="29" r="3.2" fill="${c1}"/><path d="M24 38 Q32 45 40 38" fill="none" stroke="${c1}" stroke-width="3" stroke-linecap="round"/><circle cx="${dotX}" cy="${dotY}" r="${dotR}" fill="${c2}" opacity="0.8"/>`;
      break;
    case 3:
      pattern = `<path d="M10 38 Q32 8 54 38 Q32 52 10 38Z" fill="#ffffff" opacity="0.95"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c2}"/><circle cx="${dotX}" cy="${dotY}" r="${dotR}" fill="#ffffff" opacity="0.8"/>`;
      break;
    case 4:
      pattern = `<rect x="12" y="12" width="40" height="40" rx="20" fill="#ffffff" opacity="0.92"/><circle cx="32" cy="28" r="7" fill="${c1}"/><path d="M18 44 Q32 34 46 44 L46 52 L18 52Z" fill="${c2}"/>`;
      break;
    default:
      pattern = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" opacity="0.95"/><path d="M${triX} ${triY} l12 0 l-6 10 Z" fill="${c3}" opacity="0.9"/><circle cx="${dotX}" cy="${dotY}" r="${dotR}" fill="#ffffff" opacity="0.7"/><circle cx="32" cy="32" r="26" fill="none" stroke="#ffffff" stroke-width="1.8" opacity="0.4"/>`;
      break;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="0.55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient><linearGradient id="o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><g transform="rotate(${angle} 32 32)">${pattern}</g><rect width="64" height="64" fill="url(#o)"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Avatar URL for a user, falling back to a generated one. */
export function avatarUrlFor(stored: string | null | undefined, seed: string): string {
  const parsed = parseAvatar(stored);
  if (parsed) return avatarDataUri(parsed);
  return avatarDataUri(avatarSpecFor(seed));
}

/** A fresh random spec for "shuffle avatar". */
export function randomAvatarSpec(seed: string): AvatarSpec {
  const salt = Math.floor(Math.random() * 1_000_000);
  const base = avatarSpecFor(seed, salt);
  // Encode the salt into the seed so the choice persists.
  return { ...base, seed: `${seed}#${salt}` };
}

/** Gallery of ready-made avatars to pick from. */
export function avatarGallery(seed: string, count = 12): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(avatarDataUri(avatarSpecFor(seed, i * 7 + 1)));
  }
  return out;
}

/** Downscale an uploaded photo to a small data URI suitable for storage. */
export async function fileToAvatarDataUri(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image.');
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
