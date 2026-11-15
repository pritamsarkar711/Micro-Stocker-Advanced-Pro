import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { desktop } from '@/lib/desktop';
import { PlatformLogo } from '@/components/stock/PlatformLogo';
import { PLATFORM_LIST } from '@/lib/stock/platforms';

/** One marketplace = one dense, scannable reference card. */
export function PlatformsPage() {
  return (
    <>
      <PageHeader
        title="Platforms"
        description={`${PLATFORM_LIST.length} marketplaces · verified Nov 2026`}
      />

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-3">
        {PLATFORM_LIST.map((platform) => (
          <Card
            key={platform.id}
            title={
              <span className="flex min-w-0 items-center gap-2">
                <PlatformLogo id={platform.id} size={18} />
                <span className="truncate">{platform.name}</span>
              </span>
            }
            action={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Open ${platform.name}`}
                onClick={() => desktop.shell.openExternal(platform.site)}
              >
                <ExternalLink className="size-3.5" />
              </Button>
            }
          >
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <Row label="Photo" value={platform.formats.photo.map((f) => f.toUpperCase()).join(', ') || '—'} />
              <Row label="Vector" value={platform.formats.vector.map((f) => f.toUpperCase()).join(', ') || '—'} />
              <Row
                label="Size"
                value={`${platform.minMP}${platform.maxMP ? `–${platform.maxMP}` : '+'} MP · ${platform.maxFileMB} MB`}
              />
              <Row
                label="Keywords"
                value={`${platform.keywords.min}–${platform.keywords.max}${platform.keywords.ordered ? ' ordered' : ''}`}
              />
              <Row label="Title" value={`≤ ${platform.title.maxChars}${platform.title.noCommas ? ' · no commas' : ''}`} />
              <Row label="CSV" value={platform.csv ? (platform.csv.delimiter === ';' ? 'semicolon · no header' : 'comma · header') : 'portal form'} />
            </dl>

            <div className="mt-2 flex flex-wrap gap-1">
              <Badge tone={platform.aiPolicy === 'forbidden' ? 'danger' : 'warn'}>
                {platform.aiPolicy === 'forbidden' ? 'No AI' : 'AI labelled'}
              </Badge>
              {platform.readsEmbeddedMetadata && <Badge tone="ok">Reads IPTC</Badge>}
              <Badge tone={platform.source === 'official' ? 'neutral' : 'outline'}>
                {platform.source === 'official' ? 'Official' : 'Verified'}
              </Badge>
            </div>

            <p className="mt-2 line-clamp-2 text-[0.6875rem] text-fg-muted">
              {platform.csv?.notes ?? platform.vectorRules}
            </p>
          </Card>
        ))}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.625rem] tracking-[0.04em] text-fg-subtle uppercase">{label}</dt>
      <dd className="truncate text-[0.75rem] font-medium text-fg" title={value}>
        {value}
      </dd>
    </div>
  );
}
