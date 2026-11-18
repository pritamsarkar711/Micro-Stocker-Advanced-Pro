import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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
import { seasonalIdeas } from '@/lib/generate/trends';

const COPY: Record<GeneratorKind, { title: string; tagline: string; icon: 'file_download' | 'draw' | 'image' }> = {
  eps: { title: 'EPS generator', tagline: 'Editable vector paths for Illustrator and print', icon: 'file_download' },
  svg: { title: 'SVG generator', tagline: 'Clean web-ready vector with named groups', icon: 'draw' },
  ai: { title: 'AI file generator', tagline: 'Native Illustrator document, fully editable', icon: 'draw' },
  jpg: { title: 'JPG generator', tagline: 'Premium photography and commercial imagery', icon: 'image' },
};

const EXAMPLES: Record<GeneratorKind, string[]> = {
  eps: ['Alpine sunrise for a travel brand', 'Minimal coffee badge for a cafe', 'Christmas tree poster with the word WINTER'],
  svg: ['Line art snowflake pattern', 'Isometric data centre icon', 'Bauhaus poster for a design studio'],
  ai: ['Luxury award badge with laurel', 'City skyline panorama in flat style', 'Diwali diya emblem with warm palette'],
  jpg: ['Ceramic mug on a linen table in morning light', 'Founder working alone in a bright studio', 'Fresh croissants on a marble counter'],
};

const FORMAT_LABEL: Record<GeneratorKind, string> = { eps: '.eps', svg: '.svg', ai: '.ai', jpg: '.png' };

function formatEta(ms: number): string {
  if (ms <= 0) return 'almost done';
  const seconds = Math.ceil(ms / 1000);
  return seconds > 1 ? `about ${seconds}s left` : 'about a second left';
}

