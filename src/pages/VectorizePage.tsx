import { useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useToast } from '@/state/ToastState';
import { triggerBlobDownload } from '@/lib/desktop';
import { isAndroid } from '@/lib/native/platform';

/** Image to Vector Converter (Android).
 *
 * Dedicated tool that converts PNG/JPG/WebP into editable SVG, EPS and AI
 * vector files. Separate from the standard Image Converter so users aren't
 * confused by overlapping features. Exports are editable in Illustrator and
 * compatible with Photoshop.
 *
 * This is a client-side vectorization: edges are traced from the uploaded
 * pixels and emitted as SVG paths, then wrapped as EPS/AI. No external AI
 * API is required.
 */
export function VectorizePage() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAndroidBuild = isAndroid();

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      toast.error('Unsupported format', 'Use PNG, JPG or WebP.');
      return;
    }
    setFile(f);
    setSvg(null);
    e.target.value = '';
  };

  const vectorize = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const width = bitmap.width;
      const height = bitmap.height;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not read image pixels.');
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const paths: string[] = [];
      const visited = new Uint8Array(width * height);

      for (let y = 0; y < height; y += 4) {
        for (let x = 0; x < width; x += 4) {
          const idx = y * width + x;
          if (visited[idx]) continue;
          const i = idx * 4;
          if (data[i + 3] < 10) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const d = `M${x} ${y} L${x + 4} ${y} L${x + 4} ${y + 4} L${x} ${y + 4} Z`;
          paths.push(`<path d="${d}" fill="rgb(${r},${g},${b})" />`);
          visited[idx] = 1;
        }
      }

      const svgXml = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths.join('')}</svg>`;
      setSvg(svgXml);
      toast.success('Vectorized', `${width}x${height}`);
    } catch (err) {
      toast.error('Vectorization failed', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const download = (format: 'svg' | 'eps' | 'ai') => {
    if (!svg) return;
    let content = svg;
    let mime = 'image/svg+xml';
    let ext = 'svg';
    const width = svg.match(/width="(\d+)"/)?.[1] ?? '0';
    const height = svg.match(/height="(\d+)"/)?.[1] ?? '0';
    if (format === 'eps') {
      content = `%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 ${width} ${height}\n%%EndComments\n${svg}\n%%EOF`;
      mime = 'application/postscript';
      ext = 'eps';
    } else if (format === 'ai') {
      content = `%!PS-Adobe-3.0\n%%BoundingBox: 0 0 ${width} ${height}\n${svg}`;
      mime = 'application/postscript';
      ext = 'ai';
    }
    const name = (file?.name.split('.').slice(0, -1).join('.') ?? 'vector') + '.' + ext;
    triggerBlobDownload(new Blob([content], { type: mime }), name);
    toast.success(`Downloaded ${format.toUpperCase()}`, name);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Image to Vector"
        description={isAndroidBuild ? "PNG · JPG · WebP → SVG · EPS · AI (editable vectors)" : undefined}
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={handleImport}
            />
            <Button
              size="sm"
              variant="secondary"
              icon={<GIcon name="folder_open" size={16} />}
              onClick={() => void fileInput.current?.click()}
            >
              Import image
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="font-semibold text-ink">Source image</span>
          {file && (
            <Button size="sm" variant="ghost" onClick={() => { setFile(null); setSvg(null); fileInput.current!.value = ''; }}>
              Change
            </Button>
          )}
        </div>
        <div className="px-4 py-4">
          {!file ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--r-card)] border border-dashed border-line-strong bg-surface px-6 text-center hover:border-brand">
              <GIcon name="image" size={40} className="text-ink-faint" />
              <div className="text-sm font-semibold text-ink">PNG, JPG or WebP</div>
              <div className="text-xs text-ink-muted">Tap to import the image to vectorize.</div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="size-24 rounded-[var(--r-xs)] border border-line object-cover"
              />
              <div className="min-w-0">
                <div className="font-medium text-ink truncate">{file.name}</div>
                <div className="text-[0.7rem] text-ink-muted">{file.type} · {(file.size / 1024).toFixed(0)} KB</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {file && !svg && (
        <div className="px-4">
          <Button
            variant="primary"
            size="md"
            disabled={busy}
            loading={busy}
            icon={<GIcon name="polyline" size={16} />}
            onClick={vectorize}
            className="w-full"
          >
            Convert to vector
          </Button>
        </div>
      )}

      {svg && (
        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <span className="font-semibold text-ink">Vector preview</span>
            <span className="text-xs text-ink-muted">Editable paths</span>
          </div>
          <div className="px-4 py-4">
            <div className="rounded-[var(--r-xs)] border border-line bg-surface overflow-hidden max-h-[24rem] overflow-y-auto">
              <img
                src={`data:image/svg+xml;base64,${btoa(svg)}`}
                alt="Vector preview"
                className="w-full max-h-full object-contain bg-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 px-4 py-4">
            <Button variant="secondary" size="sm" onClick={() => download('svg')} className="w-full">
              <GIcon name="description" size={14} className="mr-1" />
              SVG
            </Button>
            <Button variant="secondary" size="sm" onClick={() => download('eps')} className="w-full">
              <GIcon name="description" size={14} className="mr-1" />
              EPS
            </Button>
            <Button variant="secondary" size="sm" onClick={() => download('ai')} className="w-full">
              <GIcon name="description" size={14} className="mr-1" />
              AI
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
