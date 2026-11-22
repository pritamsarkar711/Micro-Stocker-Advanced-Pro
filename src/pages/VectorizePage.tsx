import { useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useToast } from '@/state/ToastState';
import { triggerBlobDownload } from '@/lib/desktop';
import { isAndroid } from '@/lib/native/platform';
import {
  vectorResultToAi,
  vectorResultToEps,
  vectorResultToSvg,
  vectorizeImage,
  type VectorizeResult,
} from '@/lib/motion/vectorize';

/**
 * Image to Vector Converter (Android).
 *
 * Converts PNG, JPG or WebP into editable SVG, EPS and AI vector files by
 * tracing the image's colour regions into real paths. Separate from the
 * standard Image Converter so the two jobs never confuse each other.
 */
export function VectorizePage() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<VectorizeResult | null>(null);
  const [colors, setColors] = useState(16);
  const [detail, setDetail] = useState(1.2);
  const [busy, setBusy] = useState(false);

  const isAndroidBuild = isAndroid();

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      toast.error('Unsupported format', 'Use PNG, JPG or WebP.');
      return;
    }
    setFile(f);
    setResult(null);
    e.target.value = '';
  };

  const convert = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const traced = await vectorizeImage(file, { colors, detail });
      setResult(traced);
      toast.success('Vectorized', `${traced.colorCount} colours · ${traced.paths.length} paths`);
    } catch (err) {
      toast.error('Vectorization failed', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const download = (format: 'svg' | 'eps' | 'ai') => {
    if (!result) return;
    const content =
      format === 'svg' ? vectorResultToSvg(result) : format === 'eps' ? vectorResultToEps(result) : vectorResultToAi(result);
    const mime = format === 'svg' ? 'image/svg+xml' : 'application/postscript';
    const base = file?.name.split('.').slice(0, -1).join('.') ?? 'vector';
    const name = `${base}.${format}`;
    triggerBlobDownload(new Blob([content], { type: mime }), name);
    toast.success(`Downloaded ${format.toUpperCase()}`, name);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Image to Vector"
        description={isAndroidBuild ? 'PNG · JPG · WebP → editable SVG · EPS · AI' : undefined}
        actions={
          <>
            <input ref={fileInput} type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={handleImport} />
            <Button size="sm" variant="secondary" icon={<GIcon name="folder_open" size={16} />} onClick={() => fileInput.current?.click()}>
              Import image
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-semibold text-ink">Source image</span>
          {file && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFile(null);
                setResult(null);
                if (fileInput.current) fileInput.current.value = '';
              }}
            >
              Change
            </Button>
          )}
        </div>
        <div className="px-4 py-4">
          {!file ? (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-[var(--r-card)] border border-dashed border-line-strong bg-surface px-6 py-8 text-center hover:border-brand"
            >
              <GIcon name="image" size={40} className="text-ink-faint" />
              <div className="text-sm font-semibold text-ink">PNG, JPG or WebP</div>
              <div className="text-xs text-ink-muted">Tap to import the image to vectorize.</div>
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <img src={URL.createObjectURL(file)} alt={file.name} className="size-24 rounded-[var(--r-xs)] border border-line object-cover" />
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">{file.name}</div>
                <div className="text-[0.7rem] text-ink-muted">
                  {file.type} · {(file.size / 1024).toFixed(0)} KB
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {file && (
        <Card>
          <div className="border-b border-line px-4 py-3">
            <span className="font-semibold text-ink">Vector settings</span>
          </div>
          <div className="grid gap-4 px-4 py-4">
            <Field label={`Colours (${colors})`}>
              <input
                type="range"
                min={4}
                max={32}
                step={2}
                value={colors}
                onChange={(e) => setColors(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
                aria-label="Number of colours"
              />
              <div className="text-2xs text-ink-muted">More colours keep more detail but make larger files.</div>
            </Field>
            <Field label={`Detail (${detail.toFixed(1)})`}>
              <input
                type="range"
                min={0.5}
                max={4}
                step={0.1}
                value={detail}
                onChange={(e) => setDetail(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
                aria-label="Path detail"
              />
              <div className="text-2xs text-ink-muted">Lower keeps curves smoother and files smaller.</div>
            </Field>
            <Button variant="primary" size="md" disabled={busy} loading={busy} icon={<GIcon name="polyline" size={16} />} onClick={() => void convert()} className="w-full">
              {busy ? 'Tracing…' : result ? 'Convert again' : 'Convert to vector'}
            </Button>
          </div>
        </Card>
      )}

      {result && (
        <Card>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-semibold text-ink">Vector preview</span>
            <span className="text-xs text-ink-muted">
              {result.colorCount} colours · {result.paths.length} editable paths
            </span>
          </div>
          <div className="px-4 py-4">
            <div className="max-h-[24rem] overflow-y-auto rounded-[var(--r-xs)] border border-line bg-white">
              <img
                src={`data:image/svg+xml;base64,${btoa(vectorResultToSvg(result))}`}
                alt="Vector preview"
                className="w-full object-contain"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 px-4 pb-4">
            <Button variant="secondary" size="sm" icon={<GIcon name="download" size={14} />} onClick={() => download('svg')} className="w-full">
              SVG
            </Button>
            <Button variant="secondary" size="sm" icon={<GIcon name="download" size={14} />} onClick={() => download('eps')} className="w-full">
              EPS
            </Button>
            <Button variant="secondary" size="sm" icon={<GIcon name="download" size={14} />} onClick={() => download('ai')} className="w-full">
              AI
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
