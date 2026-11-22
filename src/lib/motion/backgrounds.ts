/**
 * Procedural background generator engine.
 *
 * One scene description (style + palette + seed + density) drives three
 * renderers: canvas raster (PNG/JPG), SVG and EPS PostScript. Because the
 * scene is data, the vector exports contain real editable shapes, not a
 * picture of the picture. Every scene is original and commercially usable.
 */

export type BackgroundStyleId =
  | 'gradient'
  | 'aurora'
  | 'bokeh'
  | 'waves'
  | 'geometric'
  | 'mesh'
  | 'texture'
  | 'pattern'
  | 'starfield'
  | 'topographic';

export interface BackgroundPalette {
  id: string;
  label: string;
  colors: string[];
}

export const BACKGROUND_PALETTES: BackgroundPalette[] = [
  { id: 'indigo', label: 'Indigo', colors: ['#312e81', '#6366f1', '#a5b4fc'] },
  { id: 'ocean', label: 'Ocean', colors: ['#082f49', '#0ea5e9', '#7dd3fc'] },
  { id: 'sunset', label: 'Sunset', colors: ['#7c2d12', '#f97316', '#fde68a'] },
  { id: 'forest', label: 'Forest', colors: ['#052e16', '#10b981', '#a7f3d0'] },
  { id: 'rose', label: 'Rose', colors: ['#4c0519', '#f43f5e', '#fecdd3'] },
  { id: 'gold', label: 'Gold', colors: ['#451a03', '#f59e0b', '#fde68a'] },
  { id: 'slate', label: 'Slate', colors: ['#0f172a', '#64748b', '#e2e8f0'] },
  { id: 'plum', label: 'Plum', colors: ['#3b0764', '#a855f7', '#e9d5ff'] },
];

export const BACKGROUND_STYLES: Array<{ id: BackgroundStyleId; label: string }> = [
  { id: 'gradient', label: 'Gradient' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'bokeh', label: 'Bokeh' },
  { id: 'waves', label: 'Waves' },
  { id: 'geometric', label: 'Geometric' },
  { id: 'mesh', label: 'Mesh' },
  { id: 'texture', label: 'Texture' },
  { id: 'pattern', label: 'Pattern' },
  { id: 'starfield', label: 'Starfield' },
  { id: 'topographic', label: 'Topographic' },
];

