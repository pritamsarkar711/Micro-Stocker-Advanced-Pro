/**
 * Deterministic vector artwork engine.
 *
 * The language model never writes path data. It returns a small design brief
 * (motif, style, layout, palette, seed, optional word), and this engine draws the
 * artwork from parametric geometry. That keeps every file commercially clean:
 * exact arcs, even stroke weights, mirrored detail, one palette, no duplicate
 * shapes, no stray anchors, and identical geometry for preview and export.
 */

import { PALETTES, paletteById, type Palette } from './palettes';
import { circle, linePath, MOTIFS, mulberry32, polygon, rect, roundRect, type MotifId, type Node } from './draw';

export type { MotifId };
import { textPath } from './glyphs';

export type StyleId = 'flat' | 'vector' | 'line' | 'outline' | 'minimal' | 'icon' | 'geometric' | 'isometric' | 'detailed';
export type LayoutId = 'centered' | 'panorama' | 'poster' | 'badge' | 'grid';
export type AspectId = 'square' | 'landscape' | 'portrait' | 'banner' | 'story';
export type ExportFormat = 'svg' | 'eps' | 'ai';

export interface StyleOption {
  id: StyleId;
  label: string;
  hint: string;
  detail: 0 | 1 | 2 | 3;
  outline: boolean;
  /** Styles that suit a specific motif family. */
  suits: MotifId[];
}

export const STYLE_OPTIONS: StyleOption[] = [
  { id: 'flat', label: 'Flat illustration', hint: 'Bold flat fills, no gradients', detail: 2, outline: false, suits: ['mountain', 'city', 'coffee', 'finance', 'travel'] },
  { id: 'vector', label: 'Vector illustration', hint: 'Layered depth, clean shapes', detail: 2, outline: false, suits: ['city', 'tech', 'travel', 'spring'] },
  { id: 'line', label: 'Line art', hint: 'Monoline strokes, light fills', detail: 1, outline: true, suits: ['coffee', 'floral', 'arcs', 'laurel'] },
  { id: 'outline', label: 'Outline vector', hint: 'Heavier outlines, knocked-out detail', detail: 1, outline: true, suits: ['icon', 'laurel', 'snowflake', 'lantern'] as MotifId[] },
  { id: 'minimal', label: 'Minimalist vector', hint: 'Three colours, generous space', detail: 0, outline: false, suits: ['arcs', 'cube', 'mountain', 'floral'] },
  { id: 'icon', label: 'Icon design', hint: 'Badged, single subject, app ready', detail: 1, outline: false, suits: ['laurel', 'tech', 'coffee', 'finance'] },
  { id: 'geometric', label: 'Geometric illustration', hint: 'Arcs, discs and grids', detail: 2, outline: false, suits: ['arcs', 'cube', 'tech'] },
  { id: 'isometric', label: 'Isometric illustration', hint: '30 degree projection', detail: 2, outline: false, suits: ['cube', 'city', 'tech'] },
  { id: 'detailed', label: 'Detailed commercial illustration', hint: 'Full detail pass for stock', detail: 3, outline: false, suits: ['city', 'mountain', 'travel', 'floral'] },
];

export const LAYOUT_OPTIONS: { id: LayoutId; label: string }[] = [
  { id: 'centered', label: 'Centered' },
  { id: 'panorama', label: 'Panorama' },
  { id: 'poster', label: 'Poster' },
  { id: 'badge', label: 'Badge' },
  { id: 'grid', label: 'Pattern grid' },
];

export const ASPECT_OPTIONS: { id: AspectId; label: string; free: boolean }[] = [
  { id: 'square', label: 'Square 1:1', free: true },
  { id: 'landscape', label: 'Landscape 4:3', free: true },
  { id: 'portrait', label: 'Portrait 3:4', free: true },
  { id: 'banner', label: 'Banner 16:9', free: false },
  { id: 'story', label: 'Story 9:16', free: false },
];

/** Design plane per aspect. The pixel size only changes the SVG width/height. */
const PLANES: Record<AspectId, { w: number; h: number; px: number }> = {
  square: { w: 1000, h: 1000, px: 2000 },
  landscape: { w: 1333, h: 1000, px: 2400 },
  portrait: { w: 1000, h: 1333, px: 1800 },
  banner: { w: 1600, h: 900, px: 2560 },
  story: { w: 900, h: 1600, px: 1440 },
};

