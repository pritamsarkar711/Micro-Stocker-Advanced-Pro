import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Expand,
  Laptop,
  Monitor,
  Smartphone,
  Square,
  Table2,
  Tablet,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SegmentedControl } from '@/components/ui/Field';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { BREAKPOINTS, useViewport, type Breakpoint } from '@/hooks/useViewport';
import { desktop } from '@/lib/desktop';
import { useToast } from '@/state/ToastState';

interface Device {
  id: string;
  label: string;
  width: number;
  height: number;
  icon: typeof Smartphone;
}

const DEVICES: Device[] = [
  { id: 'phone-s', label: 'Small phone', width: 360, height: 640, icon: Smartphone },
  { id: 'phone', label: 'Phone', width: 390, height: 844, icon: Smartphone },
  { id: 'tablet-p', label: 'Tablet ↕', width: 768, height: 1024, icon: Tablet },
  { id: 'tablet-l', label: 'Tablet ↔', width: 1024, height: 768, icon: Tablet },
  { id: 'laptop', label: 'Laptop', width: 1280, height: 800, icon: Laptop },
  { id: 'desktop', label: 'Desktop', width: 1600, height: 900, icon: Monitor },
];

const PREVIEW_ROUTES = [
  { value: '/', label: 'Overview' },
  { value: '/cloud', label: 'Cloud' },
  { value: '/settings', label: 'Settings' },
  { value: '/about', label: 'About' },
];

interface DemoRow {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  price: number;
  updated: string;
}

const DEMO_ROWS: DemoRow[] = [
  { id: '1', name: 'Wireless barcode scanner', sku: 'ACC-BS-2201', category: 'Hardware', stock: 14, price: 4200, updated: '2 hours ago' },
  { id: '2', name: 'Thermal receipt paper 80mm', sku: 'CON-TP-0080', category: 'Consumables', stock: 240, price: 55, updated: '5 hours ago' },
  { id: '3', name: 'USB-C charging cable 1m', sku: 'ACC-CB-1001', category: 'Hardware', stock: 3, price: 320, updated: 'yesterday' },
  { id: '4', name: 'Label printer rolls (pack of 6)', sku: 'CON-LR-0006', category: 'Consumables', stock: 48, price: 780, updated: '2 days ago' },
  { id: '5', name: 'Cash drawer insert', sku: 'HRW-CD-0011', category: 'Furniture', stock: 0, price: 5600, updated: '3 days ago' },
];

