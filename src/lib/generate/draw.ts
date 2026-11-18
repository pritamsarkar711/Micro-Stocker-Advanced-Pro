/**
 * Vector primitives and motif builders.
 *
 * Everything here is pure geometry on a 1000 x 1000 design plane: no raster
 * images, no filters, no live fonts and no random anchor soup. Motifs are built
 * from parametric primitives (arcs, superellipses, isometric projections) so a
 * generated file has clean curves, consistent stroke weights and mirror-symmetric
 * detail instead of the wobbly paths a language model produces when asked to
 * "write some SVG".
 */

import type { Palette } from './palettes';

export interface Node {
  id: string;
  name: string;
  /** Path data using only M, L, C, Z. */
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  /** Round or butt line caps for stroke-only styles. */
  cap?: 'round' | 'butt';
}

export interface DrawContext {
  palette: Palette;
  rand: () => number;
  /** 0 = icon, 1 = simple, 2 = standard, 3 = detailed. */
  detail: 0 | 1 | 2 | 3;
  /** Style hint used by motif builders that look different in outline mode. */
  outline: boolean;
  /** Season tag for holiday motifs. */
  season?: string;
}

const n = (value: number) => Math.round(value * 100) / 100;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------- primitives */

export function circle(cx: number, cy: number, r: number): string {
  const k = 0.5522847498 * r;
  return [
    `M${n(cx - r)} ${n(cy)}`,
    `C${n(cx - r)} ${n(cy - k)} ${n(cx - k)} ${n(cy - r)} ${n(cx)} ${n(cy - r)}`,
    `C${n(cx + k)} ${n(cy - r)} ${n(cx + r)} ${n(cy - k)} ${n(cx + r)} ${n(cy)}`,
    `C${n(cx + r)} ${n(cy + k)} ${n(cx + k)} ${n(cy + r)} ${n(cx)} ${n(cy + r)}`,
    `C${n(cx - k)} ${n(cy + r)} ${n(cx - r)} ${n(cy + k)} ${n(cx - r)} ${n(cy)}`,
    'Z',
  ].join('');
}

export function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  const kx = 0.5522847498 * rx;
  const ky = 0.5522847498 * ry;
  return [
    `M${n(cx - rx)} ${n(cy)}`,
    `C${n(cx - rx)} ${n(cy - ky)} ${n(cx - kx)} ${n(cy - ry)} ${n(cx)} ${n(cy - ry)}`,
    `C${n(cx + kx)} ${n(cy - ry)} ${n(cx + rx)} ${n(cy - ky)} ${n(cx + rx)} ${n(cy)}`,
    `C${n(cx + rx)} ${n(cy + ky)} ${n(cx + kx)} ${n(cy + ry)} ${n(cx)} ${n(cy + ry)}`,
    `C${n(cx - kx)} ${n(cy + ry)} ${n(cx - rx)} ${n(cy + ky)} ${n(cx - rx)} ${n(cy)}`,
    'Z',
  ].join('');
}

export function rect(x: number, y: number, w: number, h: number): string {
  return `M${n(x)} ${n(y)}L${n(x + w)} ${n(y)}L${n(x + w)} ${n(y + h)}L${n(x)} ${n(y + h)}Z`;
}

export function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  const k = 0.5522847498 * radius;
  const x2 = x + w;
  const y2 = y + h;
  return [
    `M${n(x + radius)} ${n(y)}`,
    `L${n(x2 - radius)} ${n(y)}`,
    `C${n(x2 - radius + k)} ${n(y)} ${n(x2)} ${n(y + radius - k)} ${n(x2)} ${n(y + radius)}`,
    `L${n(x2)} ${n(y2 - radius)}`,
    `C${n(x2)} ${n(y2 - radius + k)} ${n(x2 - radius + k)} ${n(y2)} ${n(x2 - radius)} ${n(y2)}`,
    `L${n(x + radius)} ${n(y2)}`,
    `C${n(x + radius - k)} ${n(y2)} ${n(x)} ${n(y2 - radius + k)} ${n(x)} ${n(y2 - radius)}`,
    `L${n(x)} ${n(y + radius)}`,
    `C${n(x)} ${n(y + radius - k)} ${n(x + radius - k)} ${n(y)} ${n(x + radius)} ${n(y)}`,
    'Z',
  ].join('');
}

export function polygon(points: number[][]): string {
  if (!points.length) return '';
  return `${points.map(([x, y], index) => `${index ? 'L' : 'M'}${n(x)} ${n(y)}`).join('')}Z`;
}

