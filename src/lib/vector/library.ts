/**
 * Vector Studio element library.
 *
 * Every element is drawn inside a normalised 100 × 100 box so the studio can
 * place it at any size, and every element is built from plain geometry — no
 * filters, gradients or embedded fonts — because the same artwork has to pass
 * marketplace checks and convert cleanly to EPS.
 *
 * `mode: 'stroke'` elements are outlines (frames, arrows, line icons) and are
 * inserted with `fill="none"`; everything else inherits the current fill.
 */

export type ElementCategoryId = 'shapes' | 'commerce' | 'arrows' | 'frames' | 'symbols';

export interface VectorElement {
  id: string;
  name: string;
  category: ElementCategoryId;
  body: string;
  mode?: 'fill' | 'stroke';
  /** Stroke width in the 100-unit box for outline elements. */
  strokeWidth?: number;
}

export interface ElementCategory {
  id: ElementCategoryId;
  label: string;
}

export const ELEMENT_CATEGORIES: ElementCategory[] = [
  { id: 'shapes', label: 'Shapes' },
  { id: 'commerce', label: 'Commerce' },
  { id: 'arrows', label: 'Arrows' },
  { id: 'frames', label: 'Frames' },
  { id: 'symbols', label: 'Icons' },
];

const E = (id: string, name: string, category: ElementCategoryId, body: string, extra: Partial<VectorElement> = {}): VectorElement => ({
  id,
  name,
  category,
  body,
  ...extra,
});

