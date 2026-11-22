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
  MOTION_PALETTES,
  MOTION_STYLES,
  drawMotionFrame,
  hashText,
  mimeExtension,
  pickRecorderMime,
  type MotionParams,
  type MotionStyleId,
} from '@/lib/motion/engine';

type ResolutionId = '2K' | '4K' | '8K';
type AspectId = '16:9' | '9:16' | '1:1';

const RESOLUTIONS: Array<{ id: ResolutionId; label: string; w: number; h: number }> = [
  { id: '2K', label: '2K', w: 2560, h: 1440 },
  { id: '4K', label: '4K', w: 3840, h: 2160 },
  { id: '8K', label: '8K', w: 7680, h: 4320 },
];

const ASPECTS: Array<{ id: AspectId; label: string; w: number; h: number }> = [
  { id: '16:9', label: '16:9', w: 16, h: 9 },
  { id: '9:16', label: '9:16', w: 9, h: 16 },
  { id: '1:1', label: '1:1', w: 1, h: 1 },
];

const DURATIONS = [3, 5, 8];

/**
 * Motion Video Generator (Android).
 *
 * Describe an idea or upload a photo, tune the motion, preview it live and
 * export a seamless loop in 2K, 4K or 8K. Rendering happens entirely on the
 * device with the built-in procedural engine: no external AI model or API.
 * Every render is original motion computed from the user's input, so the
 * output is commercially usable and never copies a stock template.
 */
