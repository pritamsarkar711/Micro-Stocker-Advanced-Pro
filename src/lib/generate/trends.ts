/**
 * Seasonal and holiday idea engine.
 *
 * A small editorial calendar, not a network call: the suggestions are instant,
 * free, and vary per visitor. Windows are stored as month/day ranges so a
 * southern-hemisphere user still sees the right season soon after the northern
 * one, and every idea carries the palette and style that sells for that occasion.
 */

import type { LayoutId, MotifId, StyleId } from './engine';

export interface TrendIdea {
  id: string;
  title: string;
  prompt: string;
  motif: MotifId;
  style: StyleId;
  paletteId: string;
  layout?: LayoutId;
  tags: string[];
  occasion: string;
  /** Month/day window in which the idea peaks. */
  window: [number, number];
  regions: string[];
}

interface IdeaSeed extends Omit<TrendIdea, 'id'> {}

const IDEAS: IdeaSeed[] = [
  {
    title: 'Christmas tree with baubles',
    prompt: 'Minimal Christmas tree with hanging baubles under a winter moon, greeting card cover',
    motif: 'tree',
    style: 'flat',
    paletteId: 'festive',
    tags: ['christmas', 'holiday', 'greeting card'],
    occasion: 'Christmas',
    window: [1120, 1227],
    regions: ['Global'],
  },
  {
    title: 'New year fireworks poster',
    prompt: 'Fireworks burst over confetti in a clean poster layout for New Year celebrations',
    motif: 'celebration',
    style: 'flat',
    layout: 'poster',
    paletteId: 'midnight',
    tags: ['new year', 'fireworks', 'celebration'],
    occasion: "New Year's Eve",
    window: [1226, 106],
    regions: ['Global'],
  },
  {
    title: 'Snowflake pattern',
    prompt: 'Symmetrical snowflake crystal pattern for winter packaging and textiles',
    motif: 'snowflake',
    style: 'line',
    paletteId: 'ice',
    tags: ['winter', 'snow', 'pattern'],
    occasion: 'Winter holidays',
    window: [1201, 228],
    regions: ['Global'],
  },
  {
    title: 'Valentine hearts card',
    prompt: 'Layered overlapping hearts with a ribbon, romantic greeting card for Valentine',
    motif: 'hearts',
    style: 'flat',
    paletteId: 'berry',
    tags: ['valentine', 'love', 'card'],
    occasion: "Valentine's Day",
    window: [105, 220],
    regions: ['Global'],
  },
  {
    title: 'Ramadan lantern night',
    prompt: 'Hanging festival lantern under a crescent moon for Ramadan greetings',
    motif: 'lantern',
    style: 'vector',
    paletteId: 'deep-teal',
    tags: ['ramadan', 'eid', 'lantern'],
    occasion: 'Ramadan and Eid',
    window: [210, 410],
    regions: ['Middle East', 'South Asia', 'Southeast Asia'],
  },
  {
    title: 'Diwali lamp and rangoli',
    prompt: 'Oil lamp on a rangoli pattern for Diwali festival greetings',
    motif: 'diya',
    style: 'flat',
    paletteId: 'harvest',
    tags: ['diwali', 'lamp', 'festival'],
    occasion: 'Diwali',
    window: [1001, 1115],
    regions: ['South Asia', 'Global diaspora'],
  },
  {
    title: 'Halloween pumpkin night',
    prompt: 'Carved pumpkin with bats under a full moon, halloween poster scene',
    motif: 'pumpkin',
    style: 'vector',
    paletteId: 'harvest',
    tags: ['halloween', 'pumpkin', 'autumn'],
    occasion: 'Halloween',
    window: [901, 1031],
    regions: ['US', 'UK', 'Europe'],
  },
  {
    title: 'Spring blossom hills',
    prompt: 'Blossom branch on rolling spring hills, fresh seasonal illustration',
    motif: 'spring',
    style: 'flat',
    paletteId: 'forest',
    tags: ['spring', 'blossom', 'nature'],
    occasion: 'Spring season',
    window: [301, 531],
    regions: ['Global'],
  },
  {
    title: 'Summer travel suitcase',
    prompt: 'Suitcase on a winding path under the sun, summer vacation illustration',
    motif: 'travel',
    style: 'flat',
    paletteId: 'citrus',
    tags: ['summer', 'travel', 'vacation'],
    occasion: 'Summer holidays',
    window: [601, 831],
    regions: ['Global', 'Europe'],
  },
  {
    title: 'Black Friday sale badge',
    prompt: 'Sale badge emblem with laurel and star for Black Friday promotion',
    motif: 'laurel',
    style: 'flat',
    layout: 'badge',
    paletteId: 'midnight',
    tags: ['black friday', 'sale', 'promotion'],
    occasion: 'Black Friday',
    window: [1110, 1130],
    regions: ['US', 'Global'],
  },
  {
    title: 'Back to school set',
    prompt: 'Geometric school supplies set for back to school season',
    motif: 'arcs',
    style: 'geometric',
    paletteId: 'citrus',
    tags: ['school', 'education', 'september'],
    occasion: 'Back to school',
    window: [801, 915],
    regions: ['US', 'Europe', 'Global'],
  },
  {
    title: 'Autumn harvest scene',
    prompt: 'Layered mountain range with warm autumn light, seasonal landscape',
    motif: 'mountain',
    style: 'detailed',
    paletteId: 'terracotta',
    tags: ['autumn', 'harvest', 'landscape'],
    occasion: 'Autumn',
    window: [915, 1130],
    regions: ['Global'],
  },
  {
    title: 'Lunar new year lanterns',
    prompt: 'Red lantern composition for Lunar New Year greetings',
    motif: 'lantern',
    style: 'flat',
    paletteId: 'festive',
    tags: ['lunar new year', 'lantern', 'celebration'],
    occasion: 'Lunar New Year',
    window: [110, 220],
    regions: ['China', 'East Asia', 'Global diaspora'],
  },
  {
    title: 'Coffee brand icon',
    prompt: 'Coffee cup icon set with steam, cafe brand icon design',
    motif: 'coffee',
    style: 'icon',
    paletteId: 'clay',
    tags: ['coffee', 'cafe', 'brand'],
    occasion: 'Evergreen',
    window: [101, 1231],
    regions: ['Global'],
  },
  {
    title: 'Finance growth poster',
    prompt: 'Rising bar chart with coin, financial growth poster illustration',
    motif: 'finance',
    style: 'vector',
    paletteId: 'ocean',
    tags: ['finance', 'business', 'growth'],
    occasion: 'Evergreen',
    window: [101, 1231],
    regions: ['Global'],
  },
  {
    title: 'Tech circuit banner',
    prompt: 'Microchip with orbital data paths, technology banner illustration',
    motif: 'tech',
    style: 'detailed',
    paletteId: 'midnight',
    tags: ['technology', 'data', 'banner'],
    occasion: 'Evergreen',
    window: [101, 1231],
    regions: ['Global'],
  },
  {
    title: 'Botanical line art',
    prompt: 'Single blossom botanical line art for wellness branding',
    motif: 'floral',
    style: 'line',
    paletteId: 'forest',
    tags: ['botanical', 'wellness', 'line art'],
    occasion: 'Evergreen',
    window: [101, 1231],
    regions: ['Global'],
  },
  {
    title: 'Bauhaus abstract shapes',
    prompt: 'Bauhaus arcs and discs composition, modern gallery poster',
    motif: 'arcs',
    style: 'geometric',
    paletteId: 'terracotta',
    tags: ['bauhaus', 'abstract', 'poster'],
    occasion: 'Evergreen',
    window: [101, 1231],
    regions: ['Global'],
  },
  {
    title: 'Isometric tech blocks',
    prompt: 'Stacked isometric cubes for modular technology branding',
    motif: 'cube',
    style: 'isometric',
    paletteId: 'deep-teal',
    tags: ['isometric', 'modular', 'branding'],
    occasion: 'Evergreen',
    window: [101, 1231],
    regions: ['Global'],
  },
  {
    title: 'City skyline icon',
    prompt: 'City skyline icon for real estate branding',
    motif: 'city',
    style: 'icon',
    paletteId: 'mono',
    tags: ['city', 'real estate', 'icon'],
    occasion: 'Evergreen',
    window: [101, 1231],
    regions: ['Global'],
  },
];

