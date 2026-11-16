import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { GIcon } from '@/components/ui/GoogleIcon';
import { PlatformLogo } from '@/components/stock/PlatformLogo';
import { desktop } from '@/lib/desktop';
import { PLATFORM_LIST } from '@/lib/stock/platforms';

type PolicyFilter = 'all' | 'csv' | 'ai-allowed' | 'no-ai';

export function PlatformsPage() {
  const [filter, setFilter] = useState<PolicyFilter>('all');
  const [search, setSearch] = useState('');

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
            placeholder="Filter marketplaces"
            leading={<GIcon name="search" size={15} />}
            className="h-8 w-52"
          />
        }
      />

      <Tabs
        value={filter}
        onChange={setFilter}
        items={[
          { id: 'all', label: 'All Agencies', count: PLATFORM_LIST.length },
          { id: 'csv', label: 'CSV Supported', count: PLATFORM_LIST.filter((p) => p.csv).length },
          {
            id: 'ai-allowed',
            label: 'Disclosed AI Allowed',
            count: PLATFORM_LIST.filter((p) => p.aiPolicy !== 'forbidden').length,
          },
          {
            id: 'no-ai',
            label: 'No Generative AI',
            count: PLATFORM_LIST.filter((p) => p.aiPolicy === 'forbidden').length,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((p) => (
          <Card key={p.id} className="space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <PlatformLogo id={p.id} size={32} />
                <div>
                  <h2 className="text-sm font-bold text-ink">{p.name}</h2>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={p.aiPolicy === 'forbidden' ? 'neutral' : 'brand'}>
                      {p.aiPolicy === 'forbidden' ? 'No AI' : 'Disclosed AI'}
                    </Badge>
                    {p.csv && <Badge tone="brand">CSV</Badge>}
                    {p.readsEmbeddedMetadata && <Badge tone="neutral">IPTC & XMP</Badge>}
                  </div>
                </div>
              </div>
              <Button
                size="xs"
                variant="ghost"
                iconRight={<GIcon name="open_in_new" size={13} />}
                onClick={() => void desktop.shell.openExternal(p.site)}
              >
                Portal
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-[var(--r-control)] border border-line bg-surface-2/50 p-2.5 text-2xs sm:grid-cols-4">
              <div>
                <div className="text-ink-faint">Resolution</div>
                <div className="mt-0.5 font-semibold text-ink tabular-nums">
                  {p.minMP > 0 ? `${p.minMP}${p.maxMP ? ` to ${p.maxMP}` : '+'} MP` : 'Vector'}
                </div>
              </div>
              <div>
                <div className="text-ink-faint">Max file</div>
                <div className="mt-0.5 font-semibold text-ink tabular-nums">{p.maxFileMB} MB</div>
              </div>
              <div>
                <div className="text-ink-faint">Keywords</div>
                <div className="mt-0.5 font-semibold text-ink tabular-nums">
                  {p.keywords.min} to {p.keywords.max}
                </div>
              </div>
              <div>
                <div className="text-ink-faint">Title max</div>
                <div className="mt-0.5 font-semibold text-ink tabular-nums">
                  {p.title.recommendedChars ?? p.title.maxChars} chars
                </div>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-ink-muted">
              <div>
                <span className="font-semibold text-ink">Formats: </span>
                {[...p.formats.photo, ...p.formats.vector].map((f) => f.toUpperCase()).join(', ')}
                {p.video && ` · Video up to ${p.video.maxHeight >= 4320 ? '8K' : '4K'}`}
              </div>
              <div>
                <span className="font-semibold text-ink">AI policy: </span>
                {p.aiNote}
              </div>
              <div>
                <span className="font-semibold text-ink">Vectors: </span>
                {p.vectorRules}
              </div>
              {p.csv && (
                <div>
                  <span className="font-semibold text-ink">CSV columns: </span>
                  <span className="font-mono text-2xs">{p.csv.columns.join(` ${p.csv.delimiter} `)}</span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