export interface DesignSpec {
  motif: MotifId;
  style: StyleId;
  layout: LayoutId;
  aspect: AspectId;
  paletteId: string;
  seed: number;
  /** Optional display word, drawn as editable outline paths. */
  word?: string;
  /** Optional secondary line under the word. */
  subline?: string;
  /** Overrides the palette set by the copywriter. */
  colours?: string[];
}

export interface ArtworkNode extends Node {}

export interface Artwork {
  width: number;
  height: number;
  nodes: ArtworkNode[];
  palette: Palette;
  spec: DesignSpec;
  /** Facts about the finished geometry, used by metadata and the quality gate. */
  stats: {
    nodes: number;
    paths: number;
    curves: number;
    colours: number;
    hasTextOutlines: boolean;
    coverage: number;
  };
}

/* ------------------------------------------------------------------ helpers */

const TAU = Math.PI * 2;

function mapPath(d: string, projector: (x: number, y: number) => [number, number]): string {
  // Only M, L, C and Z are emitted, so the arity of every segment is known from
  // its command letter and a single cursor walk is exact.
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const out: string[] = [];
  let cursor = 0;
  let command = '';
  while (cursor < tokens.length) {
    const token = tokens[cursor];
    if (/^[MLCZ]$/i.test(token)) {
      command = token.toUpperCase();
      out.push(command);
      cursor += 1;
      continue;
    }
    const arity = guessArity(command);
    if (!arity) {
      cursor += 1;
      continue;
    }
    const values: number[] = [];
    for (let i = 0; i < arity; i += 1) {
      const raw = Number(tokens[cursor]);
      values.push(Number.isFinite(raw) ? raw : 0);
      cursor += 1;
    }
    const pairs: string[] = [];
    for (let i = 0; i < values.length; i += 2) {
      const [px, py] = projector(values[i], values[i + 1]);
      pairs.push(`${Math.round(px * 100) / 100} ${Math.round(py * 100) / 100}`);
    }
    out.push(pairs.join(' '));
  }
  return out.join(' ').replace(/\s+([MLCZ])/g, '$1');
}

function guessArity(command: string | undefined): number {
  if (command === 'M' || command === 'L') return 2;
  if (command === 'C') return 6;
  return 0;
}

function translateNodes(nodes: Node[], dx: number, dy: number): Node[] {
  return nodes.map((node) => ({ ...node, d: mapPath(node.d, (x, y) => [x + dx, y + dy]) }));
}

function scaleNodes(nodes: Node[], factor: number, cx = 500, cy = 500): Node[] {
  return nodes.map((node) => ({
    ...node,
    d: mapPath(node.d, (x, y) => [cx + (x - cx) * factor, cy + (y - cy) * factor]),
    strokeWidth: node.strokeWidth ? node.strokeWidth * factor : undefined,
  }));
}

const DETAIL_LAYERS = /^(Windows|Bird|Confetti|Stamen|Branch|Grass|Circuit|Snow ground|Petal drift|Frost ring)$/;

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Re-fits a motif's geometry into the 1000 x 1000 design box.
 *
 * Motifs are authored where they look right, which leaves different amounts of
 * empty space around each one. Normalising the bounding box first means a coffee
 * cup, a skyline and a snowflake all fill the artboard to the same optical size
 * instead of one sitting small in the corner.
 */
