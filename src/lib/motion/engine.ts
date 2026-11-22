/**
 * Procedural motion engine for the Motion Video Generator.
 *
 * Everything here is pure canvas 2D math: no external AI model, no API, no
 * network. Each style is a function of a loop phase in [0, 1) built only from
 * sin/cos of 2π·phase, so every render is a seamless loop by construction.
 *
 * A seeded RNG (mulberry32) plus the user's idea text give each session a
 * distinct composition: same style, different layout, palette and rhythm.
 * Nothing is copied from any stock template; the output is original motion
 * computed on the device and safe for commercial use.
 */

export type MotionStyleId =
  | 'particles'
  | 'aurora'
  | 'bokeh'
  | 'waves'
  | 'flowfield'
  | 'starfield'
  | 'geometric'
  | 'mesh'
  | 'kenburns';

export interface MotionPalette {
  id: string;
  label: string;
  colors: string[];
}

export const MOTION_PALETTES: MotionPalette[] = [
  { id: 'ocean', label: 'Ocean', colors: ['#0ea5e9', '#06b6d4', '#22d3ee', '#a5f3fc'] },
  { id: 'sunset', label: 'Sunset', colors: ['#f97316', '#ef4444', '#ec4899', '#fbbf24'] },
  { id: 'forest', label: 'Forest', colors: ['#10b981', '#34d399', '#84cc16', '#a7f3d0'] },
  { id: 'cosmic', label: 'Cosmic', colors: ['#6366f1', '#8b5cf6', '#a855f7', '#e879f9'] },
  { id: 'gold', label: 'Gold', colors: ['#f59e0b', '#fbbf24', '#fde68a', '#fff7ed'] },
  { id: 'mono', label: 'Mono', colors: ['#e2e8f0', '#94a3b8', '#64748b', '#f8fafc'] },
  { id: 'rose', label: 'Rose', colors: ['#f43f5e', '#fb7185', '#fda4af', '#ffe4e6'] },
  { id: 'mint', label: 'Mint', colors: ['#14b8a6', '#2dd4bf', '#5eead4', '#ccfbf1'] },
];

export interface MotionParams {
  style: MotionStyleId;
  /** Seed for layout randomness (derived from idea text + randomize). */
  seed: number;
  /** 0.25 .. 3 playback speed multiplier. */
  speed: number;
  /** 0 .. 100 density / intensity. */
  intensity: number;
  palette: string[];
  /** Background base colour. */
  background: string;
}

export const MOTION_STYLES: Array<{ id: MotionStyleId; label: string }> = [
  { id: 'particles', label: 'Particles' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'bokeh', label: 'Bokeh' },
  { id: 'waves', label: 'Waves' },
  { id: 'flowfield', label: 'Flow field' },
  { id: 'starfield', label: 'Starfield' },
  { id: 'geometric', label: 'Geometric' },
  { id: 'mesh', label: 'Gradient mesh' },
  { id: 'kenburns', label: 'Photo drift' },
];

/** FNV-1a hash: idea text becomes a stable seed and palette pick. */
export function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
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

const TAU = Math.PI * 2;

interface Particle {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
  color: string;
  drift: number;
}

function buildParticles(params: MotionParams, w: number, h: number): Particle[] {
  const rand = mulberry32(params.seed);
  const count = Math.round(30 + (params.intensity / 100) * 170);
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: rand() * w,
      y: rand() * h,
      r: 1.5 + rand() * 5,
      speed: 0.4 + rand() * 1.2,
      phase: rand() * TAU,
      color: params.palette[Math.floor(rand() * params.palette.length)],
      drift: 10 + rand() * 60,
    });
  }
  return out;
}