export const ELEMENTS: VectorElement[] = [
  /* ---------------------------------------------------------------- shapes */
  E('square', 'Square', 'shapes', '<rect x="10" y="10" width="80" height="80"/>'),
  E('rounded', 'Rounded box', 'shapes', '<rect x="8" y="14" width="84" height="72" rx="14"/>'),
  E('pill', 'Pill', 'shapes', '<rect x="6" y="32" width="88" height="36" rx="18"/>'),
  E('circle', 'Circle', 'shapes', '<circle cx="50" cy="50" r="38"/>'),
  E('ellipse', 'Ellipse', 'shapes', '<ellipse cx="50" cy="50" rx="46" ry="30"/>'),
  E('ring', 'Ring', 'shapes', '<path fill-rule="evenodd" d="M50 12a38 38 0 1 0 0 76 38 38 0 0 0 0-76Zm0 16a22 22 0 1 1 0 44 22 22 0 0 1 0-44Z"/>'),
  E('half', 'Half disc', 'shapes', '<path d="M8 62a42 42 0 0 1 84 0Z"/>'),
  E('quarter', 'Quarter disc', 'shapes', '<path d="M12 88V12h76a76 76 0 0 1-76 76Z"/>'),
  E('triangle', 'Triangle', 'shapes', '<path d="M50 8 94 90H6Z"/>'),
  E('right-triangle', 'Right triangle', 'shapes', '<path d="M8 8v84h84Z"/>'),
  E('diamond', 'Diamond', 'shapes', '<path d="M50 4 96 50 50 96 4 50Z"/>'),
  E('pentagon', 'Pentagon', 'shapes', '<path d="M50 4 95 37 78 90H22L5 37Z"/>'),
  E('hexagon', 'Hexagon', 'shapes', '<path d="M28 6h44l24 44-24 44H28L4 50Z"/>'),
  E('octagon', 'Octagon', 'shapes', '<path d="M32 6h36l26 26v36L68 94H32L6 68V32Z"/>'),
  E('star-5', 'Star', 'shapes', '<path d="m50 4 13.4 29.6 32.4 3.7-24.2 22 6.6 31.9L50 75.5 21.8 91.2l6.6-31.9-24.2-22 32.4-3.7Z"/>'),
  E('star-6', 'Six point star', 'shapes', '<path d="m50 2 12 20.8h24L74 43.6 86 64.4H62L50 85.2 38 64.4H14L26 43.6 14 22.8h24Z"/>'),
  E('star-12', 'Burst', 'shapes', '<path d="m50 2 6.7 15.8 13-11.2-1.9 17 16.5-4.4-10 13.8 16 6.4-15.8 6.6 11.2 13-17-1.9 4.4 16.5-13.8-10-6.4 16-6.6-15.8-13 11.2 1.9-17-16.5 4.4 10-13.8-16-6.4 15.8-6.6-11.2-13 17 1.9-4.4-16.5L43.4 17.8Z"/>'),
  E('sparkle', 'Sparkle', 'shapes', '<path d="M50 2 62 38 98 50 62 62 50 98 38 62 2 50 38 38Z"/>'),
  E('plus', 'Plus', 'shapes', '<path d="M38 6h24v32h32v24H62v32H38V62H6V38h32Z"/>'),
  E('cross', 'Cross', 'shapes', '<path d="m26 6 24 24L74 6l20 20-24 24 24 24-20 20-24-24-24 24-20-20 24-24L6 26Z"/>'),
  E('chevron', 'Chevron', 'shapes', '<path d="M8 6h32l32 44-32 44H8l32-44Z"/>'),
  E('arrow-block', 'Arrow', 'shapes', '<path d="M4 36h44V14l48 36-48 36V64H4Z"/>'),
  E('arrow-up', 'Arrow up', 'shapes', '<path d="M36 96V52H14l36-48 36 48H64v44Z"/>'),
  E('arch', 'Arch', 'shapes', '<path d="M8 94V48a42 42 0 0 1 84 0v46Z"/>'),
  E('blob-a', 'Blob', 'shapes', '<path d="M78 14c16 8 20 30 12 46s-30 30-48 26S8 64 10 46 34 6 50 6s12 0 28 8Z"/>'),
  E('blob-b', 'Blob soft', 'shapes', '<path d="M52 6c26 0 42 16 42 40s-16 48-40 48S8 78 8 52 26 6 52 6Z"/>'),
  E('wave', 'Wave', 'shapes', '<path d="M0 62c14-22 30-22 50 0s36 22 50 0v26H0Z"/>'),
  E('zigzag', 'Zigzag', 'shapes', '<path d="M0 66 14 34l14 32 14-32 14 32 14-32 14 32 14-32v30H0Z"/>'),
  E('ticket', 'Ticket', 'shapes', '<path d="M4 30h22a10 10 0 0 0 20 0h50v14a8 8 0 0 0 0 16v14H46a10 10 0 0 0-20 0H4V60a8 8 0 0 0 0-16Z"/>'),
  E('tag', 'Tag', 'shapes', '<path d="M52 4h44v44L52 92 4 44Z"/><circle cx="74" cy="26" r="7" fill="var(--cut, #fff)"/>'),

  /* -------------------------------------------------------------- commerce */
  E('sale-badge', 'Sale badge', 'commerce', '<path fill-rule="evenodd" d="m50 2 8.4 10.9 13.2-3.9 3.9 13.2L86.4 30l-2.6 13.6L94 50l-10.2 6.4L86.4 70l-10.9 8.4 3.9 13.2-13.2-3.9L50 98l-8.4-10.9-13.2 3.9 3.9-13.2L13.6 70l2.6-13.6L6 50l10.2-6.4L13.6 30l10.9-8.4-3.9-13.2 13.2 3.9Z"/><text x="50" y="60" font-size="26" font-weight="800" text-anchor="middle" font-family="Plus Jakarta Sans, Arial" fill="var(--cut, #fff)">SALE</text>'),
  E('price-tag', 'Price tag', 'commerce', '<path fill-rule="evenodd" d="M46 2h48v48L46 98 2 54Z M72 12a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"/>'),
  E('ribbon', 'Ribbon banner', 'commerce', '<path d="M2 22h96v30H74l8 26-32-18-32 18 8-26H2Z"/>'),
  E('circle-sticker', 'Sticker', 'commerce', '<path d="M50 4a46 46 0 1 1 0 92 46 46 0 0 1 0-92Zm0 9a37 37 0 1 0 0 74 37 37 0 0 0 0-74Z"/>'),
  E('percent', 'Percent', 'commerce', '<path d="M78 8 22 92H8L64 8ZM20 8a14 14 0 1 1 0 28 14 14 0 0 1 0-28Zm60 56a14 14 0 1 1 0 28 14 14 0 0 1 0-28Z"/>'),
  E('coin', 'Coin', 'commerce', '<path fill-rule="evenodd" d="M50 4a46 46 0 1 1 0 92 46 46 0 0 1 0-92Zm0 8a38 38 0 1 0 0 76 38 38 0 0 0 0-76Z"/><path d="M46 26h9v8.5c7 1.3 11.6 5.4 12.4 11.6h-9c-.8-3-3-4.8-6.9-4.8-3.6 0-6 1.6-6 4.2 0 2.4 1.8 3.6 6.6 4.7l3.6.9c8.2 1.9 12.4 5.6 12.4 12.2 0 6.9-4.6 11.4-12.2 12.7V86H46v-9c-7.4-1.4-12.3-5.8-13-12.4h9.2c.9 3.4 3.6 5.4 8 5.4 3.9 0 6.4-1.7 6.4-4.5 0-2.4-1.7-3.7-6.4-4.8l-3.8-1C38.4 58.8 34 55 34 48.6c0-6.4 4.4-10.8 12-12.2Z"/>'),
  E('cart', 'Cart', 'commerce', '<path fill-rule="evenodd" d="M2 10h14l4 14h72l-8 34H26L14 10H2Zm40 60a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm38 0a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM27 34l5 18h52l4-18Z"/>'),
  E('bag', 'Shopping bag', 'commerce', '<path fill-rule="evenodd" d="M14 30h72l6 64H8ZM34 30V20a16 16 0 0 1 32 0v10h-10V20a6 6 0 0 0-12 0v10Z"/>'),
  E('shield-badge', 'Shield', 'commerce', '<path d="M50 4 94 18v32c0 24-18 42-44 50C24 92 6 74 6 50V18Z"/>'),
  E('medal', 'Medal', 'commerce', '<path d="M30 2h40l-14 34H44Zm-8 40h56l6 12-28 44-28-44Z"/>'),
  E('crown', 'Crown', 'commerce', '<path d="M4 82 10 26l22 20 18-28 18 28 22-20 6 56Z"/>'),

  /* ---------------------------------------------------------------- arrows */
  E('arrow-line', 'Arrow', 'arrows', '<path d="M6 50h70M58 30l20 20-20 20"/>', { mode: 'stroke', strokeWidth: 8 }),
  E('arrow-up-line', 'Arrow up', 'arrows', '<path d="M50 94V22M30 42l20-20 20 20"/>', { mode: 'stroke', strokeWidth: 8 }),
  E('arrow-double', 'Double arrow', 'arrows', '<path d="M6 50h88M28 28 6 50l22 22M72 28l22 22-22 22"/>', { mode: 'stroke', strokeWidth: 7 }),
  E('arrow-curve', 'Curved arrow', 'arrows', '<path d="M8 84c0-40 24-62 62-62M52 6l18 16-18 16"/>', { mode: 'stroke', strokeWidth: 8 }),
  E('arrow-diagonal', 'Diagonal arrow', 'arrows', '<path d="M14 86 86 14M40 14h46v46"/>', { mode: 'stroke', strokeWidth: 8 }),
  E('chevron-line', 'Chevron', 'arrows', '<path d="m36 12 34 38-34 38"/>', { mode: 'stroke', strokeWidth: 9 }),
  E('refresh', 'Refresh', 'arrows', '<path d="M50 12a38 38 0 1 1-27 11M50 2v20H30"/>', { mode: 'stroke', strokeWidth: 8 }),
  E('pointer', 'Pointer', 'arrows', '<path d="M24 8 78 62 52 64 40 92Z"/>'),

  /* ---------------------------------------------------------------- frames */
  E('frame', 'Frame', 'frames', '<rect x="4" y="10" width="92" height="80" rx="4"/>', { mode: 'stroke', strokeWidth: 5 }),
  E('frame-double', 'Double frame', 'frames', '<rect x="2" y="8" width="96" height="84" rx="3"/><rect x="10" y="18" width="80" height="64" rx="2"/>', { mode: 'stroke', strokeWidth: 4 }),
  E('frame-phone', 'Phone', 'frames', '<rect x="22" y="2" width="56" height="96" rx="10"/><path d="M42 10h16"/>', { mode: 'stroke', strokeWidth: 4 }),
  E('frame-browser', 'Browser', 'frames', '<rect x="2" y="10" width="96" height="80" rx="5"/><path d="M2 30h96M10 20h4M20 20h4M30 20h4"/>', { mode: 'stroke', strokeWidth: 4 }),
  E('frame-polaroid', 'Polaroid', 'frames', '<rect x="6" y="4" width="88" height="92" rx="3"/><rect x="15" y="13" width="70" height="62"/>', { mode: 'stroke', strokeWidth: 4 }),
  E('frame-circle', 'Circle frame', 'frames', '<circle cx="50" cy="50" r="46"/>', { mode: 'stroke', strokeWidth: 5 }),
  E('frame-dashed', 'Dashed frame', 'frames', '<rect x="6" y="10" width="88" height="80" rx="6" stroke-dasharray="12 9"/>', { mode: 'stroke', strokeWidth: 5 }),
  E('frame-corners', 'Corner marks', 'frames', '<path d="M4 26V8h20M76 8h20v18M96 74v18H76M24 92H4V74"/>', { mode: 'stroke', strokeWidth: 6 }),
  E('frame-story', 'Story frame', 'frames', '<rect x="26" y="2" width="48" height="96" rx="6"/><path d="M34 14h32"/>', { mode: 'stroke', strokeWidth: 4 }),

  /* --------------------------------------------------------------- symbols */
  E('image', 'Image', 'symbols', '<path fill-rule="evenodd" d="M4 8h92v84H4Zm10 10v46l22-22 18 18 14-14 18 18V18Z"/><circle cx="70" cy="34" r="9" fill="var(--cut, #fff)"/>'),
  E('camera', 'Camera', 'symbols', '<path fill-rule="evenodd" d="M2 26h22l8-12h36l8 12h22v62H2Zm48 12a19 19 0 1 0 0 38 19 19 0 0 0 0-38Z"/>'),
  E('play', 'Play', 'symbols', '<path d="M18 6 88 50 18 94Z"/>'),
  E('download-arrow', 'Download', 'symbols', '<path d="M42 4h16v40h20L50 92 22 44h20Z"/><path d="M6 92h88v-14H6Z"/>'),
  E('upload-cloud', 'Upload cloud', 'symbols', '<path d="M28 84a24 24 0 0 1-2-48 28 28 0 0 1 52-6 22 22 0 0 1 2 54h-8V54h14L50 20 14 54h14Z"/>'),
  E('search', 'Search', 'symbols', '<path fill-rule="evenodd" d="M42 6a36 36 0 1 1 0 72 36 36 0 0 1 0-72Zm0 12a24 24 0 1 0 0 48 24 24 0 0 0 0-48Z"/><path d="m62 62 32 32-8 8-32-32Z"/>'),
  E('lock', 'Lock', 'symbols', '<path fill-rule="evenodd" d="M14 44h72v52H14ZM30 44V28a20 20 0 0 1 40 0v16H58V28a8 8 0 0 0-16 0v16Z"/>'),
  E('check-circle', 'Check', 'symbols', '<path fill-rule="evenodd" d="M50 2a48 48 0 1 1 0 96 48 48 0 0 1 0-96ZM76 32 42 66l-14-14-8 8 22 22 42-42Z"/>'),
  E('pin', 'Location pin', 'symbols', '<path fill-rule="evenodd" d="M50 2a34 34 0 0 1 34 34c0 24-34 62-34 62S16 60 16 36A34 34 0 0 1 50 2Zm0 20a14 14 0 1 0 0 28 14 14 0 0 0 0-28Z"/>'),
  E('clock', 'Clock', 'symbols', '<path fill-rule="evenodd" d="M50 2a48 48 0 1 1 0 96 48 48 0 0 1 0-96Zm0 10a38 38 0 1 0 0 76 38 38 0 0 0 0-76Z"/><path d="M44 22h12v30l22 14-6 10-28-18Z"/>'),
  E('calendar', 'Calendar', 'symbols', '<path fill-rule="evenodd" d="M4 14h16V4h10v10h40V4h10v10h16v82H4Zm10 26h72v46H14Z"/>'),
  E('mail', 'Mail', 'symbols', '<path fill-rule="evenodd" d="M2 18h96v64H2Zm10 12 38 26 38-26v-2H12Z"/>'),
  E('megaphone', 'Megaphone', 'symbols', '<path d="M6 38h18L70 12v76L24 62H6Z"/><path d="M34 66l8 30H26l-8-30Z"/>'),
  E('music', 'Music note', 'symbols', '<path d="M78 4v60a18 18 0 1 1-10-16V22L38 32v44a18 18 0 1 1-10-16V20Z"/>'),
  E('gear', 'Settings', 'symbols', '<path fill-rule="evenodd" d="M50 34a16 16 0 1 1 0 32 16 16 0 0 1 0-32Zm-6-32h12l3 12 10 5 11-6 8 8-6 11 5 10 12 3v12l-12 3-5 10 6 11-8 8-11-6-10 5-3 12H44l-3-12-10-5-11 6-8-8 6-11-5-10-12-3V44l12-3 5-10-6-11 8-8 11 6 10-5Z"/>'),
  E('chart-bars', 'Bar chart', 'symbols', '<path d="M6 54h18v42H6ZM32 30h18v66H32ZM58 12h18v84H58ZM84 44h12v52H84Z"/>'),
  E('chart-line', 'Trend line', 'symbols', '<path d="M4 82 32 50l18 16 20-32 22 20M78 32h16v16"/>', { mode: 'stroke', strokeWidth: 7 }),
  E('dots', 'Dot grid', 'symbols', '<circle cx="14" cy="14" r="6"/><circle cx="38" cy="14" r="6"/><circle cx="62" cy="14" r="6"/><circle cx="86" cy="14" r="6"/><circle cx="14" cy="38" r="6"/><circle cx="38" cy="38" r="6"/><circle cx="62" cy="38" r="6"/><circle cx="86" cy="38" r="6"/><circle cx="14" cy="62" r="6"/><circle cx="38" cy="62" r="6"/><circle cx="62" cy="62" r="6"/><circle cx="86" cy="62" r="6"/><circle cx="14" cy="86" r="6"/><circle cx="38" cy="86" r="6"/><circle cx="62" cy="86" r="6"/><circle cx="86" cy="86" r="6"/>'),
  E('stripes', 'Stripes', 'symbols', '<path d="M0 68 68 0h20L0 88Zm22 32L90 32h10L32 100ZM0 36 36 0h20L0 56Z"/>'),
  E('folder', 'Folder', 'symbols', '<path d="M2 16h34l8 10h54v66H2Z"/>'),
  E('document', 'Document', 'symbols', '<path fill-rule="evenodd" d="M12 2h48l28 28v70H12Zm44 8v24h24Z"/>'),
  E('bookmark', 'Bookmark', 'symbols', '<path d="M20 2h60v96L50 74 20 98Z"/>'),
  E('heart', 'Heart', 'symbols', '<path d="M50 92S8 66 8 38a24 24 0 0 1 42-17 24 24 0 0 1 42 17c0 28-42 54-42 54Z"/>'),
  E('drop', 'Drop', 'symbols', '<path d="M50 2s34 40 34 60a34 34 0 0 1-68 0C16 42 50 2 50 2Z"/>'),
  E('leaf', 'Leaf', 'symbols', '<path d="M92 6C50 6 14 26 14 62c0 14 8 24 20 28C38 44 62 26 92 6Z"/><path d="M10 94c6-22 20-38 42-50"/>', { mode: 'stroke', strokeWidth: 7 }),
];

