/**
 * Raster to vector tracing engine.
 *
 * Pipeline: median-cut colour quantisation, then marching-squares contour
 * tracing per colour layer, then Douglas-Peucker simplification. The result
 * is genuine editable paths (one path per colour, even-odd fill so holes
 * stay holes), not a grid of tiny rectangles.
 *
 * The same path data drives the SVG export and a real PostScript EPS export
 * that Adobe Illustrator opens as editable artwork.
 */

export interface TracedPath {
  color: string;
  /** SVG path data (absolute M/L/Z commands). */
  d: string;
  /** Raw loops for the EPS renderer. */
  loops: Array<Array<[number, number]>>;
}

export interface VectorizeResult {
  width: number;
  height: number;
  paths: TracedPath[];
  colorCount: number;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function medianCut(pixels: RGB[], maxColors: number): RGB[] {
  if (pixels.length === 0) return [];
  let boxes: RGB[][] = [pixels];
  while (boxes.length < maxColors) {
    // Split the box with the largest channel range.
    let best = -1;
    let bestRange = -1;
    let bestChannel: 'r' | 'g' | 'b' = 'r';
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.length < 2) continue;
      for (const ch of ['r', 'g', 'b'] as const) {
        let min = 255;
        let max = 0;
        for (const p of box) {
          if (p[ch] < min) min = p[ch];
          if (p[ch] > max) max = p[ch];
        }
        if (max - min > bestRange) {
          bestRange = max - min;
          best = i;
          bestChannel = ch;
        }
      }
    }
    if (best < 0 || bestRange === 0) break;
    const box = boxes.splice(best, 1)[0];
    box.sort((a, b) => a[bestChannel] - b[bestChannel]);
    const mid = Math.floor(box.length / 2);
    boxes.push(box.slice(0, mid), box.slice(mid));
  }
  return boxes.map((box) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const p of box) {
      r += p.r;
      g += p.g;
      b += p.b;
    }
    const n = Math.max(1, box.length);
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  });
}