export function MotionPage() {
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const startedAtRef = useRef(0);
  const imageEl = useRef<HTMLImageElement | null>(null);
  const paramsRef = useRef<MotionParams | null>(null);

  const [idea, setIdea] = useState('');
  const [style, setStyle] = useState<MotionStyleId>('particles');
  const [paletteId, setPaletteId] = useState('ocean');
  const [speed, setSpeed] = useState(1);
  const [intensity, setIntensity] = useState(55);
  const [duration, setDuration] = useState(5);
  const [aspect, setAspect] = useState<AspectId>('16:9');
  const [resolution, setResolution] = useState<ResolutionId>('2K');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [exported, setExported] = useState<{ url: string; name: string } | null>(null);

  const palette = MOTION_PALETTES.find((p) => p.id === paletteId) ?? MOTION_PALETTES[0];
  const aspectDef = ASPECTS.find((a) => a.id === aspect) ?? ASPECTS[0];
  const target = RESOLUTIONS.find((r) => r.id === resolution) ?? RESOLUTIONS[0];
  const isAndroidBuild = isAndroid();

  const buildParams = useCallback((): MotionParams => {
    const ideaSeed = idea.trim() ? hashText(idea.trim().toLowerCase()) : 0;
    return {
      style,
      seed: (ideaSeed || 12345) + intensity * 7,
      speed,
      intensity,
      palette: palette.colors,
      background: '#0b0f19',
    };
  }, [idea, style, palette, speed, intensity]);

  paramsRef.current = buildParams();

  const drawPreviewFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const params = paramsRef.current;
    if (!canvas || !params) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const elapsed = (performance.now() - startedAtRef.current) / 1000;
    const phase = (elapsed / duration) % 1;
    drawMotionFrame(ctx, canvas.width, canvas.height, phase, params, imageEl.current);
  }, [duration]);

  const startPreview = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    startedAtRef.current = performance.now();
    setPreviewing(true);
    const loop = () => {
      if (!runningRef.current) return;
      drawPreviewFrame();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [drawPreviewFrame]);

  const stopPreview = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPreviewing(false);
  }, []);

  // Live preview runs from the moment the page opens and follows every
  // control change, with or without an uploaded photo.
  useEffect(() => {
    startPreview();
    return stopPreview;
  }, [startPreview, stopPreview]);

  useEffect(() => {
    if (previewing) drawPreviewFrame();
  }, [previewing, drawPreviewFrame, style, paletteId, speed, intensity, aspect, imageUrl]);

  const loadImage = (f: File) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      imageEl.current = img;
      setImageUrl(url);
      if (style !== 'kenburns') setStyle('kenburns');
      toast.success('Photo added', 'Photo drift style selected');
    };
    img.src = url;
  };

  const randomize = () => {
    const styles = MOTION_STYLES.map((s) => s.id);
    setStyle(styles[Math.floor(Math.random() * styles.length)]);
    setPaletteId(MOTION_PALETTES[Math.floor(Math.random() * MOTION_PALETTES.length)].id);
    setSpeed(Math.round((0.5 + Math.random() * 1.5) * 10) / 10);
    setIntensity(30 + Math.floor(Math.random() * 60));
  };

  const renderVideo = async () => {
    if (rendering) return;
    const mime = pickRecorderMime();
    if (!mime) {
      toast.error('Video recording is not supported on this device');
      return;
    }
    stopPreview();
    setRendering(true);
    setRenderProgress(0);
    setExported(null);

    const params = buildParams();
    // 8K canvases are heavy; on low-memory devices render at 4K instead of
    // crashing the WebView.
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    let w = target.w;
    let h = target.h;
    let downgraded = false;
    if (target.id === '8K' && deviceMemory < 6) {
      w = 3840;
      h = 2160;
      downgraded = true;
    }
    const aspectScale = Math.min(w / aspectDef.w, h / aspectDef.h);
    const outW = Math.round(aspectDef.w * aspectScale);
    const outH = Math.round(aspectDef.h * aspectScale);

    const off = document.createElement('canvas');
    off.width = outW;
    off.height = outH;
    const octx = off.getContext('2d');
    if (!octx) {
      setRendering(false);
      toast.error('Could not create the render canvas');
      return;
    }

    const fps = 30;
    const totalFrames = Math.round(duration * fps);
    const stream = off.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 24_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    const finish = () => {
      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      const name = `vecmotion-motion-${style}-${resolution.toLowerCase()}.${mimeExtension(mime)}`;
      setExported({ url, name });
      triggerBlobDownload(blob, name);
      toast.success('Video exported', name);
      setRendering(false);
      setRenderProgress(0);
      startPreview();
    };
    recorder.onstop = finish;

    let frames = 0;
    recorder.start(200);
    const drawFrame = () => {
      if (frames >= totalFrames) {
        recorder.stop();
        return;
      }
      const phase = frames / totalFrames;
      drawMotionFrame(octx, outW, outH, phase, params, imageEl.current);
      frames++;
      setRenderProgress(Math.round((frames / totalFrames) * 100));
      requestAnimationFrame(drawFrame);
    };
    drawFrame();

    if (downgraded) {
      toast.info('Rendered at 4K', 'This device has limited memory for an 8K canvas');
    }
  };

  const previewW = aspectDef.w >= aspectDef.h ? 640 : Math.round(640 * (aspectDef.w / aspectDef.h));
  const previewH = aspectDef.w >= aspectDef.h ? Math.round(640 * (aspectDef.h / aspectDef.w)) : 640;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Motion Video"
        description={isAndroidBuild ? 'Describe an idea or add a photo · seamless loops · 2K · 4K · 8K' : undefined}
        actions={
          <Button size="sm" variant="secondary" icon={<GIcon name="refresh" size={16} />} onClick={randomize}>
            Surprise me
          </Button>
        }
      />

      <Card>
        <div className="border-b border-line px-4 py-3">
          <span className="font-semibold text-ink">Create</span>
        </div>
        <div className="grid gap-4 px-4 py-4">
          <Field label="Animation idea (optional)">
            <Input
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. golden particles drifting over deep blue"
              leading={<GIcon name="description" size={15} />}
            />
          </Field>

          <Field label="Motion style">
            <div className="flex flex-wrap gap-1.5">
              {MOTION_STYLES.map((s) => {
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

          <Field label="Colour palette">
            <div className="flex flex-wrap gap-1.5">
              {MOTION_PALETTES.map((p) => {
                const active = paletteId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPaletteId(p.id)}
                    className={`flex items-center gap-1.5 rounded-[var(--r-control)] border px-2.5 py-2 text-xs font-medium transition-colors ${
                      active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-line-strong'
                    }`}
                  >
                    <span className="flex -space-x-1">
                      {p.colors.slice(0, 3).map((c) => (
                        <span key={c} className="size-3 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Speed (${speed.toFixed(1)}x)`}>
              <input
                type="range"
                min={0.25}
                max={3}
                step={0.25}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
                aria-label="Animation speed"
              />
            </Field>
            <Field label={`Density (${intensity})`}>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
                aria-label="Motion density"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shape">
              <div className="grid grid-cols-3 gap-1.5">
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
            <Field label="Loop length">
              <div className="grid grid-cols-3 gap-1.5">
                {DURATIONS.map((d) => {
                  const active = duration === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`rounded-[var(--r-control)] border px-2 py-2 text-xs font-medium transition-colors ${
                        active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-line-strong'
                      }`}
                    >
                      {d}s
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadImage(f);
                e.target.value = '';
              }}
            />
            <Button variant="secondary" size="sm" icon={<GIcon name="add_photo_alternate" size={16} />} onClick={() => fileRef.current?.click()}>
              {imageUrl ? 'Change photo' : 'Add photo'}
            </Button>
            {imageUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  imageEl.current = null;
                  setImageUrl(null);
                }}
              >
                Remove photo
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-semibold text-ink">Live preview</span>
          <span className="text-2xs text-ink-muted">Seamless loop</span>
        </div>
        <div className="flex flex-col items-center px-4 py-4">
          <div
            className="overflow-hidden rounded-[var(--r-card)] border border-line bg-[#0b0f19]"
            style={{ width: previewW, maxWidth: '100%', aspectRatio: `${aspectDef.w}/${aspectDef.h}` }}
          >
            <canvas ref={canvasRef} width={previewW} height={previewH} className="h-full w-full" />
          </div>
          <div className="mt-4 flex w-full flex-col gap-2">
            <Field label="Export resolution">
              <div className="grid grid-cols-3 gap-1.5">
                {RESOLUTIONS.map((r) => {
                  const active = resolution === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setResolution(r.id)}
                      className={`rounded-[var(--r-control)] border px-2 py-2.5 text-sm font-semibold transition-colors ${
                        active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-line-strong'
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Button
              variant="primary"
              size="md"
              disabled={rendering}
              loading={rendering}
              icon={<GIcon name="videocam" size={16} />}
              onClick={() => void renderVideo()}
              className="w-full"
            >
              {rendering ? `Rendering… ${renderProgress}%` : `Export ${target.label} loop`}
            </Button>
          </div>
        </div>
      </Card>

      {exported && (
        <Card className="border border-ok/40 bg-ok-soft/30">
          <div className="flex items-center gap-3 px-4 py-4">
            <video src={exported.url} className="size-24 rounded-[var(--r-xs)] border border-line object-cover" controls autoPlay loop muted playsInline />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-ink">Loop exported</div>
              <div className="truncate text-xs text-ink-muted">{exported.name}</div>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                icon={<GIcon name="download" size={14} />}
                onClick={() => {
                  void fetch(exported.url)
                    .then((r) => r.blob())
                    .then((blob) => triggerBlobDownload(blob, exported.name));
                }}
              >
                Download again
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
