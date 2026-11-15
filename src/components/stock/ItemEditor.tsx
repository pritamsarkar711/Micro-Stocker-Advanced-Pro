import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Check, Copy, Download, PenLine, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PlatformLogo } from '@/components/stock/PlatformLogo';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { isDesktop } from '@/lib/desktop';
import { formatBytes } from '@/lib/stock/files';
import { megapixels, type StockItem } from '@/lib/stock/types';
import { PLATFORM_LIST, PLATFORMS } from '@/lib/stock/platforms';
import type { PlatformId } from '@/lib/stock/types';
import { adaptForPlatform } from '@/lib/stock/metadata';
import { sanitizeFilename, validateItem } from '@/lib/stock/validate';
import { CATEGORY_KEYS } from '@/lib/stock/categories';
import { useReleases, isExpired } from '@/state/releases';
import { useBank } from '@/state/bank';

type EditorTab = 'metadata' | 'platforms' | 'embed';

export function ItemEditor({ item, onClose }: { item: StockItem; onClose: () => void }) {
  const library = useLibrary();
  const toast = useToast();
  const [tab, setTab] = useState<EditorTab>('metadata');
  const [keywordInput, setKeywordInput] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState(item.metadata.keywords.join(', '));
  const [subject, setSubject] = useState('');
  const [concepts, setConcepts] = useState('');
  const [style, setStyle] = useState<'auto' | 'vector' | 'photo'>('auto');
  const [backup, setBackup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [safeName, setSafeName] = useState(() => sanitizeFilename(item.name).name);
  const { releases } = useReleases();
  const { bank } = useBank();

  const appendTranslations = () => {
    const extra: string[] = [];
    for (const keyword of item.metadata.keywords) {
      const entry = bank.translations[keyword];
      if (!entry) continue;
      for (const value of Object.values(entry)) if (value && !extra.includes(value)) extra.push(value);
    }
    if (extra.length === 0) {
      toast.info('No dictionary terms');
      return;
    }
    library.setMetadata(item.id, { keywords: Array.from(new Set([...item.metadata.keywords, ...extra])).slice(0, 50) });
    toast.success(`+${extra.length} translated`);
  };

  const mp = megapixels(item);

  const addKeywords = (raw: string) => {
    const parts = raw.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return;
    const merged = Array.from(new Set([...item.metadata.keywords, ...parts])).slice(0, 50);
    library.setMetadata(item.id, { keywords: merged });
    setKeywordInput('');
  };

  const onGenerate = async () => {
    setBusy(true);
    const result = await library.generateFor([item.id], {
      subject: subject || undefined,
      style,
      categories: item.metadata.categories,
      concepts: concepts.split(',').map((c) => c.trim()).filter(Boolean),
    });
    setBusy(false);
    if (result.error) toast.error('AI failed — used built-in instead', result.error);
    else toast.success('Generated', result.aiUsed ? result.providerLabel : 'Built-in generator');
  };

  const onEmbed = async () => {
    setBusy(true);
    const result = await library.embedFor([item.id], { backup });
    setBusy(false);
    if (result.done) toast.success('Embedded');
    else toast.error('Embed failed', result.failed[0]);
  };

  const onDownloadEmbedded = async () => {
    try {
      const bytes = await library.getItemBytes(item.id);
      const blob = new Blob([bytes as unknown as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (error) {
      toast.error('Download failed', error instanceof Error ? error.message : String(error));
    }
  };

  const platformIssues = useMemo(
    () => PLATFORM_LIST.map((p) => ({ platform: p, issues: validateItem(item, p.id, library.items) })),
    [item, library.items],
  );
  const badCount = platformIssues.filter((p) => p.issues.some((i) => i.level === 'error')).length;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative flex h-full w-full flex-col border-l border-line bg-bg-elevated shadow-[var(--shadow-pop)] sm:max-w-xl lg:max-w-2xl">
        {/* header */}
        <header className="flex items-start gap-3 border-b border-line px-4 py-3">
          {item.thumbUrl ? (
            <img src={item.thumbUrl} alt="" className="size-10 shrink-0 r-chip border border-line object-cover" />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center r-chip border border-line bg-surface-2 font-mono text-[0.625rem] text-fg-subtle uppercase">{item.format}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="display truncate text-[0.9375rem] font-semibold text-fg" title={item.name}>{item.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-fg-subtle">
              <Badge tone="neutral">{item.format.toUpperCase()}</Badge>
              {item.width && item.height && <span className="tabular-nums">{item.width}×{item.height}</span>}
              {mp !== null && <span className="tabular-nums">{mp.toFixed(1)} MP</span>}
              <span>{formatBytes(item.sizeBytes)}</span>
              {item.embeddedAt && <Badge tone="ok" dot>embedded</Badge>}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close editor"><X className="size-4" /></Button>
        </header>

        <Tabs
          className="px-3"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'metadata', label: 'Metadata' },
            { value: 'platforms', label: `Platforms ${badCount ? `(${badCount})` : ''}` },
            { value: 'embed', label: 'Embed' },
          ]}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {tab === 'metadata' && (
            <div className="flex flex-col gap-3">
              <div className="card p-3">
                <p className="mb-2 flex items-center gap-2 text-[0.6875rem] font-semibold tracking-wide text-fg-subtle uppercase"><Wand2 className="size-3.5 text-brand" /> Generate</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Subject">
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="golden retriever puppy" />
                  </Field>
                  <Field label="Concepts">
                    <Input value={concepts} onChange={(e) => setConcepts(e.target.value)} placeholder="friendship, loyalty" />
                  </Field>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Select value={style} onChange={(e) => setStyle(e.target.value as typeof style)} className="w-36" options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'vector', label: 'Vector' },
                    { value: 'photo', label: 'Photo' },
                  ]} />
                  <Button size="sm" onClick={onGenerate} loading={busy} icon={<Wand2 className="size-4" />}>Generate</Button>
                  <Button size="sm" variant="ghost" onClick={appendTranslations}>+ ES/DE/FR</Button>
                  {library.aiReady ? <Badge tone="brand" dot>AI</Badge> : <Badge tone="neutral" dot>Built-in</Badge>}
                </div>
              </div>

              <Field label={`Title (${item.metadata.title.length} chars)`}>
                <Input value={item.metadata.title} onChange={(e) => library.setMetadata(item.id, { title: e.target.value })} placeholder="Descriptive sentence" />
              </Field>

              <Field label="Description">
                <Textarea value={item.metadata.description} onChange={(e) => library.setMetadata(item.id, { description: e.target.value })} placeholder="One factual sentence" />
              </Field>

              <Field label={`Keywords ${item.metadata.keywords.length}/50`}>
                {!bulkMode ? (
                  <div className="flex flex-wrap gap-1.5 r-control border border-line bg-surface-2 p-2">
                    {item.metadata.keywords.map((keyword) => (
                      <span key={keyword} className="inline-flex items-center gap-1 r-chip bg-brand-soft px-1.5 py-0.5 text-[0.6875rem] font-medium text-brand-fg">
                        {keyword}
                        <button type="button" aria-label={`Remove ${keyword}`} onClick={() => library.setMetadata(item.id, { keywords: item.metadata.keywords.filter((k) => k !== keyword) })}>
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addKeywords(keywordInput);
                        }
                      }}
                      onBlur={() => keywordInput && addKeywords(keywordInput)}
                      placeholder="add + Enter"
                      className="min-w-32 flex-1 bg-transparent px-1 py-0.5 text-xs text-fg placeholder:text-fg-subtle focus:outline-none"
                    />
                  </div>
                ) : (
                  <Textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} onBlur={() => library.setMetadata(item.id, { keywords: Array.from(new Set(bulkText.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean))).slice(0, 50) })} placeholder="comma, separated, keywords" />
                )}
                <button type="button" className="mt-1 text-[0.6875rem] font-medium text-brand-fg hover:underline" onClick={() => setBulkMode((v) => !v)}>
                  {bulkMode ? 'Chips' : 'Bulk paste'}
                </button>
              </Field>

              <Field label="Categories (2)">
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_KEYS.map((category) => {
                    const active = item.metadata.categories.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() =>
                          library.setMetadata(item.id, {
                            categories: active
                              ? item.metadata.categories.filter((c) => c !== category)
                              : [...item.metadata.categories, category].slice(0, 2),
                          })
                        }
                        className={clsx(
                          'r-chip border px-1.5 py-0.5 text-[0.6875rem] font-medium transition-colors',
                          active ? 'border-brand bg-brand-soft text-brand-fg' : 'border-line bg-surface-2 text-fg-muted hover:text-fg',
                        )}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="card flex flex-col gap-3 p-3">
                <p className="text-[0.6875rem] font-semibold tracking-wide text-fg-subtle uppercase">Flags</p>
                <Switch checked={item.flags.aiGenerated} onChange={(v) => library.setFlags(item.id, { aiGenerated: v })} label="AI-generated" />
                {item.flags.aiGenerated && (
                  <Input value={item.flags.aiTool} onChange={(e) => library.setFlags(item.id, { aiTool: e.target.value })} placeholder="Tool used (e.g. Real-ESRGAN upscale, Midjourney)" />
                )}
                <Switch checked={item.flags.illustration} onChange={(v) => library.setFlags(item.id, { illustration: v })} label="Illustration" />
                <Switch checked={item.flags.editorial} onChange={(v) => library.setFlags(item.id, { editorial: v })} label="Editorial" />
                <Switch checked={item.flags.mature} onChange={(v) => library.setFlags(item.id, { mature: v })} label="Mature content" />
                <Field label="Vecteezy licence">
                  <Select value={item.flags.license} onChange={(e) => library.setFlags(item.id, { license: e.target.value as typeof item.flags.license })} options={[
                    { value: 'free', label: 'free' },
                    { value: 'pro', label: 'pro' },
                    { value: 'editorial', label: 'editorial' },
                  ]} />
                </Field>
              </div>
            </div>
          )}

          {tab === 'platforms' && (
            <div className="flex flex-col gap-3">
              {platformIssues.map(({ platform, issues }) => {
                const adapted = adaptForPlatform(item.metadata, platform);
                const errors = issues.filter((i) => i.level === 'error');
                return (
                  <details key={platform.id} className="card overflow-hidden">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5">
                      <PlatformLogo id={platform.id} size={18} />
                      <span className="flex-1 truncate text-sm font-medium text-fg">{platform.name}</span>
                      <Badge tone={errors.length ? 'danger' : issues.length ? 'warn' : 'ok'} dot>
                        {errors.length ? `${errors.length}` : issues.length ? 'warn' : 'ok'}
                      </Badge>
                      <span className="text-[0.6875rem] text-fg-subtle tabular-nums">{adapted.keywords.length}/{platform.keywords.max} kw</span>
                    </summary>
                    <div className="border-t border-line px-3 py-3">
                      <p className="text-xs text-fg-muted"><span className="font-semibold text-fg">Title:</span> {adapted.title || '—'}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{adapted.keywords.slice(0, 12).join(', ')}{adapted.keywords.length > 12 ? '…' : ''}</p>
                      {issues.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {issues.map((issue, index) => (
                            <li key={index} className={clsx('r-chip px-2 py-1.5 text-[0.6875rem] leading-relaxed', issue.level === 'error' ? 'bg-danger-soft text-danger' : issue.level === 'warn' ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-fg-muted')}>
                              {issue.message}
                              {issue.hint && <span className="block opacity-80">{issue.hint}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button
                        size="xs"
                        variant="ghost"
                        className="mt-2"
                        icon={<Copy className="size-3.5" />}
                        onClick={async () => {
                          await navigator.clipboard.writeText(adapted.keywords.join(', '));
                          toast.success(`Copied ${adapted.keywords.length}`);
                        }}
                      >
                        Copy adapted keywords
                      </Button>
                    </div>
                  </details>
                );
              })}
            </div>
          )}

          {tab === 'embed' && (
            <div className="flex flex-col gap-3">
              <div className="card p-3">
                <p className="text-[0.6875rem] font-semibold tracking-wide text-fg-subtle uppercase">IPTC / XMP</p>
                <p className="mt-1 text-[0.6875rem] text-fg-muted">
                  Title, description and keywords written into the file; portals pre-fill on ingest.
                </p>
                <div className="mt-3 r-control border border-line bg-surface-2 p-3">
                  <Switch checked={backup} onChange={setBackup} label="Keep backup copy" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={onEmbed} loading={busy} icon={<PenLine className="size-4" />} disabled={!['jpg', 'png', 'svg', 'eps', 'webp'].includes(item.format)}>
                    Embed
                  </Button>
                  {!isDesktop && (
                    <Button size="sm" variant="outline" icon={<Download className="size-4" />} onClick={onDownloadEmbedded}>
                      Download copy
                    </Button>
                  )}
                </div>
                {item.embeddedAt && (
                  <p className="mt-2 flex items-center gap-1.5 text-[0.6875rem] text-ok"><Check className="size-3.5" /> {new Date(item.embeddedAt).toLocaleDateString()}</p>
                )}
              </div>

              <div className="card p-3">
                <p className="text-[0.6875rem] font-semibold tracking-wide text-fg-subtle uppercase">Releases</p>
                <p className="mt-1 text-[0.6875rem] text-fg-muted">Silences the model-release warning.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {releases.length === 0 && <span className="text-[0.6875rem] text-fg-subtle">None yet</span>}
                  {releases.map((release) => {
                    const linked = (item.releaseIds ?? []).includes(release.id);
                    return (
                      <button
                        key={release.id}
                        type="button"
                        onClick={() =>
                          library.setReleaseIds(
                            item.id,
                            linked ? (item.releaseIds ?? []).filter((r) => r !== release.id) : [...(item.releaseIds ?? []), release.id],
                          )
                        }
                        className={clsx(
                          'r-chip border px-1.5 py-0.5 text-[0.6875rem] font-medium transition-colors',
                          linked ? 'border-ok bg-ok-soft text-ok' : 'border-line bg-surface-2 text-fg-muted hover:text-fg',
                          isExpired(release) && 'opacity-60 line-through',
                        )}
                      >
                        {release.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="card p-3">
                <p className="text-[0.6875rem] font-semibold tracking-wide text-fg-subtle uppercase">Filename</p>
                <p className="mt-1 text-[0.6875rem] text-fg-muted">ASCII only · Adobe ≤ 30 chars</p>
                <div className="mt-2 flex gap-2">
                  <Input value={safeName} onChange={(e) => setSafeName(e.target.value)} className="font-mono text-xs" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const ok = await library.renameItem(item.id, safeName);
                      if (ok) toast.success('Renamed', safeName);
                    }}
                  >
                    Apply
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSafeName(sanitizeFilename(item.name, PLATFORMS[platformGuess(item)]).name)}>
                    Auto
                  </Button>
                </div>
              </div>

            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function platformGuess(item: StockItem): PlatformId {
  return item.format === 'eps' || item.format === 'ai' ? 'freepik' : 'adobe';
}
