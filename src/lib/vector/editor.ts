/**
 * Beginner-friendly vector document helpers.
 *
 * The editor keeps the imported artwork as a live SVG DOM (so nothing is lost on
 * round trip) and this module supplies the pieces that need to be exact:
 * element creation, layer enumeration, colour/transform helpers and a real
 * vector EPS writer for export.
 */

export const SVG_NS = 'http://www.w3.org/2000/svg';

export type Primitive = 'rect' | 'ellipse' | 'star' | 'line';

export interface LayerInfo {
  id: string;
  tag: string;
  label: string;
  index: number;
  depth: number;
  hidden: boolean;
  locked: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Colours                                                                   */
/* -------------------------------------------------------------------------- */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  grey: '#808080',
  gray: '#808080',
  none: 'none',
  transparent: 'none',
};

export function parseColor(input: string | null | undefined): Rgb | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (value === 'none' || value === 'transparent' || value.startsWith('url(')) return null;
  const named = NAMED[value];
  const hex = named ?? value;
  if (hex.startsWith('#')) {
    const raw = hex.slice(1);
    if (raw.length === 3) {
      return {
        r: Number.parseInt(raw[0] + raw[0], 16),
        g: Number.parseInt(raw[1] + raw[1], 16),
        b: Number.parseInt(raw[2] + raw[2], 16),
      };
    }
    if (raw.length === 6) {
      return {
        r: Number.parseInt(raw.slice(0, 2), 16),
        g: Number.parseInt(raw.slice(2, 4), 16),
        b: Number.parseInt(raw.slice(4, 6), 16),
      };
    }
  }
  const rgb = value.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3) return { r: parts[0], g: parts[1], b: parts[2] };
  }
  return { r: 0, g: 0, b: 0 };
}

/** PostScript wants 0–1 components. */
export function psColor(input: string | null | undefined): [number, number, number] | null {
  const rgb = parseColor(input);
  if (!rgb) return null;
  return [rgb.r / 255, rgb.g / 255, rgb.b / 255];
}

