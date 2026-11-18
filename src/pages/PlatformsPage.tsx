import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { GIcon } from '@/components/ui/GoogleIcon';
import { Input } from '@/components/ui/Field';
import { PlatformLogo } from '@/components/stock/PlatformLogo';
import { desktop } from '@/lib/desktop';
import { PLATFORM_LIST } from '@/lib/stock/platforms';

type PolicyFilter = 'all' | 'csv' | 'ai-allowed' | 'no-ai';

const FILTERS: Array<{ id: PolicyFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'csv', label: 'CSV' },
  { id: 'ai-allowed', label: 'AI allowed' },
  { id: 'no-ai', label: 'No AI' },
];

function Stat({ icon, label, value }: { icon: 'aspect_ratio' | 'save' | 'sell' | 'description'; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <GIcon name={icon} size={15} className="shrink-0 text-ink-faint" />
      <div className="min-w-0">
        <div className="text-2xs text-ink-faint">{label}</div>
        <div className="truncate text-[0.8125rem] font-semibold text-ink tabular-nums">{value}</div>
      </div>
    </div>
  );
}

export function PlatformsPage() {
  const [filter, setFilter] = useState<PolicyFilter>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PLATFORM_LIST.filter((p) => {
      if (filter === 'csv' && !p.csv) return false;
      if (filter === 'ai-allowed' && p.aiPolicy === 'forbidden') return false;
      if (filter === 'no-ai' && p.aiPolicy !== 'forbidden') return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.highlights.some((h) => h.toLowerCase().includes(q));
    });
  }, [filter, search]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platform Rules"
        actions={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find an agency"
            leading={<GIcon name="search" size={16} />}
            className="h-9 w-56"
          />
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((item) => {
          const active = filter === item.id;
          const count =
            item.id === 'all'
              ? PLATFORM_LIST.length
              : item.id === 'csv'
                ? PLATFORM_LIST.filter((p) => p.csv).length
                : item.id === 'ai-allowed'
                  ? PLATFORM_LIST.filter((p) => p.aiPolicy !== 'forbidden').length
                  : PLATFORM_LIST.filter((p) => p.aiPolicy === 'forbidden').length;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={clsx(
                'inline-flex h-8 items-center gap-1.5 rounded-[var(--r-control)] border px-2.5 text-[0.75rem] font-medium transition-colors',
                active
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {item.label}
              <span className={clsx('tabular-nums', active ? 'text-white/90' : 'text-ink-faint')}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((p) => {
          const expanded = open === p.id;
          return (
            <Card key={p.id} padding="md" className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <PlatformLogo id={p.id} size={30} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[0.9375rem] font-bold text-ink">{p.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {p.csv && <Badge tone="brand" size="sm">CSV</Badge>}
                    {p.readsEmbeddedMetadata && <Badge tone="neutral" size="sm">IPTC</Badge>}
                    <Badge tone={p.aiPolicy === 'forbidden' ? 'neutral' : 'ok'} size="sm">
                      {p.aiPolicy === 'forbidden' ? 'No AI' : 'AI'}
                    </Badge>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void desktop.shell.openExternal(p.site)}
                  aria-label={`Open ${p.name}`}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--r-control)] text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <GIcon name="open_in_new" size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-line pt-3">
                <Stat
                  icon="aspect_ratio"
                  label="Resolution"
                  value={p.minMP > 0 ? `${p.minMP}${p.maxMP ? `-${p.maxMP}` : '+'} MP` : 'Vector'}
                />
                <Stat icon="save" label="Max file" value={`${p.maxFileMB} MB`} />
                <Stat icon="sell" label="Keywords" value={`${p.keywords.min}-${p.keywords.max}`} />
                <Stat icon="description" label="Title" value={`${p.title.recommendedChars ?? p.title.maxChars} chars`} />
              </div>

              <button
                type="button"
                onClick={() => setOpen(expanded ? null : p.id)}
                aria-expanded={expanded}
                className="flex min-h-9 w-full items-center justify-between gap-2 py-1 text-[0.75rem] font-medium text-ink-muted transition-colors hover:text-ink max-sm:min-h-11 max-sm:text-[0.8125rem]"
              >
                <span>{expanded ? 'Hide rules' : 'Rules and formats'}</span>
                <GIcon name={expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={17} />
              </button>

              {expanded && (
                <dl className="space-y-2 border-t border-line pt-3 text-[0.75rem] leading-relaxed">
                  <div>
                    <dt className="font-semibold text-ink">Formats</dt>
                    <dd className="text-ink-muted">
                      {[...p.formats.photo, ...p.formats.vector].map((f) => f.toUpperCase()).join(', ')}
                      {p.video && ` · video to ${p.video.maxHeight >= 4320 ? '8K' : '4K'}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">AI policy</dt>
                    <dd className="text-ink-muted">{p.aiNote}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">Vectors</dt>
                    <dd className="text-ink-muted">{p.vectorRules}</dd>
                  </div>
                  {p.csv && (
                    <div>
                      <dt className="font-semibold text-ink">CSV columns</dt>
                      <dd className="font-mono text-2xs break-words text-ink-muted">
                        {p.csv.columns.join(` ${p.csv.delimiter} `)}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
