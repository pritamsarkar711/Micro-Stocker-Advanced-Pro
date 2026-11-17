import { useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Kpi } from '@/components/ui/Kpi';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { GIcon, type GoogleIconName } from '@/components/ui/GoogleIcon';
import { PlatformLogo } from '@/components/stock/PlatformLogo';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { PLATFORM_LIST } from '@/lib/stock/platforms';
import { buildValidationIndex, validateItem, worstLevel } from '@/lib/stock/validate';
import type { PlatformId } from '@/lib/stock/types';

const STUDIO_TOOLS: Array<{
  to: string;
  title: string;
  sub: string;
  icon: GoogleIconName;
}> = [
  {
    to: '/vector',
    title: 'Vector Studio',
    sub: 'Draw, open and export SVG or EPS',
    icon: 'polyline',
  },
  {
    to: '/quality',
    title: 'Quality Checker',
    sub: 'Editability, sharpness and duplicates',
    icon: 'fact_check',
  },
  {
    to: '/optimize',
    title: 'Image Optimizer',
    sub: 'Smaller files, same visible quality',
    icon: 'compress',
  },
  {
    to: '/upscale',
    title: 'Image Upscaler',
    sub: 'Local models up to 8K',
    icon: 'photo_size_select_large',
  },
  {
    to: '/bg-remove',
    title: 'Background Remover',
    sub: 'Transparent PNG cutouts',
    icon: 'content_cut',
  },
  {
    to: '/convert',
    title: 'Image Converter',
    sub: 'JPG, PNG, WebP, AVIF, TIFF, EPS',
    icon: 'swap_horiz',
  },
];

const FEATURED_PLATFORMS: PlatformId[] = [
  'shutterstock',
  'adobe',
  'freepik',
  'getty',
  'dreamstime',
  '123rf',
  'depositphotos',
  'vecteezy',
  'alamy',
  'pond5',
  'canva',
  'envato',
];

export function OverviewPage() {
  const { items, importFiles } = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const titled = items.filter(
      (it) => it.metadata.title.trim() && it.metadata.keywords.length >= 7,
    ).length;
    const embedded = items.filter((it) => Boolean(it.embeddedAt)).length;
    const avgKeywords = items.length
      ? Math.round(items.reduce((sum, it) => sum + it.metadata.keywords.length, 0) / items.length)
      : 0;
    return { total: items.length, titled, embedded, avgKeywords };
  }, [items]);

  const readiness = useMemo(() => {
    const idx = buildValidationIndex(items);
    return FEATURED_PLATFORMS.map((id) => {
      const p = PLATFORM_LIST.find((x) => x.id === id)!;
      if (!items.length) return { platform: p, ready: 0 };
      let ready = 0;
      for (const it of items) {
        if (worstLevel(validateItem(it, id, items, idx)) !== 'error') ready++;
      }
      return { platform: p, ready };
    });
  }, [items]);

  async function handleQuickImport(files: FileList) {
    const added = await importFiles(files);
    if (added.length) {
      toast.success(`Imported ${added.length} file${added.length === 1 ? '' : 's'}`);
      navigate('/library');
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.eps,.ai,.svg,.tif,.tiff,.avif,.webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void handleQuickImport(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              icon={<GIcon name="upload_file" size={16} />}
              onClick={() => fileRef.current?.click()}
            >
              Import files
            </Button>
            <Link to="/library">
              <Button size="sm" variant="primary" icon={<GIcon name="photo_library" size={16} />}>
                Open Library
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Library Assets" value={String(stats.total)} icon="photo_library" />
        <Kpi label="Tagged & Ready" value={String(stats.titled)} icon="check_circle" />
        <Kpi label="IPTC & XMP Embedded" value={String(stats.embedded)} icon="bookmark" />
        <Kpi label="Average Keywords" value={String(stats.avgKeywords)} icon="local_offer" />
      </div>

      <div>
        <h2 className="mb-2.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">
          Studio Tools
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STUDIO_TOOLS.map((tool) => (
            <Link key={tool.to} to={tool.to}>
              <Card padding="sm" interactive className="flex h-full items-center gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--r-control)] bg-accent-soft text-accent">
                  <GIcon name={tool.icon} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{tool.title}</div>
                  <div className="truncate text-xs text-ink-muted">{tool.sub}</div>
                </div>
                <GIcon name="chevron_right" size={16} className="shrink-0 text-ink-faint" />
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader
          title="Marketplace Readiness"
          icon={<GIcon name="storefront" size={17} />}
          action={
            <Link to="/platforms">
              <Button size="xs" variant="ghost" iconRight={<GIcon name="arrow_forward" size={13} />}>
                All rules
              </Button>
            </Link>
          }
        />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {readiness.map(({ platform, ready }) => (
            <Link
              key={platform.id}
              to="/export"
              className="flex items-center gap-3 rounded-[var(--r-control)] border border-line bg-surface p-3 hover:border-line-strong hover:bg-surface-2/50"
            >
              <PlatformLogo id={platform.id} size={28} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-ink">{platform.name}</div>
                <div className="truncate text-2xs text-ink-muted">
                  {platform.minMP > 0 ? `${platform.minMP} MP min` : 'Vector'} · {platform.keywords.min} to {platform.keywords.max} tags
                </div>
              </div>
              <Badge tone={ready > 0 && ready === items.length ? 'brand' : 'neutral'}>
                {items.length ? `${ready}/${items.length}` : platform.csv ? 'CSV' : 'XMP'}
              </Badge>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
