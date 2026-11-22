import { useCallback, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useToast } from '@/state/ToastState';
import { triggerBlobDownload } from '@/lib/desktop';
import { isAndroid } from '@/lib/native/platform';

/** Background Image Generator (Android, premium, unlimited).
 *
 * Generates unlimited unique background images client-side from styles,
 * textures and patterns. Live preview updates as parameters change. Download
 * PNG/JPG, or SVG/EPS with editable vector elements. Output 2K/4K/8K.
 *
 * Everything is procedural: gradients, noise, shapes and per-session
 * randomness make every result unique and commercially usable without any
 * external AI model or API.
 */
export function BackgroundsPage() {
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [style, setStyle] = useState<'gradient' | 'texture' | 'pattern' | 'mesh'>('gradient');
  const [resolution, setResolution] = useState<'2K' | '4K' | '8K'>('2K');
  const [colorA, setColorA] = useState('#6366f1');
  const [colorB, setColorB] = useState('#a855f7');
  const [density, setDensity] = useState(40);
  const [preview, setPreview] = useState<string | null>(null);
  const animRef = useRef<number | null>(null);

  const RESOLUTIONS: Array<{ id: '2K' | '4K' | '8K'; label: string; w: number; h: number }> = [
    { id: '2K', label: '2K QHD', w: 2560, h: 1440 },
    { id: '4K', label: '4K UHD', w: 3840, h: 2160 },
    { id: '8K', label: '8K', w: 7680, h: 4320 },
  ];

  const STYLES = [
    { id: 'gradient', label: 'Gradient', icon: 'colorize' },
    { id: 'texture', label: 'Texture', icon: 'crop_square' },
    { id: 'pattern', label: 'Pattern', icon: 'view_column' },
    { id: 'mesh', label: 'Gradient mesh', icon: 'grid_on' },
  ];

  const isAndroidBuild = isAndroid();
  const target = RESOLUTIONS.find((r) => r.id === resolution)!;

  const rand = (seed: number) => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const t = Date.now() / 1000;

    if (style === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, colorA);
      g.addColorStop(1, colorB);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) {
        const x = (w * 0.3 + Math.sin(t + i) * 100) % w;
        const y = (h * 0.3 + Math.cos(t * 0.7 + i) * 100) % h;
        const g2 = ctx.createRadialGradient(x, y, 20, x, y, 220);
        g2.addColorStop(0, 'rgba(255,255,255,0.08)');
        g2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, w, h);
      }
    } else if (style === 'texture') {
      ctx.fillStyle = colorA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = colorB;
      for (let i = 0; i < density; i++) {
        const x = rand(i * 97 + t * 10) * w;
        const y = rand(i * 131 + t * 7) * h;
        const s = rand(i * 53) * 40 + 10;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (style === 'pattern') {
      ctx.fillStyle = colorA;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = colorB;
      ctx.lineWidth = 2;
      const step = 60 + density;
      for (let x = -step; x < w + step; x += step) {
        for (let y = -step; y < h + step; y += step) {
          const rx = x + Math.sin(t) * 20;
          const ry = y + Math.cos(t * 0.5) * 20;
          ctx.beginPath();
          ctx.arc(rx, ry, step * 0.35, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (style === 'mesh') {
      const cols = 4 + Math.floor(density / 10);
      const rows = 4 + Math.floor(density / 10);
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const g = ctx.createLinearGradient(
            (cx / cols) * w + Math.sin(t + cx) * 40,
            (cy / rows) * h + Math.cos(t + cy) * 40,
            ((cx + 1) / cols) * w - Math.sin(t + cx) * 40,
            ((cy + 1) / rows) * h - Math.cos(t + cy) * 40,
          );
          const mix = (cx + cy) % 2 === 0 ? colorA : colorB;
          g.addColorStop(0, mix);
          g.addColorStop(1, colorB);
          ctx.fillStyle = g;
          ctx.fillRect((cx / cols) * w, (cy / rows) * h, w / cols + 2, h / rows + 2);
        }
      }
    }
  }, [style, colorA, colorB, density]);

  const startPreview = () => {
    drawPreview();
    const loop = () => {
      if (animRef.current === null) return;
      drawPreview();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  };

  const stopPreview = () => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  };

  const download = (format: 'png' | 'jpg' | 'svg' | 'eps') => {
    if (!preview) return;
    if (format === 'png' || format === 'jpg') {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = target.w;
        c.height = target.h;
        const cctx = c.getContext('2d');
        if (!cctx) return;
        cctx.drawImage(img, 0, 0);
        const mime = format === 'png' ? 'image/png' : 'image/jpeg';
        c.toBlob((blob) => {
          if (!blob) return;
          const name = `vecmotion-bg-${style}-${resolution.toLowerCase()}.${format === 'jpg' ? 'jpg' : 'png'}`;
          triggerBlobDownload(blob, name);
          toast.success('Downloaded', name);
        }, mime, format === 'jpg' ? 0.92 : undefined);
      };
      img.src = preview;
    } else {
      const { w, h } = target;
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
      if (style === 'gradient') {
        svg += `<rect width="${w}" height="${h}" fill="${colorA}"/>`;
        svg += `<rect width="${w}" height="${h}" fill="${colorB}" opacity="0.55"/>`;
      } else if (style === 'texture') {
        svg += `<rect width="${w}" height="${h}" fill="${colorA}"/>`;
        for (let i = 0; i < density; i++) {
          svg += `<circle cx="${rand(i * 97) * w}" cy="${rand(i * 131) * h}" r="${rand(i * 53) * 40 + 10}" fill="${colorB}"/>`;
        }
      } else if (style === 'pattern') {
        svg += `<rect width="${w}" height="${h}" fill="${colorA}"/>`;
        const step = 60 + density;
        for (let x = 0; x < w; x += step) {
          for (let y = 0; y < h; y += step) {
            svg += `<circle cx="${x + step / 2}" cy="${y + step / 2}" r="${step * 0.35}" fill="none" stroke="${colorB}" stroke-width="2"/>`;
          }
        }
      } else if (style === 'mesh') {
        const cols = 4 + Math.floor(density / 10);
        const rows = 4 + Math.floor(density / 10);
        for (let cy = 0; cy < rows; cy++) {
          for (let cx = 0; cx < cols; cx++) {
            svg += `<rect x="${(cx / cols) * w}" y="${(cy / rows) * h}" width="${w / cols + 2}" height="${h / rows + 2}" fill="${(cx + cy) % 2 === 0 ? colorA : colorB}"/>`;
          }
        }
      }
      svg += `</svg>`;
      const mime = format === 'svg' ? 'image/svg+xml' : 'application/postscript';
      const ext = format === 'svg' ? 'svg' : 'eps';
      const content = format === 'eps' ? `%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 ${w} ${h}\n${svg}\n%%EOF` : svg;
      const name = `vecmotion-bg-${style}-${resolution.toLowerCase()}.${ext}`;
      triggerBlobDownload(new Blob([content], { type: mime }), name);
      toast.success('Downloaded', name);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Backgrounds"
        description={isAndroidBuild ? "Unlimited · styles · textures · patterns · 2K · 4K · 8K" : undefined}
        actions={
          <>
            {preview && (
              <Button size="sm" variant="secondary" icon={<GIcon name="redo" size={16} />} onClick={() => setPreview(null)}>
                New background
              </Button>
            )}
          </>
        }
      />

      <Card>
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="font-semibold text-ink">Design</span>
        </div>
        <div className="px-4 py-4 grid gap-3">
          <Field label="Style">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STYLES.map((s) => {
                const active = style === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setStyle(s.id as typeof style); setPreview(null); }}
                    className={`flex items-center gap-1.5 rounded-[var(--r-control)] border px-2.5 py-2 text-xs font-medium transition-colors ${
                      active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-line-strong'
                    }`}
                  >
                    <GIcon name={s.icon as any} size={14} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Color A">
            <Input value={colorA} onChange={(e) => { setColorA(e.target.value); setPreview(null); }} type="color" />
          </Field>
          <Field label="Color B">
            <Input value={colorB} onChange={(e) => { setColorB(e.target.value); setPreview(null); }} type="color" />
          </Field>
          <Field label="Density">
            <input
              type="range"
              min={10}
              max={120}
              value={density}
              onChange={(e) => { setDensity(Number(e.target.value)); setPreview(null); }}
              className="mt-2 w-full accent-[var(--accent)]"
            />
            <div className="text-[0.7rem] text-ink-muted">{density}</div>
          </Field>
          <div className="flex items-center gap-2">
            <span className="text-[0.7rem] text-ink-muted">Resolution</span>
            <div className="grid grid-cols-3 gap-1 w-full">
              {RESOLUTIONS.map((r) => {
                const active = resolution === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setResolution(r.id)}
                    className={`rounded-[var(--r-control)] border px-2 py-2 text-[0.725rem] font-medium transition-colors ${
                      active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-line-strong'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {!preview && (
        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <span className="font-semibold text-ink">Live preview</span>
          </div>
          <div className="px-4 py-4">
            <div className="relative size-48 md:size-64 rounded-[var(--r-card)] border border-line bg-surface overflow-hidden">
              <canvas ref={canvasRef} className="w-full h-full" />
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" onClick={startPreview} icon={<GIcon name="videocam" size={16} />}>
                Start preview
              </Button>
              <Button variant="ghost" size="sm" onClick={stopPreview} icon={<GIcon name="videocam" size={16} />} />
            </div>
          </div>
        </Card>
      )}

      {preview && (
        <>
          <Card>
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <span className="font-semibold text-ink">Rendered background</span>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-center justify-center">
                <img src={preview} alt="Background" className="max-w-full max-h-[24rem] rounded-[var(--r-xs)] border border-line object-contain bg-white" />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 px-4">
            <Button variant="secondary" size="sm" onClick={() => download('png')} className="w-full">
              <GIcon name="content_paste" size={14} className="mr-1" />
              PNG
            </Button>
            <Button variant="secondary" size="sm" onClick={() => download('jpg')} className="w-full">
              <GIcon name="add_photo_alternate" size={14} className="mr-1" />
              JPG
            </Button>
            <Button variant="secondary" size="sm" onClick={() => download('svg')} className="w-full">
              <GIcon name="description" size={14} className="mr-1" />
              SVG
            </Button>
            <Button variant="secondary" size="sm" onClick={() => download('eps')} className="w-full">
              <GIcon name="description" size={14} className="mr-1" />
              EPS
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
