import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useToast } from '@/state/ToastState';
import { triggerBlobDownload } from '@/lib/desktop';
import { isAndroid } from '@/lib/native/platform';
import {
  BACKGROUND_PALETTES,
  BACKGROUND_STYLES,
  backgroundToEps,
  backgroundToSvg,
  drawBackground,
  type BackgroundScene,
  type BackgroundStyleId,
} from '@/lib/motion/backgrounds';

type ResolutionId = '2K' | '4K' | '8K';
type AspectId = '16:9' | '9:16' | '1:1' | '4:5';

const RESOLUTIONS: Array<{ id: ResolutionId; label: string; w: number; h: number }> = [
  { id: '2K', label: '2K', w: 2560, h: 1440 },
  { id: '4K', label: '4K', w: 3840, h: 2160 },
  { id: '8K', label: '8K', w: 7680, h: 4320 },
];

const ASPECTS: Array<{ id: AspectId; label: string; w: number; h: number }> = [
  { id: '16:9', label: '16:9', w: 16, h: 9 },
  { id: '9:16', label: '9:16', w: 9, h: 16 },
  { id: '1:1', label: '1:1', w: 1, h: 1 },
  { id: '4:5', label: '4:5', w: 4, h: 5 },
];

/**
 * Background Image Generator (Android).
 *
 * Unlimited unique backgrounds from 10 styles, 8 palettes and a seed you can
 * shuffle forever. The live preview updates instantly as you change anything.
 * Download PNG or JPG at 2K, 4K or 8K, or SVG / EPS with real editable
 * vector shapes. Everything is generated on the device: original designs,
 * commercially usable, no external AI.
 */