export function GeneratePage({ kind }: { kind: GeneratorKind }) {
  const toast = useToast();
  const { credits, planName } = useLicense();
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState<GeneratorOptions>({ ...DEFAULT_OPTIONS, fileKind: kind === 'jpg' ? 'jpg' : kind });
  const [imageKind, setImageKind] = useState<ImageKind>('photo');
  const [imageAspect, setImageAspect] = useState('square');
  const [lighting, setLighting] = useState<string>(IMAGE_LIGHTING[0]);
  const [mood, setMood] = useState<string>(IMAGE_MOODS[0]);
  const [word, setWord] = useState('');
  const [artifact, setArtifact] = useState<GeneratedArtifact | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const startedAt = useRef(0);
  const [eta, setEta] = useState('');

  const copy = COPY[kind];
  const ideas = useMemo(() => seasonalIdeas(new Date(), 5, 'generator'), []);
  const isImage = kind === 'jpg';

  useEffect(() => {
    setOptions((current) => ({ ...current, fileKind: kind === 'jpg' ? 'jpg' : kind }));
    setArtifact(null);
    setError(null);
    setPrompt('');
  }, [kind]);

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
      toast.warning('Add a prompt', 'Describe what should be drawn.');
      return;
    }
    setBusy(true);
    setError(null);
    setArtifact(null);
    startedAt.current = Date.now();
    try {
      const result = isImage
        ? await generateImage(
            { kind, prompt: text, options, imageBrief: { kind: imageKind, aspect: imageAspect, lighting, mood, prompt: text } },
            setProgress,
          )
        : await generateArtwork(
            { kind, prompt: text, options: { ...options, word: word.trim() ? word.trim() : undefined }, trending: ideas[0]?.title },
            setProgress,
          );
      setArtifact(result);
      toast.success('File ready', result.quality ? `Quality score ${result.quality.score} of 100.` : 'Download it below.');
    } catch (cause) {
      const failure = cause instanceof GenerationError ? cause : null;
      setError({
        message: failure?.message ?? (cause instanceof Error ? cause.message : 'Generation failed'),
        detail: failure?.detail,
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [ideas, imageAspect, imageKind, isImage, kind, lighting, mood, options, prompt, toast, word]);

  const download = useCallback(() => {
    if (!artifact?.file) return;
    const blob = new Blob([artifact.file.bytes as unknown as BlobPart], { type: artifact.file.mime });
    triggerBlobDownload(blob, artifact.file.filename);
    toast.success('Downloaded', artifact.file.filename);
  }, [artifact, toast]);

  const progressPct = progress ? Math.round(progress.progress * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow="Pro"
        title={copy.title}
        description={copy.tagline}
        actions={
          <Badge tone="brand" icon={<GIcon name="workspace_premium" size={14} />}>
            {planName ?? 'Pro'} · {credits} credits
          </Badge>
        }
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <Card className="space-y-4">
          <Field label="Prompt" hint={`${prompt.length}/600`}>
            <Textarea
              value={prompt}
              maxLength={600}
              rows={3}
              placeholder={EXAMPLES[kind][0]}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </Field>

          <div className="flex flex-wrap gap-1.5">
            {ideas.slice(0, 4).map((idea) => (
              <button
                key={idea.id}
                type="button"
                onClick={() => setPrompt(idea.title)}
                className="rounded-full border border-line bg-surface px-2.5 py-1 text-2xs text-ink-muted transition hover:border-accent/40 hover:text-ink"
              >
                {idea.title}
              </button>
            ))}
          </div>

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
                    <option value="auto">Let the art director choose</option>
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
                    <option value="auto">Match the subject</option>
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

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Button onClick={() => void run()} loading={busy} icon={<GIcon name="draw" size={18} />}>
              {busy ? 'Generating' : 'Generate'}
            </Button>
            <span className="text-2xs text-ink-muted">
              {isImage ? `${FORMAT_LABEL[kind]} · 5 credits` : `${FORMAT_LABEL[kind]} · 1 credit`}
            </span>
          </div>

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
            <div className="flex items-start gap-2 rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3 py-2.5 text-[0.8125rem] text-danger">
              <GIcon name="info" size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{error.message}</p>
                {error.detail && <p className="mt-0.5 opacity-90">{error.detail}</p>}
              </div>
            </div>
          )}
        </Card>

        <Card flush className="overflow-hidden">
          <CardHeader title="Output" subtitle={artifact ? `${artifact.file?.filename ?? ''}` : 'Nothing yet'} icon={<GIcon name="image" size={18} />} />
          <div className="flex min-h-[300px] items-center justify-center border-y border-line bg-surface-2 p-4">
            {busy ? (
              <div className="flex flex-col items-center gap-2 text-ink-muted">
                <Spinner size={6} />
                <span className="text-2xs">{progress?.message ?? 'Working'}</span>
              </div>
            ) : previewUrl ? (
              <img src={previewUrl} alt="Generated vector preview" className="max-h-[340px] w-auto rounded-[var(--r-control)] bg-white shadow-[var(--elev-1)]" />
            ) : artifact?.imageUrl ? (
              <img src={artifact.imageUrl} alt="Generated image" className="max-h-[340px] w-auto rounded-[var(--r-control)] object-contain" />
            ) : (
              <div className="text-center text-ink-muted">
                <GIcon name={copy.icon} size={30} className="mx-auto opacity-60" />
                <p className="mt-2 text-2xs">Your file appears here</p>
              </div>
            )}
          </div>

          {artifact && (
            <div className="space-y-4 p-4">
              {artifact.quality && (
                <div className="flex items-center gap-2">
                  <Badge tone={artifact.quality.pass ? 'ok' : 'warn'} icon={<GIcon name="verified" size={14} />}>
                    Quality {artifact.quality.score}/100
                  </Badge>
                  <span className="text-2xs text-ink-muted">
                    {artifact.quality.checks.filter((check) => check.status === 'pass').length} of {artifact.quality.checks.length} checks passed
                  </span>
                </div>
              )}

              <div className="space-y-2 text-[0.8125rem]">
                <p className="font-semibold leading-snug">{artifact.metadata.title}</p>
                <p className="text-ink-muted leading-relaxed">{artifact.metadata.description}</p>
                <p className="text-2xs text-ink-muted">{artifact.metadata.keywords.join(', ')}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <Button onClick={download} icon={<GIcon name="file_download" size={18} />}>
                  Download {FORMAT_LABEL[kind]}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const text = `${artifact.metadata.title}\n\n${artifact.metadata.description}\n\n${artifact.metadata.keywords.join(', ')}`;
                    void navigator.clipboard.writeText(text).then(() => toast.success('Metadata copied'));
                  }}
                  icon={<GIcon name="content_copy" size={18} />}
                >
                  Copy metadata
                </Button>
                {typeof artifact.quality?.score === 'number' && (
                  <span className={clsx('text-2xs', artifact.quality.pass ? 'text-ok' : 'text-warn')}>
                    {artifact.attempts > 1 ? `${artifact.attempts} passes to clear the gate` : 'Passed first time'}
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      <p className="mt-4 text-2xs text-ink-muted">
        Every file is built from real paths and passes an automated structural check. Marketplace acceptance rules are outside our control.
      </p>
    </div>
  );
}