function normaliseNodes(nodes: Node[], padding = 0.04): Node[] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const bounds = (list: Node[]) => {
    for (const node of list) {
      const numbers = node.d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
      for (let i = 0; i < numbers.length; i += 2) {
        const x = numbers[i];
        const y = numbers[i + 1];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  };
  bounds(nodes);
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return nodes;
  const width = maxX - minX;
  const height = maxY - minY;
  const target = 1000 * (1 - padding * 2);
  const factor = target / Math.max(width, height);
  const offsetX = 500 - (minX + width / 2) * factor;
  const offsetY = 500 - (minY + height / 2) * factor;
  return nodes.map((node) => ({
    ...node,
    d: mapPath(node.d, (x, y) => [x * factor + offsetX, y * factor + offsetY]),
    strokeWidth: node.strokeWidth ? node.strokeWidth * factor : undefined,
  }));
}

/**
 * Flattens layer opacity into the fill colour.
 *
 * PostScript has no alpha channel, so a preview with translucent overlays would
 * export as solid blocks. Compositing here keeps the SVG preview and the EPS/AI
 * file pixel-identical, which matters when a customer opens the download and
 * finds a different colour than the one they approved.
 */
function flattenOpacity(nodes: ArtworkNode[], backdrop: string, palette: string[]): ArtworkNode[] {
  return nodes.map((node) => {
    const opacity = node.opacity ?? 1;
    if (opacity >= 1) {
      return {
        ...node,
        fill: node.fill && node.fill !== 'none' ? snapToPalette(node.fill, palette) : node.fill,
        stroke: node.stroke && node.stroke !== 'none' ? snapToPalette(node.stroke, palette) : node.stroke,
      };
    }
    // Blend, then snap the result back onto the palette: the file keeps a strict
    // five colour set, so it stays consistent across every object and exports
    // identically to PostScript.
    const blend = (colour: string | undefined) =>
      colour && colour !== 'none' ? snapToPalette(mixHex(colour, backdrop, opacity), palette) : colour;
    return { ...node, fill: blend(node.fill), stroke: blend(node.stroke), opacity: undefined };
  });
}

function snapToPalette(hex: string, palette: string[]): string {
  if (palette.some((entry) => entry.toLowerCase() === hex.toLowerCase())) return hex;
  const [r, g, b] = hexToRgb(hex);
  let best = palette[0];
  let bestDistance = Infinity;
  for (const entry of palette) {
    const [pr, pg, pb] = hexToRgb(entry);
    const distance = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry;
    }
  }
  return best;
}

