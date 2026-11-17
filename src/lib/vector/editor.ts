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
      if (!child.getAttribute('id')) {
        child.setAttribute('id', nextShapeId(tag));
      }
      const id = child.getAttribute('id')!;
      const label = child.getAttribute('data-name') || child.getAttribute('inkscape:label') || friendlyName(tag);
      layers.push({ id, tag, label: String(label), index: layers.length, depth });
      if (tag === 'g') walk(child, depth + 1);
    });
  };
  walk(root, 0);
  return layers;
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

export function svgToEps(svg: SVGSVGElement, title = 'Micro Stocker Advanced Pro'): EpsExportResult {
  const viewBox = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const width = Number(svg.getAttribute('width')) || (Number.isFinite(viewBox[2]) ? viewBox[2] : 1000);
  const height = Number(svg.getAttribute('height')) || (Number.isFinite(viewBox[3]) ? viewBox[3] : 1000);
  const ctx: Ctx = { lines: [], skipped: [], width, height };

  ctx.lines.push('%!PS-Adobe-3.0 EPSF-3.0');
  ctx.lines.push(`%%Creator: ${title}`);
  ctx.lines.push(`%%Title: ${title}`);
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