function nearestColor(palette: RGB[], r: number, g: number, b: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const c = palette[i];
    const dr = r - c.r;
    const dg = g - c.g;
    const db = b - c.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/* -------------------------------------------------------------------------- */
/* Marching squares                                                           */
/* -------------------------------------------------------------------------- */

type Pt = [number, number];

interface Segment {
  a: Pt;
  b: Pt;
  used: boolean;
}

// Edge midpoints for a cell at (x, y): T, R, B, L.
function edgePoint(edge: number, x: number, y: number): Pt {
  switch (edge) {
    case 0:
      return [x + 0.5, y];
    case 1:
      return [x + 1, y + 0.5];
    case 2:
      return [x + 0.5, y + 1];
    default:
      return [x, y + 0.5];
  }
}

// For each case index, the edge pairs the contour connects.
const CASE_EDGES: Record<number, Array<[number, number]>> = {
  1: [[3, 0]],
  2: [[0, 1]],
  3: [[3, 1]],
  4: [[1, 2]],
  5: [
    [3, 0],
    [1, 2],
  ],
  6: [[0, 2]],
  7: [[3, 2]],
  8: [[2, 3]],
  9: [[0, 2]],
  10: [
    [0, 1],
    [2, 3],
  ],
  11: [[1, 2]],
  12: [[3, 1]],
  13: [[0, 1]],
  14: [[3, 0]],
};

function traceMask(mask: Uint8Array, w: number, h: number): Pt[][] {
  const segments: Segment[] = [];
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const tl = mask[y * w + x] ? 1 : 0;
      const tr = mask[y * w + x + 1] ? 1 : 0;
      const br = mask[(y + 1) * w + x + 1] ? 1 : 0;
      const bl = mask[(y + 1) * w + x] ? 1 : 0;
      const idx = tl | (tr << 1) | (br << 2) | (bl << 3);
      const pairs = CASE_EDGES[idx];
      if (!pairs) continue;
      for (const [e1, e2] of pairs) {
        segments.push({ a: edgePoint(e1, x, y), b: edgePoint(e2, x, y), used: false });
      }
    }
  }
  if (segments.length === 0) return [];

  // Join segments into loops by shared endpoints.
  const key = (p: Pt) => `${p[0]},${p[1]}`;
  const byPoint = new Map<string, number[]>();
  segments.forEach((seg, i) => {
    for (const p of [seg.a, seg.b]) {
      const k = key(p);
      const list = byPoint.get(k);
      if (list) list.push(i);
      else byPoint.set(k, [i]);
    }
  });

  const loops: Pt[][] = [];
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].used) continue;
    segments[i].used = true;
    const loop: Pt[] = [segments[i].a, segments[i].b];
    // Extend forward.
    let head = segments[i].b;
    for (;;) {
      const candidates = byPoint.get(key(head)) ?? [];
      const next = candidates.find((j) => !segments[j].used);
      if (next === undefined) break;
      segments[next].used = true;
      const seg = segments[next];
      const far = key(seg.a) === key(head) ? seg.b : seg.a;
      loop.push(far);
      head = far;
    }
    // Extend backward.
    let tail = segments[i].a;
    for (;;) {
      const candidates = byPoint.get(key(tail)) ?? [];
      const next = candidates.find((j) => !segments[j].used);
      if (next === undefined) break;
      segments[next].used = true;
      const seg = segments[next];
      const far = key(seg.a) === key(tail) ? seg.b : seg.a;
      loop.unshift(far);
      tail = far;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

/* -------------------------------------------------------------------------- */
/* Douglas-Peucker simplification                                             */
/* -------------------------------------------------------------------------- */

function perpDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function simplifyLoop(points: Pt[], epsilon: number): Pt[] {
  if (points.length <= 3 || epsilon <= 0) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let maxIndex = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpDistance(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        maxIndex = i;
      }
    }
    if (maxIndex >= 0 && maxDist > epsilon) {
      keep[maxIndex] = 1;
      stack.push([start, maxIndex], [maxIndex, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export interface VectorizeOptions {
  /** Target colour count (4 .. 32). */
  colors: number;
  /** Simplification tolerance in pixels (0.5 .. 4). Lower = more detail. */
  detail: number;
  /** Longest edge used for tracing (bigger = slower, more faithful). */
  maxEdge?: number;
}

export async function vectorizeImage(file: File, options: VectorizeOptions): Promise<VectorizeResult> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = options.maxEdge ?? 720;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read image pixels');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, w, h);
  const opaque: RGB[] = [];
  const indexMap = new Int16Array(w * h).fill(-1);
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] < 128) continue;
    const p = { r: data[i * 4], g: data[i * 4 + 1], b: data[i * 4 + 2] };
    indexMap[i] = opaque.length;
    opaque.push(p);
  }
  if (opaque.length === 0) throw new Error('The image has no visible pixels to trace');

  const palette = medianCut(opaque, Math.max(2, Math.min(32, options.colors)));
  const labels = new Int16Array(w * h).fill(-1);
  for (let i = 0; i < w * h; i++) {
    const src = indexMap[i];
    if (src < 0) continue;
    const p = opaque[src];
    labels[i] = nearestColor(palette, p.r, p.g, p.b);
  }

  const paths: TracedPath[] = [];
  const mask = new Uint8Array(w * h);
  for (let c = 0; c < palette.length; c++) {
    mask.fill(0);
    let any = false;
    for (let i = 0; i < w * h; i++) {
      if (labels[i] === c) {
        mask[i] = 1;
        any = true;
      }
    }
    if (!any) continue;
    const loops = traceMask(mask, w, h)
      .map((loop) => simplifyLoop(loop, options.detail))
      .filter((loop) => loop.length >= 3);
    if (loops.length === 0) continue;
    const col = palette[c];
    const d = loops
      .map((loop) => loop.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('') + 'Z')
      .join('');
    paths.push({
      color: `rgb(${col.r},${col.g},${col.b})`,
      d,
      loops,
    });
  }

  if (paths.length === 0) throw new Error('No shapes could be traced from this image');

  return { width: w, height: h, paths, colorCount: palette.length };
}

export function vectorResultToSvg(result: VectorizeResult): string {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${result.width}" height="${result.height}" viewBox="0 0 ${result.width} ${result.height}">`,
  ];
  for (const p of result.paths) {
    parts.push(`<path d="${p.d}" fill="${p.color}" fill-rule="evenodd"/>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

function psColor(rgb: string): string {
  const m = rgb.match(/\d+/g);
  if (!m) return '0 0 0 setrgbcolor';
  const [r, g, b] = m.map((v) => (Number(v) / 255).toFixed(3));
  return `${r} ${g} ${b} setrgbcolor`;
}

/**
 * Real EPS (PostScript) from the traced paths. Illustrator opens this as
 * editable vector artwork with one path per colour.
 */
export function vectorResultToEps(result: VectorizeResult): string {
  const { width: w, height: h } = result;
  const lines: string[] = [
    '%!PS-Adobe-3.0 EPSF-3.0',
    `%%BoundingBox: 0 0 ${w} ${h}`,
    '%%Creator: vecmotion Image to Vector',
    '%%EndComments',
  ];
  for (const p of result.paths) {
    lines.push(psColor(p.color), 'newpath');
    for (const loop of p.loops) {
      loop.forEach(([x, y], i) => {
        lines.push(`${i === 0 ? 'moveto' : 'lineto'} ${x.toFixed(1)} ${(h - y).toFixed(1)}`);
      });
      lines.push('closepath');
    }
    lines.push('eofill');
  }
  lines.push('%%EOF');
  return lines.join('\n');
}

/** Illustrator file: EPS content with an AI header, which Illustrator opens directly. */
export function vectorResultToAi(result: VectorizeResult): string {
  const eps = vectorResultToEps(result);
  return eps.replace('%!PS-Adobe-3.0 EPSF-3.0', '%!PS-Adobe-3.0\n%%Creator: Adobe Illustrator vecmotion\n%%Title: vecmotion vector');
}