const monthDay = (date: Date) => (date.getMonth() + 1) * 100 + date.getDate();

function inWindow(day: number, [start, end]: [number, number]): boolean {
  return start <= end ? day >= start && day <= end : day >= start || day <= end;
}

/** Days until an idea's window opens, used to rank "coming up" suggestions. */
function daysUntil(day: number, start: number): number {
  const current = new Date(2026, Math.floor(day / 100) - 1, day % 100);
  const target = new Date(current.getFullYear(), Math.floor(start / 100) - 1, start % 100);
  if (target < current) target.setFullYear(target.getFullYear() + 1);
  return Math.round((target.getTime() - current.getTime()) / 86_400_000);
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Returns `count` ideas, ranked by what is in season right now, then what is
 * coming up, then evergreen. `salt` (visitor id, session, press count) rotates
 * the order so two people do not see the same list.
 */
export function seasonalIdeas(date: Date = new Date(), count = 6, salt = ''): TrendIdea[] {
  const day = monthDay(date);
  const ranked = IDEAS.map((idea, index) => {
    const live = inWindow(day, idea.window);
    const upcoming = daysUntil(day, idea.window[0]);
    const jitter = hash(`${idea.title}${salt}${date.getFullYear()}`) % 1000;
    const evergreen = idea.occasion === 'Evergreen';
    const score = live ? 0 : evergreen ? 2 : upcoming <= 60 ? 1 : 3;
    return { idea, index, score, upcoming, jitter };
  }).sort((a, b) => a.score - b.score || a.upcoming - b.upcoming || a.jitter - b.jitter);

  return ranked.slice(0, Math.max(1, Math.min(count, IDEAS.length))).map(({ idea }, index) => ({
    ...idea,
    id: idea.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `idea-${index}`,
  }));
}

/** A fresh shuffle of the same list, used by the "New ideas" control. */
export function rotateIdeas(list: TrendIdea[], salt: number): TrendIdea[] {
  if (list.length < 2) return list;
  const offset = salt % list.length;
  return [...list.slice(offset), ...list.slice(0, offset)];
}