export interface BackgroundScene {
  style: BackgroundStyleId;
  colors: string[];
  seed: number;
  /** 10 .. 120 element density. */
  density: number;
  /** 0 .. 100 grain amount. */
  grain: number;
  /** 0 .. 100 vignette strength. */
  vignette: number;
}

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function mix(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Render the scene to any canvas context at any size. */
export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, scene: BackgroundScene): void {
  const [c0, c1, c2] = scene.colors;
  const rand = mulberry32(scene.seed);
  const scale = Math.max(w, h) / 1000;
  const TAU = Math.PI * 2;

  // Base wash.
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, c0);
  base.addColorStop(1, mix(c0, c1, 0.55));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  switch (scene.style) {
    case 'gradient': {
      const g = ctx.createRadialGradient(w * 0.3, h * 0.3, 0, w * 0.3, h * 0.3, Math.max(w, h) * 0.9);
      g.addColorStop(0, shade(c2, 0.55));
      g.addColorStop(0.5, shade(c1, 0.25));
      g.addColorStop(1, shade(c1, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case 'aurora': {
      const bands = 3 + Math.round(scene.density / 25);
      for (let i = 0; i < bands; i++) {
        const color = scene.colors[i % scene.colors.length];
        const yBase = h * (0.2 + (i / bands) * 0.55);
        const amp = h * 0.12;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += Math.max(8, w / 140)) {
          const y =
            yBase +
            Math.sin((x / w) * Math.PI * 2 * (1.4 + i * 0.5) + i * 1.9) * amp +
            Math.sin((x / w) * Math.PI * 5 + i) * amp * 0.3;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, yBase - amp, 0, h);
        grad.addColorStop(0, shade(color, 0.55));
        grad.addColorStop(1, shade(color, 0.04));
        ctx.fillStyle = grad;
        ctx.fill();
      }
      break;
    }
    case 'bokeh': {
      const count = Math.round(scene.density * 0.8);
      for (let i = 0; i < count; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = (15 + rand() * 110) * scale;
        const color = scene.colors[Math.floor(rand() * scene.colors.length)];
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, shade(color, 0.4));
        grad.addColorStop(0.7, shade(color, 0.14));
        grad.addColorStop(1, shade(color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'waves': {
      const lines = 4 + Math.round(scene.density / 8);
      for (let i = 0; i < lines; i++) {
        const color = scene.colors[i % scene.colors.length];
        const yBase = h * (0.15 + (i / lines) * 0.7);
        ctx.beginPath();
        for (let x = 0; x <= w; x += Math.max(6, w / 180)) {
          const y =
            yBase +
            Math.sin((x / w) * Math.PI * 3 + i * 0.9) * h * 0.07 +
            Math.sin((x / w) * Math.PI * 7 - i * 0.5) * h * 0.025;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = shade(color, 0.5);
        ctx.lineWidth = Math.max(1, 2.5 * scale);
        ctx.stroke();
      }
      break;
    }
    case 'geometric': {
      const count = 5 + Math.round(scene.density / 6);
      for (let i = 0; i < count; i++) {
        const cx = rand() * w;
        const cy = rand() * h;
        const size = (40 + rand() * 160) * scale;
        const color = scene.colors[Math.floor(rand() * scene.colors.length)];
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rand() * Math.PI);
        ctx.strokeStyle = shade(color, 0.7);
        ctx.lineWidth = Math.max(1.5, 3 * scale);
        ctx.beginPath();
        const kind = i % 3;
        if (kind === 0) ctx.rect(-size / 2, -size / 2, size, size);
        else if (kind === 1) ctx.arc(0, 0, size / 2, 0, TAU);
        else {
          ctx.moveTo(0, -size / 2);
          ctx.lineTo(size / 2, size / 2);
          ctx.lineTo(-size / 2, size / 2);
          ctx.closePath();
        }
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'mesh': {
      const cols = 3;
      const rows = 3;
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const x = (cx / cols) * w + (rand() - 0.5) * w * 0.08;
          const y = (cy / rows) * h + (rand() - 0.5) * h * 0.08;
          const cw = w / cols + 6;
          const ch = h / rows + 6;
          const color = scene.colors[(cx + cy) % scene.colors.length];
          const grad = ctx.createLinearGradient(x, y, x + cw, y + ch);
          grad.addColorStop(0, shade(color, 0.9));
          grad.addColorStop(1, shade(scene.colors[(cx + cy + 1) % scene.colors.length], 0.9));
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, cw, ch);
        }
      }
      break;
    }
    case 'texture': {
      const count = Math.round(scene.density * 2.2);
      for (let i = 0; i < count; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = (2 + rand() * 26) * scale;
        const color = scene.colors[Math.floor(rand() * scene.colors.length)];
        ctx.fillStyle = shade(color, 0.12 + rand() * 0.3);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'pattern': {
      const step = (40 + scene.density) * scale;
      ctx.strokeStyle = shade(c2, 0.6);
      ctx.lineWidth = Math.max(1, 2 * scale);
      for (let x = step / 2; x < w + step; x += step) {
        for (let y = step / 2; y < h + step; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, step * 0.32, 0, TAU);
          ctx.stroke();
        }
      }
      break;
    }
    case 'starfield': {
      const count = Math.round(scene.density * 2.5);
      for (let i = 0; i < count; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = (0.6 + rand() * 2.4) * scale;
        const color = scene.colors[Math.floor(rand() * scene.colors.length)];
        ctx.fillStyle = shade(color, 0.35 + rand() * 0.65);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
      const gx = rand() * w;
      const gy = rand() * h;
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.45);
      grad.addColorStop(0, shade(c1, 0.3));
      grad.addColorStop(1, shade(c1, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case 'topographic': {
      const rings = 4 + Math.round(scene.density / 8);
      for (let i = 0; i < rings; i++) {
        const cx = w * (0.3 + rand() * 0.4);
        const cy = h * (0.3 + rand() * 0.4);
        const color = scene.colors[i % scene.colors.length];
        ctx.strokeStyle = shade(color, 0.55);
        ctx.lineWidth = Math.max(1, 2 * scale);
        for (let r = 1; r <= 6; r++) {
          ctx.beginPath();
          const radius = r * (30 + i * 8) * scale;
          for (let a = 0; a <= TAU + 0.1; a += 0.15) {
            const wobble = 1 + 0.18 * Math.sin(a * 3 + i + r * 0.7);
            const x = cx + Math.cos(a) * radius * wobble;
            const y = cy + Math.sin(a) * radius * wobble;
            if (a === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      break;
    }
  }

  // Grain.
  if (scene.grain > 0) {
    const dots = Math.round((scene.grain / 100) * 4000);
    for (let i = 0; i < dots; i++) {
      const x = rand() * w;
      const y = rand() * h;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(x, y, Math.max(1, scale), Math.max(1, scale));
    }
  }

  // Vignette.
  if (scene.vignette > 0) {
    const grad = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.35,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.75,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${(scene.vignette / 100) * 0.55})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

/** Build an editable SVG from the same scene data. */
export function backgroundToSvg(w: number, h: number, scene: BackgroundScene): string {
  const [c0, c1, c2] = scene.colors;
  const rand = mulberry32(scene.seed);
  const scale = Math.max(w, h) / 1000;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<defs><linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${mix(c0, c1, 0.55)}"/></linearGradient></defs>`,
    `<rect width="${w}" height="${h}" fill="url(#base)"/>`,
  ];

  const circle = (cx: number, cy: number, r: number, fill: string, opacity = 1) =>
    `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" opacity="${opacity}"/>`;

  switch (scene.style) {
    case 'gradient':
      parts.push(circle(w * 0.3, h * 0.3, Math.max(w, h) * 0.9, c2));
      break;
    case 'aurora': {
      const bands = 3 + Math.round(scene.density / 25);
      for (let i = 0; i < bands; i++) {
        const color = scene.colors[i % scene.colors.length];
        const yBase = h * (0.2 + (i / bands) * 0.55);
        const amp = h * 0.12;
        let d = `M0 ${h}`;
        for (let x = 0; x <= w; x += Math.max(8, w / 140)) {
          const y =
            yBase +
            Math.sin((x / w) * Math.PI * 2 * (1.4 + i * 0.5) + i * 1.9) * amp +
            Math.sin((x / w) * Math.PI * 5 + i) * amp * 0.3;
          d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
        }
        d += ` L${w} ${h} Z`;
        parts.push(`<path d="${d}" fill="${color}" opacity="0.45"/>`);
      }
      break;
    }
    case 'bokeh': {
      const count = Math.round(scene.density * 0.8);
      for (let i = 0; i < count; i++) {
        parts.push(circle(rand() * w, rand() * h, (15 + rand() * 110) * scale, scene.colors[Math.floor(rand() * scene.colors.length)]));
      }
      break;
    }
    case 'waves': {
      const lines = 4 + Math.round(scene.density / 8);
      for (let i = 0; i < lines; i++) {
        const color = scene.colors[i % scene.colors.length];
        const yBase = h * (0.15 + (i / lines) * 0.7);
        let d = '';
        for (let x = 0; x <= w; x += Math.max(6, w / 180)) {
          const y =
            yBase +
            Math.sin((x / w) * Math.PI * 3 + i * 0.9) * h * 0.07 +
            Math.sin((x / w) * Math.PI * 7 - i * 0.5) * h * 0.025;
          d += `${x === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
        }
        parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${(2.5 * scale).toFixed(1)}" opacity="0.6"/>`);
      }
      break;
    }
    case 'geometric': {
      const count = 5 + Math.round(scene.density / 6);
      for (let i = 0; i < count; i++) {
        const cx = rand() * w;
        const cy = rand() * h;
        const size = (40 + rand() * 160) * scale;
        const color = scene.colors[Math.floor(rand() * scene.colors.length)];
        const rot = (rand() * 180).toFixed(1);
        const kind = i % 3;
        if (kind === 0) {
          parts.push(
            `<rect x="${(cx - size / 2).toFixed(1)}" y="${(cy - size / 2).toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${(3 * scale).toFixed(1)}" transform="rotate(${rot} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`,
          );
        } else if (kind === 1) {
          parts.push(circle(cx, cy, size / 2, 'none', 1).replace('fill="none"', `fill="none" stroke="${color}" stroke-width="${(3 * scale).toFixed(1)}"`));
        } else {
          parts.push(
            `<polygon points="${cx.toFixed(1)},${(cy - size / 2).toFixed(1)} ${(cx + size / 2).toFixed(1)},${(cy + size / 2).toFixed(1)} ${(cx - size / 2).toFixed(1)},${(cy + size / 2).toFixed(1)}" fill="none" stroke="${color}" stroke-width="${(3 * scale).toFixed(1)}" transform="rotate(${rot} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`,
          );
        }
      }
      break;
    }
    case 'mesh': {
      const cols = 3;
      const rows = 3;
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const x = (cx / cols) * w + (rand() - 0.5) * w * 0.08;
          const y = (cy / rows) * h + (rand() - 0.5) * h * 0.08;
          parts.push(
            `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(w / cols + 6).toFixed(1)}" height="${(h / rows + 6).toFixed(1)}" fill="${scene.colors[(cx + cy) % scene.colors.length]}" opacity="0.9"/>`,
          );
        }
      }
      break;
    }
    case 'texture': {
      const count = Math.round(scene.density * 2.2);
      for (let i = 0; i < count; i++) {
        parts.push(circle(rand() * w, rand() * h, (2 + rand() * 26) * scale, scene.colors[Math.floor(rand() * scene.colors.length)]));
      }
      break;
    }
    case 'pattern': {
      const step = (40 + scene.density) * scale;
      for (let x = step / 2; x < w + step; x += step) {
        for (let y = step / 2; y < h + step; y += step) {
          parts.push(
            `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(step * 0.32).toFixed(1)}" fill="none" stroke="${c2}" stroke-width="${(2 * scale).toFixed(1)}" opacity="0.6"/>`,
          );
        }
      }
      break;
    }
    case 'starfield': {
      const count = Math.round(scene.density * 2.5);
      for (let i = 0; i < count; i++) {
        parts.push(circle(rand() * w, rand() * h, (0.6 + rand() * 2.4) * scale, scene.colors[Math.floor(rand() * scene.colors.length)]));
      }
      break;
    }
    case 'topographic': {
      const rings = 4 + Math.round(scene.density / 8);
      for (let i = 0; i < rings; i++) {
        const cx = w * (0.3 + rand() * 0.4);
        const cy = h * (0.3 + rand() * 0.4);
        const color = scene.colors[i % scene.colors.length];
        for (let r = 1; r <= 6; r++) {
          const radius = r * (30 + i * 8) * scale;
          let d = '';
          for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) {
            const wobble = 1 + 0.18 * Math.sin(a * 3 + i + r * 0.7);
            const x = cx + Math.cos(a) * radius * wobble;
            const y = cy + Math.sin(a) * radius * wobble;
            d += `${a === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
          }
          parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${(2 * scale).toFixed(1)}" opacity="0.55"/>`);
        }
      }
      break;
    }
  }

  parts.push('</svg>');
  return parts.join('');
}

function psColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (((n >> 16) & 255) / 255).toFixed(3);
  const g = (((n >> 8) & 255) / 255).toFixed(3);
  const b = ((n & 255) / 255).toFixed(3);
  return `${r} ${g} ${b} setrgbcolor`;
}

/**
 * Build a real EPS (PostScript) file from the scene: filled rects, circles
 * and stroked paths as native PostScript operators, so Adobe Illustrator
 * opens it as editable vector artwork.
 */
export function backgroundToEps(w: number, h: number, scene: BackgroundScene): string {
  const [c0, c1] = scene.colors;
  const rand = mulberry32(scene.seed);
  const scale = Math.max(w, h) / 1000;
  const lines: string[] = [
    '%!PS-Adobe-3.0 EPSF-3.0',
    `%%BoundingBox: 0 0 ${w} ${h}`,
    '%%Creator: vecmotion Background Generator',
    '%%EndComments',
    `${w} ${h} translate`,
    // Base rectangle (PostScript origin is bottom-left; flip Y).
    `${psColor(c0)}`,
    `0 0 ${w} ${h} rectfill`,
  ];

  const rect = (x: number, y: number, rw: number, rh: number, color: string) => {
    lines.push(`${psColor(color)}`, `newpath ${x.toFixed(1)} ${(h - y - rh).toFixed(1)} ${rw.toFixed(1)} ${rh.toFixed(1)} rectfill`);
  };
  const circle = (cx: number, cy: number, r: number, color: string) => {
    lines.push(`${psColor(color)}`, `newpath ${cx.toFixed(1)} ${(h - cy).toFixed(1)} ${r.toFixed(1)} 0 360 arc fill`);
  };
  const strokeCircle = (cx: number, cy: number, r: number, color: string, lw: number) => {
    lines.push(`${psColor(color)} ${lw.toFixed(1)} setlinewidth`, `newpath ${cx.toFixed(1)} ${(h - cy).toFixed(1)} ${r.toFixed(1)} 0 360 arc stroke`);
  };

  switch (scene.style) {
    case 'gradient':
    case 'mesh':
      rect(0, 0, w, h, c1);
      break;
    case 'aurora': {
      const bands = 3 + Math.round(scene.density / 25);
      for (let i = 0; i < bands; i++) {
        const color = scene.colors[i % scene.colors.length];
        const yBase = h * (0.2 + (i / bands) * 0.55);
        const amp = h * 0.12;
        lines.push(`${psColor(color)} newpath 0 ${h.toFixed(1)} moveto`);
        for (let x = 0; x <= w; x += Math.max(8, w / 140)) {
          const y =
            yBase +
            Math.sin((x / w) * Math.PI * 2 * (1.4 + i * 0.5) + i * 1.9) * amp +
            Math.sin((x / w) * Math.PI * 5 + i) * amp * 0.3;
          lines.push(`${x.toFixed(1)} ${(h - y).toFixed(1)} lineto`);
        }
        lines.push(`${w} ${h.toFixed(1)} lineto closepath fill`);
      }
      break;
    }
    case 'bokeh': {
      const count = Math.round(scene.density * 0.8);
      for (let i = 0; i < count; i++) {
        circle(rand() * w, rand() * h, (15 + rand() * 110) * scale, scene.colors[Math.floor(rand() * scene.colors.length)]);
      }
      break;
    }
    case 'waves': {
      const linesCount = 4 + Math.round(scene.density / 8);
      for (let i = 0; i < linesCount; i++) {
        const color = scene.colors[i % scene.colors.length];
        const yBase = h * (0.15 + (i / linesCount) * 0.7);
        lines.push(`${psColor(color)} ${(2.5 * scale).toFixed(1)} setlinewidth newpath`);
        for (let x = 0; x <= w; x += Math.max(6, w / 180)) {
          const y =
            yBase +
            Math.sin((x / w) * Math.PI * 3 + i * 0.9) * h * 0.07 +
            Math.sin((x / w) * Math.PI * 7 - i * 0.5) * h * 0.025;
          lines.push(`${x === 0 ? 'moveto' : 'lineto'} ${x.toFixed(1)} ${(h - y).toFixed(1)} ${x === 0 ? '' : ''}`.trim());
        }
        lines.push('stroke');
      }
      break;
    }
    case 'geometric': {
      const count = 5 + Math.round(scene.density / 6);
      for (let i = 0; i < count; i++) {
        strokeCircle(rand() * w, rand() * h, (20 + rand() * 80) * scale, scene.colors[Math.floor(rand() * scene.colors.length)], 3 * scale);
      }
      break;
    }
    case 'texture': {
      const count = Math.round(scene.density * 2.2);
      for (let i = 0; i < count; i++) {
        circle(rand() * w, rand() * h, (2 + rand() * 26) * scale, scene.colors[Math.floor(rand() * scene.colors.length)]);
      }
      break;
    }
    case 'pattern': {
      const step = (40 + scene.density) * scale;
      for (let x = step / 2; x < w + step; x += step) {
        for (let y = step / 2; y < h + step; y += step) {
          strokeCircle(x, y, step * 0.32, scene.colors[2], 2 * scale);
        }
      }
      break;
    }
    case 'starfield': {
      const count = Math.round(scene.density * 2.5);
      for (let i = 0; i < count; i++) {
        circle(rand() * w, rand() * h, (0.6 + rand() * 2.4) * scale, scene.colors[Math.floor(rand() * scene.colors.length)]);
      }
      break;
    }
    case 'topographic': {
      const rings = 4 + Math.round(scene.density / 8);
      for (let i = 0; i < rings; i++) {
        const cx = w * (0.3 + rand() * 0.4);
        const cy = h * (0.3 + rand() * 0.4);
        const color = scene.colors[i % scene.colors.length];
        for (let r = 1; r <= 6; r++) {
          const radius = r * (30 + i * 8) * scale;
          lines.push(`${psColor(color)} ${(2 * scale).toFixed(1)} setlinewidth newpath`);
          for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) {
            const wobble = 1 + 0.18 * Math.sin(a * 3 + i + r * 0.7);
            const x = cx + Math.cos(a) * radius * wobble;
            const y = cy + Math.sin(a) * radius * wobble;
            lines.push(`${a === 0 ? 'moveto' : 'lineto'} ${x.toFixed(1)} ${(h - y).toFixed(1)}`);
          }
          lines.push('closepath stroke');
        }
      }
      break;
    }
  }

  lines.push('%%EOF');
  return lines.join('\n');
}
