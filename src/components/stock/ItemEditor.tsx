import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { GIcon } from '@/components/ui/GoogleIcon';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { FormatIcon } from '@/components/ui/FormatIcon';
import { PlatformLogo } from './PlatformLogo';
import { AiPanel } from '@/components/settings/AiPanel';
import { useLibrary } from '@/state/library';
import { useBank } from '@/state/bank';
import { useReleases } from '@/state/releases';
import { useToast } from '@/state/ToastState';
import { DEFAULT_AI, loadAiSettings, PROVIDERS, type AiSettings } from '@/lib/stock/ai';
import { mergeKeywords, parseKeywordInput } from '@/lib/stock/metadata';
import { PLATFORM_LIST, SHUTTERSTOCK_CATEGORIES } from '@/lib/stock/platforms';
import { validateEverywhere, worstLevel } from '@/lib/stock/validate';
import { canEmbedFormat } from '@/lib/stock/xmp';
import { formatBytes } from '@/lib/modelStore';
import { megapixels, type PlatformId, type StockItem } from '@/lib/stock/types';

export interface ItemEditorProps {
  item: StockItem;
  onClose?: () => void;
}

export function ItemEditor({ item, onClose }: ItemEditorProps) {
  const {
    items,
    updateMetadata,
    updateFlags,
    setReleases,
    aiDraft,
    downloadEmbeddedFile,
    copyItemMetadata,
    exportMetadataCsv,
    removeItems,
  } = useLibrary();
  const { bank } = useBank();
  const { releases } = useReleases();
  const toast = useToast();

  const [aiSettings, setAiSettings] = useState<AiSettings>(DEFAULT_AI);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [kwInput, setKwInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [activePlatform, setActivePlatform] = useState<PlatformId | null>(null);

  useEffect(() => {
    void loadAiSettings().then(setAiSettings);
  }, []);

  const provider = PROVIDERS[aiSettings.kind];
  const mp = megapixels(item);
  const embeddable = canEmbedFormat(item.format);

  const report = useMemo(() => validateEverywhere(item, items), [item, items]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await aiDraft([item.id]);
      if (res.ok > 0) {
        toast.success(
          res.embedded > 0 ? 'Metadata generated and embedded' : 'Metadata generated',
          `${provider.name}`,
        );
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleEmbedDownload() {
    setEmbedding(true);
    try {
      await downloadEmbeddedFile(item.id);
    } finally {
      setEmbedding(false);
    }
  }

  async function copyText(label: string, text: string) {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text.trim());
      toast.success(`${label} copied`);
    } catch {
      toast.error('Clipboard unavailable');
    }
  }

  function addKeywords() {
    const incoming = parseKeywordInput(kwInput);
    if (!incoming.length) return;
    updateMetadata(item.id, { keywords: mergeKeywords(item.metadata.keywords, incoming, 50) });
    setKwInput('');
  }

  function removeKeyword(word: string) {
    updateMetadata(item.id, {
      keywords: item.metadata.keywords.filter((k) => k !== word),
    });
  }

  function promoteKeyword(index: number) {
    if (index <= 0) return;
    const next = [...item.metadata.keywords];
    const [moved] = next.splice(index, 1);
    next.unshift(moved);
    updateMetadata(item.id, { keywords: next });
  }

  const synonymSuggestions = useMemo(() => {
    const existing = new Set(item.metadata.keywords);
    const out: string[] = [];
    for (const [key, list] of Object.entries(bank.synonyms)) {
      if (existing.has(key) || item.metadata.title.toLowerCase().includes(key)) {
        for (const w of list) {
          if (!existing.has(w) && !out.includes(w)) out.push(w);
        }
      }
    }
    return out.slice(0, 12);
  }, [bank.synonyms, item.metadata.keywords, item.metadata.title]);

  return (
    <div className="space-y-4">
      {/* Asset header */}
      <div className="flex items-start gap-3">
        <div className="checkerboard flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-control)] border border-line bg-surface-2">
          {item.thumbUrl ? (
            <img src={item.thumbUrl} alt={item.name} className="size-full object-cover" />
          ) : (
            <FormatIcon format={item.format} size={22} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink" title={item.name}>
            {item.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-ink-muted">
            <Badge tone="neutral">{item.format.toUpperCase()}</Badge>
            {item.width && item.height && (
              <span>
                {item.width}x{item.height} ({mp?.toFixed(1)} MP)
              </span>
            )}
            <span>·</span>
            <span>{formatBytes(item.sizeBytes)}</span>
            {item.embeddedAt && (
              <Badge tone="brand">
                <GIcon name="check_circle" size={12} />
                IPTC & XMP ready
              </Badge>
            )}
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-[var(--r-xs)] text-ink-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Close editor"
          >
            <GIcon name="close" size={17} />
          </button>
        )}
      </div>

      {/* AI generation & post generation bar */}
      <div className="rounded-[var(--r-control)] border border-line bg-surface-2/60 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setAiModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-[var(--r-xs)] border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:border-accent"
            title="Switch AI provider or model"
          >
            <BrandLogo brand={provider.brand} size={15} />
            <span>{provider.name}</span>
            <GIcon name="expand_more" size={14} className="text-ink-muted" />
          </button>

          <Button
            size="sm"
            variant="primary"
            loading={generating}
            icon={<GIcon name="brush" size={15} />}
            onClick={() => void handleGenerate()}
          >
            Generate metadata
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
          <Button
            size="xs"
            variant="secondary"
            icon={<GIcon name="content_copy" size={13} />}
            onClick={() => void copyItemMetadata(item.id)}
          >
            Copy all
          </Button>
          {embeddable && (
            <Button
              size="xs"
              variant="secondary"
              loading={embedding}
              icon={<GIcon name="file_download" size={13} />}
              onClick={() => void handleEmbedDownload()}
            >
              Embed & save file
            </Button>
          )}
          <Button
            size="xs"
            variant="secondary"
            icon={<GIcon name="table_chart" size={13} />}
            onClick={() => void exportMetadataCsv([item.id], 'universal')}
          >
            CSV
          </Button>
          <Button
            size="xs"
            variant="ghost"
            icon={<PlatformLogo id="shutterstock" size={14} />}
            onClick={() => void exportMetadataCsv([item.id], 'shutterstock')}
          >
            SS CSV
          </Button>
          <Button
            size="xs"
            variant="ghost"
            icon={<PlatformLogo id="adobe" size={14} />}
            onClick={() => void exportMetadataCsv([item.id], 'adobe')}
          >
            Adobe CSV
          </Button>
          <Button
            size="xs"
            variant="ghost"
            icon={<PlatformLogo id="freepik" size={14} />}
            onClick={() => void exportMetadataCsv([item.id], 'freepik')}
          >
            Magnific CSV
          </Button>
        </div>
      </div>

      {/* Title */}
      <Field
        label="Title"
        hint={
          <span className="inline-flex items-center gap-2 tabular-nums">
            <span className={clsx(item.metadata.title.length > 70 && 'text-accent')}>
              {item.metadata.title.length}/70 ideal (200 max)
            </span>
            <button
              type="button"
              onClick={() => void copyText('Title', item.metadata.title)}
              className="text-accent hover:underline"
            >
              Copy
            </button>
          </span>
        }
      >
        <Input
          value={item.metadata.title}
          onChange={(e) => updateMetadata(item.id, { title: e.target.value })}
          placeholder="Descriptive buyer focused title without commas"
        />
      </Field>

      {/* Description */}
      <Field
        label="Description"
        hint={
          <span className="inline-flex items-center gap-2 tabular-nums">
            <span>{item.metadata.description.length}/200</span>
            <button
              type="button"
              onClick={() =>
                void copyText('Description', item.metadata.description || item.metadata.title)
              }
              className="text-accent hover:underline"
            >
              Copy
            </button>
          </span>
        }
      >
        <Textarea
          rows={2}
          value={item.metadata.description}
          onChange={(e) => updateMetadata(item.id, { description: e.target.value })}
          placeholder="Complete descriptive sentence of 5 or more words"
        />
      </Field>

      {/* Keywords */}
      <Field
        label={`Keywords (${item.metadata.keywords.length}/49)`}
        hint={
          <span className="inline-flex items-center gap-2">
            <span>First 10 highlighted for Adobe Stock</span>
            <button
              type="button"
              onClick={() => void copyText('Keywords', item.metadata.keywords.join(', '))}
              className="text-accent hover:underline"
            >
              Copy
            </button>
          </span>
        }
      >
        <div className="flex gap-2">
          <Input
            value={kwInput}
            onChange={(e) => setKwInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addKeywords();
              }
            }}
            placeholder="Add comma separated keywords"
          />
          <Button size="md" variant="secondary" icon={<GIcon name="add" size={15} />} onClick={addKeywords}>
            Add
          </Button>
        </div>

        {item.metadata.keywords.length > 0 && (
          <div className="mt-2 flex max-h-40 flex-wrap gap-1 overflow-y-auto rounded-[var(--r-control)] border border-line bg-surface-2/40 p-2">
            {item.metadata.keywords.map((kw, index) => (
              <span
                key={kw}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-[var(--r-xs)] border px-2 py-0.5 text-2xs font-medium',
                  index < 10
                    ? 'border-accent/35 bg-accent-soft text-accent'
                    : 'border-line bg-surface text-ink',
                )}
              >
                {index >= 10 && (
                  <button
                    type="button"
                    onClick={() => promoteKeyword(index)}
                    className="text-ink-faint hover:text-accent"
                    title="Move to top 10"
                  >
                    <GIcon name="north" size={11} />
                  </button>
                )}
                <span>{kw}</span>
                <button
                  type="button"
                  onClick={() => removeKeyword(kw)}
                  className="text-ink-faint hover:text-danger"
                  aria-label={`Remove ${kw}`}
                >
                  <GIcon name="close" size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {synonymSuggestions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="text-2xs text-ink-faint">Bank:</span>
            {synonymSuggestions.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() =>
                  updateMetadata(item.id, {
                    keywords: mergeKeywords(item.metadata.keywords, [word], 50),
                  })
                }
                className="rounded-[var(--r-xs)] border border-line px-1.5 py-0.5 text-2xs text-ink-muted hover:border-accent hover:text-accent"
              >
                + {word}
              </button>
            ))}
          </div>
        )}
      </Field>

      {/* Categories */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Field label="Primary category">
          <Select
            value={item.metadata.categories[0] ?? ''}
            onChange={(e) => {
              const next = [e.target.value, item.metadata.categories[1] ?? ''].filter(Boolean);
              updateMetadata(item.id, { categories: next });
            }}
            options={[
              { value: '', label: 'Select category' },
              ...SHUTTERSTOCK_CATEGORIES.map((c) => ({ value: c, label: c })),
            ]}
          />
        </Field>
        <Field label="Secondary category">
          <Select
            value={item.metadata.categories[1] ?? ''}
            onChange={(e) => {
              const first = item.metadata.categories[0] ?? '';
              const next = [first, e.target.value].filter(Boolean);
              updateMetadata(item.id, { categories: next });
            }}
            options={[
              { value: '', label: 'Optional' },
              ...SHUTTERSTOCK_CATEGORIES.map((c) => ({ value: c, label: c })),
            ]}
          />
        </Field>
      </div>

      {/* Submission flags */}
      <div className="grid grid-cols-2 gap-2 rounded-[var(--r-control)] border border-line p-3 sm:grid-cols-3">
        <Switch
          checked={item.flags.aiGenerated}
          onChange={(aiGenerated) => updateFlags(item.id, { aiGenerated })}
          label="AI generated"
        />
        <Switch
          checked={item.flags.illustration}
          onChange={(illustration) => updateFlags(item.id, { illustration })}
          label="Illustration"
        />
        <Switch
          checked={item.flags.editorial}
          onChange={(editorial) => updateFlags(item.id, { editorial })}
          label="Editorial"
        />
      </div>

      {item.flags.aiGenerated && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Field label="AI generator model">
            <Input
              value={item.flags.aiTool}
              onChange={(e) => updateFlags(item.id, { aiTool: e.target.value })}
              placeholder="Generator name for Magnific"
            />
          </Field>
          <Field label="AI prompt (Magnific CSV)">
            <Input
              value={item.flags.aiPrompt ?? ''}
              onChange={(e) => updateFlags(item.id, { aiPrompt: e.target.value })}
              placeholder="Optional prompt"
            />
          </Field>
        </div>
      )}

      {/* Releases */}
      {releases.length > 0 && (
        <Field label="Linked releases">
          <div className="flex flex-wrap gap-1.5">
            {releases.map((rel) => {
              const linked = (item.releaseIds ?? []).includes(rel.id);
              return (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => {
                    const cur = item.releaseIds ?? [];
                    setReleases(
                      item.id,
                      linked ? cur.filter((id) => id !== rel.id) : [...cur, rel.id],
                    );
                  }}
                  className={clsx(
                    'inline-flex items-center gap-1 rounded-[var(--r-xs)] border px-2 py-1 text-2xs font-medium',
                    linked
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line text-ink-muted hover:text-ink',
                  )}
                >
                  <GIcon name={linked ? 'check_circle' : 'add'} size={12} />
                  {rel.name}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {/* Live 14 marketplace readiness */}
      <div className="space-y-2 border-t border-line pt-3">
        <div className="text-xs font-semibold text-ink">Marketplace compliance</div>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORM_LIST.map((p) => {
            const issues = report[p.id] ?? [];
            const level = worstLevel(issues);
            const selected = activePlatform === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePlatform(selected ? null : p.id)}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-[var(--r-xs)] border px-2 py-1 text-2xs font-medium',
                  selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-surface-2',
                )}
              >
                <PlatformLogo id={p.id} size={15} />
                <span className="text-ink">{p.name}</span>
                <GIcon
                  name={level === 'error' ? 'cancel' : 'check_circle'}
                  size={13}
                  className={
                    level === 'error'
                      ? 'text-danger'
                      : level === 'warn'
                        ? 'text-ink-muted'
                        : 'text-accent'
                  }
                />
              </button>
            );
          })}
        </div>

        {activePlatform && (
          <div className="rounded-[var(--r-control)] border border-line bg-surface-2/60 p-2.5 text-xs space-y-1">
            {(report[activePlatform] ?? []).length === 0 ? (
              <div className="flex items-center gap-1.5 font-medium text-accent">
                <GIcon name="check_circle" size={14} />
                Ready for upload
              </div>
            ) : (
              report[activePlatform].map((iss, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-ink-muted">
                  <GIcon
                    name={iss.level === 'error' ? 'cancel' : 'info'}
                    size={14}
                    className={clsx(
                      'mt-0.5 shrink-0',
                      iss.level === 'error' ? 'text-danger' : 'text-accent',
                    )}
                  />
                  <span>{iss.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Remove */}
      <div className="flex justify-end border-t border-line pt-2">
        <Button
          size="xs"
          variant="ghost"
          className="text-danger hover:text-danger"
          icon={<GIcon name="delete" size={14} />}
          onClick={() => {
            removeItems([item.id]);
            onClose?.();
          }}
        >
          Remove from library
        </Button>
      </div>

      <Modal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        title="AI metadata provider"
        size="lg"
      >
        <AiPanel compact onChange={setAiSettings} />
      </Modal>
    </div>
  );
}
