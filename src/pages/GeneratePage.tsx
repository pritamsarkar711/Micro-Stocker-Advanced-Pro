import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { ActionBar } from '@/components/layout/ActionBar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CreditIcon } from '@/components/ui/CreditIcon';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { GIcon } from '@/components/ui/GoogleIcon';
import { Spinner } from '@/components/ui/Misc';
import { useToast } from '@/state/ToastState';
import { useLicense } from '@/state/LicenseState';
import { triggerBlobDownload } from '@/lib/desktop';
import {
  ASPECT_OPTIONS,
  LAYOUT_OPTIONS,
  PALETTE_OPTIONS,
  STYLE_OPTIONS,
  type AspectId,
  type LayoutId,
  type StyleId,
} from '@/lib/generate/engine';
import { IMAGE_ASPECTS, IMAGE_KINDS, IMAGE_LIGHTING, IMAGE_MOODS, DEFAULT_OPTIONS, type GeneratorOptions, type ImageKind } from '@/lib/generate/brief';
import { estimateMs, generateArtwork, generateImage, GenerationError, type GeneratedArtifact, type GeneratorKind, type ProgressEvent } from '@/lib/generate/run';
import { composePrompt, presetsFor } from '@/lib/generate/presets';
import { useRenderModels } from '@/lib/pro/models';

const COPY: Record<GeneratorKind, { title: string; tagline: string; icon: 'file_download' | 'draw' | 'image'; idea: string }> = {
  eps: { title: 'AI EPS Generator', tagline: 'Editable vector for Illustrator and print', icon: 'file_download', idea: 'Alpine sunrise for a travel brand' },
  svg: { title: 'AI SVG Generator', tagline: 'Clean web ready vector', icon: 'draw', idea: 'Line art snowflake' },
  ai: { title: 'AI Illustrator File', tagline: 'Native .ai document', icon: 'draw', idea: 'Luxury award badge' },
  jpg: { title: 'JPG Generator', tagline: 'Premium photography', icon: 'image', idea: 'Ceramic mug on a linen table' },
};

const FORMAT_LABEL: Record<GeneratorKind, string> = { eps: '.eps', svg: '.svg', ai: '.ai', jpg: '.jpg' };

function formatEta(ms: number): string {
  if (ms <= 0) return 'almost done';
  const seconds = Math.ceil(ms / 1000);
  return seconds > 1 ? `${seconds}s left` : 'a second left';
}

function readModelChoice(kind: GeneratorKind): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(`msap.generate.model.${kind}`) ?? '';
}