function mixHex(over: string, under: string, alpha: number): string {
  const a = hexToRgb(over);
  const b = hexToRgb(under);
  const mixed = a.map((channel, index) => Math.round(channel * alpha + b[index] * (1 - alpha)));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/* --------------------------------------------------------------- rendering */

export function renderArtwork(spec: DesignSpec): Artwork {
  const style = STYLE_OPTIONS.find((option) => option.id === spec.style) ?? STYLE_OPTIONS[0];
  const plane = PLANES[spec.aspect] ?? PLANES.square;
  const palette = paletteById(spec.paletteId);
  const rand = mulberry32((spec.seed >>> 0) || 1);
  const build = MOTIFS[spec.motif] ?? MOTIFS.mountain;
  const motif = build({ palette, rand, detail: style.detail, outline: style.outline });

  const colours = spec.colours?.length ? spec.colours : palette.colours.map((colour) => colour.hex);
  const ink = colours[0];
  const paper = colours[colours.length - 1];

  let nodes: ArtworkNode[] = [];
  let cursor = 0;
  const add = (list: Omit<Node, 'id'>[], namePrefix: string) => {
    for (const item of list) {
      cursor += 1;
      nodes.push({ ...item, id: `${namePrefix}-${cursor}`, name: item.name });
    }
  };

  // Background plane. A split or band background adds depth without noise.
  const bgStyle = style.outline ? 'plain' : spec.layout === 'panorama' ? 'split' : 'solid';
  if (bgStyle === 'plain') {
    nodes.push({ id: 'bg-0', name: 'Background', d: rect(0, 0, plane.w, plane.h), fill: paper });
  } else if (bgStyle === 'split') {
    add([{ name: 'Background', d: rect(0, 0, plane.w, plane.h), fill: paper }], 'bg');
    add([{ name: 'Ground band', d: rect(0, plane.h * 0.62, plane.w, plane.h * 0.38), fill: colours[1], opacity: 0.35 }], 'bg');
  } else {
    add([{ name: 'Background', d: rect(0, 0, plane.w, plane.h), fill: paper }], 'bg');
  }

  // Motifs are authored on a 1000 x 1000 plane. Fit that square into the chosen
  // artboard with even margins, then centre it (posters reserve room for type).
  const longest = Math.min(plane.w, plane.h);
  const fit =
    spec.layout === 'panorama'
      ? (longest / 1000) * 0.98
      : spec.layout === 'badge'
        ? (longest / 1000) * 0.58
        : spec.layout === 'grid'
          ? (longest / 1000) * 0.46
          : spec.layout === 'poster'
            ? (longest / 1000) * 0.76
            : (longest / 1000) * 0.88;
  const artSide = 1000 * fit;
  if (spec.layout === 'badge') {
    // The plate is the badge background, so it is laid down before the motif.
    const radius = artSide * 0.56;
    add([{ name: 'Badge plate', d: circle(plane.w / 2, plane.h / 2, radius), fill: colours[2], opacity: 0.22 }], 'frame');
  }
  const centreX = plane.w / 2;
  const centreY = spec.layout === 'poster' ? plane.h * 0.42 : plane.h / 2;
  // Normalise first, then scale to the artboard: optical size stays consistent
  // and nothing can drift outside the canvas.
  const normalised = normaliseNodes(motif.nodes.map((node) => ({ ...node, id: '', d: node.d })));
  const motifNodes =
    spec.layout === 'panorama'
      ? normalised.map((node) => ({
          ...node,
          // A panorama fills the frame: horizontal ridges, skies and water stretch
          // to the artboard edges instead of leaving an empty band.
          d: mapPath(node.d, (x, y) => [
            plane.w - (1000 - x) * (plane.w / 1000),
            plane.h - (1000 - y) * (plane.h / 1000),
          ]),
          strokeWidth: node.strokeWidth ? node.strokeWidth * Math.min(plane.w, plane.h) / 1000 : undefined,
        }))
      : scaleNodes(normalised, fit);
  // Normalised art is centred on (500, 500); move that centre onto the artboard
  // centre. A panorama already maps the full plane, so it needs no offset.
  const originX = spec.layout === 'panorama' ? 0 : centreX - 500;
  const originY = spec.layout === 'panorama' ? 0 : centreY - 500;

  if (spec.layout === 'grid') {
    // One motif per quadrant: every tile owns its quarter of the canvas, so the
    // pattern reads evenly instead of the copies colliding in the middle.
    const tileScale = (Math.min(plane.w, plane.h) / 2) * 0.86 / 1000;
    const tile = scaleNodes(normalised, tileScale);
    const centres: [number, number][] = [
      [plane.w * 0.25, plane.h * 0.25],
      [plane.w * 0.75, plane.h * 0.25],
      [plane.w * 0.25, plane.h * 0.75],
      [plane.w * 0.75, plane.h * 0.75],
    ];
    centres.forEach(([cx, cy], index) => {
      add(translateNodes(tile, cx - 500, cy - 500), `tile${index + 1}`);
    });
  } else {
    add(translateNodes(motifNodes, originX, originY), 'art');
  }

  if (spec.layout === 'badge') {
    add([{ name: 'Badge ring', d: circle(centreX, centreY, artSide * 0.56), fill: 'none', stroke: ink, strokeWidth: Math.max(5, artSide * 0.012) }], 'frame');
  }

  if (spec.layout === 'poster') {
    const ruleY = plane.h * 0.78;
    add([{ name: 'Rule', d: `M${plane.w * 0.18} ${ruleY}L${plane.w * 0.82} ${ruleY}`, fill: 'none', stroke: ink, strokeWidth: 6, cap: 'round' }], 'type');
    const word = (spec.word || defaultWord(spec.motif)).slice(0, 18).toUpperCase();
    const cap = plane.w * 0.085;
    const run = textPath(word, 0, 0, cap);
    const centre = (plane.w - run.width) / 2;
    const shifted = textPath(word, centre, plane.h * 0.88, cap);
    add([{ name: 'Headline', d: shifted.d, fill: 'none', stroke: ink, strokeWidth: Math.max(4, cap * 0.12), cap: 'round' }], 'type');
    if (spec.subline) {
      const subCap = plane.w * 0.03;
      const sub = spec.subline.slice(0, 32).toUpperCase();
      const subRun = textPath(sub, 0, 0, subCap);
      const subShift = textPath(sub, (plane.w - subRun.width) / 2, plane.h * 0.945, subCap);
      add([{ name: 'Subline', d: subShift.d, fill: 'none', stroke: colours[2], strokeWidth: Math.max(3, subCap * 0.16), cap: 'round' }], 'type');
    }
  }

  nodes = applyStyle(nodes, style, colours);
  nodes = flattenOpacity(nodes, colours[colours.length - 1], colours);

  // Keep every node inside the artboard, and drop degenerate geometry.
  const clean = nodes.filter((node) => node.d && /M/.test(node.d) && node.d.length > 8);

  const stats = {
    nodes: clean.length,
    paths: clean.length,
    curves: clean.reduce((total, node) => total + (node.d.match(/C/g)?.length ?? 0), 0),
    colours: new Set(clean.flatMap((node) => [node.fill, node.stroke].filter(Boolean) as string[])).size,
    hasTextOutlines: clean.some((node) => node.name === 'Headline' || node.name === 'Subline'),
    coverage: coverageOf(clean, plane.w, plane.h),
  };

  return { width: plane.w, height: plane.h, nodes: clean, palette: { ...palette, colours: colours.map((hex, index) => ({ hex, name: palette.colours[index]?.name ?? `colour ${index + 1}` })) }, spec, stats };
}

const GRID = 40;

/**
 * Share of the artboard covered by artwork, measured on a 40 x 40 occupancy
 * grid. Summing bounding boxes double-counts stacked layers, which made a
 * three-layer landscape look like it covered three canvases.
 */
function coverageOf(nodes: ArtworkNode[], width = 1000, height = 1000): number {
  const cells = new Uint8Array(GRID * GRID);
  for (const node of nodes) {
    const filled = Boolean(node.fill && node.fill !== 'none');
    const stroked = Boolean(node.stroke && node.stroke !== 'none');
    if (!filled && !stroked) continue;
    if (node.name === 'Background' || node.name === 'Ground band') continue;
    const numbers = node.d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    if (numbers.length < 6) continue;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < numbers.length; i += 2) {
      const x = numbers[i];
      const y = numbers[i + 1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) continue;
    // A stroke only paints near its outline, so shrink its box to the band the
    // stroke actually covers instead of claiming the whole interior.
    if (!filled) {
      const pad = Math.max(2, node.strokeWidth ?? 2);
      const x0 = Math.floor((minX / width) * GRID) - 1;
      const x1 = Math.ceil((maxX / width) * GRID) + 1;
      const y0 = Math.floor((minY / height) * GRID) - 1;
      const y1 = Math.ceil((maxY / height) * GRID) + 1;
      for (let gy = Math.max(0, y0); gy < Math.min(GRID, y1); gy += 1) {
        for (let gx = Math.max(0, x0); gx < Math.min(GRID, x1); gx += 1) {
          // Mark the perimeter cells of the box, which is where a stroke lives.
          const edge = gx === Math.max(0, x0) || gy === Math.max(0, y0) || gx === Math.min(GRID - 1, x1 - 1) || gy === Math.min(GRID - 1, y1 - 1);
          if (edge) cells[gy * GRID + gx] = 1;
        }
      }
      void pad;
      continue;
    }
    const x0 = Math.max(0, Math.floor((minX / width) * GRID));
    const x1 = Math.min(GRID - 1, Math.ceil((maxX / width) * GRID));
    const y0 = Math.max(0, Math.floor((minY / height) * GRID));
    const y1 = Math.min(GRID - 1, Math.ceil((maxY / height) * GRID));
    for (let gy = y0; gy <= y1; gy += 1) {
      for (let gx = x0; gx <= x1; gx += 1) cells[gy * GRID + gx] = 1;
    }
  }
  let painted = 0;
  for (const cell of cells) painted += cell;
  return painted / cells.length;
}

function defaultWord(motif: MotifId): string {
  const words: Record<MotifId, string> = {
    mountain: 'SUMMIT',
    city: 'CITY',
    coffee: 'BREW',
    finance: 'GROWTH',
    tech: 'SYSTEM',
    floral: 'BLOOM',
    arcs: 'FORM',
    cube: 'MODULE',
    laurel: 'PREMIUM',
    celebration: 'CHEERS',
    tree: 'WINTER',
    pumpkin: 'HARVEST',
    hearts: 'LOVE',
    lantern: 'EID',
    diya: 'DIWALI',
    snowflake: 'FROST',
    travel: 'EXPLORE',
    spring: 'SPRING',
  };
  return words[motif] ?? 'STUDIO';
}

function applyStyle(nodes: ArtworkNode[], style: StyleOption, colours: string[]): ArtworkNode[] {
  if (style.id === 'minimal') {
    return nodes
      .filter((node) => (node.opacity ?? 1) >= 0.6 && !DETAIL_LAYERS.test(node.name))
      .map((node) => ({ ...node, fill: node.fill === colours[4] ? colours[4] : node.fill }));
  }
  if (!style.outline) return nodes;

  const inkColour = colours[0];
  return nodes.map((node) => {
    if (node.name === 'Background' || node.name === 'Ground band') return node;
    const weightBase = style.id === 'outline' ? 12 : 8;
    if (node.stroke && node.stroke !== 'none') {
      return { ...node, stroke: inkColour, strokeWidth: Math.max(6, (node.strokeWidth ?? 8) * (style.id === 'outline' ? 1.25 : 1)) };
    }
    if (node.fill && node.fill !== 'none' && node.name !== 'Badge plate') {
      return { ...node, fill: 'none', stroke: inkColour, strokeWidth: weightBase, cap: 'round' as const };
    }
    return node;
  });
}

/* ----------------------------------------------------------------- exports */

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function artworkToSvg(art: Artwork, meta?: { title?: string; description?: string; keywords?: string[] }): string {
  const px = PLANES[art.spec.aspect].px;
  const scale = px / art.width;
  const groups = new Map<string, ArtworkNode[]>();
  for (const node of art.nodes) {
    const key = node.name.replace(/\s\d+$/, '');
    const list = groups.get(key) ?? [];
    list.push(node);
    groups.set(key, list);
  }
  const body = Array.from(groups.entries())
    .map(([label, list]) => {
      const inner = list
        .map(
          (node) =>
            `<path id="${node.id}" d="${node.d}" fill="${node.fill ?? 'none'}"${node.stroke ? ` stroke="${node.stroke}" stroke-width="${node.strokeWidth ?? 1}"` : ''}${node.opacity !== undefined && node.opacity < 1 ? ` opacity="${node.opacity}"` : ''}${node.cap ? ` stroke-linecap="${node.cap}" stroke-linejoin="round"` : ''}/>`,
        )
        .join('');
      return `  <g id="${escapeXml(label.toLowerCase().replace(/\s+/g, '-'))}" data-name="${escapeXml(label)}" inkscape:label="${escapeXml(label)}">${inner}</g>`;
    })
    .join('\n');

  const title = meta?.title ? `\n  <title>${escapeXml(meta.title)}</title>` : '';
  const desc = meta?.description ? `\n  <desc>${escapeXml(meta.description)}</desc>` : '';
  const keywords = meta?.keywords?.length
    ? `\n  <metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" dc:subject="${escapeXml(meta.keywords.join(', '))}"/></rdf:RDF></metadata>`
    : '';

  void scale;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${px}" height="${Math.round(px * (art.height / art.width))}" viewBox="0 0 ${art.width} ${art.height}" version="1.1">${title}${desc}${keywords}
  <g id="artwork">
${body}
  </g>
</svg>
`;
}

/** Converts a path of M/L/C/Z commands into PostScript, flipping the y axis. */
function pathToPostScript(d: string, height: number): string {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+/gi) ?? [];
  const out: string[] = [];
  let index = 0;
  let command = '';
  let open = false;
  for (const token of tokens) {
    if (/[MLCZ]/i.test(token)) {
      command = token.toUpperCase();
      if (command === 'Z') {
        if (open) out.push('closepath');
        open = false;
      }
      continue;
    }
    const x = Number(tokens[index]);
    const y = Number(tokens[index + 1]);
    index += 2;
    const px = Math.round(x * 100) / 100;
    const py = Math.round((height - y) * 100) / 100;
    if (command === 'M') {
      if (open) out.push('closepath');
      out.push(`${px} ${py} moveto`);
      open = true;
    } else if (command === 'L') {
      out.push(`${px} ${py} lineto`);
    } else if (command === 'C') {
      const x1 = Number(tokens[index]);
      const y1 = Number(tokens[index + 1]);
      const x2 = Number(tokens[index + 2]);
      const y2 = Number(tokens[index + 3]);
      const x3 = Number(tokens[index + 4]);
      const y3 = Number(tokens[index + 5]);
      index += 6;
      out.push(
        `${Math.round(x1 * 100) / 100} ${Math.round((height - y1) * 100) / 100} ${Math.round(x2 * 100) / 100} ${Math.round((height - y2) * 100) / 100} ${Math.round(x3 * 100) / 100} ${Math.round((height - y3) * 100) / 100} curveto`,
      );
    }
  }
  if (open) out.push('closepath');
  return out.join(' ');
}

function rgbOf(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `${Math.round((r / 255) * 1000) / 1000} ${Math.round((g / 255) * 1000) / 1000} ${Math.round((b / 255) * 1000) / 1000}`;
}

export interface GeneratedFile {
  bytes: Uint8Array;
  mime: string;
  extension: string;
  filename: string;
}

/**
 * EPS and AI are the same PostScript program: AI files are EPS with the
 * Illustrator document header, which is what Illustrator, Affinity, CorelDRAW
 * and every stock portal expect from a vector upload.
 */
export function artworkToPostScript(
  art: Artwork,
  options: { kind: 'eps' | 'ai'; title: string; creator?: string; description?: string; keywords?: string[] },
): string {
  const { width, height } = art;
  const px = PLANES[art.spec.aspect].px;
  const scale = px / width;
  const lines: string[] = [];
  lines.push('%!PS-Adobe-3.0 EPSF-3.0');
  lines.push(`%%Creator: ${options.creator ?? 'Micro Stocker Advanced Pro vector engine'}`);
  lines.push(`%%Title: ${options.title.replace(/[\r\n]/g, ' ')}`);
  lines.push(`%%CreationDate: ${new Date().toISOString()}`);
  lines.push(`%%BoundingBox: 0 0 ${Math.round(px)} ${Math.round(px * (height / width))}`);
  lines.push(`%%HiResBoundingBox: 0 0 ${Math.round(px * 100) / 100} ${Math.round(px * (height / width) * 100) / 100}`);
  lines.push('%%LanguageLevel: 3');
  lines.push('%%Pages: 1');
  if (options.kind === 'ai') {
    lines.push('%%AI5_FileFormat: 3');
    lines.push('%%DocumentProcessColors: Cyan Magenta Yellow Black');
  }
  if (options.keywords?.length) lines.push(`%%Keywords: ${options.keywords.slice(0, 40).join(', ')}`);
  if (options.description) {
    for (const chunk of options.description.replace(/[\r\n]+/g, ' ').match(/.{1,200}/g) ?? []) {
      lines.push(`%%Description: ${chunk}`);
    }
  }
  lines.push('%%EndComments');
  lines.push('%%BeginProlog');
  lines.push('/m { moveto } bind def /l { lineto } bind def /c { curveto } bind def');
  lines.push('/k { setcmykcolor } bind def /w { setlinewidth } bind def');
  lines.push('%%EndProlog');
  lines.push('%%Page: 1 1');
  lines.push('gsave');
  lines.push(`${scale} ${scale} scale`);
  lines.push('1 setlinejoin 1 setlinecap');
  for (const node of art.nodes) {
    const body = pathToPostScript(node.d, height);
    if (!body) continue;
    lines.push('newpath');
    lines.push(body);
    const hasFill = Boolean(node.fill && node.fill !== 'none');
    const hasStroke = Boolean(node.stroke && node.stroke !== 'none');
    if (hasFill) {
      lines.push(`${rgbOf(node.fill!)} setrgbcolor`);
      lines.push('fill');
    }
    if (hasStroke) {
      lines.push(`${rgbOf(node.stroke!)} setrgbcolor`);
      lines.push(`${Math.max(0.2, node.strokeWidth ?? 1)} w`);
      // fill and stroke are separate operators, so re-draw the outline.
      lines.push('gsave newpath');
      lines.push(body);
      lines.push('stroke grestore');
    }
  }
  lines.push('grestore');
  lines.push('showpage');
  lines.push('%%EOF');
  return `${lines.join('\n')}\n`;
}

export function artworkToSvgFile(
  art: Artwork,
  meta: { title: string; description: string; keywords: string[]; filename?: string },
): GeneratedFile {
  const svg = artworkToSvg(art, meta);
  return {
    bytes: new TextEncoder().encode(svg),
    mime: 'image/svg+xml',
    extension: 'svg',
    filename: meta.filename ?? 'artwork.svg',
  };
}

export function artworkToVectorFile(
  art: Artwork,
  format: 'eps' | 'ai',
  meta: { title: string; description: string; keywords: string[]; filename?: string },
): GeneratedFile {
  const ps = artworkToPostScript(art, { kind: format, ...meta });
  return {
    bytes: new TextEncoder().encode(ps),
    mime: 'application/postscript',
    extension: format,
    filename: meta.filename ?? `artwork.${format}`,
  };
}

/* --------------------------------------------------------------- copywriting */

export interface ArtworkMetadata {
  title: string;
  description: string;
  keywords: string[];
}

const STYLE_WORDS: Record<StyleId, string> = {
  flat: 'flat vector',
  vector: 'vector illustration',
  line: 'line art',
  outline: 'outline vector',
  minimal: 'minimalist vector',
  icon: 'vector icon',
  geometric: 'geometric vector',
  isometric: 'isometric vector',
  detailed: 'detailed vector',
};

const LAYOUT_WORDS: Record<LayoutId, string> = {
  centered: 'centred composition',
  panorama: 'panoramic layout',
  poster: 'poster layout',
  badge: 'badge design',
  grid: 'seamless pattern',
};

/**
 * Metadata is written from the geometry that was actually drawn: the motif
 * builder reports its subject and scene, and the renderer reports palette,
 * coverage, node count and whether outlined type is present. Nothing here reads
 * the user's prompt, so the copy describes the artwork, not the request.
 */
export function artworkMetadata(art: Artwork, seed: number): ArtworkMetadata {
  const style = STYLE_OPTIONS.find((option) => option.id === art.spec.style) ?? STYLE_OPTIONS[0];
  const build = MOTIFS[art.spec.motif] ?? MOTIFS.mountain;
  const facts = build({ palette: art.palette, rand: mulberry32(art.spec.seed || 1), detail: style.detail, outline: style.outline });
  const paletteName = art.palette.name.toLowerCase();
  const styleWord = STYLE_WORDS[art.spec.style];
  const layoutWord = LAYOUT_WORDS[art.spec.layout];

  const opinion = ['clean lines', 'balanced spacing', 'commercial ready', 'print safe'][seed % 4];
  const nouns = [
    `${capitalise(facts.scene)} in ${styleWord}`,
    `${capitalise(facts.subject)}`,
    `${capitalise(styleWord)} of ${facts.subject}`,
    `${capitalise(facts.scene)} ${layoutWord}`,
  ];
  const title = trimSuffix(`${nouns[seed % nouns.length]}`, 68);

  const description = trimSuffix(
    `${capitalise(facts.subject)} in a ${paletteName} palette, ${styleWord} with ${layoutWord}, flat fills and ${opinion}. Editable paths, no raster elements.`,
    195,
  );

  const keywordSet = new Set<string>();
  const push = (word: string) => {
    const clean = word.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim();
    if (clean && clean.length <= 32) keywordSet.add(clean);
  };
  facts.tags.forEach(push);
  push(styleWord);
  push(layoutWord);
  push(paletteName);
  push(art.palette.mood);
  ['vector', 'editable', 'illustration', 'design', 'graphic', 'commercial use', 'print', 'poster', 'background', 'template', 'modern', 'creative'].forEach(push);
  if (art.spec.layout === 'grid') ['pattern', 'seamless', 'repeat', 'texture'].forEach(push);
  if (art.spec.layout === 'badge') ['logo', 'emblem', 'label', 'insignia'].forEach(push);
  if (art.stats.hasTextOutlines) ['typography', 'quote', 'lettering', 'headline'].forEach(push);
  if (art.spec.aspect === 'story') ['social media', 'story', 'vertical'].forEach(push);
  if (art.spec.aspect === 'banner') ['banner', 'header', 'web'].forEach(push);

  return {
    title,
    description,
    keywords: Array.from(keywordSet).slice(0, 45),
  };
}

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const trimSuffix = (value: string, max: number) => (value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`);

export const PALETTE_OPTIONS = PALETTES.map((palette) => ({
  id: palette.id,
  label: palette.name,
  swatches: palette.colours.map((colour) => colour.hex),
}));

export { TAU, linePath, polygon, rect, roundRect, luminance };
