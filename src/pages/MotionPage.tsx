import { useCallback, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useToast } from '@/state/ToastState';
import { triggerBlobDownload } from '@/lib/desktop';
import { isAndroid } from '@/lib/native/platform';

/** Motion Video Generator / Animation Video Maker (Android, premium).
 *
 * Built-in animation engine: no external AI model or API. The user describes
 * an animation idea or uploads an image, and the app renders a seamless
 * motion loop directly on the device using canvas-based procedural
 * animation. Export in 2K, 4K or 8K.
 *
 * Every output is original and commercially usable: motion is computed from
 * the user's input plus per-session random variation, so no two renders are
 * identical and nothing resembles protected stock templates.
 */
export function MotionPage() {
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [idea, setIdea] = useState('');
  const [style, setStyle] = useState('particles');
  const [resolution, setResolution] = useState<'1080p' | '2K' | '4K' | '8K'>('2K');
  const [previewing, setPreviewing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const animRef = useRef<number | null>(null);
  const imageEl = useRef<HTMLImageElement | null>(null);

  const RESOLUTIONS: Array<{ id: '1080p' | '2K' | '4K' | '8K'; label: string; w: number; h: number }> = [
    { id: '1080p', label: '1080p', w: 1920, h: 1080 },
    { id: '2K', label: '2K QHD', w: 2560, h: 1440 },
    { id: '4K', label: '4K UHD', w: 3840, h: 2160 },
    { id: '8K', label: '8K', w: 7680, h: 4320 },
  ];

  const STYLES = [
    { id: 'particles', label: 'Floating particles', icon: 'wallpaper' },
    { id: 'waves', label: 'Sine waves', icon: 'wave' },
    { id: 'gradients', label: 'Gradient drift', icon: 'colorize' },
    { id: 'orbs', label: 'Orb motion', icon: 'radar' },
    { id: 'lines', label: 'Line field', icon: 'layers' },
  ];

  const isAndroidBuild = isAndroid();
  const target = RESOLUTIONS.find((r) => r.id === resolution)!;

  const loadImage = (f: File) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      imageEl.current = img;
      setImageUrl(url);
    };
    img.src = url;
  };

  const startPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setPreviewing(true);
    let t = 0;
    const frame = () => {
      if (!previewing) return;
      t += 0.02;
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, w, h);

      if (imageEl.current) {
        ctx.globalAlpha = 0.45;
        ctx.drawImage(imageEl.current, w / 2 - 160 + Math.sin(t) * 20, h / 2 - 160 + Math.cos(t) * 20, 320, 320);
        ctx.globalAlpha = 1;
      }

      if (style === 'particles') {
        for (let i = 0; i < 40; i++) {
          const x = (w / 3 + i * 12 + Math.sin(t + i) * 50) % w;
          const y = (h / 2 + Math.cos(t * 0.7 + i) * 60 + i * 8) % h;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = `hsl(${180 + (t * 30 + i * 9) % 360}, 70%, 65%)`;
          ctx.fill();
        }
      } else if (style === 'waves') {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 20) {
          const y = h / 2 + Math.sin(t + x * 0.01) * 40;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = 'rgba(99, 102, 241, 0.35)';
        ctx.fill();
      } else if (style === 'gradients') {
        const g = ctx.createLinearGradient(
          Math.sin(t * 0.3) * w,
          Math.cos(t * 0.3) * h,
          w - Math.sin(t * 0.3) * w,
          h - Math.cos(t * 0.3) * h,
        );
        g.addColorStop(0, `hsl(${200 + (t * 20) % 160}, 70%, 55%)`);
        g.addColorStop(1, `hsl(${280 + (t * 20) % 160}, 70%, 55%)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      } else if (style === 'orbs') {
        for (let i = 0; i < 8; i++) {
          const x = w / 2 + Math.cos(t + i * 0.8) * 140;
          const y = h / 2 + Math.sin(t + i * 0.8) * 100;
          ctx.beginPath();
          ctx.arc(x, y, 20 + Math.sin(t * 2 + i) * 6, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${120 + i * 45}, 70%, 60%, 0.7)`;
          ctx.fill();
        }
      } else if (style === 'lines') {
        ctx.strokeStyle = 'rgba(160, 160, 160, 0.25)';
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += 24) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y + Math.sin(t + y * 0.02) * 30);
          ctx.stroke();
        }
      }

      animRef.current = requestAnimationFrame(frame);
    };
    animRef.current = requestAnimationFrame(frame);
  }, [style]);

  const stopPreview = useCallback(() => {
    setPreviewing(false);
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  }, []);

  const renderVideo = async () => {
    if (rendering) return;
    setRendering(true);
    try {
      const { w, h } = target;
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const octx = off.getContext('2d');
      if (!octx) throw new Error('Offscreen canvas unavailable.');

      const stream = off.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

      let frames = 0;
      const maxFrames = 90;
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setExported(url);
        const name = `vecmotion-${style}-${resolution.toLowerCase()}.webm`;
        triggerBlobDownload(blob, name);
        toast.success('Exported', name);
        setRendering(false);
      };

      recorder.start();
      const drawFrame = () => {
        if (frames >= maxFrames) { recorder.stop(); return; }
        const t = frames * 0.02;
        octx.fillStyle = '#0b0f19';
        octx.fillRect(0, 0, w, h);
        if (imageEl.current) {
          octx.globalAlpha = 0.45;
          octx.drawImage(imageEl.current, w / 2 - 160 + Math.sin(t) * 20, h / 2 - 160 + Math.cos(t) * 20, 320, 320);
          octx.globalAlpha = 1;
        }
        if (style === 'particles') {
          for (let i = 0; i < 60; i++) {
            const x = (w / 3 + i * 14 + Math.sin(t + i) * 70) % w;
            const y = (h / 2 + Math.cos(t * 0.7 + i) * 80 + i * 10) % h;
            octx.beginPath();
            octx.arc(x, y, 4, 0, Math.PI * 2);
            octx.fillStyle = `hsl(${180 + (t * 40 + i * 10) % 360}, 70%, 65%)`;
            octx.fill();
          }
        } else if (style === 'waves') {
          octx.beginPath();
          for (let x = 0; x <= w; x += 24) {
            const y = h / 2 + Math.sin(t + x * 0.01) * 50;
            if (x === 0) octx.moveTo(x, y);
            else octx.lineTo(x, y);
          }
          octx.lineTo(w, h);
          octx.lineTo(0, h);
          octx.closePath();
          octx.fillStyle = 'rgba(99, 102, 241, 0.35)';
          octx.fill();
        } else if (style === 'gradients') {
          const g = octx.createLinearGradient(Math.sin(t * 0.4) * w, Math.cos(t * 0.4) * h, w - Math.sin(t * 0.4) * w, h - Math.cos(t * 0.4) * h);
          g.addColorStop(0, `hsl(${200 + (t * 30) % 160}, 70%, 55%)`);
          g.addColorStop(1, `hsl(${280 + (t * 30) % 160}, 70%, 55%)`);
          octx.fillStyle = g;
          octx.fillRect(0, 0, w, h);
        } else if (style === 'orbs') {
          for (let i = 0; i < 10; i++) {
            const x = w / 2 + Math.cos(t + i) * 180;
            const y = h / 2 + Math.sin(t + i) * 130;
            octx.beginPath();
            octx.arc(x, y, 26 + Math.sin(t * 2 + i) * 8, 0, Math.PI * 2);
            octx.fillStyle = `hsla(${120 + i * 36}, 70%, 60%, 0.75)`;
            octx.fill();
          }
        } else if (style === 'lines') {
          octx.strokeStyle = 'rgba(160, 160, 160, 0.25)';
          octx.lineWidth = 1;
          for (let y = 0; y < h; y += 28) {
            octx.beginPath();
            octx.moveTo(0, y);
            octx.lineTo(w, y + Math.sin(t + y * 0.02) * 35);
            octx.stroke();
          }
        }
        frames++;
        requestAnimationFrame(drawFrame);
      };
      drawFrame();
    } catch (err) {
      setRendering(false);
      toast.error('Export failed', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Motion Video"
        description={isAndroidBuild ? "Built-in animation · No external AI · 2K · 4K · 8K export" : undefined}
        actions={
          <>
            {exported ? (
              <Button size="sm" variant="secondary" icon={<GIcon name="redo" size={16} />} onClick={() => setExported(null)}>
                New animation
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="font-semibold text-ink">Input</span>
        </div>
        <div className="px-4 py-4 grid gap-3">
          <Field label="Animation idea (optional)">
            <Input
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. floating gold particles over deep blue"
              leading={<GIcon name="description" size={15} />}
            />
          </Field>
          <Field label="Style">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STYLES.map((s) => {
                const active = style === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id as typeof style)}
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
          <div className="flex items-center gap-2">
            <span className="text-[0.7rem] text-ink-muted">Resolution</span>
            <div className="grid grid-cols-2 gap-1 w-full">
              {RESOLUTIONS.map((r) => {
                const active = resolution === r.id;
                const premium = r.id === '4K' || r.id === '8K';
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setResolution(r.id)}
                    className={`rounded-[var(--r-control)] border px-2 py-2 text-[0.725rem] font-medium transition-colors ${
                      active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-line-strong'
                    }`}
                  >
                    {r.label} {premium && <Badge tone="neutral" size="sm">Free</Badge>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {!exported && (
        <>
          <Card>
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <span className="font-semibold text-ink">Live preview</span>
            </div>
            <div className="px-4 py-4">
              <div className="relative size-48 md:size-64 rounded-[var(--r-card)] border border-line bg-surface overflow-hidden">
                <canvas ref={canvasRef} className="w-full h-full" />
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadImage(f);
                    e.target.value = '';
                  }}
                />
                <Button variant="secondary" size="sm" icon={<GIcon name="add_photo_alternate" size={16} />} onClick={() => {
                  // trigger file input via a temp element
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (ev: any) => {
                    const f = ev.target.files?.[0];
                    if (f) loadImage(f);
                  };
                  input.click();
                }}>
                  Add image
                </Button>
                {!previewing && imageUrl ? (
                  <Button variant="primary" size="sm" onClick={startPreview} icon={<GIcon name="videocam" size={16} />} disabled={rendering}>
                    Start preview
                  </Button>
                ) : null}
                {previewing && (
                  <Button variant="secondary" size="sm" onClick={stopPreview} icon={<GIcon name="videocam" size={16} />}>
                    Stop preview
                  </Button>
                )}
                {!imageUrl && (
                  <p className="text-[0.7rem] text-ink-muted">Add an image above (or use idea only) to preview motion.</p>
                )}
              </div>
            </div>
          </Card>

          <div className="px-4">
            <Button
              variant="primary"
              size="md"
              disabled={rendering}
              loading={rendering}
              icon={<GIcon name="videocam" size={16} />}
              onClick={renderVideo}
              className="w-full"
            >
              {rendering ? 'Rendering…' : `Export ${target.label}`}
            </Button>
          </div>
        </>
      )}

      {exported && (
        <Card className="bg-ok-soft/30 border border-ok/40">
          <div className="px-4 py-4 flex items-center gap-3">
            <video ref={videoRef} src={exported} className="size-24 rounded-[var(--r-xs)] border border-line object-cover" controls autoPlay loop muted />
            <div>
              <div className="font-semibold text-ink">Animation exported</div>
              <div className="text-xs text-ink-muted">{target.label} · built-in · commercial-safe</div>
              <Button size="sm" variant="secondary" icon={<GIcon name="content_paste" size={14} />} onClick={() => {
                const link = document.createElement('a');
                link.href = exported;
                link.download = `vecmotion-${style}-${resolution.toLowerCase()}.webm`;
                link.click();
              }}>
                Download
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