export const ELEMENT_GROUPS: Array<{ category: ElementCategory; items: VectorElement[] }> = ELEMENT_CATEGORIES.map((category) => ({
  category,
  items: ELEMENTS.filter((element) => element.category === category.id),
}));

/** Neutral palette used by the fill/stroke picker and by templates. */
export const VECTOR_PALETTE = [
  '#16181c',
  '#ffffff',
  '#c2185b',
  '#e6477c',
  '#f7a1bd',
  '#0f766e',
  '#0ea5a4',
  '#2563eb',
  '#6366f1',
  '#7c3aed',
  '#b45309',
  '#f59e0b',
  '#dc2626',
  '#f5f6f8',
  '#94a3b8',
  'none',
];

/* -------------------------------------------------------------------------- */
/*  Templates                                                                 */
/* -------------------------------------------------------------------------- */

export interface VectorTemplate {
  id: string;
  name: string;
  hint: string;
  width: number;
  height: number;
  svg: string;
}

const TEMPLATE_PREFIX = 'msap vector template';

export const TEMPLATES: VectorTemplate[] = [
  {
    id: 'sale-badge',
    name: 'Sale badge',
    hint: 'Square social post',
    width: 2000,
    height: 2000,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000"><title>${TEMPLATE_PREFIX} — sale badge</title><rect id="bg" x="0" y="0" width="2000" height="2000" fill="#fce8f0"/><path id="burst" d="m1000 220 96 216 190-152-32 244 236-64-152 196 240 86-222 118 190 158-240 34 106 228-234-42-22 250-158-196-160 196-24-250-232 42 104-228-240-34 190-158-220-118 238-86-150-196 236 64-34-244 190 152Z" fill="#c2185b"/><text id="headline" x="1000" y="940" font-family="Plus Jakarta Sans, Arial" font-size="300" font-weight="800" text-anchor="middle" fill="#ffffff">50%</text><text id="sub" x="1000" y="1180" font-family="Plus Jakarta Sans, Arial" font-size="120" font-weight="700" letter-spacing="8" text-anchor="middle" fill="#fce8f0">OFF TODAY</text></svg>`,
  },
  {
    id: 'price-tag',
    name: 'Price tag',
    hint: 'Transparent PNG / SVG',
    width: 2000,
    height: 2000,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000"><title>${TEMPLATE_PREFIX} — price tag</title><path id="tag" d="M420 240h1160v900L1000 1760 420 1140Z" fill="#c2185b"/><circle id="hole" cx="1420" cy="540" r="90" fill="#ffffff"/><text id="price" x="1000" y="900" font-family="Plus Jakarta Sans, Arial" font-size="360" font-weight="800" text-anchor="middle" fill="#ffffff">99৳</text><text id="label" x="1000" y="1120" font-family="Plus Jakarta Sans, Arial" font-size="130" font-weight="600" letter-spacing="6" text-anchor="middle" fill="#fce8f0">LIMITED STOCK</text></svg>`,
  },
  {
    id: 'quote-card',
    name: 'Quote card',
    hint: 'Editorial 4:5',
    width: 1600,
    height: 2000,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 2000" width="1600" height="2000"><title>${TEMPLATE_PREFIX} — quote card</title><rect id="bg" x="0" y="0" width="1600" height="2000" fill="#16181c"/><rect id="rule" x="140" y="1480" width="220" height="14" fill="#e6477c"/><text id="quote" x="140" y="820" font-family="Plus Jakarta Sans, Arial" font-size="150" font-weight="700" fill="#ffffff"><tspan x="140" dy="0">Every asset deserves</tspan><tspan x="140" dy="200">a clean vector.</tspan></text><text id="what" x="140" y="1060" font-family="Plus Jakarta Sans, Arial" font-size="80" font-weight="500" fill="#a9b1bb"><tspan x="140" dy="0">Draw it once, export it</tspan><tspan x="140" dy="110">everywhere.</tspan></text><text id="attribution" x="140" y="1600" font-family="Plus Jakarta Sans, Arial" font-size="56" font-weight="600" letter-spacing="4" fill="#f7a1bd">MICRO STOCKER STUDIO</text></svg>`,
  },
  {
    id: 'product-frame',
    name: 'Product frame',
    hint: 'Marketplace mockup',
    width: 2000,
    height: 2000,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000"><title>${TEMPLATE_PREFIX} — product frame</title><rect id="bg" x="0" y="0" width="2000" height="2000" fill="#ffffff"/><rect id="plate" x="240" y="240" width="1520" height="1300" fill="#f5f6f8"/><rect id="outline" x="240" y="240" width="1520" height="1300" fill="none" stroke="#16181c" stroke-width="12"/><circle id="dot" cx="1500" cy="320" r="26" fill="#c2185b"/><text id="title" x="240" y="1730" font-family="Plus Jakarta Sans, Arial" font-size="120" font-weight="800" fill="#16181c">PRODUCT NAME</text><text id="meta" x="240" y="1840" font-family="Plus Jakarta Sans, Arial" font-size="70" font-weight="500" fill="#5f6672">SKU 0001 · 4 MP minimum</text></svg>`,
  },
  {
    id: 'story-cover',
    name: 'Story cover',
    hint: 'Vertical 9:16',
    width: 1080,
    height: 1920,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920"><title>${TEMPLATE_PREFIX} — story cover</title><rect id="bg" x="0" y="0" width="1080" height="1920" fill="#c2185b"/><circle id="circle" cx="540" cy="700" r="330" fill="none" stroke="#ffffff" stroke-width="16"/><path id="arrow" d="M420 700h240M580 620l80 80-80 80" fill="none" stroke="#ffffff" stroke-width="22" stroke-linecap="round"/><text id="title" x="540" y="1250" font-family="Plus Jakarta Sans, Arial" font-size="120" font-weight="800" text-anchor="middle" fill="#ffffff"><tspan x="540" dy="0">NEW DROP</tspan><tspan x="540" dy="150">THIS WEEK</tspan></text><text id="cta" x="540" y="1640" font-family="Plus Jakarta Sans, Arial" font-size="60" font-weight="600" letter-spacing="8" text-anchor="middle" fill="#fce8f0">SWIPE UP</text></svg>`,
  },
  {
    id: 'logo-mark',
    name: 'Logo mark',
    hint: 'Editable monogram',
    width: 2000,
    height: 2000,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000"><title>${TEMPLATE_PREFIX} — logo mark</title><circle id="disc" cx="1000" cy="1000" r="760" fill="#16181c"/><path id="mark" d="M640 1320V680l360 400 360-400v640" fill="none" stroke="#ffffff" stroke-width="140" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
];

export function templateDocument(template: VectorTemplate): string {
  return template.svg;
}