export function BackgroundsPage() {
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [style, setStyle] = useState<BackgroundStyleId>('aurora');
  const [paletteId, setPaletteId] = useState('indigo');
  const [customColors, setCustomColors] = useState(false);
  const [colorA, setColorA] = useState('#312e81');
  const [colorB, setColorB] = useState('#6366f1');
  const [colorC, setColorC] = useState('#a5b4fc');
  const [density, setDensity] = useState(50);
  const [grain, setGrain] = useState(15);
  const [vignette, setVignette] = useState(20);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [resolution, setResolution] = useState<ResolutionId>('2K');
  const [aspect, setAspect] = useState<AspectId>('16:9');
  const [rendered, setRendered] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const palette = BACKGROUND_PALETTES.find((p) => p.id === paletteId) ?? BACKGROUND_PALETTES[0];
  const aspectDef = ASPECTS.find((a) => a.id === aspect) ?? ASPECTS[0];
  const target = RESOLUTIONS.find((r) => r.id === resolution) ?? RESOLUTIONS[0];
  const isAndroidBuild = isAndroid();

  const scene: BackgroundScene = {
    style,
    colors: customColors ? [colorA, colorB, colorC] : palette.colors,
    seed,
    density,
    grain,
    vignette,
  };

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawBackground(ctx, canvas.width, canvas.height, scene);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, paletteId, customColors, colorA, colorB, colorC, density, grain, vignette, seed]);

  useEffect(() => {
    drawPreview();
    setRendered(null);
  }, [drawPreview]);

  const shuffle = () => {
    setSeed(Math.floor(Math.random() * 1_000_000));
  };

  const surprise = () => {
    const styles = BACKGROUND_STYLES.map((s) => s.id);
    setStyle(styles[Math.floor(Math.random() * styles.length)]);
    setPaletteId(BACKGROUND_PALETTES[Math.floor(Math.random() * BACKGROUND_PALETTES.length)].id);
    setCustomColors(false);
    setSeed(Math.floor(Math.random() * 1_000_000));
    setDensity(30 + Math.floor(Math.random() * 70));
  };

  const outputSize = () => {
    const scale = Math.min(target.w / aspectDef.w, target.h / aspectDef.h);
    return { w: Math.round(aspectDef.w * scale), h: Math.round(aspectDef.h * scale) };
  };

  const generate = () => {
    if (rendering) return;
    setRendering(true);
    // Let the button paint before the heavy full-res render.
    requestAnimationFrame(() => {
      try {
        const { w, h } = outputSize();
        const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
        let outW = w;
        let outH = h;
        if (target.id === '8K' && deviceMemory < 6) {
          outW = Math.round(w / 2);
          outH = Math.round(h / 2);
          toast.info('Rendered at 4K', 'This device has limited memory for an 8K canvas');
        }
        const off = document.createElement('canvas');
        off.width = outW;
        off.height = outH;
        const ctx = off.getContext('2d');
        if (!ctx) throw new Error('Could not create the render canvas');
        drawBackground(ctx, outW, outH, scene);
        setRendered(off.toDataURL('image/png'));
        toast.success('Background generated', `${outW}×${outH}`);
      } catch (err) {
        toast.error('Generation failed', err instanceof Error ? err.message : String(err));
      } finally {
        setRendering(false);
      }
    });
  };

  const downloadRaster = (format: 'png' | 'jpg') => {
    if (!rendered) return;
    const img = new Image();
    img.onload = () => {
      const { w, h } = outputSize();
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      c.toBlob(
        (blob) => {
          if (!blob) return;
          const name = `vecmotion-bg-${style}-${resolution.toLowerCase()}.${format === 'jpg' ? 'jpg' : 'png'}`;
          triggerBlobDownload(blob, name);
          toast.success('Downloaded', name);
        },
        format === 'jpg' ? 'image/jpeg' : 'image/png',
        format === 'jpg' ? 0.92 : undefined,
      );
    };
    img.src = rendered;
  };

  const downloadVector = (format: 'svg' | 'eps') => {
    const { w, h } = outputSize();
    const content = format === 'svg' ? backgroundToSvg(w, h, scene) : backgroundToEps(w, h, scene);
    const mime = format === 'svg' ? 'image/svg+xml' : 'application/postscript';
    const name = `vecmotion-bg-${style}-${resolution.toLowerCase()}.${format}`;
    triggerBlobDownload(new Blob([content], { type: mime }), name);
    toast.success('Downloaded', name);
  };

  const previewW = aspectDef.w >= aspectDef.h ? 640 : Math.round(640 * (aspectDef.w / aspectDef.h));
  const previewH = aspectDef.w >= aspectDef.h ? Math.round(640 * (aspectDef.h / aspectDef.w)) : 640;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Backgrounds"
        description={isAndroidBuild ? 'Unlimited unique designs · live preview · 2K · 4K · 8K · PNG · JPG · SVG · EPS' : undefined}
        actions={
          <Button size="sm" variant="secondary" icon={<GIcon name="refresh" size={16} />} onClick={surprise}>
            Surprise me
          </Button>
        }
      />

      <Card>
        <div className="border-b border-line px-4 py-3">
          <span className="font-semibold text-ink">Design</span>
        </div>
        <div className="grid gap-4 px-4 py-4">
          <Field label="Style">
            <div className="flex flex-wrap gap-1.5">
              {BACKGROUND_STYLES.map((s) => {
                const active = style === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id)}
                    className={`rounded-[var(--r-control)] border px-2.5 py-2 text-xs font-medium transition-colors ${
                      active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-line-strong'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Palette">
            <div className="flex flex-wrap gap-1.5">
              {BACKGROUND_PALETTES.map((p) => {
                const active = !customColors && paletteId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPaletteId(p.id);
                      setCustomColors(false);
                    }}
                    className={`flex items-center gap-1.5 rounded-[var(--r-control)] border px-2.5 py-2 text-xs font-medium transition-colors ${
                      active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-line-strong'
                    }`}
                  >
                    <span className="flex -space-x-1">
                      {p.colors.map((c) => (
                        <span key={c} className="size-3 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    {p.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCustomColors(true)}
                className={`rounded-[var(--r-control)] border px-2.5 py-2 text-xs font-medium transition-colors ${
                  customColors ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-line-strong'
                }`}
              >
                Custom
              </button>
            </div>
          </Field>

          {customColors && (
            <div className="grid grid-cols-3 gap-2">
              <Field label="Colour 1">
                <Input type="color" value={colorA} onChange={(e) => setColorA(e.target.value)} />
              </Field>
              <Field label="Colour 2">
                <Input type="color" value={colorB} onChange={(e) => setColorB(e.target.value)} />
              </Field>
              <Field label="Colour 3">
                <Input type="color" value={colorC} onChange={(e) => setColorC(e.target.value)} />
              </Field>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={`Elements (${density})`}>
              <input type="range" min={10} max={120} step={5} value={density} onChange={(e) => setDensity(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Element density" />
            </Field>
            <Field label={`Grain (${grain})`}>
              <input type="range" min={0} max={100} step={5} value={grain} onChange={(e) => setGrain(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Grain amount" />
            </Field>
            <Field label={`Vignette (${vignette})`}>
              <input type="range" min={0} max={100} step={5} value={vignette} onChange={(e) => setVignette(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Vignette strength" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shape">
              <div className="grid grid-cols-4 gap-1.5">
                {ASPECTS.map((a) => {
                  const active = aspect === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAspect(a.id)}
                      className={`rounded-[var(--r-control)] border px-2 py-2 text-xs font-medium transition-colors ${
                        active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-line-strong'
                      }`}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Resolution">
              <div className="grid grid-cols-3 gap-1.5">
                {RESOLUTIONS.map((r) => {
                  const active = resolution === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setResolution(r.id)}
                      className={`rounded-[var(--r-control)] border px-2 py-2 text-xs font-medium transition-colors ${
                        active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-line-strong'
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<GIcon name="refresh" size={15} />} onClick={shuffle}>
              Shuffle design
            </Button>
            <Button variant="primary" size="sm" loading={rendering} icon={<GIcon name="image" size={15} />} onClick={generate}>
              {rendering ? 'Generating…' : `Generate ${target.label}`}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="border-b border-line px-4 py-3">
          <span className="font-semibold text-ink">Live preview</span>
        </div>
        <div className="flex flex-col items-center px-4 py-4">
          <div
            className="overflow-hidden rounded-[var(--r-card)] border border-line"
            style={{ width: previewW, maxWidth: '100%', aspectRatio: `${aspectDef.w}/${aspectDef.h}` }}
          >
            <canvas ref={canvasRef} width={previewW} height={previewH} className="h-full w-full" />
          </div>
        </div>
      </Card>

      {rendered && (
        <>
          <Card>
            <div className="border-b border-line px-4 py-3">
              <span className="font-semibold text-ink">Generated background</span>
            </div>
            <div className="flex items-center justify-center px-4 py-4">
              <img src={rendered} alt="Generated background" className="max-h-[24rem] max-w-full rounded-[var(--r-xs)] border border-line object-contain" />
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-4">
            <Button variant="secondary" size="sm" icon={<GIcon name="download" size={14} />} onClick={() => downloadRaster('png')}>
              PNG
            </Button>
            <Button variant="secondary" size="sm" icon={<GIcon name="download" size={14} />} onClick={() => downloadRaster('jpg')}>
              JPG
            </Button>
            <Button variant="secondary" size="sm" icon={<GIcon name="download" size={14} />} onClick={() => downloadVector('svg')}>
              SVG
            </Button>
            <Button variant="secondary" size="sm" icon={<GIcon name="download" size={14} />} onClick={() => downloadVector('eps')}>
              EPS
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