export function ResponsiveLabPage() {
  const viewport = useViewport();
  const toast = useToast();
  const [device, setDevice] = useState<Device>(DEVICES[1]);
  const [route, setRoute] = useState('/');
  const [fit, setFit] = useState(true);
  const [customWidth, setCustomWidth] = useState(390);
  const frameHostRef = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(0);

  useEffect(() => {
    const node = frameHostRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      setHostWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(node);
    setHostWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  const embedUrl = useMemo(() => {
    const base = window.location.href.split('#')[0];
    return `${base}#${route}?embed=1`;
  }, [route]);

  const scale = fit && hostWidth > 0 ? Math.min(1, (hostWidth - 4) / device.width) : 1;
  const frameWidth = fit ? device.width : customWidth || device.width;
  const effectiveScale =
    fit && hostWidth > 0 ? Math.min(1, (hostWidth - 4) / frameWidth) : 1;

  const openInNewWindow = () => {
    const width = device.width;
    const height = Math.min(device.height, 900);
    const left = Math.max(0, (window.screen.availWidth - width) / 2);
    const top = Math.max(0, (window.screen.availHeight - height) / 2);
    const opened = window.open(
      embedUrl,
      'msap-responsive-preview',
      `width=${width},height=${height},left=${left},top=${top}`,
    );
    if (!opened) toast.warning('Popup blocked', 'Allow popups for this page to open the resizable preview window.');
  };

  const columns: Column<DemoRow>[] = [
    { key: 'name', header: 'Item', primary: true, sortable: true },
    { key: 'sku', header: 'SKU', sortable: true, hideBelow: 'lg', render: (row) => <span className="font-mono text-xs text-fg-muted">{row.sku}</span> },
    { key: 'category', header: 'Category', hideBelow: 'xl' },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.stock,
      render: (row) => (
        <Badge tone={row.stock === 0 ? 'danger' : row.stock < 5 ? 'warn' : 'ok'} dot>
          {row.stock}
        </Badge>
      ),
    },
    {
      key: 'price',
      header: 'Unit price',
      align: 'right',
      hideBelow: 'md',
      sortable: true,
      sortValue: (row) => row.price,
      render: (row) => <span className="tabular-nums">৳{row.price.toLocaleString()}</span>,
    },
    { key: 'updated', header: 'Updated', hideBelow: 'xl', render: (row) => <span className="text-fg-subtle">{row.updated}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Responsive lab"
        description="The live app rendered at phone, tablet and desktop widths."
        actions={
          <Button variant="outline" size="sm" icon={<Expand className="size-4" />} onClick={openInNewWindow}>
            Open resizable window
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Live viewport" description="Values from this actual window">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Width', `${viewport.width}px`],
              ['Height', `${viewport.height}px`],
              ['Breakpoint', viewport.breakpoint.toUpperCase()],
              ['Device pixel ratio', viewport.dpr.toFixed(2)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-surface-2 p-3">
                <p className="text-[0.6875rem] tracking-wide text-fg-subtle uppercase">{label}</p>
                <p className="mt-1 truncate font-mono text-lg font-semibold text-fg tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          {/* Breakpoint ruler */}
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
              Breakpoint ruler
            </p>
            <div className="relative h-10 overflow-hidden rounded-lg border border-line bg-surface-2">
              <div className="absolute inset-0 flex">
                {(Object.keys(BREAKPOINTS) as Breakpoint[]).map((key, index, all) => {
                  const start = BREAKPOINTS[key];
                  const end = index === all.length - 1 ? 1920 : BREAKPOINTS[all[index + 1]];
                  const widthPct = ((end - start) / 1920) * 100;
                  const active = key === viewport.breakpoint;
                  return (
                    <div
                      key={key}
                      style={{ width: `${widthPct}%` }}
                      className={
                        active
                          ? 'flex items-center justify-center border-r border-line bg-brand text-[0.6875rem] font-bold text-white'
                          : 'flex items-center justify-center border-r border-line text-[0.6875rem] font-medium text-fg-subtle last:border-r-0'
                      }
                      title={`${key}: ${start}px+`}
                    >
                      {key}
                    </div>
                  );
                })}
              </div>
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-danger transition-[left] duration-150"
                style={{ left: `${Math.min(100, (viewport.width / 1920) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-fg-muted">
              Red line = current width. {viewport.isTouch ? 'Touch input detected — controls get 44px minimum targets.' : 'Pointer input detected.'}
            </p>
          </div>
        </Card>

        <Card title="Layout rules" description="How the shell rearranges itself">
          <ul className="flex flex-col gap-2.5 text-sm">
            {[
              ['< 640px', 'Single column, bottom tab bar, dialogs become bottom sheets'],
              ['640–1023px', 'Two columns, tables replace card lists, drawer navigation'],
              ['1024–1279px', 'Collapsed icon rail, three-column dashboards'],
              ['≥ 1280px', 'Full sidebar with labels, dense workspace grids'],
              ['≥ 1536px', 'Extra columns appear instead of stretching content'],
            ].map(([range, rule]) => (
              <li key={range} className="flex gap-3 rounded-lg border border-line bg-surface-2 p-3">
                <span className="shrink-0 font-mono text-xs text-brand-fg">{range}</span>
                <span className="text-xs leading-relaxed text-fg-muted">{rule}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        className="mt-4"
        title="Device simulator"
        description="The real app, loaded inside a frame at the exact width of each device"
        action={<Badge tone="brand">live iframe</Badge>}
      >
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {DEVICES.map((item) => {
            const Icon = item.icon;
            const active = item.id === device.id && fit;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setDevice(item);
                  setFit(true);
                }}
                className={
                  active
                    ? 'inline-flex shrink-0 items-center gap-2 rounded-lg border border-brand bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-fg'
                    : 'inline-flex shrink-0 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-medium text-fg-muted transition hover:text-fg'
                }
              >
                <Icon className="size-4" />
                {item.label}
                <span className="font-mono opacity-70">{item.width}px</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedControl
            size="sm"
            value={route}
            onChange={(value) => setRoute(value)}
            options={PREVIEW_ROUTES.map((r) => ({ value: r.value, label: r.label }))}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-fg-muted">
              <input
                type="checkbox"
                checked={fit}
                onChange={(event) => setFit(event.target.checked)}
                className="size-4 accent-[var(--brand)]"
              />
              Scale to fit
            </label>
            {!fit && (
              <label className="flex items-center gap-2 text-xs text-fg-muted">
                Custom width
                <input
                  type="number"
                  min={280}
                  max={2560}
                  value={customWidth}
                  onChange={(event) => setCustomWidth(Number(event.target.value))}
                  className="h-8 w-24 rounded-md border border-line bg-surface-2 px-2 font-mono text-xs text-fg"
                />
                px
              </label>
            )}
            <span className="font-mono text-xs text-fg-subtle">
              {frameWidth}×{device.height} @ {Math.round(effectiveScale * 100)}%
            </span>
          </div>
        </div>

        <div
          ref={frameHostRef}
          className="mt-4 overflow-auto rounded-xl border border-line bg-surface-3 p-2"
          style={{ minHeight: 260 }}
        >
          <div
            style={{
              width: frameWidth * effectiveScale,
              height: device.height * effectiveScale,
              margin: '0 auto',
            }}
          >
            <div
              style={{
                width: frameWidth,
                height: device.height,
                transform: `scale(${effectiveScale})`,
                transformOrigin: 'top left',
              }}
              className="overflow-hidden rounded-lg border border-line bg-bg shadow-[var(--shadow-card)]"
            >
              <iframe
                key={`${embedUrl}-${frameWidth}`}
                src={embedUrl}
                title={`Preview at ${frameWidth}px`}
                className="h-full w-full border-0"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
          Tip: this simulator loads <code className="font-mono">{embedUrl.replace(window.location.origin, '')}</code>.
          The <code className="font-mono">?embed=1</code> flag hides the shell chrome so you see the
          page content only. In a packaged desktop build the same frames load from disk.
        </p>
      </Card>

      <Card
        className="mt-4"
        title="Component stress test"
        description="Real components at this exact width — tables drop low-priority columns, grids reflow, text truncates instead of overflowing"
        action={<Badge tone="neutral">sample data</Badge>}
        flush
      >
        <DataTable rows={DEMO_ROWS} columns={columns} rowKey={(row) => row.id} dense />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Auto-fit grid" description="minmax(15rem, 1fr) — columns appear as space allows">
          <div className="grid-auto-fill gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-line bg-surface-2 p-3">
                <Square className="size-4 text-brand" />
                <p className="mt-2 text-sm font-medium text-fg">Tile {index + 1}</p>
                <p className="text-xs text-fg-subtle">Fluid width</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Long text handling" description="Truncation and wrapping, never horizontal overflow">
          <p className="truncate text-sm font-medium text-fg">
            Wireless barcode scanner with charging dock, USB receiver and configurable prefix/suffix
          </p>
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-fg-muted">
            Descriptions wrap inside their container and clamp after three lines so a card keeps its
            height no matter how long the content gets. Very long unbroken strings such as
            SUPERCALIFRAGILISTIC-ABCDEFGHIJKLMN-0123456789 also break correctly instead of pushing the
            layout wider than the window.
          </p>
          <p className="mt-2 break-all font-mono text-[0.6875rem] text-fg-subtle">
            SUPERCALIFRAGILISTIC-ABCDEFGHIJKLMN-0123456789-QRSTUVWXYZ
          </p>
        </Card>

        <Card title="Overflow safety" description="Tables scroll inside their card, not the page">
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-xs">
              <thead className="bg-surface-2 text-fg-subtle">
                <tr>
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((head) => (
                    <th key={head} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                      Column {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-line">
                    {Array.from({ length: 7 }).map((__, colIndex) => (
                      <td key={colIndex} className="px-3 py-2 whitespace-nowrap text-fg-muted">
                        {rowIndex + 1}·{colIndex + 1}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-subtle">
            <Table2 className="size-3.5" /> Swipe/scroll horizontally inside the card only.
          </p>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          icon={<Expand className="size-4" />}
          onClick={openInNewWindow}
        >
          Open real resizable window
        </Button>
        {desktop.isDesktop && (
          <Badge tone="ok" dot>
            Running as a desktop app — resize the OS window to test
          </Badge>
        )}
        {!desktop.isDesktop && (
          <Badge tone="neutral" dot>
            Browser preview — the packaged desktop app behaves identically
          </Badge>
        )}
      </div>
    </>
  );
}