export function toHex(rgb: Rgb): string {
  const part = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`;
}

/* -------------------------------------------------------------------------- */
/*  Document creation                                                         */
/* -------------------------------------------------------------------------- */

export function createDocument(width: number, height: number, background: string | null = null): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  if (background) {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('id', 'background');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
    rect.setAttribute('fill', background);
    svg.appendChild(rect);
  }
  return svg;
}

export function parseSvgDocument(text: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const error = doc.querySelector('parsererror');
  if (error) throw new Error('This file is not valid SVG.');
  const svg = doc.documentElement as unknown as SVGSVGElement;
  if (svg.tagName.toLowerCase() !== 'svg') throw new Error('No <svg> root element found.');
  return svg;
}

let idCounter = 0;
export function nextShapeId(tag: string): string {
  idCounter += 1;
  return `${tag}-${Date.now().toString(36)}-${idCounter}`;
}

export function createShape(
  tag: Primitive,
  box: { x: number; y: number; w: number; h: number },
  fill: string,
  stroke: string,
  strokeWidth: number,
): SVGElement {
  const el = document.createElementNS(SVG_NS, tag === 'star' ? 'path' : tag);
  el.setAttribute('id', nextShapeId(tag));
  el.setAttribute('fill', fill);
  if (strokeWidth > 0) {
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', String(strokeWidth));
  }
  const { x, y, w, h } = box;
  switch (tag) {
    case 'rect':
      el.setAttribute('x', String(x));
      el.setAttribute('y', String(y));
      el.setAttribute('width', String(w));
      el.setAttribute('height', String(h));
      break;
    case 'ellipse':
      el.setAttribute('cx', String(x + w / 2));
      el.setAttribute('cy', String(y + h / 2));
      el.setAttribute('rx', String(w / 2));
      el.setAttribute('ry', String(h / 2));
      break;
    case 'line':
      el.setAttribute('d', `M ${x} ${y + h} L ${x + w} ${y}`);
      (el as unknown as SVGPathElement).removeAttribute('d');
      el.setAttribute('x1', String(x));
      el.setAttribute('y1', String(y + h));
      el.setAttribute('x2', String(x + w));
      el.setAttribute('y2', String(y));
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke', strokeWidth > 0 ? stroke : '#000000');
      el.setAttribute('stroke-width', String(strokeWidth || 4));
      break;
    case 'star':
      el.setAttribute('d', starPath(x + w / 2, y + h / 2, Math.min(w, h) / 2, Math.min(w, h) / 4, 5));
      break;
  }
  return el;
}

export function starPath(cx: number, cy: number, outer: number, inner: number, points = 5): string {
  const step = Math.PI / points;
  let d = '';
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = i * step - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return `${d}Z`;
}

/* -------------------------------------------------------------------------- */
/*  Layers                                                                    */
/* -------------------------------------------------------------------------- */

export function listLayers(root: SVGSVGElement): LayerInfo[] {
  const layers: LayerInfo[] = [];
  const walk = (parent: Element, depth: number) => {
    Array.from(parent.children).forEach((child) => {
      const tag = child.tagName.toLowerCase();
      if (tag === 'defs' || tag === 'metadata' || tag === 'title' || tag === 'desc' || tag === 'style') return;
      const existingId = child.getAttribute('id');
      if (!existingId) {
        child.setAttribute('id', nextShapeId(tag));
      }
      const id = child.getAttribute('id')!;
      // Imported documents carry meaningful ids ("quote", "bg", "logo_mark").
      // Generated ids look like "rect-mwk3" and should stay generic.
      const generated = /^(rect|roundrect|circle|ellipse|path|text|line|polygon|polyline|g|image|art)-[a-z0-9]+/i.test(existingId ?? '');
      const humanised = existingId && !generated ? humaniseId(existingId) : null;
      const label = child.getAttribute('data-name') || child.getAttribute('inkscape:label') || humanised || friendlyName(tag);
      layers.push({
        id,
        tag,
        label: String(label),
        index: layers.length,
        depth,
        hidden: child.getAttribute('display') === 'none' || (child as SVGElement).style.display === 'none',
        locked: child.getAttribute('data-locked') === '1',
      });
      if (tag === 'g') walk(child, depth + 1);
    });
  };
  walk(root, 0);
  return layers;
}

const ID_LABELS: Record<string, string> = {
  bg: 'Background',
  fg: 'Foreground',
  img: 'Image',
  txt: 'Text',
};

function humaniseId(id: string): string {
  const known = ID_LABELS[id.toLowerCase()];
  if (known) return known;
  const words = id.replace(/[_-]+/g, ' ').trim();
  if (!words) return id;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function friendlyName(tag: string): string {
  const map: Record<string, string> = {
    path: 'Path',
    rect: 'Rectangle',
    circle: 'Circle',
    ellipse: 'Ellipse',
    line: 'Line',
    polygon: 'Polygon',
    polyline: 'Polyline',
    text: 'Text',
    tspan: 'Text',
    g: 'Group',
    image: 'Image',
    use: 'Symbol',
  };
  return map[tag] ?? tag;
}

/* -------------------------------------------------------------------------- */
/*  Transform helpers                                                         */
/* -------------------------------------------------------------------------- */

export function translateElement(el: SVGElement, dx: number, dy: number): void {
  const existing = el.getAttribute('transform') ?? '';
  el.setAttribute('transform', `translate(${dx} ${dy}) ${existing}`.trim());
}

export function setFill(el: SVGElement, color: string): void {
  el.setAttribute('fill', color);
  if (color !== 'none') el.style.fill = '';
}

export function setStroke(el: SVGElement, color: string, width: number): void {
  if (!color || color === 'none' || width <= 0) {
    el.removeAttribute('stroke');
    el.removeAttribute('stroke-width');
    return;
  }
  el.setAttribute('stroke', color);
  el.setAttribute('stroke-width', String(width));
}

/* -------------------------------------------------------------------------- */
/*  SVG path → PostScript                                                     */
/* -------------------------------------------------------------------------- */

/** Absolute-ises the common commands; arcs fall back to a line to the endpoint. */
export function pathToPostScript(d: string): string {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const out: string[] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let command = '';
  let lastCtrlX = 0;
  let lastCtrlY = 0;

  const needs = (n: number) => i + n <= tokens.length;

  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) {
      command = tokens[i];
      i += 1;
    }
    const relative = command === command.toLowerCase();
    const cmd = command.toUpperCase();

    if (cmd === 'Z') {
      out.push('closepath');
      cx = startX;
      cy = startY;
      command = '';
      continue;
    }

    if (!needs(1)) break;

    if (cmd === 'M' || cmd === 'L') {
      if (!needs(2)) break;
      const x = Number(tokens[i]) + (relative ? cx : 0);
      const y = Number(tokens[i + 1]) + (relative ? cy : 0);
      i += 2;
      if (cmd === 'M') {
        out.push(`${fmt(x)} ${fmt(y)} moveto`);
        startX = x;
        startY = y;
        command = relative ? 'l' : 'L';
      } else {
        out.push(`${fmt(x)} ${fmt(y)} lineto`);
      }
      cx = x;
      cy = y;
      continue;
    }

    if (cmd === 'H') {
      const x = Number(tokens[i]) + (relative ? cx : 0);
      i += 1;
      out.push(`${fmt(x)} ${fmt(cy)} lineto`);
      cx = x;
      continue;
    }

    if (cmd === 'V') {
      const y = Number(tokens[i]) + (relative ? cy : 0);
      i += 1;
      out.push(`${fmt(cx)} ${fmt(y)} lineto`);
      cy = y;
      continue;
    }

    if (cmd === 'C') {
      if (!needs(6)) break;
      const x1 = Number(tokens[i]) + (relative ? cx : 0);
      const y1 = Number(tokens[i + 1]) + (relative ? cy : 0);
      const x2 = Number(tokens[i + 2]) + (relative ? cx : 0);
      const y2 = Number(tokens[i + 3]) + (relative ? cy : 0);
      const x = Number(tokens[i + 4]) + (relative ? cx : 0);
      const y = Number(tokens[i + 5]) + (relative ? cy : 0);
      i += 6;
      out.push(`${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)} ${fmt(x)} ${fmt(y)} curveto`);
      lastCtrlX = x2;
      lastCtrlY = y2;
      cx = x;
      cy = y;
      continue;
    }

    if (cmd === 'S') {
      if (!needs(4)) break;
      const x2 = Number(tokens[i]) + (relative ? cx : 0);
      const y2 = Number(tokens[i + 1]) + (relative ? cy : 0);
      const x = Number(tokens[i + 2]) + (relative ? cx : 0);
      const y = Number(tokens[i + 3]) + (relative ? cy : 0);
      i += 4;
      const x1 = 2 * cx - lastCtrlX;
      const y1 = 2 * cy - lastCtrlY;
      out.push(`${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)} ${fmt(x)} ${fmt(y)} curveto`);
      lastCtrlX = x2;
      lastCtrlY = y2;
      cx = x;
      cy = y;
      continue;
    }

    if (cmd === 'Q' || cmd === 'T') {
      let ctrlX: number;
      let ctrlY: number;
      let x: number;
      let y: number;
      if (cmd === 'Q') {
        if (!needs(4)) break;
        ctrlX = Number(tokens[i]) + (relative ? cx : 0);
        ctrlY = Number(tokens[i + 1]) + (relative ? cy : 0);
        x = Number(tokens[i + 2]) + (relative ? cx : 0);
        y = Number(tokens[i + 3]) + (relative ? cy : 0);
        i += 4;
      } else {
        if (!needs(2)) break;
        ctrlX = 2 * cx - lastCtrlX;
        ctrlY = 2 * cy - lastCtrlY;
        x = Number(tokens[i]) + (relative ? cx : 0);
        y = Number(tokens[i + 1]) + (relative ? cy : 0);
        i += 2;
      }
      // Quadratic → cubic.
      const c1x = cx + (2 / 3) * (ctrlX - cx);
      const c1y = cy + (2 / 3) * (ctrlY - cy);
      const c2x = x + (2 / 3) * (ctrlX - x);
      const c2y = y + (2 / 3) * (ctrlY - y);
      out.push(`${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(x)} ${fmt(y)} curveto`);
      lastCtrlX = ctrlX;
      lastCtrlY = ctrlY;
      cx = x;
      cy = y;
      continue;
    }

    if (cmd === 'A') {
      if (!needs(7)) break;
      const x = Number(tokens[i + 5]) + (relative ? cx : 0);
      const y = Number(tokens[i + 6]) + (relative ? cy : 0);
      i += 7;
      out.push(`${fmt(x)} ${fmt(y)} lineto`);
      cx = x;
      cy = y;
      continue;
    }

    // Unknown command: skip one token so we always make progress.
    i += 1;
  }

  return out.join('\n');
}

const fmt = (value: number) => (Number.isFinite(value) ? Number(value.toFixed(3)) : 0).toString();

/* -------------------------------------------------------------------------- */
/*  SVG → EPS (vector, not a raster wrapper)                                  */
/* -------------------------------------------------------------------------- */

export interface EpsExportResult {
  eps: string;
  skipped: string[];
}

interface Ctx {
  lines: string[];
  skipped: string[];
  width: number;
  height: number;
}

export function svgToEps(
  svg: SVGSVGElement,
  title = 'Micro Stocker Advanced Pro',
  kind: 'eps' | 'ai' = 'eps',
): EpsExportResult {
  const viewBox = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const width = Number(svg.getAttribute('width')) || (Number.isFinite(viewBox[2]) ? viewBox[2] : 1000);
  const height = Number(svg.getAttribute('height')) || (Number.isFinite(viewBox[3]) ? viewBox[3] : 1000);
  const ctx: Ctx = { lines: [], skipped: [], width, height };

  ctx.lines.push('%!PS-Adobe-3.0 EPSF-3.0');
  ctx.lines.push(`%%Creator: ${title}`);
  ctx.lines.push(`%%Title: ${title}`);
  ctx.lines.push(`%%For: ${kind === 'ai' ? 'Adobe Illustrator' : 'Micro Stocker Advanced Pro'}`);
  if (kind === 'ai') {
    // Illustrator opens EPS compatible .ai files, and this header keeps the
    // file recognisable to its own importer and to CorelDRAW and Affinity.
    ctx.lines.push('%%AI5_FileFormat: 3');
    ctx.lines.push('%%DocumentProcessColors: Cyan Magenta Yellow Black');
  }
  ctx.lines.push('%%LanguageLevel: 3');
  ctx.lines.push(`%%BoundingBox: 0 0 ${Math.ceil(width)} ${Math.ceil(height)}`);
  ctx.lines.push('%%DocumentData: Clean7Bit');
  ctx.lines.push('%%EndComments');
  ctx.lines.push('%%BeginProlog');
  ctx.lines.push('/m { moveto } bind def');
  ctx.lines.push('%%EndProlog');
  ctx.lines.push('gsave');
  // SVG's y axis points down; flip once so authored coordinates work unchanged.
  ctx.lines.push(`0 ${fmt(height)} translate 1 -1 scale`);

  for (const child of Array.from(svg.children)) {
    emit(child, ctx);
  }

  ctx.lines.push('grestore');
  ctx.lines.push('showpage');
  ctx.lines.push('%%EOF');
  return { eps: ctx.lines.join('\n') + '\n', skipped: ctx.skipped };
}

function emit(el: Element, ctx: Ctx): void {
  const tag = el.tagName.toLowerCase();
  if (['defs', 'metadata', 'title', 'desc', 'style', 'script', 'clipPath', 'mask', 'pattern'].includes(tag)) return;

  const opacity = Number(el.getAttribute('opacity') ?? '1');
  if (opacity === 0) return;

  ctx.lines.push('gsave');
  const transform = el.getAttribute('transform');
  if (transform) {
    const matrix = toMatrix(transform);
    if (matrix) ctx.lines.push(`[${matrix.map(fmt).join(' ')}] concat`);
  }

  if (tag === 'g' || tag === 'a' || tag === 'svg') {
    for (const child of Array.from(el.children)) emit(child, ctx);
    ctx.lines.push('grestore');
    return;
  }

  const fill = psColor(el.getAttribute('fill') ?? 'black');
  const stroke = psColor(el.getAttribute('stroke'));
  const strokeWidth = Number(el.getAttribute('stroke-width') ?? '1') || 1;
  const paint = () => {
    if (fill) ctx.lines.push(`${fill.map(fmt).join(' ')} setrgbcolor fill`);
    if (stroke) {
      ctx.lines.push('gsave');
      ctx.lines.push(`${stroke.map(fmt).join(' ')} setrgbcolor ${fmt(strokeWidth)} setlinewidth stroke`);
      ctx.lines.push('grestore');
    }
  };

  switch (tag) {
    case 'rect': {
      const x = Number(el.getAttribute('x') ?? 0);
      const y = Number(el.getAttribute('y') ?? 0);
      const w = Number(el.getAttribute('width') ?? 0);
      const h = Number(el.getAttribute('height') ?? 0);
      if (w <= 0 || h <= 0) break;
      ctx.lines.push('newpath');
      ctx.lines.push(`${fmt(x)} ${fmt(y)} moveto ${fmt(x + w)} ${fmt(y)} lineto ${fmt(x + w)} ${fmt(y + h)} lineto ${fmt(x)} ${fmt(y + h)} lineto closepath`);
      paint();
      break;
    }
    case 'circle':
    case 'ellipse': {
      const cx = Number(el.getAttribute('cx') ?? 0);
      const cy = Number(el.getAttribute('cy') ?? 0);
      const rx = tag === 'circle' ? Number(el.getAttribute('r') ?? 0) : Number(el.getAttribute('rx') ?? 0);
      const ry = tag === 'circle' ? rx : Number(el.getAttribute('ry') ?? 0);
      if (rx <= 0 || ry <= 0) break;
      const k = 0.5522847498;
      ctx.lines.push('newpath');
      ctx.lines.push(`${fmt(cx + rx)} ${fmt(cy)} moveto`);
      ctx.lines.push(`${fmt(cx + rx)} ${fmt(cy + ry * k)} ${fmt(cx + rx * k)} ${fmt(cy + ry)} ${fmt(cx)} ${fmt(cy + ry)} curveto`);
      ctx.lines.push(`${fmt(cx - rx * k)} ${fmt(cy + ry)} ${fmt(cx - rx)} ${fmt(cy + ry * k)} ${fmt(cx - rx)} ${fmt(cy)} curveto`);
      ctx.lines.push(`${fmt(cx - rx)} ${fmt(cy - ry * k)} ${fmt(cx - rx * k)} ${fmt(cy - ry)} ${fmt(cx)} ${fmt(cy - ry)} curveto`);
      ctx.lines.push(`${fmt(cx + rx * k)} ${fmt(cy - ry)} ${fmt(cx + rx)} ${fmt(cy - ry * k)} ${fmt(cx + rx)} ${fmt(cy)} curveto`);
      ctx.lines.push('closepath');
      paint();
      break;
    }
    case 'line': {
      const x1 = Number(el.getAttribute('x1') ?? 0);
      const y1 = Number(el.getAttribute('y1') ?? 0);
      const x2 = Number(el.getAttribute('x2') ?? 0);
      const y2 = Number(el.getAttribute('y2') ?? 0);
      ctx.lines.push('newpath');
      ctx.lines.push(`${fmt(x1)} ${fmt(y1)} moveto ${fmt(x2)} ${fmt(y2)} lineto`);
      if (stroke) {
        ctx.lines.push(`${stroke.map(fmt).join(' ')} setrgbcolor ${fmt(strokeWidth)} setlinewidth stroke`);
      }
      break;
    }
    case 'polygon':
    case 'polyline': {
      const points = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number);
      if (points.length < 4) break;
      ctx.lines.push('newpath');
      ctx.lines.push(`${fmt(points[0])} ${fmt(points[1])} moveto`);
      for (let i = 2; i + 1 < points.length; i += 2) ctx.lines.push(`${fmt(points[i])} ${fmt(points[i + 1])} lineto`);
      if (tag === 'polygon') ctx.lines.push('closepath');
      paint();
      break;
    }
    case 'path': {
      const d = el.getAttribute('d');
      if (!d) break;
      const script = pathToPostScript(d);
      if (!script.trim()) break;
      ctx.lines.push('newpath');
      ctx.lines.push(script);
      paint();
      break;
    }
    case 'image':
      ctx.skipped.push('embedded raster image');
      break;
    case 'text':
    case 'tspan':
      ctx.skipped.push('live text (convert to outlines to export)');
      break;
    default:
      ctx.skipped.push(tag);
  }

  ctx.lines.push('grestore');
}

/** `translate(x y) rotate(deg) scale(s)` → SVG matrix components. */
export function toMatrix(transform: string): [number, number, number, number, number, number] | null {
  let m: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];
  let found = false;
  const mul = (a: [number, number, number, number, number, number]) => {
    const [a1, b1, c1, d1, e1, f1] = m;
    const [a2, b2, c2, d2, e2, f2] = a;
    m = [
      a1 * a2 + c1 * b2,
      b1 * a2 + d1 * b2,
      a1 * c2 + c1 * d2,
      b1 * c2 + d1 * d2,
      a1 * e2 + c1 * f2 + e1,
      b1 * e2 + d1 * f2 + f1,
    ];
    found = true;
  };
  for (const match of transform.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const args = match[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const name = match[1];
    if (name === 'translate') mul([1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0]);
    else if (name === 'scale') mul([args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0]);
    else if (name === 'rotate') {
      const rad = ((args[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      if (args.length >= 3) {
        mul([1, 0, 0, 1, args[1], args[2]]);
        mul([cos, sin, -sin, cos, 0, 0]);
        mul([1, 0, 0, 1, -args[1], -args[2]]);
      } else {
        mul([cos, sin, -sin, cos, 0, 0]);
      }
    } else if (name === 'matrix' && args.length >= 6) {
      mul([args[0], args[1], args[2], args[3], args[4], args[5]]);
    } else if (name === 'skewX') {
      mul([1, 0, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 1, 0, 0]);
    } else if (name === 'skewY') {
      mul([1, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]);
    }
  }
  return found ? m : null;
}

/* -------------------------------------------------------------------------- */
/*  Serialisation                                                             */
/* -------------------------------------------------------------------------- */

export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', SVG_NS);
  // Strip our own selection/hover decorations.
  clone.querySelectorAll('[data-selected], [data-hover]').forEach((node) => {
    node.removeAttribute('data-selected');
    node.removeAttribute('data-hover');
  });
  return new XMLSerializer().serializeToString(clone);
}

/** Converts an SVG string to a PNG blob at a chosen scale using canvas. */
export async function svgToPngBlob(svgText: string, width: number, height: number, scale = 2): Promise<Blob> {
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not rasterise the artwork.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG encoding failed.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* -------------------------------------------------------------------------- */
/*  Editing primitives (v2)                                                   */
/* -------------------------------------------------------------------------- */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function matrixOfTransform(transform: string | null): Matrix {
  if (!transform) return IDENTITY;
  return toMatrix(transform) ?? IDENTITY;
}

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function applyMatrix(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Bounding box of an element in its parent's coordinate space. */
export function boxInParent(el: SVGElement): Box {
  const b = (el as SVGGraphicsElement).getBBox();
  const m = matrixOfTransform(el.getAttribute('transform'));
  const corners = [
    applyMatrix(m, b.x, b.y),
    applyMatrix(m, b.x + b.width, b.y),
    applyMatrix(m, b.x + b.width, b.y + b.height),
    applyMatrix(m, b.x, b.y + b.height),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * Bounding box in document coordinates (the SVG viewBox space), which is what
 * alignment, snapping and the rulers work in.
 */
export function boxInDocument(el: SVGElement, root: SVGSVGElement): Box {
  const box = boxInParent(el);
  const chain: Matrix[] = [];
  let node: Element | null = el.parentNode as Element | null;
  while (node && node !== root) {
    if (node instanceof SVGElement) chain.push(matrixOfTransform(node.getAttribute('transform')));
    node = node.parentNode as Element | null;
  }
  let m: Matrix = IDENTITY;
  for (let i = chain.length - 1; i >= 0; i -= 1) m = multiply(m, chain[i]!);
  const corners = [
    applyMatrix(m, box.x, box.y),
    applyMatrix(m, box.x + box.w, box.y),
    applyMatrix(m, box.x + box.w, box.y + box.h),
    applyMatrix(m, box.x, box.y + box.h),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: right - x, h: bottom - y };
}

/** Wraps a transform so it applies *before* whatever is already on the node. */
function prependTransform(el: SVGElement, value: string): void {
  const existing = el.getAttribute('transform') ?? '';
  el.setAttribute('transform', `${value} ${existing}`.trim());
}

/** Scale about a point given in the element's parent space. */
export function scaleElement(el: SVGElement, sx: number, sy: number, cx: number, cy: number): void {
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx === 0 || sy === 0) return;
  prependTransform(
    el,
    `translate(${round(cx)} ${round(cy)}) scale(${round(sx, 4)} ${round(sy, 4)}) translate(${round(-cx)} ${round(-cy)})`,
  );
}

/** Rotate about a point given in the element's parent space. */
export function rotateElement(el: SVGElement, deg: number, cx: number, cy: number): void {
  prependTransform(el, `rotate(${round(deg, 3)} ${round(cx)} ${round(cy)})`);
}

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Current rotation in degrees, as far as the transform attribute reveals. */
export function rotationOf(el: SVGElement): number {
  const m = matrixOfTransform(el.getAttribute('transform'));
  const deg = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
  const snapped = Math.round(deg * 10) / 10;
  return Math.abs(snapped) < 0.05 ? 0 : snapped;
}

export function setRotation(el: SVGElement, deg: number, cx: number, cy: number): void {
  const current = rotationOf(el);
  const delta = deg - current;
  if (Math.abs(delta) < 0.01) return;
  rotateElement(el, delta, cx, cy);
}

export function setOpacity(el: SVGElement, opacity: number): void {
  const value = Math.max(0, Math.min(1, opacity));
  if (value >= 0.999) el.removeAttribute('opacity');
  else el.setAttribute('opacity', String(round(value, 3)));
}

export function opacityOf(el: SVGElement): number {
  const value = Number(el.getAttribute('opacity') ?? '1');
  return Number.isFinite(value) ? value : 1;
}

/** Applies fill/stroke to an element *and* everything inside it. */
export function paintElement(el: SVGElement, kind: 'fill' | 'stroke', color: string, width?: number): void {
  const targets: SVGElement[] = [el, ...Array.from(el.querySelectorAll<SVGElement>('path, rect, circle, ellipse, polygon, polyline, line, text, g'))];
  targets.forEach((node) => {
    if (kind === 'fill') {
      // Outline-only artwork must not be flood-filled.
      if (node.getAttribute('fill') === 'none') return;
      node.setAttribute('fill', color);
      node.style.removeProperty('fill');
    } else {
      if (color === 'none' || !color) {
        node.removeAttribute('stroke');
        node.removeAttribute('stroke-width');
        return;
      }
      node.setAttribute('stroke', color);
      node.setAttribute('stroke-width', String(width ?? 2));
    }
  });
}

export function fillOf(el: SVGElement): string {
  const own = el.getAttribute('fill') ?? el.style.fill;
  if (own) return own;
  const child = el.querySelector<SVGElement>('path, rect, circle, ellipse, polygon, polyline');
  return child?.getAttribute('fill') ?? '#16181c';
}

export function strokeOf(el: SVGElement): { color: string; width: number } {
  const child = el.querySelector<SVGElement>('path, rect, circle, ellipse, polygon, polyline');
  const host = el.getAttribute('stroke') || el.getAttribute('fill') === 'none' ? el : (child ?? el);
  return {
    color: host.getAttribute('stroke') ?? 'none',
    width: Number(host.getAttribute('stroke-width') ?? '0') || 0,
  };
}

/* -------------------------------------------------------------------------- */
/*  Arrangement, grouping, alignment                                          */
/* -------------------------------------------------------------------------- */

export function moveElement(el: SVGElement, delta: 'front' | 'back' | 'up' | 'down'): void {
  const parent = el.parentNode as Element | null;
  if (!parent) return;
  if (delta === 'front') parent.appendChild(el);
  else if (delta === 'back') parent.insertBefore(el, parent.firstChild);
  else if (delta === 'up') {
    const next = el.nextElementSibling;
    if (next) parent.insertBefore(next, el);
  } else {
    const prev = el.previousElementSibling;
    if (prev) parent.insertBefore(el, prev);
  }
}

export function groupElements(elements: SVGElement[]): SVGGElement | null {
  const parent = elements[0]?.parentNode as Element | null;
  if (!parent || elements.length < 2) return null;
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('id', nextShapeId('group'));
  group.setAttribute('data-name', 'Group');
  const anchor = elements[0]!;
  parent.insertBefore(group, anchor);
  elements.forEach((el) => {
    if (el.parentNode === parent) group.appendChild(el);
  });
  return group;
}

export function ungroupElement(group: SVGElement): SVGElement[] {
  const parent = group.parentNode as Element | null;
  if (!parent) return [];
  const children = Array.from(group.children).filter((child): child is SVGElement => child instanceof SVGElement);
  children.forEach((child) => parent.insertBefore(child, group));
  group.remove();
  return children;
}

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export function alignElements(root: SVGSVGElement, elements: SVGElement[], mode: AlignMode, frame: Box): void {
  elements.forEach((el) => {
    const box = boxInDocument(el, root);
    let dx = 0;
    let dy = 0;
    if (mode === 'left') dx = frame.x - box.x;
    if (mode === 'center') dx = frame.x + frame.w / 2 - (box.x + box.w / 2);
    if (mode === 'right') dx = frame.x + frame.w - (box.x + box.w);
    if (mode === 'top') dy = frame.y - box.y;
    if (mode === 'middle') dy = frame.y + frame.h / 2 - (box.y + box.h / 2);
    if (mode === 'bottom') dy = frame.y + frame.h - (box.y + box.h);
    const scale = parentScale(el);
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) translateElement(el, round(dx / scale, 3), round(dy / scale, 3));
  });
}

/** Total scale factor of an element's ancestor chain, for screen↔local maths. */
function parentScale(el: SVGElement): number {
  let scale = 1;
  let node: Element | null = el.parentNode as Element | null;
  while (node && node.tagName.toLowerCase() !== 'svg') {
    if (node instanceof SVGElement) {
      const m = matrixOfTransform(node.getAttribute('transform'));
      scale *= Math.hypot(m[0], m[1]) || 1;
    }
    node = node.parentNode as Element | null;
  }
  return scale || 1;
}

export function distributeElements(root: SVGSVGElement, elements: SVGElement[], axis: 'x' | 'y'): void {
  if (elements.length < 3) return;
  const boxes = elements.map((el) => ({ el, box: boxInDocument(el, root) }));
  boxes.sort((a, b) => (axis === 'x' ? a.box.x - b.box.x : a.box.y - b.box.y));
  const first = boxes[0]!.box;
  const last = boxes[boxes.length - 1]!.box;
  const span = axis === 'x' ? last.x + last.w - first.x : last.y + last.h - first.y;
  const total = boxes.reduce((sum, item) => sum + (axis === 'x' ? item.box.w : item.box.h), 0);
  const gap = (span - total) / (boxes.length - 1);
  let cursor = axis === 'x' ? first.x : first.y;
  boxes.forEach((item) => {
    const current = axis === 'x' ? item.box.x : item.box.y;
    const delta = cursor - current;
    const scale = parentScale(item.el);
    if (Math.abs(delta) > 0.01) {
      translateElement(item.el, axis === 'x' ? round(delta / scale, 3) : 0, axis === 'y' ? round(delta / scale, 3) : 0);
    }
    cursor += (axis === 'x' ? item.box.w : item.box.h) + gap;
  });
}

export function cloneElement(el: SVGElement, offset = 0): SVGElement {
  const clone = el.cloneNode(true) as SVGElement;
  clone.setAttribute('id', nextShapeId('copy'));
  if (offset) translateElement(clone, offset, offset);
  return clone;
}

/* -------------------------------------------------------------------------- */
/*  Element library + import insertion                                        */
/* -------------------------------------------------------------------------- */

const SVG_TAGS = new Set([
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'polygon',
  'polyline',
  'line',
  'text',
  'tspan',
  'defs',
  'clipPath',
  'use',
]);

/**
 * Inserts library artwork (or the contents of an imported SVG) as one editable
 * group, scaled into `frame`. Unknown/unsafe nodes are dropped rather than
 * copied, so a malicious SVG cannot smuggle script into the studio.
 */
export function insertArtwork(
  root: SVGSVGElement,
  markup: string,
  options: {
    frame: Box;
    viewBox?: { w: number; h: number };
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    outline?: boolean;
    name?: string;
  },
): SVGGElement | null {
  const { frame, viewBox = { w: 100, h: 100 } } = options;
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="${SVG_NS}" viewBox="0 0 ${viewBox.w} ${viewBox.h}">${markup}</svg>`,
    'image/svg+xml',
  );
  if (doc.querySelector('parsererror')) return null;

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('id', nextShapeId('art'));
  group.setAttribute('data-name', options.name ?? 'Artwork');

  const sx = frame.w / viewBox.w;
  const sy = frame.h / viewBox.h;
  const s = Math.min(sx, sy);
  const tx = frame.x + (frame.w - viewBox.w * s) / 2;
  const ty = frame.y + (frame.h - viewBox.h * s) / 2;
  group.setAttribute('transform', `translate(${round(tx, 3)} ${round(ty, 3)}) scale(${round(s, 5)})`);

  const copy = (source: Element, target: Element) => {
    Array.from(source.children).forEach((child) => {
      const tag = child.tagName.toLowerCase();
      if (tag === 'defs' || tag === 'metadata' || tag === 'style' || tag === 'script' || tag === 'title' || tag === 'desc') return;
      if (!SVG_TAGS.has(tag)) return;
      const clone = document.createElementNS(SVG_NS, tag);
      Array.from(child.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) return;
        if (name === 'href' || name === 'xlink:href') return;
        if (name === 'style' && /url\s*\(/i.test(attr.value)) return;
        clone.setAttribute(attr.name, attr.value);
      });
      if (tag === 'text' || tag === 'tspan') clone.textContent = child.textContent;
      if (!clone.getAttribute('fill') && tag !== 'g' && tag !== 'defs') {
        clone.setAttribute('fill', options.outline ? 'none' : (options.fill ?? '#16181c'));
      }
      if (options.outline) {
        if (!clone.getAttribute('stroke')) clone.setAttribute('stroke', options.stroke ?? options.fill ?? '#16181c');
        if (!clone.getAttribute('stroke-width')) clone.setAttribute('stroke-width', String(options.strokeWidth ?? 2));
      }
      copy(child, clone);
      target.appendChild(clone);
    });
  };
  copy(doc.documentElement, group);
  if (!group.childNodes.length) return null;
  root.appendChild(group);
  return group;
}

/** Turns a parsed SVG file into a group that fits the current document. */
export function importDocumentInto(
  root: SVGSVGElement,
  source: SVGSVGElement,
  frame: Box,
): SVGGElement | null {
  const box = (source.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const w = Number.isFinite(box[2]) && box[2] > 0 ? box[2]! : Number(source.getAttribute('width')) || 100;
  const h = Number.isFinite(box[3]) && box[3] > 0 ? box[3]! : Number(source.getAttribute('height')) || 100;
  const inner = new XMLSerializer().serializeToString(source)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');
  return insertArtwork(root, inner, { frame, viewBox: { w, h }, name: 'Imported SVG' });
}

/** Reads the viewBox of a document as `{w, h}`, falling back to its width/height. */
export function documentSize(svg: SVGSVGElement): { w: number; h: number } {
  const box = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  if (Number.isFinite(box[2]) && Number.isFinite(box[3]) && box[2]! > 0 && box[3]! > 0) {
    return { w: box[2]!, h: box[3]! };
  }
  return {
    w: Number(svg.getAttribute('width')) || 2000,
    h: Number(svg.getAttribute('height')) || 2000,
  };
}