export function GeneratePage({ kind }: { kind: GeneratorKind }) {
  const toast = useToast();
  const { credits, costs } = useLicense();
  const [prompt, setPrompt] = useState('');
  const [presetId, setPresetId] = useState('');
  const [options, setOptions] = useState<GeneratorOptions>({ ...DEFAULT_OPTIONS, fileKind: kind === 'jpg' ? 'jpg' : kind });
  const [imageKind, setImageKind] = useState<ImageKind>('photo');
  const [imageAspect, setImageAspect] = useState('square');
  const [lighting, setLighting] = useState<string>(IMAGE_LIGHTING[0]);
  const [mood, setMood] = useState<string>(IMAGE_MOODS[0]);
  const [word, setWord] = useState('');
  const [model, setModel] = useState(() => readModelChoice(kind));
  const [artifact, setArtifact] = useState<GeneratedArtifact | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const startedAt = useRef(0);
  const outputRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [eta, setEta] = useState('');

  const copy = COPY[kind];
  const isImage = kind === 'jpg';
  const presets = useMemo(() => presetsFor(kind), [kind]);
  const preset = useMemo(() => presets.find((entry) => entry.id === presetId) ?? null, [presetId, presets]);
  const models = useRenderModels(isImage ? 'image' : 'vector');
  const unitCost = isImage ? costs.jpg : costs.vector;

  useEffect(() => {
    setOptions((current) => ({ ...current, fileKind: kind === 'jpg' ? 'jpg' : kind }));
    setArtifact(null);
    setError(null);
    setPrompt('');
    setPresetId('');
    setModel(readModelChoice(kind));
  }, [kind]);

  useEffect(() => {
    if (!model) return;
    localStorage.setItem(`msap.generate.model.${kind}`, model);
  }, [kind, model]);

  useEffect(() => {
    if (!artifact?.previewSvg) {
      setPreviewUrl(null);
      return;
    }
    const blob = new Blob([artifact.previewSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [artifact?.previewSvg]);

  useEffect(() => {
    if (!busy) {
      setEta('');
      return;
    }
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      setEta(formatEta(estimateMs(kind) - elapsed));
    }, 500);
    return () => window.clearInterval(tick);
  }, [busy, kind]);

  const run = useCallback(async () => {
    const text = prompt.trim();
    if (text.length < 3) {
      toast.warning('Add an idea', 'A few words is enough.');
      return;
    }
    const composed = composePrompt(text, preset);
    setBusy(true);
    setError(null);
    setArtifact(null);
    startedAt.current = Date.now();
    try {
      const chosen = model || undefined;
      const result = isImage
        ? await generateImage(
            { kind, prompt: composed, model: chosen, options, imageBrief: { kind: imageKind, aspect: imageAspect, lighting, mood, prompt: text } },
            setProgress,
          )
        : await generateArtwork(
            { kind, prompt: composed, model: chosen, options: { ...options, word: word.trim() ? word.trim() : undefined } },
            setProgress,
          );
      setArtifact(result);
      toast.success('File ready', result.quality ? `Quality ${result.quality.score} of 100` : undefined);
      // On a phone the result sits below a long form; bring it into view
      // instead of leaving the user staring at an unchanged page.
      if (window.matchMedia('(max-width: 1023.98px)').matches) {
        window.setTimeout(() => {
          outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    } catch (cause) {
      const failure = cause instanceof GenerationError ? cause : null;
      const message = failure?.message ?? (cause instanceof Error ? cause.message : 'Generation failed');
      setError({ message, detail: failure?.detail });
      // The error card lives under a long form on a phone, so say it out loud
      // as a toast and bring it into view: a tap must never look ignored.
      toast.error('Nothing was charged', message);
      window.setTimeout(() => {
        errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [imageAspect, imageKind, isImage, kind, lighting, model, mood, options, preset, prompt, toast, word]);

  const download = useCallback(() => {
    if (!artifact?.file) return;
    const blob = new Blob([artifact.file.bytes as unknown as BlobPart], { type: artifact.file.mime });
    triggerBlobDownload(blob, artifact.file.filename);
    toast.success('Downloaded', artifact.file.filename);
  }, [artifact, toast]);

  const progressPct = progress ? Math.round(progress.progress * 100) : 0;

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={copy.tagline}
        actions={
          <span
            title={`${credits.toLocaleString()} credits`}
            aria-label={`${credits.toLocaleString()} credits left`}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[0.8125rem] font-semibold"
          >
            <CreditIcon size={16} />
            {credits.toLocaleString()}
          </span>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)]">
        <Card className="space-y-3.5 max-md:pb-24">
          <Field label="Idea" hint={`${prompt.length}/600`}>
            <Textarea
              value={prompt}
              maxLength={600}
              rows={3}
              placeholder={copy.idea}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </Field>

          {presets.length > 0 && (
            <Field label="Prompt style" hint={preset?.hint}>
              <Select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
                <option value="">Studio default</option>
                {presets.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {models.length > 1 && (
            <Field label="Model">
              <Select value={model || models[0].id} onChange={(event) => setModel(event.target.value)}>
                {models.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                    {entry.providerLabel ? ` · ${entry.providerLabel}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {isImage ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Image type">
                <Select value={imageKind} onChange={(event) => setImageKind(event.target.value as ImageKind)}>
                  {IMAGE_KINDS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Aspect">
                <Select value={imageAspect} onChange={(event) => setImageAspect(event.target.value)}>
                  {IMAGE_ASPECTS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label} · {option.ratio}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Light">
                <Select value={lighting} onChange={(event) => setLighting(event.target.value)}>
                  {IMAGE_LIGHTING.map((option) => <option key={option} value={option}>{option}</option>)}
                </Select>
              </Field>
              <Field label="Mood">
                <Select value={mood} onChange={(event) => setMood(event.target.value)}>
                  {IMAGE_MOODS.map((option) => <option key={option} value={option}>{option}</option>)}
                </Select>
              </Field>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Style">
                  <Select
                    value={options.auto ? 'auto' : options.style}
                    onChange={(event) =>
                      setOptions((current) =>
                        event.target.value === 'auto'
                          ? { ...current, auto: true }
                          : { ...current, auto: false, style: event.target.value as StyleId },
                      )
                    }
                  >
                    <option value="auto">Auto</option>
                    {STYLE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Layout">
                  <Select
                    value={options.layout}
                    onChange={(event) => setOptions((current) => ({ ...current, layout: event.target.value as LayoutId }))}
                  >
                    {LAYOUT_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Canvas">
                  <Select
                    value={options.aspect}
                    onChange={(event) => setOptions((current) => ({ ...current, aspect: event.target.value as AspectId }))}
                  >
                    {ASPECT_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Palette">
                  <Select
                    value={options.auto ? 'auto' : options.paletteId}
                    onChange={(event) =>
                      setOptions((current) =>
                        event.target.value === 'auto'
                          ? { ...current, auto: true }
                          : { ...current, auto: false, paletteId: event.target.value },
                      )
                    }
                  >
                    <option value="auto">Auto</option>
                    {PALETTE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Word on the artwork" hint="optional">
                <Input
                  value={word}
                  maxLength={18}
                  placeholder="WINTER"
                  onChange={(event) => setWord(event.target.value.toUpperCase())}
                />
              </Field>
            </>
          )}

          <ActionBar>
            <Button
              onClick={() => void run()}
              loading={busy}
              className="flex-1 sm:w-auto sm:flex-none"
              icon={<GIcon name="draw" size={18} />}
            >
              {busy ? 'Generating' : 'Generate'}
            </Button>
            <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-medium text-ink-muted sm:text-[0.75rem]">
              <CreditIcon size={13} />
              {unitCost} per file
              <span className="hidden text-ink-faint sm:inline">·</span>
              <span className="hidden sm:inline">{FORMAT_LABEL[kind]}</span>
            </span>
          </ActionBar>

          {busy && (
            <div className="space-y-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full brand-gradient transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="flex items-center justify-between text-2xs text-ink-muted">
                <span>{progress?.message ?? 'Starting'}</span>
                <span>{eta}</span>
              </div>
            </div>
          )}

          {error && (
            <div
              ref={errorRef}
              role="alert"
              className="flex items-start gap-2 rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3 py-2.5 text-[0.8125rem] text-danger"
            >
              <GIcon name="info" size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{error.message}</p>
                {error.detail && <p className="mt-0.5 opacity-90">{error.detail}</p>}
              </div>
            </div>
          )}
        </Card>

        <Card flush className="overflow-hidden">
          <span ref={outputRef} className="block scroll-mt-16" aria-hidden="true" />
          <CardHeader
            title="Output"
            subtitle={artifact ? artifact.file?.filename ?? 'File ready' : undefined}
            icon={<GIcon name="image" size={18} />}
            action={
              artifact && (
                <Button size="sm" onClick={download} icon={<GIcon name="file_download" size={16} />}>
                  Download
                </Button>
              )
            }
          />
          <div className="flex min-h-[320px] items-center justify-center border-t border-line bg-surface-2 p-4">
            {busy ? (
              <div className="flex flex-col items-center gap-2 text-ink-muted">
                <Spinner size={6} />
                <span className="text-2xs">{progress?.message ?? 'Working'}</span>
              </div>
            ) : previewUrl ? (
              <img src={previewUrl} alt="Generated vector preview" className="max-h-[420px] w-auto rounded-[var(--r-control)] bg-white shadow-[var(--elev-1)]" />
            ) : artifact?.imageUrl ? (
              <img src={artifact.imageUrl} alt="Generated image" className="max-h-[420px] w-auto rounded-[var(--r-control)] object-contain" />
            ) : (
              <div className="text-center text-ink-muted">
                <GIcon name={copy.icon} size={28} className="mx-auto opacity-50" />
                <p className="mt-2 text-2xs">Nothing yet</p>
              </div>
            )}
          </div>

          {artifact && (
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                {artifact.quality && (
                  <Badge tone={artifact.quality.pass ? 'ok' : 'warn'} icon={<GIcon name="verified" size={13} />}>
                    Quality {artifact.quality.score}/100
                  </Badge>
                )}
                <Badge tone="neutral">{FORMAT_LABEL[kind]}</Badge>
              </div>
              <div className="space-y-1.5">
                <p className="text-[0.875rem] font-semibold leading-snug">{artifact.metadata.title}</p>
                <p className="line-clamp-3 text-[0.75rem] leading-relaxed text-ink-muted">{artifact.metadata.description}</p>
                <p className="line-clamp-2 text-2xs text-ink-muted">{artifact.metadata.keywords.join(', ')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const text = `${artifact.metadata.title}\n\n${artifact.metadata.description}\n\n${artifact.metadata.keywords.join(', ')}`;
                    void navigator.clipboard.writeText(text).then(() => toast.success('Metadata copied'));
                  }}
                  icon={<GIcon name="content_copy" size={16} />}
                >
                  Copy metadata
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