export function linePath(points: number[][]): string {
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${n(x)} ${n(y)}`).join('');
}

/** Circular arc as cubic beziers, angles in degrees, 0 = east, clockwise. */
export function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const sweep = to - from;
  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / 90));
  const step = (sweep * Math.PI) / 180 / steps;
  const k = (4 / 3) * Math.tan(step / 4);
  let angle = (from * Math.PI) / 180;
  let x = cx + r * Math.cos(angle);
  let y = cy + r * Math.sin(angle);
  const parts = [`M${n(x)} ${n(y)}`];
  for (let i = 0; i < steps; i += 1) {
    const next = angle + step;
    const nx = cx + r * Math.cos(next);
    const ny = cy + r * Math.sin(next);
    parts.push(
      `C${n(x - k * r * Math.sin(angle))} ${n(y + k * r * Math.cos(angle))} ${n(nx + k * r * Math.sin(next))} ${n(ny - k * r * Math.cos(next))} ${n(nx)} ${n(ny)}`,
    );
    angle = next;
    x = nx;
    y = ny;
  }
  return parts.join('');
}

/** Exact regular star, alternating outer and inner radius. */
export function star(cx: number, cy: number, points: number, outer: number, inner: number, rotation = -90): string {
  const coords: number[][] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = ((rotation + (i * 180) / points) * Math.PI) / 180;
    coords.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return polygon(coords);
}

/** Symmetric leaf/lens shape pointing at `angle` degrees. */
export function leaf(x: number, y: number, length: number, width: number, angle: number): string {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const px = -dy;
  const py = dx;
  const tipX = x + dx * length;
  const tipY = y + dy * length;
  const bulge = width / 2;
  return [
    `M${n(x)} ${n(y)}`,
    `C${n(x + dx * length * 0.25 + px * bulge)} ${n(y + dy * length * 0.25 + py * bulge)} ${n(x + dx * length * 0.75 + px * bulge)} ${n(y + dy * length * 0.75 + py * bulge)} ${n(tipX)} ${n(tipY)}`,
    `C${n(x + dx * length * 0.75 - px * bulge)} ${n(y + dy * length * 0.75 - py * bulge)} ${n(x + dx * length * 0.25 - px * bulge)} ${n(y + dy * length * 0.25 - py * bulge)} ${n(x)} ${n(y)}`,
    'Z',
  ].join('');
}

/** Closed smooth wave across a width, used for water, hills and ribbons. */
export function wave(x: number, y: number, width: number, amplitude: number, periods: number, baseline: number): string {
  const segment = width / periods;
  const parts = [`M${n(x)} ${n(y)}`];
  for (let i = 0; i < periods; i += 1) {
    const x0 = x + segment * i;
    parts.push(
      `C${n(x0 + segment * 0.35)} ${n(y - amplitude)} ${n(x0 + segment * 0.65)} ${n(y + amplitude)} ${n(x0 + segment)} ${n(y)}`,
    );
  }
  parts.push(`L${n(x + width)} ${n(y + baseline)}L${n(x)} ${n(y + baseline)}Z`);
  return parts.join('');
}

/* ------------------------------------------------------------------ motifs */

export interface MotifResult {
  nodes: Omit<Node, 'id'>[];
  /** Names used by the metadata writer. */
  subject: string;
  scene: string;
  tags: string[];
}

const P = (ctx: DrawContext, index: number) => ctx.palette.colours[index % ctx.palette.colours.length].hex;

function sunWithHalo(ctx: DrawContext, cx: number, cy: number, r: number): Omit<Node, 'id'>[] {
  const nodes: Omit<Node, 'id'>[] = [];
  if (ctx.detail >= 1 && !ctx.outline) {
    nodes.push({ name: 'Sun halo', d: circle(cx, cy, r * 1.55), fill: P(ctx, 3), opacity: 0.5 });
  }
  nodes.push({ name: 'Sun', d: circle(cx, cy, r), fill: P(ctx, 3) });
  return nodes;
}

function mountainMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  const horizon = 676;
  nodes.push(...sunWithHalo(ctx, 690, 330, 92));
  // Back range, mid range, front ridge: three planes keep depth readable.
  nodes.push({
    name: 'Back ridge',
    d: polygon([[120, horizon], [330, 250], [520, horizon]]),
    fill: P(ctx, 2),
    opacity: 0.55,
  });
  nodes.push({
    name: 'Mid ridge',
    d: polygon([[300, horizon], [560, 175], [830, horizon]]),
    fill: P(ctx, 1),
  });
  nodes.push({
    name: 'Snow cap',
    d: polygon([[560, 175], [640, 292], [592, 286], [560, 320], [524, 284], [478, 290]]),
    fill: P(ctx, 4),
  });
  nodes.push({
    name: 'Front ridge',
    d: polygon([[60, horizon], [300, 395], [560, horizon]]),
    fill: P(ctx, 0),
  });
  if (ctx.detail >= 1) {
    nodes.push({ name: 'Water', d: rect(0, horizon, 1000, 1000 - horizon), fill: P(ctx, 2) });
    nodes.push({ name: 'Reflection', d: rect(0, horizon, 1000, 16), fill: P(ctx, 4) });
    nodes.push({ name: 'Shore line', d: `M0 ${horizon + 96}L1000 ${horizon + 96}`, stroke: P(ctx, 3), strokeWidth: 8, fill: 'none' });
  }
  if (ctx.detail >= 2) {
    for (let i = 0; i < 3; i += 1) {
      const y = 250 + i * 34;
      const x = 780 + i * 24;
      nodes.push({
        name: 'Bird',
        d: `M${x} ${y}C${x + 8} ${y - 10} ${x + 18} ${y - 10} ${x + 26} ${y}M${x + 26} ${y}C${x + 34} ${y - 10} ${x + 44} ${y - 10} ${x + 52} ${y}`,
        stroke: P(ctx, 0),
        strokeWidth: 7,
        fill: 'none',
        cap: 'round',
      });
    }
  }
  return {
    nodes,
    subject: 'layered mountain range reflected in still water',
    scene: 'alpine landscape',
    tags: ['mountains', 'landscape', 'nature', 'outdoors', 'travel', 'adventure', 'sunrise', 'lake', 'horizon', 'wilderness'],
  };
}

function cityMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  const ground = 780;
  nodes.push(...sunWithHalo(ctx, 260, 300, 78));
  const towers = [
    { x: 120, w: 120, h: 300 },
    { x: 262, w: 86, h: 210 },
    { x: 370, w: 140, h: 380 },
    { x: 532, w: 96, h: 260 },
    { x: 650, w: 150, h: 330 },
    { x: 822, w: 90, h: 190 },
  ];
  towers.forEach((tower, index) => {
    const top = ground - tower.h;
    nodes.push({
      name: `Tower ${index + 1}`,
      d: rect(tower.x, top, tower.w, tower.h),
      fill: index % 2 === 0 ? P(ctx, 0) : P(ctx, 1),
    });
    if (ctx.detail >= 1) {
      const cols = Math.max(2, Math.floor(tower.w / 34));
      const rows = Math.max(2, Math.floor(tower.h / 46));
      const cells: string[] = [];
      for (let r = 0; r < rows; r += 1) {
        for (let col = 0; col < cols; col += 1) {
          // Skip a deterministic share of windows so the grid reads as lived in.
          if (ctx.rand() < 0.35) continue;
          const wx = tower.x + 12 + col * ((tower.w - 24) / cols);
          const wy = top + 18 + r * ((tower.h - 30) / rows);
          cells.push(rect(wx, wy, Math.max(6, (tower.w - 24) / cols - 10), 12));
        }
      }
      if (cells.length) {
        nodes.push({ name: `Windows ${index + 1}`, d: cells.join(''), fill: P(ctx, 3), opacity: 0.85 });
      }
    }
  });
  if (ctx.detail >= 2) {
    nodes.push({ name: 'Ground', d: rect(0, ground, 1000, 1000 - ground), fill: P(ctx, 0) });
    nodes.push({ name: 'Curb', d: 'M0 ' + (ground + 16) + 'L1000 ' + (ground + 16), stroke: P(ctx, 2), strokeWidth: 8, fill: 'none', opacity: 0.7 });
  }
  return {
    nodes,
    subject: 'stylised skyline of office towers',
    scene: 'modern city',
    tags: ['city', 'skyline', 'urban', 'architecture', 'business', 'downtown', 'buildings', 'skyline', 'metropolis', 'real estate'],
  };
}

function coffeeMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  nodes.push({ name: 'Saucer', d: ellipse(500, 742, 268, 50), fill: P(ctx, 2), opacity: 0.4 });
  nodes.push({ name: 'Handle', d: arc(672, 508, 96, -80, 80), stroke: P(ctx, 0), strokeWidth: 40, fill: 'none' });
  nodes.push({ name: 'Cup body', d: 'M318 372L682 372L636 700C636 724 566 742 500 742C434 742 364 724 364 700Z', fill: P(ctx, 1) });
  nodes.push({ name: 'Cup shade', d: 'M364 700C364 724 434 742 500 742C566 742 636 724 636 700L628 636L372 636Z', fill: P(ctx, 0), opacity: 0.35 });
  nodes.push({ name: 'Coffee surface', d: ellipse(500, 374, 182, 30), fill: P(ctx, 0) });
  nodes.push({ name: 'Rim', d: ellipse(500, 372, 182, 30), fill: 'none', stroke: P(ctx, 0), strokeWidth: 12 });
  if (ctx.detail >= 1) {
    for (let i = 0; i < 3; i += 1) {
      const x = 440 + i * 60;
      nodes.push({
        name: `Steam ${i + 1}`,
        d: `M${x} 330C${x - 26} 290 ${x + 26} 272 ${x} 234`,
        stroke: P(ctx, 2),
        strokeWidth: 16,
        fill: 'none',
        cap: 'round',
        opacity: 0.8,
      });
    }
  }
  if (ctx.detail >= 2) {
    nodes.push({ name: 'Bean one', d: ellipse(210, 780, 62, 44), fill: P(ctx, 0), opacity: 0.9 });
    nodes.push({ name: 'Bean one crease', d: 'M160 786C190 764 230 764 260 786', stroke: P(ctx, 2), strokeWidth: 9, fill: 'none', cap: 'round' });
    nodes.push({ name: 'Bean two', d: ellipse(790, 800, 46, 34), fill: P(ctx, 1), opacity: 0.9 });
  }
  return {
    nodes,
    subject: 'ceramic coffee cup with rising steam and roasted beans',
    scene: 'cafe still life',
    tags: ['coffee', 'cafe', 'espresso', 'drink', 'morning', 'barista', 'breakfast', 'caffeine', 'cup', 'restaurant'],
  };
}

function financeMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  const base = 800;
  const bars = [180, 320, 260, 430, 380, 560];
  bars.forEach((height, index) => {
    const x = 130 + index * 126;
    nodes.push({
      name: `Bar ${index + 1}`,
      d: roundRect(x, base - height, 88, height, 14),
      fill: index === bars.length - 1 ? P(ctx, 1) : P(ctx, 2),
      opacity: index === bars.length - 1 ? 1 : 0.55 + index * 0.08,
    });
  });
  nodes.push({ name: 'Baseline', d: rect(110, base, 780, 14), fill: P(ctx, 0), opacity: 0.7 });
  // Rising trend line over the bars, with a coin at the head.
  nodes.push({
    name: 'Trend line',
    d: 'M150 690L330 560L470 610L650 430L820 300',
    stroke: P(ctx, 0),
    strokeWidth: 18,
    fill: 'none',
    cap: 'round',
  });
  nodes.push({ name: 'Trend head', d: polygon([[820, 300], [742, 300], [820, 378]]), fill: P(ctx, 0) });
  nodes.push({ name: 'Coin', d: circle(790, 190, 84), fill: P(ctx, 3) });
  nodes.push({ name: 'Coin inner', d: circle(790, 190, 58), fill: 'none', stroke: P(ctx, 0), strokeWidth: 12 });
  nodes.push({ name: 'Coin mark', d: 'M790 152L790 228M766 172L814 172M766 208L814 208', stroke: P(ctx, 0), strokeWidth: 12, fill: 'none', cap: 'round' });
  if (ctx.detail >= 2) {
    nodes.push({ name: 'Grid', d: 'M130 500L890 500M130 620L890 620M130 740L890 740', stroke: P(ctx, 2), strokeWidth: 4, fill: 'none', opacity: 0.5 });
  }
  return {
    nodes,
    subject: 'bar chart rising toward a coin',
    scene: 'financial growth',
    tags: ['finance', 'growth', 'investment', 'chart', 'business', 'profit', 'money', 'analytics', 'success', 'economy'],
  };
}

function techMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  nodes.push({ name: 'Chip', d: roundRect(360, 360, 280, 280, 46), fill: P(ctx, 1) });
  nodes.push({ name: 'Chip core', d: roundRect(430, 430, 140, 140, 24), fill: P(ctx, 4) });
  nodes.push({ name: 'Chip core mark', d: circle(500, 500, 36), fill: P(ctx, 1) });
  for (let i = 0; i < 4; i += 1) {
    const offset = 400 + i * 66;
    nodes.push({
      name: `Pins top ${i + 1}`,
      d: `M${offset} 360L${offset} 276M${offset} 640L${offset} 724`,
      stroke: P(ctx, 1),
      strokeWidth: 16,
      fill: 'none',
      cap: 'round',
    });
    nodes.push({
      name: `Pins side ${i + 1}`,
      d: `M360 ${offset}L276 ${offset}M640 ${offset}L724 ${offset}`,
      stroke: P(ctx, 1),
      strokeWidth: 16,
      fill: 'none',
      cap: 'round',
    });
  }
  if (ctx.detail >= 1) {
    const orbits = [230, 310];
    orbits.forEach((radius, index) => {
      nodes.push({
        name: `Orbit ${index + 1}`,
        d: ellipse(500, 500, radius, radius * 0.42),
        fill: 'none',
        stroke: P(ctx, 2),
        strokeWidth: 8,
        opacity: 0.8,
      });
      const angle = ctx.rand() * Math.PI * 2;
      nodes.push({
        name: `Node ${index + 1}`,
        d: circle(500 + radius * Math.cos(angle), 500 + radius * 0.42 * Math.sin(angle), 18),
        fill: P(ctx, 3),
      });
    });
  }
  if (ctx.detail >= 2) {
    nodes.push({ name: 'Circuit one', d: 'M120 780L300 780L300 690L420 690', stroke: P(ctx, 2), strokeWidth: 10, fill: 'none', cap: 'round' });
    nodes.push({ name: 'Circuit two', d: 'M880 260L720 260L720 350L600 350', stroke: P(ctx, 2), strokeWidth: 10, fill: 'none', cap: 'round' });
    nodes.push({ name: 'Circuit dot one', d: circle(120, 780, 16), fill: P(ctx, 3) });
    nodes.push({ name: 'Circuit dot two', d: circle(880, 260, 16), fill: P(ctx, 3) });
  }
  return {
    nodes,
    subject: 'microchip wired into orbital data paths',
    scene: 'technology',
    tags: ['technology', 'chip', 'digital', 'data', 'innovation', 'computer', 'network', 'future', 'electronics', 'software'],
  };
}

function floralMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  const cx = 500;
  const cy = 470;
  const petals = ctx.detail >= 2 ? 8 : 6;
  for (let i = 0; i < petals; i += 1) {
    const angle = (i * 360) / petals - 90;
    nodes.push({
      name: `Petal ${i + 1}`,
      d: leaf(cx, cy, 250, 150, angle),
      fill: i % 2 ? P(ctx, 2) : P(ctx, 3),
      opacity: i % 2 ? 0.9 : 0.7,
    });
  }
  nodes.push({ name: 'Bloom centre', d: circle(cx, cy, 78), fill: P(ctx, 1) });
  nodes.push({ name: 'Bloom core', d: circle(cx, cy, 34), fill: P(ctx, 3) });
  nodes.push({ name: 'Stem', d: 'M500 700L500 930', stroke: P(ctx, 1), strokeWidth: 22, fill: 'none', cap: 'round' });
  if (ctx.detail >= 1) {
    nodes.push({ name: 'Leaf left', d: leaf(500, 810, 170, 96, 200), fill: P(ctx, 1), opacity: 0.9 });
    nodes.push({ name: 'Leaf right', d: leaf(500, 860, 170, 96, -20), fill: P(ctx, 1), opacity: 0.75 });
  }
  if (ctx.detail >= 3) {
    for (let i = 0; i < 6; i += 1) {
      const angle = (i * 60 * Math.PI) / 180;
      nodes.push({
        name: `Stamen ${i + 1}`,
        d: circle(cx + Math.cos(angle) * 52, cy + Math.sin(angle) * 52, 9),
        fill: P(ctx, 4),
      });
    }
  }
  return {
    nodes,
    subject: 'single stylised blossom with layered petals',
    scene: 'botanical study',
    tags: ['flower', 'floral', 'nature', 'bloom', 'botanical', 'spring', 'garden', 'plant', 'petals', 'beauty'],
  };
}

function arcsMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  // Three overlapping primitives on a shared baseline, the classic Bauhaus
  // arrangement: a disc, a half disc and a stroked arc, nothing else.
  nodes.push({ name: 'Disc', d: circle(340, 560, 210), fill: P(ctx, 2), opacity: 0.85 });
  nodes.push({ name: 'Half disc', d: `${arc(640, 770, 230, 180, 360)}Z`, fill: P(ctx, 1) });
  nodes.push({ name: 'Arc band', d: arc(640, 770, 300, 196, 344), stroke: P(ctx, 3), strokeWidth: 46, fill: 'none', cap: 'round' });
  nodes.push({ name: 'Sun', d: circle(790, 320, 96), fill: P(ctx, 3) });
  nodes.push({ name: 'Quarter disc', d: `${arc(340, 560, 150, 180, 270)}L340 560Z`, fill: P(ctx, 0), opacity: 0.85 });
  if (ctx.detail >= 1) {
    nodes.push({ name: 'Rule wide', d: 'M150 830L850 830', stroke: P(ctx, 0), strokeWidth: 16, fill: 'none', cap: 'round' });
    nodes.push({ name: 'Rule short', d: 'M150 872L430 872', stroke: P(ctx, 1), strokeWidth: 12, fill: 'none', cap: 'round' });
  }
  if (ctx.detail >= 2) {
    nodes.push({ name: 'Dot', d: circle(860, 560, 26), fill: P(ctx, 1) });
    nodes.push({ name: 'Small ring', d: circle(180, 320, 44), fill: 'none', stroke: P(ctx, 1), strokeWidth: 14 });
  }
  return {
    nodes,
    subject: 'geometric arc and disc composition',
    scene: 'bauhaus abstraction',
    tags: ['abstract', 'geometric', 'shapes', 'modern', 'minimal', 'circle', 'poster', 'design', 'contemporary', 'pattern'],
  };
}

function cubeMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  const size = 150;
  const iso = (cx: number, cy: number, fillTop: string, fillLeft: string, fillRight: string) => {
    const w = size * Math.cos(Math.PI / 6);
    nodes.push({ name: 'Cube top', d: polygon([[cx, cy - size], [cx + w, cy - size / 2], [cx, cy], [cx - w, cy - size / 2]]), fill: fillTop });
    nodes.push({ name: 'Cube left', d: polygon([[cx - w, cy - size / 2], [cx, cy], [cx, cy + size], [cx - w, cy + size / 2]]), fill: fillLeft });
    nodes.push({ name: 'Cube right', d: polygon([[cx, cy], [cx + w, cy - size / 2], [cx + w, cy + size / 2], [cx, cy + size]]), fill: fillRight });
  };
  iso(500, 470, P(ctx, 3), P(ctx, 2), P(ctx, 1));
  if (ctx.detail >= 1) {
    iso(500, 330, P(ctx, 4), P(ctx, 2), P(ctx, 1));
    iso(500, 610, P(ctx, 3), P(ctx, 1), P(ctx, 0));
  }
  if (ctx.detail >= 2) {
    const w = size * Math.cos(Math.PI / 6);
    nodes.push({ name: 'Platform left', d: polygon([[500 - w - 130, 300], [500 - 130, 470], [500 - 130, 700], [500 - w - 130, 530]]), fill: P(ctx, 2), opacity: 0.5 });
    nodes.push({ name: 'Platform right', d: polygon([[500 + w + 130, 300], [500 + 130, 470], [500 + 130, 700], [500 + w + 130, 530]]), fill: P(ctx, 1), opacity: 0.5 });
  }
  return {
    nodes,
    subject: 'stacked isometric cubes',
    scene: 'isometric construction',
    tags: ['isometric', 'cube', 'three dimensional', 'geometric', 'modular', 'structure', 'design', 'abstract', 'block', 'perspective'],
  };
}

function laurelMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  nodes.push({ name: 'Badge', d: circle(500, 500, 330), fill: P(ctx, 1) });
  nodes.push({ name: 'Badge ring', d: circle(500, 500, 292), fill: 'none', stroke: P(ctx, 4), strokeWidth: 10, opacity: 0.6 });
  const count = ctx.detail >= 2 ? 9 : 7;
  for (let side = 0; side < 2; side += 1) {
    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1);
      const angle = (-140 + t * 100) * (side ? -1 : 1) + (side ? 180 : 0);
      const rad = (angle * Math.PI) / 180;
      const x = 500 + Math.cos(rad) * 214;
      const y = 500 + Math.sin(rad) * 214 + 70;
      nodes.push({
        name: `Laurel ${side + 1}-${i + 1}`,
        d: leaf(x, y, 74, 30, angle + (side ? 200 : -20)),
        fill: P(ctx, 4),
        opacity: 0.9,
      });
    }
  }
  nodes.push({ name: 'Star', d: star(500, 470, 5, 96, 40), fill: P(ctx, 3) });
  if (ctx.detail >= 1) {
    nodes.push({ name: 'Ribbon', d: polygon([[300, 690], [700, 690], [660, 760], [340, 760]]), fill: P(ctx, 0) });
  }
  return {
    nodes,
    subject: 'laurel wreath award badge with star',
    scene: 'award emblem',
    tags: ['award', 'badge', 'laurel', 'winner', 'premium', 'quality', 'emblem', 'achievement', 'star', 'certificate'],
  };
}

function celebrationMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  // Fireworks built from evenly spaced rays, not random spaghetti.
  const bursts = [
    { x: 300, y: 330, r: 150, rays: 12 },
    { x: 700, y: 260, r: 110, rays: 10 },
  ];
  bursts.forEach((burst, index) => {
    for (let i = 0; i < burst.rays; i += 1) {
      const angle = (i * 360 * Math.PI) / burst.rays / 180;
      nodes.push({
        name: `Burst ${index + 1} ray ${i + 1}`,
        d: `M${n(burst.x + Math.cos(angle) * burst.r * 0.35)} ${n(burst.y + Math.sin(angle) * burst.r * 0.35)}L${n(burst.x + Math.cos(angle) * burst.r)} ${n(burst.y + Math.sin(angle) * burst.r)}`,
        stroke: index ? P(ctx, 3) : P(ctx, 1),
        strokeWidth: 12,
        fill: 'none',
        cap: 'round',
      });
    }
    nodes.push({ name: `Burst ${index + 1} core`, d: circle(burst.x, burst.y, burst.r * 0.2), fill: P(ctx, 3) });
  });
  nodes.push({ name: 'Confetti', d: wave(0, 760, 1000, 26, 4, 240), fill: P(ctx, 1), opacity: 0.3 });
  if (ctx.detail >= 2) {
    for (let i = 0; i < 10; i += 1) {
      const x = 80 + ctx.rand() * 840;
      const y = 520 + ctx.rand() * 200;
      nodes.push({ name: `Confetti ${i + 1}`, d: roundRect(x, y, 26, 12, 4), fill: i % 2 ? P(ctx, 3) : P(ctx, 4), opacity: 0.9 });
    }
  }
  return {
    nodes,
    subject: 'firework bursts over falling confetti',
    scene: 'celebration',
    tags: ['celebration', 'fireworks', 'party', 'festival', 'new year', 'holiday', 'event', 'confetti', 'joy', 'night'],
  };
}

function treeMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  nodes.push({ name: 'Moon', d: circle(760, 250, 74), fill: P(ctx, 3) });
  // Tiered tree: three stacked triangles with a shared axis.
  const tiers = [
    { top: 250, bottom: 470, width: 300 },
    { top: 380, bottom: 610, width: 390 },
    { top: 510, bottom: 760, width: 480 },
  ];
  tiers.forEach((tier, index) => {
    nodes.push({
      name: `Tree tier ${index + 1}`,
      d: polygon([[500, tier.top], [500 + tier.width / 2, tier.bottom], [500 - tier.width / 2, tier.bottom]]),
      fill: index === 1 ? P(ctx, 3) : P(ctx, 3),
    });
  });
  nodes.push({ name: 'Trunk', d: roundRect(478, 760, 44, 90, 8), fill: P(ctx, 0) });
  nodes.push({ name: 'Tree shade', d: polygon([[500, 300], [560, 420], [440, 420]]), fill: P(ctx, 1), opacity: 0.5 });
  if (ctx.detail >= 1) {
    const baubles = [
      { x: 430, y: 560, r: 22 },
      { x: 570, y: 640, r: 26 },
      { x: 500, y: 700, r: 20 },
      { x: 620, y: 480, r: 18 },
    ];
    baubles.slice(0, ctx.detail >= 2 ? 4 : 2).forEach((bauble, index) => {
      nodes.push({ name: `Bauble ${index + 1}`, d: circle(bauble.x, bauble.y, bauble.r), fill: index % 2 ? P(ctx, 2) : P(ctx, 1) });
    });
  }
  if (ctx.detail >= 2) {
    nodes.push({ name: 'Star topper', d: star(500, 240, 5, 52, 22), fill: P(ctx, 3) });
    nodes.push({ name: 'Snow ground', d: wave(0, 852, 1000, 14, 5, 120), fill: P(ctx, 3), opacity: 0.5 });
  }
  return {
    nodes,
    subject: 'decorated evergreen tree under a winter moon',
    scene: 'winter holiday',
    tags: ['christmas', 'tree', 'holiday', 'winter', 'december', 'festive', 'ornament', 'season', 'greeting', 'celebration'],
  };
}

function pumpkinMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  nodes.push({ name: 'Moon', d: circle(740, 260, 110), fill: P(ctx, 3), opacity: 0.9 });
  nodes.push({ name: 'Pumpkin body', d: ellipse(500, 620, 250, 210), fill: P(ctx, 1) });
  nodes.push({ name: 'Pumpkin rib one', d: ellipse(500, 620, 168, 210), fill: P(ctx, 2), opacity: 0.65 });
  nodes.push({ name: 'Pumpkin rib two', d: ellipse(500, 620, 84, 210), fill: P(ctx, 1), opacity: 0.9 });
  nodes.push({ name: 'Stem', d: roundRect(474, 380, 52, 70, 18), fill: P(ctx, 0) });
  nodes.push({ name: 'Leaf', d: leaf(520, 400, 130, 62, 30), fill: P(ctx, 4), opacity: 0.85 });
  if (ctx.detail >= 1) {
    nodes.push({ name: 'Face left eye', d: polygon([[400, 570], [470, 570], [435, 640]]), fill: P(ctx, 0) });
    nodes.push({ name: 'Face right eye', d: polygon([[530, 570], [600, 570], [565, 640]]), fill: P(ctx, 0) });
    nodes.push({ name: 'Face mouth', d: 'M400 700C440 744 560 744 600 700C570 720 430 720 400 700Z', fill: P(ctx, 0) });
  }
  if (ctx.detail >= 2) {
    nodes.push({ name: 'Bat one', d: 'M170 330C192 304 216 304 232 330C248 304 272 304 294 330C276 338 254 352 232 370C210 352 188 338 170 330Z', fill: P(ctx, 0), opacity: 0.85 });
  }
  return {
    nodes,
    subject: 'carved pumpkin with bats under a full moon',
    scene: 'autumn holiday',
    tags: ['halloween', 'pumpkin', 'autumn', 'october', 'spooky', 'holiday', 'festival', 'night', 'season', 'decorative'],
  };
}

function heartsMotif(ctx: DrawContext): MotifResult {
  const heart = (x: number, y: number, size: number) =>
    `M${n(x)} ${n(y + size * 0.28)}C${n(x)} ${n(y)} ${n(x + size * 0.5)} ${n(y)} ${n(x + size * 0.5)} ${n(y + size * 0.3)}C${n(x + size * 0.5)} ${n(y)} ${n(x + size)} ${n(y)} ${n(x + size)} ${n(y + size * 0.28)}C${n(x + size)} ${n(y + size * 0.62)} ${n(x + size * 0.5)} ${n(y + size * 0.8)} ${n(x + size * 0.5)} ${n(y + size)}C${n(x + size * 0.5)} ${n(y + size * 0.8)} ${n(x)} ${n(y + size * 0.62)} ${n(x)} ${n(y + size * 0.28)}Z`;
  const nodes: Omit<Node, 'id'>[] = [];
  nodes.push({ name: 'Heart large', d: heart(300, 330, 400), fill: P(ctx, 1) });
  nodes.push({ name: 'Heart inner', d: heart(370, 400, 250), fill: P(ctx, 3), opacity: 0.55 });
  if (ctx.detail >= 1) {
    nodes.push({ name: 'Heart small left', d: heart(150, 620, 140), fill: P(ctx, 2) });
    nodes.push({ name: 'Heart small right', d: heart(700, 620, 120), fill: P(ctx, 2), opacity: 0.8 });
  }
  if (ctx.detail >= 2) {
    nodes.push({ name: 'Ribbon', d: wave(0, 800, 1000, 20, 3, 120), fill: P(ctx, 2), opacity: 0.35 });
    nodes.push({ name: 'Spark', d: star(840, 300, 4, 60, 16), fill: P(ctx, 4) });
  }
  return {
    nodes,
    subject: 'layered heart composition with ribbon',
    scene: 'romantic greeting',
    tags: ['heart', 'love', 'valentine', 'romance', 'wedding', 'greeting', 'card', 'romantic', 'gift', 'affection'],
  };
}

function lanternMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  nodes.push({ name: 'Crescent', d: `${circle(320, 300, 150)}${circle(380, 268, 130)}`, fill: P(ctx, 3) });
  nodes.push({ name: 'Arch', d: 'M620 760L620 470C620 376 696 300 790 300C884 300 960 376 960 470L960 760Z', fill: P(ctx, 1), opacity: 0.9 });
  // Lantern: body, cap, base and hanging line.
  nodes.push({ name: 'Lantern line', d: 'M790 200L790 270', stroke: P(ctx, 0), strokeWidth: 8, fill: 'none' });
  nodes.push({ name: 'Lantern cap', d: polygon([[742, 300], [838, 300], [818, 274], [762, 274]]), fill: P(ctx, 0) });
  nodes.push({ name: 'Lantern body', d: roundRect(748, 300, 84, 130, 26), fill: P(ctx, 2) });
  nodes.push({ name: 'Lantern glow', d: ellipse(790, 366, 26, 44), fill: P(ctx, 4), opacity: 0.85 });
  nodes.push({ name: 'Lantern base', d: polygon([[744, 430], [836, 430], [820, 452], [760, 452]]), fill: P(ctx, 0) });
  nodes.push({ name: 'Hill', d: wave(0, 860, 1000, 18, 4, 200), fill: P(ctx, 0), opacity: 0.85 });
  if (ctx.detail >= 2) {
    nodes.push({ name: 'Star one', d: star(200, 560, 5, 26, 11), fill: P(ctx, 3) });
    nodes.push({ name: 'Star two', d: star(520, 200, 5, 20, 8), fill: P(ctx, 3), opacity: 0.8 });
  }
  return {
    nodes,
    subject: 'hanging festival lantern beneath a crescent moon',
    scene: 'festival night',
    tags: ['lantern', 'festival', 'ramadan', 'eid', 'night', 'crescent', 'celebration', 'decorative', 'culture', 'greeting'],
  };
}

function diyaMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  nodes.push({ name: 'Rangoli ring one', d: circle(500, 470, 250), fill: 'none', stroke: P(ctx, 2), strokeWidth: 6, opacity: 0.7 });
  nodes.push({ name: 'Rangoli ring two', d: circle(500, 470, 180), fill: 'none', stroke: P(ctx, 3), strokeWidth: 6, opacity: 0.7 });
  for (let i = 0; i < 12; i += 1) {
    const angle = ((i * 30) * Math.PI) / 180;
    nodes.push({
      name: `Rangoli petal ${i + 1}`,
      d: leaf(500 + Math.cos(angle) * 120, 470 + Math.sin(angle) * 120, 70, 34, (i * 30)),
      fill: i % 2 ? P(ctx, 1) : P(ctx, 2),
      opacity: 0.85,
    });
  }
  nodes.push({ name: 'Lamp bowl', d: 'M330 720c60 90 280 90 340 0Z', fill: P(ctx, 1) });
  nodes.push({ name: 'Lamp rim', d: ellipse(500, 720, 170, 26), fill: P(ctx, 4) });
  nodes.push({ name: 'Flame', d: leaf(500, 720, 110, 64, -90), fill: P(ctx, 3) });
  nodes.push({ name: 'Flame core', d: leaf(500, 700, 66, 34, -90), fill: P(ctx, 4), opacity: 0.9 });
  nodes.push({ name: 'Base line', d: 'M120 860L880 860', stroke: P(ctx, 0), strokeWidth: 12, fill: 'none', cap: 'round', opacity: 0.6 });
  return {
    nodes,
    subject: 'oil lamp on a rangoli pattern',
    scene: 'festival of lights',
    tags: ['diwali', 'lamp', 'diya', 'festival', 'lights', 'rangoli', 'celebration', 'culture', 'tradition', 'decorative'],
  };
}

function snowflakeMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  const arms = ctx.detail >= 2 ? 8 : 6;
  for (let i = 0; i < arms; i += 1) {
    const angle = (i * 360) / arms;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const tip = 360;
    nodes.push({
      name: `Arm ${i + 1}`,
      d: `M500 500L${n(500 + cos * tip)} ${n(500 + sin * tip)}`,
      stroke: P(ctx, 2),
      strokeWidth: 16,
      fill: 'none',
      cap: 'round',
    });
    // Two symmetric branch pairs per arm keep the crystal balanced.
    [0.55, 0.78].forEach((t, index) => {
      const bx = 500 + cos * tip * t;
      const by = 500 + sin * tip * t;
      const length = 96 - index * 22;
      [-42, 42].forEach((offset) => {
        const a2 = ((angle + offset) * Math.PI) / 180;
        nodes.push({
          name: `Branch ${i + 1}-${index + 1}`,
          d: `M${n(bx)} ${n(by)}L${n(bx + Math.cos(a2) * length)} ${n(by + Math.sin(a2) * length)}`,
          stroke: P(ctx, 2),
          strokeWidth: 11,
          fill: 'none',
          cap: 'round',
        });
      });
    });
  }
  nodes.push({ name: 'Crystal core', d: star(500, 500, 6, 96, 54), fill: P(ctx, 3) });
  if (ctx.detail >= 1) {
    nodes.push({ name: 'Frost ring', d: circle(500, 500, 400), fill: 'none', stroke: P(ctx, 2), strokeWidth: 4, opacity: 0.4 });
  }
  return {
    nodes,
    subject: 'symmetrical snowflake crystal',
    scene: 'winter pattern',
    tags: ['snowflake', 'winter', 'snow', 'frost', 'december', 'holiday', 'pattern', 'cold', 'season', 'decorative'],
  };
}

function travelMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  nodes.push({ name: 'Sun', d: circle(760, 300, 120), fill: P(ctx, 3) });
  nodes.push({ name: 'Ground', d: wave(0, 720, 1000, 22, 3, 300), fill: P(ctx, 1) });
  nodes.push({ name: 'Case body', d: roundRect(300, 430, 400, 300, 34), fill: P(ctx, 2) });
  nodes.push({ name: 'Case band', d: rect(300, 540, 400, 44), fill: P(ctx, 0), opacity: 0.8 });
  nodes.push({ name: 'Case handle', d: arc(500, 430, 84, 180, 360), stroke: P(ctx, 0), strokeWidth: 26, fill: 'none' });
  nodes.push({ name: 'Sticker circle', d: circle(420, 620, 34), fill: P(ctx, 3) });
  nodes.push({ name: 'Sticker bar', d: roundRect(480, 600, 120, 22, 11), fill: P(ctx, 4) });
  if (ctx.detail >= 1) {
    nodes.push({ name: 'Path', d: 'M120 880c140-90 300-90 420 0s280 90 380 0', stroke: P(ctx, 4), strokeWidth: 10, fill: 'none', cap: 'round', opacity: 0.7 });
    nodes.push({ name: 'Plane', d: 'M180 300l150 60-150 60 30-60Z', fill: P(ctx, 0) });
  }
  return {
    nodes,
    subject: 'suitcase on a winding path under the sun',
    scene: 'travel planning',
    tags: ['travel', 'suitcase', 'vacation', 'journey', 'holiday', 'tourism', 'adventure', 'luggage', 'summer', 'trip'],
  };
}

function springMotif(ctx: DrawContext): MotifResult {
  const nodes: Omit<Node, 'id'>[] = [];
  nodes.push({ name: 'Sun', d: circle(680, 300, 110), fill: P(ctx, 3) });
  nodes.push({ name: 'Hill back', d: wave(0, 720, 1000, 30, 2, 300), fill: P(ctx, 2), opacity: 0.7 });
  nodes.push({ name: 'Hill front', d: wave(0, 812, 1000, 26, 3, 240), fill: P(ctx, 1) });
  nodes.push({ name: 'Stem', d: 'M420 760C410 640 440 570 500 520', stroke: P(ctx, 0), strokeWidth: 20, fill: 'none', cap: 'round' });
  nodes.push({ name: 'Blossom one', d: star(500, 520, 5, 70, 26), fill: P(ctx, 4) });
  nodes.push({ name: 'Blossom two', d: star(380, 640, 5, 52, 20), fill: P(ctx, 3) });
  nodes.push({ name: 'Leaf', d: leaf(430, 700, 120, 52, 200), fill: P(ctx, 1) });
  if (ctx.detail >= 2) {
    for (let i = 0; i < 5; i += 1) {
      const x = 120 + i * 170;
      nodes.push({ name: `Grass ${i + 1}`, d: `M${x} 900C${x + 4} 870 ${x + 16} 854 ${x + 26} 842`, stroke: P(ctx, 1), strokeWidth: 8, fill: 'none', cap: 'round', opacity: 0.7 });
    }
    nodes.push({ name: 'Petal drift', d: `${circle(700, 520, 10)}${circle(760, 600, 8)}${circle(650, 640, 7)}`, fill: P(ctx, 3), opacity: 0.8 });
  }
  return {
    nodes,
    subject: 'blossom on a rolling spring hillside',
    scene: 'spring landscape',
    tags: ['spring', 'blossom', 'flower', 'nature', 'season', 'sunshine', 'hill', 'fresh', 'bloom', 'outdoors'],
  };
}

export const MOTIFS = {
  mountain: mountainMotif,
  city: cityMotif,
  coffee: coffeeMotif,
  finance: financeMotif,
  tech: techMotif,
  floral: floralMotif,
  arcs: arcsMotif,
  cube: cubeMotif,
  laurel: laurelMotif,
  celebration: celebrationMotif,
  tree: treeMotif,
  pumpkin: pumpkinMotif,
  hearts: heartsMotif,
  lantern: lanternMotif,
  diya: diyaMotif,
  snowflake: snowflakeMotif,
  travel: travelMotif,
  spring: springMotif,
} as const;

export type MotifId = keyof typeof MOTIFS;

export const MOTIF_IDS = Object.keys(MOTIFS) as MotifId[];