function shade(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Draw one frame. `phase` is the loop position in [0, 1); `time` is seconds
 * (phase * duration * speed). All motion is periodic in phase, so frame 0 and
 * frame N are identical and the exported clip loops seamlessly.
 */
export function drawMotionFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phase: number,
  params: MotionParams,
  image?: HTMLImageElement | null,
): void {
  const t = phase * TAU;
  const speed = params.speed;
  const intensity = params.intensity / 100;

  ctx.fillStyle = params.background;
  ctx.fillRect(0, 0, w, h);

  const scale = Math.max(w, h) / 1000;

  switch (params.style) {
    case 'particles': {
      const parts = buildParticles(params, w, h);
      for (const p of parts) {
        const x = p.x + Math.sin(t * p.speed * speed + p.phase) * p.drift * scale;
        const y = p.y + Math.cos(t * p.speed * speed * 0.8 + p.phase) * p.drift * scale;
        const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2 * speed + p.phase * 3));
        ctx.beginPath();
        ctx.arc(x, y, p.r * scale * (0.7 + 0.5 * tw), 0, TAU);
        ctx.fillStyle = shade(p.color, 0.25 + 0.65 * tw);
        ctx.fill();
      }
      break;
    }
    case 'aurora': {
      const bands = 3 + Math.round(intensity * 4);
      for (let i = 0; i < bands; i++) {
        const color = params.palette[i % params.palette.length];
        const yBase = h * (0.25 + (i / bands) * 0.5);
        const amp = h * (0.08 + 0.1 * intensity);
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += Math.max(8, w / 120)) {
          const y =
            yBase +
            Math.sin((x / w) * Math.PI * 2 * (1.5 + i * 0.4) + t * speed + i * 1.7) * amp +
            Math.sin((x / w) * Math.PI * 5 + t * speed * 0.6) * amp * 0.35;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, yBase - amp, 0, h);
        grad.addColorStop(0, shade(color, 0.5));
        grad.addColorStop(1, shade(color, 0.05));
        ctx.fillStyle = grad;
        ctx.fill();
      }
      break;
    }
    case 'bokeh': {
      const rand = mulberry32(params.seed + 7);
      const count = Math.round(12 + intensity * 40);
      for (let i = 0; i < count; i++) {
        const bx = rand() * w;
        const by = rand() * h;
        const br = (20 + rand() * 90) * scale;
        const color = params.palette[Math.floor(rand() * params.palette.length)];
        const x = bx + Math.sin(t * speed * 0.5 + i) * 30 * scale;
        const y = by + Math.cos(t * speed * 0.4 + i * 1.3) * 30 * scale;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, br);
        grad.addColorStop(0, shade(color, 0.35));
        grad.addColorStop(0.7, shade(color, 0.12));
        grad.addColorStop(1, shade(color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, br, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'waves': {
      const lines = 5 + Math.round(intensity * 10);
      for (let i = 0; i < lines; i++) {
        const color = params.palette[i % params.palette.length];
        const yBase = h * (0.2 + (i / lines) * 0.6);
        ctx.beginPath();
        for (let x = 0; x <= w; x += Math.max(6, w / 160)) {
          const y =
            yBase +
            Math.sin((x / w) * Math.PI * 3 + t * speed + i * 0.9) * h * 0.06 +
            Math.sin((x / w) * Math.PI * 7 - t * speed * 0.7) * h * 0.02;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = shade(color, 0.35 + 0.5 * intensity);
        ctx.lineWidth = Math.max(1, 2.5 * scale);
        ctx.stroke();
      }
      break;
    }
    case 'flowfield': {
      const rand = mulberry32(params.seed + 13);
      const count = Math.round(40 + intensity * 160);
      ctx.lineWidth = Math.max(1, 1.4 * scale);
      for (let i = 0; i < count; i++) {
        const sx = rand() * w;
        const sy = rand() * h;
        const color = params.palette[Math.floor(rand() * params.palette.length)];
        ctx.strokeStyle = shade(color, 0.5);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        let x = sx;
        let y = sy;
        const steps = 14;
        for (let s = 0; s < steps; s++) {
          const angle =
            Math.sin((x / w) * Math.PI * 2 + t * speed) * 1.6 +
            Math.cos((y / h) * Math.PI * 2 - t * speed * 0.8) * 1.2;
          x += Math.cos(angle) * 14 * scale;
          y += Math.sin(angle) * 14 * scale;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'starfield': {
      const rand = mulberry32(params.seed + 29);
      const count = Math.round(60 + intensity * 220);
      for (let i = 0; i < count; i++) {
        const sx = rand() * w;
        const sy = rand() * h;
        const depth = 0.3 + rand() * 0.7;
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * (1 + depth) * speed + i));
        const color = params.palette[Math.floor(rand() * params.palette.length)];
        ctx.beginPath();
        ctx.arc(sx, sy, (0.8 + depth * 2.2) * scale, 0, TAU);
        ctx.fillStyle = shade(color, tw);
        ctx.fill();
      }
      // A slow drifting glow for depth.
      const gx = w * (0.5 + 0.3 * Math.sin(t * speed * 0.3));
      const gy = h * (0.5 + 0.3 * Math.cos(t * speed * 0.25));
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.4);
      grad.addColorStop(0, shade(params.palette[0], 0.18));
      grad.addColorStop(1, shade(params.palette[0], 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case 'geometric': {
      const rand = mulberry32(params.seed + 41);
      const count = 6 + Math.round(intensity * 14);
      for (let i = 0; i < count; i++) {
        const cx = rand() * w;
        const cy = rand() * h;
        const size = (30 + rand() * 90) * scale;
        const color = params.palette[Math.floor(rand() * params.palette.length)];
        const x = cx + Math.sin(t * speed * 0.5 + i * 1.1) * 40 * scale;
        const y = cy + Math.cos(t * speed * 0.45 + i * 0.7) * 40 * scale;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * speed * 0.2 * (i % 2 === 0 ? 1 : -1) + i);
        ctx.strokeStyle = shade(color, 0.75);
        ctx.lineWidth = Math.max(1.5, 2.5 * scale);
        const kind = i % 3;
        ctx.beginPath();
        if (kind === 0) {
          ctx.rect(-size / 2, -size / 2, size, size);
        } else if (kind === 1) {
          ctx.arc(0, 0, size / 2, 0, TAU);
        } else {
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
          const ox = Math.sin(t * speed * 0.5 + cx * 1.3 + cy) * w * 0.06;
          const oy = Math.cos(t * speed * 0.45 + cy * 1.1 + cx) * h * 0.06;
          const x = (cx / cols) * w + ox;
          const y = (cy / rows) * h + oy;
          const cw = w / cols + 4;
          const ch = h / rows + 4;
          const color = params.palette[(cx + cy) % params.palette.length];
          const grad = ctx.createLinearGradient(x, y, x + cw, y + ch);
          grad.addColorStop(0, shade(color, 0.85));
          grad.addColorStop(1, shade(params.palette[(cx + cy + 1) % params.palette.length], 0.85));
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, cw, ch);
        }
      }
      break;
    }
    case 'kenburns': {
      if (image) {
        const iw = image.naturalWidth || image.width;
        const ih = image.naturalHeight || image.height;
        const cover = Math.max(w / iw, h / ih);
        const zoom = 1.05 + 0.12 * (0.5 + 0.5 * Math.sin(t * speed));
        const dw = iw * cover * zoom;
        const dh = ih * cover * zoom;
        const dx = (w - dw) / 2 + Math.sin(t * speed * 0.5) * w * 0.04;
        const dy = (h - dh) / 2 + Math.cos(t * speed * 0.4) * h * 0.04;
        ctx.drawImage(image, dx, dy, dw, dh);
        // Soft colour wash so the photo feels like a designed loop.
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, shade(params.palette[0], 0.12));
        grad.addColorStop(1, shade(params.palette[1] ?? params.palette[0], 0.12));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      } else {
        // No photo yet: fall back to a drifting gradient so the preview is alive.
        const grad = ctx.createLinearGradient(
          w * (0.5 + 0.5 * Math.sin(t * speed * 0.3)),
          h * (0.5 + 0.5 * Math.cos(t * speed * 0.3)),
          w * (0.5 - 0.5 * Math.sin(t * speed * 0.3)),
          h * (0.5 - 0.5 * Math.cos(t * speed * 0.3)),
        );
        grad.addColorStop(0, params.palette[0]);
        grad.addColorStop(1, params.palette[1] ?? params.palette[0]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
  }
}

/** Pick a mime type the device can actually record. MP4 first (marketplace friendly). */
export function pickRecorderMime(): string {
  const candidates = [
    'video/mp4;codecs=avc1.640028',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  try {
    if (typeof MediaRecorder === 'undefined') return '';
    return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? '';
  } catch {
    return '';
  }
}

export function mimeExtension(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm';
}
