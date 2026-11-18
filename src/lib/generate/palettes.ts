/**
 * Curated colour palettes for generated vector artwork.
 *
 * Every palette is hand-balanced (one dominant, one dark, two accents and a
 * paper tone) so a generated file never ships the muddy, low-contrast colour
 * sets that get rejected. The model may pick a palette by id, never raw hex, and
 * the renderer only ever uses these values.
 */

export interface Palette {
  id: string;
  name: string;
  /** Named colours feed the generated keywords. */
  colours: { hex: string; name: string }[];
  /** Suggestive mood words used by the metadata writer. */
  mood: string;
}

const c = (hex: string, name: string) => ({ hex, name });

export const PALETTES: Palette[] = [
  {
    id: 'terracotta',
    name: 'Terracotta sunset',
    colours: [c('#2f2a26', 'charcoal'), c('#e76f51', 'terracotta'), c('#f4a261', 'apricot'), c('#e9c46a', 'sand'), c('#f7f3ec', 'paper')],
    mood: 'warm',
  },
  {
    id: 'deep-teal',
    name: 'Deep teal',
    colours: [c('#0f2e2e', 'deep teal'), c('#177e89', 'teal'), c('#8ac6bf', 'sea glass'), c('#f2c14e', 'gold'), c('#f7f7f2', 'paper')],
    mood: 'calm',
  },
  {
    id: 'berry',
    name: 'Berry bloom',
    colours: [c('#3d0b26', 'plum'), c('#a4133c', 'berry'), c('#e56b8b', 'rose'), c('#f6c7b6', 'blush'), c('#fff7f4', 'paper')],
    mood: 'romantic',
  },
  {
    id: 'forest',
    name: 'Forest layers',
    colours: [c('#14281d', 'forest'), c('#2d6a4f', 'pine'), c('#74c69d', 'sage'), c('#d8f3dc', 'mint'), c('#f6fff7', 'paper')],
    mood: 'natural',
  },
  {
    id: 'midnight',
    name: 'Midnight neon',
    colours: [c('#0b0c1b', 'midnight'), c('#3f2b96', 'indigo'), c('#7b5cf0', 'violet'), c('#38d6c4', 'aqua'), c('#f5f6ff', 'paper')],
    mood: 'technological',
  },
  {
    id: 'citrus',
    name: 'Citrus pop',
    colours: [c('#1d1d1b', 'ink'), c('#f4b400', 'sunflower'), c('#f28c28', 'orange'), c('#9bd13c', 'lime'), c('#fffdf5', 'paper')],
    mood: 'energetic',
  },
  {
    id: 'clay',
    name: 'Clay and cream',
    colours: [c('#3a2b22', 'cocoa'), c('#a9714b', 'clay'), c('#e2c290', 'wheat'), c('#c9d6c4', 'eucalyptus'), c('#fdfaf3', 'cream')],
    mood: 'earthy',
  },
  {
    id: 'ocean',
    name: 'Ocean depth',
    colours: [c('#05273a', 'navy'), c('#0b6e99', 'ocean'), c('#4fb3d9', 'sky'), c('#cfe9f2', 'ice'), c('#fbfdff', 'paper')],
    mood: 'airy',
  },
  {
    id: 'mono',
    name: 'Monochrome',
    colours: [c('#111111', 'black'), c('#4a4a4a', 'graphite'), c('#9a9a9a', 'grey'), c('#dcdcdc', 'silver'), c('#ffffff', 'white')],
    mood: 'minimal',
  },
  {
    id: 'festive',
    name: 'Festive red',
    colours: [c('#5c0a14', 'crimson'), c('#c1121f', 'red'), c('#f4d35e', 'gold'), c('#2d6a4f', 'pine'), c('#fffaf0', 'ivory')],
    mood: 'festive',
  },
  {
    id: 'harvest',
    name: 'Harvest gold',
    colours: [c('#3a2e1f', 'walnut'), c('#b5651d', 'amber'), c('#e8a33d', 'honey'), c('#7d8f69', 'olive'), c('#fdf6e3', 'parchment')],
    mood: 'seasonal',
  },
  {
    id: 'ice',
    name: 'Winter ice',
    colours: [c('#12343b', 'slate'), c('#2e6f7e', 'glacier'), c('#89c2d9', 'ice'), c('#e3f2f7', 'snow'), c('#ffffff', 'white')],
    mood: 'crisp',
  },
];

export const PALETTE_BY_ID = new Map(PALETTES.map((palette) => [palette.id, palette]));

export function paletteById(id: string | undefined): Palette {
  return (id && PALETTE_BY_ID.get(id)) || PALETTES[0];
}

/** Contrast ratio between two hex colours, used by the quality gate. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const value = hex.replace('#', '');
    const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
    const linear = channels.map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const first = lum(a);
  const second = lum(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
