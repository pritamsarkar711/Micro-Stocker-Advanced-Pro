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

export type ElementCategoryId =
  | 'shapes'
  | 'commerce'
  | 'arrows'
  | 'frames'
  | 'symbols'
  | 'interface'
  | 'nature'
  | 'people';

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
  { id: 'interface', label: 'Interface' },
  { id: 'nature', label: 'Nature' },
  { id: 'people', label: 'People' },
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


  /* -------------------------------------------------------- premium set */
  E('divider-thin', 'Thin divider', 'shapes', '<rect x="4" y="47" width="92" height="6" rx="3"/>'),
  E('divider-dash', 'Dashed divider', 'shapes', '<rect x="4" y="48" width="20" height="4" rx="2"/><rect x="30" y="48" width="20" height="4" rx="2"/><rect x="56" y="48" width="20" height="4" rx="2"/><rect x="80" y="48" width="16" height="4" rx="2"/>'),
  E('divider-dot', 'Dot divider', 'shapes', '<rect x="4" y="48" width="64" height="4" rx="2"/><circle cx="84" cy="50" r="7"/><circle cx="96" cy="50" r="3"/>'),
  E('v2-ribbon', 'Ribbon', 'commerce', '<path d="M4 20h92v28L4 62Z"/><path d="M4 62 40 48l-36 44Z" fill="var(--cut, #fff)" opacity="0.35"/>'),
  E('banner-wave', 'Wave banner', 'commerce', '<path d="M4 34c18-16 36-16 54 0s30 16 38 2v24c-8 14-20 14-38-2s-36-16-54 0Z"/>'),
  E('badge-starburst', 'Starburst', 'commerce', '<path d="m50 2 7 12.4 13.6-4.6 6 13 14.2 1.4-2.6 14.1 11.2 8.9-10 10.4 4.2 13.7-13.9 3.8-1.6 14.2-14-2.2-8.2 11.6-11.6-8.4-13 5.6-5.6-13.1L2 78.6l4.4-13.6-9.2-10.6 11.4-8.6L6.2 32 20 30l4.6-13.4 13.4 5.6Z"/>'),
  E('badge-shield-free', 'Round badge', 'commerce', '<circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="34" fill="none" stroke="var(--cut, #fff)" stroke-width="4" stroke-dasharray="6 6"/>'),
  E('v2-frame-corners', 'Corner frame', 'frames', '<path d="M10 30V10h20M70 10h20v20M90 70v20H70M30 90H10V70" fill="none" stroke-linecap="round"/>', { mode: 'stroke', strokeWidth: 6 }),
  E('v2-frame-hex', 'Hexagon frame', 'frames', '<path d="M50 4 92 27v46L50 96 8 73V27Z" fill="none"/>', { mode: 'stroke', strokeWidth: 5 }),
  E('frame-dotted', 'Dotted frame', 'frames', '<rect x="6" y="6" width="88" height="88" rx="10" fill="none" stroke-dasharray="4 7"/>', { mode: 'stroke', strokeWidth: 5 }),
  E('v2-frame-arch', 'Arch frame', 'frames', '<path d="M12 92V46a38 38 0 0 1 76 0v46Z" fill="none"/>', { mode: 'stroke', strokeWidth: 5 }),
  E('v2-arrow-curve', 'Curved arrow', 'arrows', '<path d="M10 82c0-34 22-56 56-56" fill="none" stroke-linecap="round"/><path d="M52 10h20v20" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', { mode: 'stroke', strokeWidth: 7 }),
  E('arrow-loop', 'Loop arrow', 'arrows', '<path d="M18 66c0-26 22-40 44-32s22 34 4 42-32-2-32-18 16-22 28-14" fill="none" stroke-linecap="round"/>', { mode: 'stroke', strokeWidth: 6 }),
  E('v2-arrow-double', 'Double arrow', 'arrows', '<path d="M6 50h88M24 30 6 50l18 20M76 30l18 20-18 20" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', { mode: 'stroke', strokeWidth: 7 }),
  E('v2-arrow-dashed', 'Dashed arrow', 'arrows', '<path d="M6 50h80" fill="none" stroke-dasharray="10 8" stroke-linecap="round"/><path d="m70 32 20 18-20 18" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', { mode: 'stroke', strokeWidth: 7 }),
  E('v2-leaf', 'Leaf', 'nature', '<path d="M92 8C46 8 12 32 12 66c0 12 6 20 14 26C38 66 62 42 92 8Z"/><path d="M22 90c10-26 34-48 58-62" fill="none" stroke="var(--cut, #fff)" stroke-width="4" stroke-linecap="round"/>'),
  E('v2-sun', 'Sun', 'nature', '<circle cx="50" cy="50" r="22"/><g stroke-linecap="round"><path d="M50 6v12M50 82v12M6 50h12M82 50h12M19 19l9 9M72 72l9 9M81 19l-9 9M28 72l-9 9"/></g>'),
  E('v2-cloud', 'Cloud', 'nature', '<path d="M30 76a18 18 0 0 1 0-36 24 24 0 0 1 46-6 18 18 0 0 1 4 42Z"/>'),
  E('browser', 'Browser window', 'interface', '<rect x="6" y="12" width="88" height="76" rx="8" fill="none"/><rect x="6" y="12" width="88" height="16" rx="8"/><circle cx="16" cy="20" r="2.6" fill="var(--cut, #fff)"/><circle cx="25" cy="20" r="2.6" fill="var(--cut, #fff)"/><circle cx="34" cy="20" r="2.6" fill="var(--cut, #fff)"/>', { mode: 'stroke', strokeWidth: 4 }),
  E('v2-phone', 'Phone', 'interface', '<rect x="28" y="4" width="44" height="92" rx="9" fill="none"/><rect x="40" y="10" width="20" height="4" rx="2"/><circle cx="50" cy="88" r="4" fill="none"/>', { mode: 'stroke', strokeWidth: 4 }),
  E('cursor', 'Cursor', 'interface', '<path d="M28 10l44 42-20 4 12 24-12 6-12-24-12 12Z"/>'),
  E('chat', 'Chat bubble', 'interface', '<path d="M12 14h76v52H48L26 86V66H12Z"/>'),
  E('avatar', 'Avatar', 'people', '<circle cx="50" cy="50" r="42" fill="none"/><circle cx="50" cy="40" r="14"/><path d="M22 84c4-14 15-22 28-22s24 8 28 22" fill="none"/>', { mode: 'stroke', strokeWidth: 5 }),
  E('v2-heart', 'Heart', 'people', '<path d="M50 86C26 68 14 54 20 40c6-12 20-12 30 2 10-14 24-14 30-2 6 14-6 28-30 46Z" fill="none"/>', { mode: 'stroke', strokeWidth: 5 }),
  /* -------------------------------------------------------------- commerce */
  E('sale-badge', 'Sale badge', 'commerce', '<path fill-rule="evenodd" d="m50 2 8.4 10.9 13.2-3.9 3.9 13.2L86.4 30l-2.6 13.6L94 50l-10.2 6.4L86.4 70l-10.9 8.4 3.9 13.2-13.2-3.9L50 98l-8.4-10.9-13.2 3.9 3.9-13.2L13.6 70l2.6-13.6L6 50l10.2-6.4L13.6 30l10.9-8.4-3.9-13.2 13.2 3.9Z"/><text x="50" y="60" font-size="26" font-weight="800" text-anchor="middle" font-family="IBM Plex Sans, Arial" fill="var(--cut, #fff)">SALE</text>'),
  E('price-tag', 'Price tag', 'commerce', '<path fill-rule="evenodd" d="M46 2h48v48L46 98 2 54Z M72 12a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"/>'),
  E('ribbon', 'Ribbon banner', 'commerce', '<path d="M2 22h96v30H74l8 26-32-18-32 18 8-26H2Z"/>'),
  E('circle-sticker', 'Sticker', 'commerce', '<path d="M50 4a46 46 0 1 1 0 92 46 46 0 0 1 0-92Zm0 9a37 37 0 1 0 0 74 37 37 0 0 0 0-74Z"/>'),
  E('percent', 'Percent', 'commerce', '<path d="M78 8 22 92H8L64 8ZM20 8a14 14 0 1 1 0 28 14 14 0 0 1 0-28Zm60 56a14 14 0 1 1 0 28 14 14 0 0 1 0-28Z"/>'),
  E('coin', 'Coin', 'commerce', '<path fill-rule="evenodd" d="M50 4a46 46 0 1 1 0 92 46 46 0 0 1 0-92Zm0 8a38 38 0 1 0 0 76 38 38 0 0 0 0-76Z"/><path d="M46 26h9v8.5c7 1.3 11.6 5.4 12.4 11.6h-9c-.8-3-3-4.8-6.9-4.8-3.6 0-6 1.6-6 4.2 0 2.4 1.8 3.6 6.6 4.7l3.6.9c8.2 1.9 12.4 5.6 12.4 12.2 0 6.9-4.6 11.4-12.2 12.7V86H46v-9c-7.4-1.4-12.3-5.8-13-12.4h9.2c.9 3.4 3.6 5.4 8 5.4 3.9 0 6.4-1.7 6.4-4.5 0-2.4-1.7-3.7-6.4-4.8l-3.8-1C38.4 58.8 34 55 34 48.6c0-6.4 4.4-10.8 12-12.2Z"/>'),
  E('cart', 'Cart', 'commerce', '<path fill-rule="evenodd" d="M2 10h14l4 14h72l-8 34H26L14 10H2Zm40 60a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm38 0a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM27 34l5 18h52l4-18Z"/>'),
  E('bag', 'Shopping bag', 'commerce', '<path fill-rule="evenodd" d="M14 30h72l6 64H8ZM34 30V20a16 16 0 0 1 32 0v10h-10V20a6 6 0 0 0-12 0v10Z"/>'),
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
  E('trapezoid', 'Trapezoid', 'shapes', '<path d="M26 14h48l22 72H4Z"/>'),
  E('parallelogram', 'Parallelogram', 'shapes', '<path d="M24 14h72L76 86H4Z"/>'),
  E('lens', 'Lens', 'shapes', '<path d="M50 6c30 18 30 70 0 88C20 76 20 24 50 6Z"/>'),
  E('crescent', 'Crescent', 'shapes', '<path d="M68 4a46 46 0 1 0 0 92 58 58 0 0 1 0-92Z"/>'),
  E('squircle', 'Squircle', 'shapes', '<path d="M50 4c28 0 46 14 46 46S78 96 50 96 4 82 4 50 22 4 50 4Z"/>'),
  E('speech', 'Speech bubble', 'shapes', '<path d="M4 10h92v60H40L16 92V70H4Z"/>'),
  E('pie', 'Pie', 'shapes', '<path d="M50 6a44 44 0 1 1-44 44h44Z"/>'),
  E('triangle-soft', 'Soft triangle', 'shapes', '<path d="M50 8c6 0 44 70 44 76 0 6-4 10-10 10H16c-6 0-10-4-10-10C6 78 44 8 50 8Z"/>'),
  E('parallelogram-round', 'Slant box', 'shapes', '<path d="M30 12c6 0 56 2 60 4 4 2 2 64-2 68-4 4-56 4-60 2-4-2-4-72 2-74Z"/>'),
  E('blob-c', 'Blob wide', 'shapes', '<path d="M66 6c22 6 34 28 28 48s-26 34-46 32S8 66 8 46 26 0 44 0c8 0 14 3 22 6Z"/>'),

  E('receipt', 'Receipt', 'commerce', '<path fill-rule="evenodd" d="M16 2h68v96l-11-4-11 4-11-4-12 4-11-4-12 4Zm12 20h44v6H28Zm0 14h44v6H28Zm0 14h30v6H28Z"/>'),
  E('wallet', 'Wallet', 'commerce', '<path fill-rule="evenodd" d="M8 20h70a14 14 0 0 1 14 14v46a14 14 0 0 1-14 14H8Zm58 34a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/>'),
  E('gift', 'Gift', 'commerce', '<path d="M10 34h80v16H10Zm6 18h68v46H16Zm28-18V6h12v28ZM50 6c-18 0-26 6-26 14s8 14 20 14h6Zm0 0c18 0 26 6 26 14s-8 14-20 14h-6Z"/>'),
  E('barcode', 'Barcode', 'commerce', '<path d="M8 10h6v80H8Zm10 0h3v80h-3Zm7 0h7v80h-7Zm11 0h3v80h-3Zm7 0h5v80h-5Zm9 0h4v80h-4Zm8 0h3v80h-3Zm7 0h7v80h-7Zm11 0h6v80h-6Z"/>'),
  E('card', 'Payment card', 'commerce', '<path fill-rule="evenodd" d="M4 20h92v60H4Zm8 12v10h76V32Z"/>'),
  E('parcel', 'Parcel', 'commerce', '<path fill-rule="evenodd" d="M50 4 96 30v40L50 96 4 70V30Zm0 12L18 34v6l32 18 32-18v-6Z"/>'),
  E('calculator', 'Calculator', 'commerce', '<path fill-rule="evenodd" d="M16 4h68v92H16Zm10 10h48v18H26Zm0 28h10v10H26Zm19 0h10v10H45Zm19 0h10v10H64ZM26 56h10v10H26Zm19 0h10v10H45Zm19 0h10v10H64ZM26 70h10v18H26Zm19 0h10v18H45Zm19 0h10v18H64Z"/>'),
  E('percent-disc', 'Percent disc', 'commerce', '<path fill-rule="evenodd" d="M50 2a48 48 0 1 1 0 96 48 48 0 0 1 0-96ZM72 26 30 74h12l42-48ZM34 26a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm32 28a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z"/>'),

  E('arrow-bend', 'Bent arrow', 'arrows', '<path d="M14 88V42a20 20 0 0 1 20-20h46M62 4l20 18-20 18"/>', { mode: 'stroke', strokeWidth: 8 }),
  E('arrow-4way', 'Four way', 'arrows', '<path d="M50 6v88M6 50h88M36 20l14-14 14 14M36 80l14 14 14-14M20 36l-14 14 14 14M80 36l14 14-14 14"/>', { mode: 'stroke', strokeWidth: 6 }),
  E('arrow-split', 'Split arrow', 'arrows', '<path d="M10 50h30l34-30M40 50l34 30M62 20h18v18M62 80h18V62"/>', { mode: 'stroke', strokeWidth: 7 }),
  E('arrow-merge', 'Merge arrow', 'arrows', '<path d="M78 20 42 50l36 30M30 20H12v18M30 80H12V62"/>', { mode: 'stroke', strokeWidth: 7 }),
  E('arrow-dashed', 'Dashed arrow', 'arrows', '<path d="M6 50h14M30 50h14M54 50h14M78 36l16 14-16 14"/>', { mode: 'stroke', strokeWidth: 7 }),
  E('arrow-down', 'Arrow down', 'arrows', '<path d="M50 6v72M30 58l20 20 20-20"/>', { mode: 'stroke', strokeWidth: 8 }),
  E('arrow-step', 'Step arrow', 'arrows', '<path d="M10 78h34V48h24V22h22M74 10l16 12-16 12"/>', { mode: 'stroke', strokeWidth: 7 }),
  E('arrow-square', 'Square arrow', 'arrows', '<path d="M16 16h68v68H16ZM50 32v36M32 50h36"/>', { mode: 'stroke', strokeWidth: 6 }),

  E('frame-arch', 'Arch frame', 'frames', '<path d="M10 92V44a40 40 0 0 1 80 0v48"/>', { mode: 'stroke', strokeWidth: 5 }),
  E('frame-hex', 'Hexagon frame', 'frames', '<path d="M50 4 92 27v46L50 96 8 73V27Z"/>', { mode: 'stroke', strokeWidth: 5 }),
  E('frame-grid', 'Grid frame', 'frames', '<path d="M6 6h88v88H6ZM6 36h88M6 66h88M36 6v88M66 6v88"/>', { mode: 'stroke', strokeWidth: 4 }),
  E('frame-split-h', 'Split frame', 'frames', '<path d="M6 10h88v80H6ZM6 50h88"/>', { mode: 'stroke', strokeWidth: 5 }),
  E('frame-split-v', 'Column frame', 'frames', '<path d="M6 10h88v80H6ZM50 10v80"/>', { mode: 'stroke', strokeWidth: 5 }),
  E('frame-squircle', 'Soft frame', 'frames', '<rect x="6" y="6" width="88" height="88" rx="20"/>', { mode: 'stroke', strokeWidth: 5 }),

  E('home', 'Home', 'interface', '<path d="M50 6 96 44v52H60V64H40v32H4V44Z"/>'),
  E('list', 'List', 'interface', '<path d="M10 16h10v10H10Zm20 0h60v10H30ZM10 44h10v10H10Zm20 0h60v10H30ZM10 72h10v10H10Zm20 0h60v10H30Z"/>'),
  E('grid-4', 'Grid', 'interface', '<path d="M8 8h36v36H8Zm48 0h36v36H56ZM8 56h36v36H8Zm48 0h36v36H56Z"/>'),
  E('menu-lines', 'Menu', 'interface', '<path d="M8 24h84v10H8Zm0 26h84v10H8Zm0 26h84v10H8Z"/>'),
  E('link', 'Link', 'interface', '<path d="M40 32H26a18 18 0 0 0 0 36h14v-10H26a8 8 0 0 1 0-16h14Zm20 0h14a18 18 0 0 1 0 36H60v-10h14a8 8 0 0 0 0-16H60Zm-24 12h28v12H36Z"/>'),
  E('info', 'Info', 'interface', '<path fill-rule="evenodd" d="M50 2a48 48 0 1 1 0 96 48 48 0 0 1 0-96ZM44 22h12v12H44Zm0 20h12v36H44Z"/>'),
  E('comment', 'Comment', 'interface', '<path fill-rule="evenodd" d="M4 10h92v62H42L16 96V72H4Z"/>'),
  E('send', 'Send', 'interface', '<path d="M4 46 96 4 66 96 48 58Z"/>'),
  E('eye', 'Eye', 'interface', '<path fill-rule="evenodd" d="M50 22c30 0 48 28 48 28S80 78 50 78 2 50 2 50s18-28 48-28Zm0 10a18 18 0 1 0 0 36 18 18 0 0 0 0-36Z"/>'),
  E('key', 'Key', 'interface', '<path fill-rule="evenodd" d="M32 6a26 26 0 1 1 0 52 26 26 0 0 1 0-52Zm0 12a14 14 0 1 0 0 28 14 14 0 0 0 0-28Z"/><path d="M54 44 94 84l-10 10-8-8-8 8-10-10 8-8-8-8 8-10-8-8Z"/>'),
  E('wifi', 'WiFi', 'interface', '<path d="M50 76a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z"/><path d="M28 62a34 34 0 0 1 44 0l-8 10a20 20 0 0 0-28 0Z"/><path d="M14 46a56 56 0 0 1 72 0l-8 10a42 42 0 0 0-56 0Z"/>'),
  E('battery', 'Battery', 'interface', '<path fill-rule="evenodd" d="M4 30h76v40H4Zm12 10h40v20H16Z"/><path d="M86 40h10v20H86Z"/>'),
  E('phone', 'Phone', 'interface', '<path fill-rule="evenodd" d="M28 2h44v96H28Zm10 10v64h24V12Z"/>'),
  E('laptop', 'Laptop', 'interface', '<path d="M16 20h68v40H16Z"/><path d="M6 62h88l6 16H0Z"/>'),
  E('server', 'Server', 'interface', '<path fill-rule="evenodd" d="M8 14h84v26H8Zm0 34h84v26H8Zm0 34h84v18H8Z"/>'),
  E('flag', 'Flag', 'interface', '<path d="M10 4h10v92H10Z"/><path d="M20 10h62l-8 14 8 14H20Z"/>'),
  E('target', 'Target', 'interface', '<path fill-rule="evenodd" d="M50 2a48 48 0 1 1 0 96 48 48 0 0 1 0-96Zm0 10a38 38 0 1 0 0 76 38 38 0 0 0 0-76Zm0 14a24 24 0 1 1 0 48 24 24 0 0 1 0-48Zm0 10a14 14 0 1 0 0 28 14 14 0 0 0 0-28Z"/>'),
  E('compass', 'Compass', 'interface', '<path fill-rule="evenodd" d="M50 2a48 48 0 1 1 0 96 48 48 0 0 1 0-96Zm0 10a38 38 0 1 0 0 76 38 38 0 0 0 0-76Z"/><path d="M66 34 56 56 34 66l10-22Z"/>'),
  E('globe', 'Globe', 'interface', '<path fill-rule="evenodd" d="M50 2a48 48 0 1 1 0 96 48 48 0 0 1 0-96Zm0 10c-10 0-18 16-18 38s8 38 18 38 18-16 18-38S60 12 50 12ZM6 44h22v12H6Zm66 0h22v12H72ZM10 28h24v10H10Zm56 0h24v10H66ZM10 62h24v10H10Zm56 0h24v10H66Z"/>'),
  E('minus-circle', 'Minus', 'interface', '<path fill-rule="evenodd" d="M50 2a48 48 0 1 1 0 96 48 48 0 0 1 0-96Zm0 10a38 38 0 1 0 0 76 38 38 0 0 0 0-76ZM28 44h44v12H28Z"/>'),
  E('plus-circle', 'Plus disc', 'interface', '<path fill-rule="evenodd" d="M50 2a48 48 0 1 1 0 96 48 48 0 0 1 0-96Zm0 10a38 38 0 1 0 0 76 38 38 0 0 0 0-76ZM44 28h12v16h16v12H56v16H44V56H28V44h16Z"/>'),

  E('mountain', 'Mountain', 'nature', '<path d="M2 90 34 26l18 30 14-22 32 56Z"/>'),
  E('tree', 'Tree', 'nature', '<path d="M50 2 24 42h16L14 74h72L60 42h16Z"/><path d="M44 74h12v22H44Z"/>'),
  E('sprout', 'Sprout', 'nature', '<path d="M46 94V54C46 34 30 22 8 22c0 22 16 34 38 34Z"/><path d="M54 94V44c0-20 16-32 38-32 0 22-16 32-38 32Z"/>'),
  E('flower', 'Flower', 'nature', '<circle cx="50" cy="50" r="13"/><path d="M50 6a18 18 0 0 1 0 30 18 18 0 0 1 0-30Zm0 58a18 18 0 0 1 0 30 18 18 0 0 1 0-30ZM6 50a18 18 0 0 1 30 0 18 18 0 0 1-30 0Zm58 0a18 18 0 0 1 30 0 18 18 0 0 1-30 0Z"/>'),
  E('cloud', 'Cloud', 'nature', '<path d="M26 84a22 22 0 0 1-2-44 30 30 0 0 1 57-6 20 20 0 0 1 1 50Z"/>'),
  E('sun', 'Sun', 'nature', '<path d="M50 26a24 24 0 1 1 0 48 24 24 0 0 1 0-48Z"/><path d="M44 2h12v14H44Zm0 82h12v14H44ZM2 44h14v12H2Zm82 0h14v12H86ZM14 8l9 9-8 8-9-9Zm63 63 9 9-8 8-9-9ZM14 92l9-9-8-8-9 9Zm63-63 9-9-8-8-9 9Z"/>'),
  E('moon', 'Moon', 'nature', '<path d="M58 4a46 46 0 1 0 0 92 46 46 0 0 1 0-92Z"/>'),
  E('umbrella', 'Umbrella', 'nature', '<path d="M50 8c28 0 46 20 46 40H4C4 28 22 8 50 8Z"/><path d="M44 48h12v34a10 10 0 0 0 20 0h12a22 22 0 0 1-44 0Z"/>'),
  E('snowflake', 'Snowflake', 'nature', '<path d="M50 4v92M10 27l80 46M90 27 10 73M36 14l14 12 14-12M36 86l14-12 14 12M18 40l16 8-4 18M82 40l-16 8 4 18"/>', { mode: 'stroke', strokeWidth: 5 }),
  E('waves', 'Waves', 'nature', '<path d="M2 34c12-14 24-14 36 0s24 14 36 0 16-6 24 0M2 58c12-14 24-14 36 0s24 14 36 0 16-6 24 0M2 82c12-14 24-14 36 0s24 14 36 0 16-6 24 0"/>', { mode: 'stroke', strokeWidth: 6 }),

  E('person', 'Person', 'people', '<path fill-rule="evenodd" d="M50 4a20 20 0 1 1 0 40 20 20 0 0 1 0-40ZM14 96c0-20 16-36 36-36s36 16 36 36Z"/>'),
  E('person-disc', 'Person disc', 'people', '<path fill-rule="evenodd" d="M50 2a48 48 0 1 1 0 96 48 48 0 0 1 0-96Zm0 12a16 16 0 1 0 0 32 16 16 0 0 0 0-32ZM22 82c4-16 15-26 28-26s24 10 28 26A38 38 0 0 1 22 82Z"/>'),
  E('people', 'Two people', 'people', '<path d="M34 8a16 16 0 1 1 0 32 16 16 0 0 1 0-32Z"/><path d="M6 84c0-16 13-28 28-28s28 12 28 28Z"/><path d="M68 12a14 14 0 1 1 0 28 14 14 0 0 1 0-28Z"/><path d="M64 56c14 0 26 10 26 24H68c0-6-1-11-4-16Z"/>'),
  E('group-three', 'Group', 'people', '<circle cx="50" cy="22" r="14"/><circle cx="22" cy="34" r="11"/><circle cx="78" cy="34" r="11"/><path d="M14 90c0-18 16-30 36-30s36 12 36 30Z"/>'),
  E('presenter', 'Presenter', 'people', '<path d="M50 4a14 14 0 1 1 0 28 14 14 0 0 1 0-28Z"/><path d="M20 92V58h60v34H66V70H34v22Z"/>'),
  E('hand', 'Hand', 'people', '<path d="M36 50V22a8 8 0 0 1 16 0v24V14a8 8 0 0 1 16 0v32V22a8 8 0 0 1 16 0v44c0 18-12 30-30 30-12 0-20-6-26-16L14 62a8 8 0 0 1 12-10l10 12Z"/>'),

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
  '#7e22ce',
  '#6d28d9',
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000"><title>${TEMPLATE_PREFIX} sale badge</title><rect id="bg" x="0" y="0" width="2000" height="2000" fill="#fce8f0"/><path id="burst" d="m1000 220 96 216 190-152-32 244 236-64-152 196 240 86-222 118 190 158-240 34 106 228-234-42-22 250-158-196-160 196-24-250-232 42 104-228-240-34 190-158-220-118 238-86-150-196 236 64-34-244 190 152Z" fill="#c2185b"/><text id="headline" x="1000" y="940" font-family="IBM Plex Sans, Arial" font-size="300" font-weight="800" text-anchor="middle" fill="#ffffff">50%</text><text id="sub" x="1000" y="1180" font-family="IBM Plex Sans, Arial" font-size="120" font-weight="700" letter-spacing="8" text-anchor="middle" fill="#fce8f0">OFF TODAY</text></svg>`,
  },
  {
    id: 'price-tag',
    name: 'Price tag',
    hint: 'Transparent PNG / SVG',
    width: 2000,
    height: 2000,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000"><title>${TEMPLATE_PREFIX} price tag</title><path id="tag" d="M420 240h1160v900L1000 1760 420 1140Z" fill="#c2185b"/><circle id="hole" cx="1420" cy="540" r="90" fill="#ffffff"/><text id="price" x="1000" y="900" font-family="IBM Plex Sans, Arial" font-size="360" font-weight="800" text-anchor="middle" fill="#ffffff">99৳</text><text id="label" x="1000" y="1120" font-family="IBM Plex Sans, Arial" font-size="130" font-weight="600" letter-spacing="6" text-anchor="middle" fill="#fce8f0">LIMITED STOCK</text></svg>`,
  },
  {
    id: 'quote-card',
    name: 'Quote card',
    hint: 'Editorial 4:5',
    width: 1600,
    height: 2000,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 2000" width="1600" height="2000"><title>${TEMPLATE_PREFIX} quote card</title><rect id="bg" x="0" y="0" width="1600" height="2000" fill="#16181c"/><rect id="rule" x="140" y="1480" width="220" height="14" fill="#e6477c"/><text id="quote" x="140" y="760" font-family="IBM Plex Sans, Arial" font-size="116" font-weight="700" fill="#ffffff"><tspan x="140" dy="0">Every asset deserves</tspan><tspan x="140" dy="168">a clean vector.</tspan></text><text id="what" x="140" y="1110" font-family="IBM Plex Sans, Arial" font-size="72" font-weight="500" fill="#a9b1bb"><tspan x="140" dy="0">Draw it once, export it</tspan><tspan x="140" dy="104">everywhere.</tspan></text><text id="attribution" x="140" y="1600" font-family="IBM Plex Sans, Arial" font-size="56" font-weight="600" letter-spacing="4" fill="#f7a1bd">MICRO STOCKER STUDIO</text></svg>`,
  },
  {
    id: 'product-frame',
    name: 'Product frame',
    hint: 'Marketplace mockup',
    width: 2000,
    height: 2000,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000"><title>${TEMPLATE_PREFIX} product frame</title><rect id="bg" x="0" y="0" width="2000" height="2000" fill="#ffffff"/><rect id="plate" x="240" y="240" width="1520" height="1300" fill="#f5f6f8"/><rect id="outline" x="240" y="240" width="1520" height="1300" fill="none" stroke="#16181c" stroke-width="12"/><circle id="dot" cx="1500" cy="320" r="26" fill="#c2185b"/><text id="title" x="240" y="1730" font-family="IBM Plex Sans, Arial" font-size="120" font-weight="800" fill="#16181c">PRODUCT NAME</text><text id="meta" x="240" y="1840" font-family="IBM Plex Sans, Arial" font-size="70" font-weight="500" fill="#5f6672">SKU 0001 · 4 MP minimum</text></svg>`,
  },
  {
    id: 'story-cover',
    name: 'Story cover',
    hint: 'Vertical 9:16',
    width: 1080,
    height: 1920,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920"><title>${TEMPLATE_PREFIX} story cover</title><rect id="bg" x="0" y="0" width="1080" height="1920" fill="#c2185b"/><circle id="circle" cx="540" cy="700" r="330" fill="none" stroke="#ffffff" stroke-width="16"/><path id="arrow" d="M420 700h240M580 620l80 80-80 80" fill="none" stroke="#ffffff" stroke-width="22" stroke-linecap="round"/><text id="title" x="540" y="1250" font-family="IBM Plex Sans, Arial" font-size="120" font-weight="800" text-anchor="middle" fill="#ffffff"><tspan x="540" dy="0">NEW DROP</tspan><tspan x="540" dy="150">THIS WEEK</tspan></text><text id="cta" x="540" y="1640" font-family="IBM Plex Sans, Arial" font-size="60" font-weight="600" letter-spacing="8" text-anchor="middle" fill="#fce8f0">SWIPE UP</text></svg>`,
  },
  {
    id: 'logo-mark',
    name: 'Logo mark',
    hint: 'Editable monogram',
    width: 2000,
    height: 2000,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000"><title>${TEMPLATE_PREFIX} logo mark</title><circle id="disc" cx="1000" cy="1000" r="760" fill="#16181c"/><path id="mark" d="M640 1320V680l360 400 360-400v640" fill="none" stroke="#ffffff" stroke-width="140" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
];

export function templateDocument(template: VectorTemplate): string {
  return template.svg;
}
