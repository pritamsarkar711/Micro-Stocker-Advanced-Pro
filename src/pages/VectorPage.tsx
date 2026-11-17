import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useToast } from '@/state/ToastState';
import { triggerBlobDownload } from '@/lib/desktop';
import { sanitizeSvg } from '@/lib/stock/vectorcheck';
import {
  createDocument,
  createShape,
  listLayers,
  parseSvgDocument,
  serializeSvg,
  svgToEps,
  svgToPngBlob,
  translateElement,
  type LayerInfo,
  type Primitive,
} from '@/lib/vector/editor';

type Tool = 'select' | Primitive | 'text';

const TOOLS: Array<{ id: Tool; icon: 'near_me' | 'crop_square' | 'circle' | 'star' | 'remove' | 'title'; label: string }> = [
  { id: 'select', icon: 'near_me', label: 'Select' },
  { id: 'rect', icon: 'crop_square', label: 'Rectangle' },
  { id: 'ellipse', icon: 'circle', label: 'Ellipse' },
  { id: 'star', icon: 'star', label: 'Star' },
  { id: 'line', icon: 'remove', label: 'Line' },
  { id: 'text', icon: 'title', label: 'Text' },
];

const PRESETS = [
  { id: 'square', label: '2000 × 2000', w: 2000, h: 2000 },
  { id: 'photo', label: '4000 × 3000', w: 4000, h: 3000 },
  { id: 'wide', label: '3840 × 2160', w: 3840, h: 2160 },
  { id: 'portrait', label: '3000 × 4000', w: 3000, h: 4000 },
];

const SWATCHES = ['#c2185b', '#e6477c', '#16181c', '#ffffff', '#f5f6f8', '#7b1a45', '#0f766e', '#b45309', '#2563eb', 'none'];

export function VectorPage() {
  const toast = useToast();
  const svgHost = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [revision, setRevision] = useState(0);
  const [tool, setTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fill, setFill] = useState('#c2185b');
  const [stroke, setStroke] = useState('#16181c');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [zoom, setZoom] = useState(0.16);
  const [docSize, setDocSize] = useState({ w: 2000, h: 2000 });
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [importedName, setImportedName] = useState<string | null>(null);

  const mount = useCallback((svg: SVGSVGElement) => {
    svgRef.current = svg;
    const host = svgHost.current;
    if (!host) return;
    host.replaceChildren(svg);
    const vb = (svg.getAttribute('viewBox') ?? '0 0 2000 2000').split(/[\s,]+/).map(Number);
    if (Number.isFinite(vb[2]) && Number.isFinite(vb[3])) setDocSize({ w: vb[2], h: vb[3] });
    setRevision((r) => r + 1);
  }, []);

  /* First document */
  useEffect(() => {
    if (!svgRef.current) mount(createDocument(2000, 2000, null));
  }, [mount]);

  const layers = useMemo<LayerInfo[]>(() => {
    void revision;
    return svgRef.current ? listLayers(svgRef.current) : [];
  }, [revision]);

  const selected = useMemo(() => {
    void revision;
    if (!svgRef.current || !selectedId) return null;
    return svgRef.current.querySelector<SVGElement>(`[id="${selectedId}"]`);
  }, [revision, selectedId]);

  const selectedTag = selected?.tagName.toLowerCase() ?? '';
  const selectedFill = selected?.getAttribute('fill') ?? selected?.style?.fill ?? '#000000';
  const selectedStroke = selected?.getAttribute('stroke') ?? 'none';
  const selectedStrokeWidth = Number(selected?.getAttribute('stroke-width') ?? '0') || 0;

  const snapshot = useCallback(() => {
    if (!svgRef.current) return;
    setHistory((prev) => [...prev.slice(-39), serializeSvg(svgRef.current!)]);
    setFuture([]);
  }, []);

  const restore = useCallback(
    (text: string) => {
      mount(parseSvgDocument(text));
      setSelectedId(null);
    },
    [mount],
  );

  const undo = () => {
    setHistory((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      if (svgRef.current) setFuture((f) => [serializeSvg(svgRef.current!), ...f].slice(0, 40));
      restore(last);
      return prev.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((prev) => {
      if (!prev.length) return prev;
      const next = prev[0];
      if (svgRef.current) setHistory((h) => [...h.slice(-39), serializeSvg(svgRef.current!)]);
      restore(next);
      return prev.slice(1);
    });
  };

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      const svg = parseSvgDocument(text);
      if (!svg.getAttribute('viewBox')) {
        const w = Number(svg.getAttribute('width')) || 2000;
        const h = Number(svg.getAttribute('height')) || 2000;
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      }
      snapshot();
      mount(svg);
      setImportedName(file.name);
      setSelectedId(null);
      const box = (svg.getAttribute('viewBox') ?? '0 0 2000 2000').split(/[\s,]+/).map(Number);
      setZoom(Math.min(1, 720 / Math.max(box[2] || 2000, box[3] || 2000)));
      toast.success(`Opened ${file.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open this SVG.');
    }
  };

  const setProperty = (property: 'fill' | 'stroke' | 'opacity' | 'stroke-width', value: string | number) => {
    const el = selected;
    if (!el) return;
    snapshot();
    if (property === 'fill') setFill(String(value));
    if (property === 'stroke') setStroke(String(value));
    el.setAttribute(property, String(value));
    setRevision((r) => r + 1);
  };

  const addShapeAt = (clientX: number, clientY: number) => {
    if (!svgRef.current || tool === 'select') return;
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const scale = docSize.w / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    const size = Math.max(120, Math.round(docSize.w * 0.16));
    snapshot();

    if (tool === 'text') {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('id', `text-${Date.now().toString(36)}`);
      text.setAttribute('x', String(Math.round(x)));
      text.setAttribute('y', String(Math.round(y)));
      text.setAttribute('font-size', String(Math.round(docSize.w * 0.06)));
      text.setAttribute('font-family', 'Telenor, Arial');
      text.setAttribute('fill', fill === 'none' ? '#16181c' : fill);
      text.textContent = 'Your text';
      svg.appendChild(text);
      setSelectedId(text.getAttribute('id'));
      setTool('select');
      setRevision((r) => r + 1);
      return;
    }

    const el = createShape(
      tool,
      { x: Math.round(x - size / 2), y: Math.round(y - size / 2), w: size, h: size },
      fill,
      stroke,
      strokeWidth,
    );
    svg.appendChild(el);
    setSelectedId(el.getAttribute('id'));
    setTool('select');
    setRevision((r) => r + 1);
  };

  const duplicate = () => {
    if (!selected || !svgRef.current) return;
    snapshot();
    const clone = selected.cloneNode(true) as SVGElement;
    clone.setAttribute('id', `${selectedTag}-${Date.now().toString(36)}`);
    translateElement(clone, Math.round(docSize.w * 0.03), Math.round(docSize.w * 0.03));
    selected.parentNode?.appendChild(clone);
    setSelectedId(clone.getAttribute('id'));
    setRevision((r) => r + 1);
  };

  const remove = () => {
    if (!selected) return;
    snapshot();
    selected.remove();
    setSelectedId(null);
    setRevision((r) => r + 1);
  };

  const reorder = (direction: 'front' | 'back') => {
    if (!selected) return;
    snapshot();
    const parent = selected.parentNode;
    if (!parent) return;
    if (direction === 'front') parent.appendChild(selected);
    else parent.insertBefore(selected, parent.firstChild);
    setRevision((r) => r + 1);
  };

  const newDocument = (w: number, h: number) => {
    snapshot();
    mount(createDocument(w, h, null));
    setImportedName(null);
    setSelectedId(null);
    setZoom(Math.min(1, 720 / Math.max(w, h)));
  };

  const exportSvg = () => {
    if (!svgRef.current) return;
    const text = serializeSvg(svgRef.current);
    const clean = sanitizeSvg(text).text;
    triggerBlobDownload(new Blob([clean], { type: 'image/svg+xml' }), 'artwork.svg');
    toast.success('SVG exported');
  };

  const exportPng = async () => {
    if (!svgRef.current) return;
    try {
      const blob = await svgToPngBlob(serializeSvg(svgRef.current), docSize.w, docSize.h, 2);
      triggerBlobDownload(blob, 'artwork-preview.png');
      toast.success('PNG preview exported');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview export failed.');
    }
  };

  const exportEps = () => {
    if (!svgRef.current) return;
    const { eps, skipped } = svgToEps(svgRef.current, importedName ?? 'Micro Stocker Advanced Pro');
    triggerBlobDownload(new Blob([eps], { type: 'application/postscript' }), 'artwork.eps');
    if (skipped.length) toast.info(`EPS exported · skipped: ${Array.from(new Set(skipped)).join(', ')}`);
    else toast.success('Vector EPS exported');
  };

  /* Pointer interaction: click to select, drag to move, click to place shapes. */
  const drag = useRef<{ id: string; startX: number; startY: number; base: string } | null>(null);

  const onPointerDown = (event: React.PointerEvent) => {
    if (!svgRef.current) return;
    if (tool !== 'select') return; // handled on click
    const target = (event.target as Element).closest<SVGElement>('[id]');
    if (!target || target === svgRef.current) {
      setSelectedId(null);
      return;
    }
    setSelectedId(target.getAttribute('id'));
    drag.current = {
      id: target.getAttribute('id')!,
      startX: event.clientX,
      startY: event.clientY,
      base: target.getAttribute('transform') ?? '',
    };
    snapshot();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scale = docSize.w / rect.width;
    const dx = (event.clientX - drag.current.startX) * scale;
    const dy = (event.clientY - drag.current.startY) * scale;
    const el = svgRef.current.querySelector<SVGElement>(`[id="${drag.current.id}"]`);
    if (!el) return;
    el.setAttribute(
      'transform',
      `translate(${dx.toFixed(1)} ${dy.toFixed(1)}) ${drag.current.base}`.trim(),
    );
  };

  const onPointerUp = () => {
    if (drag.current) setRevision((r) => r + 1);
    drag.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if ((event.target as HTMLElement).tagName === 'INPUT') return;
    if (!selected) return;
    const step = event.shiftKey ? 40 : 4;
    if (event.key === 'ArrowLeft') translateElement(selected, -step, 0);
    else if (event.key === 'ArrowRight') translateElement(selected, step, 0);
    else if (event.key === 'ArrowUp') translateElement(selected, 0, -step);
    else if (event.key === 'ArrowDown') translateElement(selected, 0, step);
    else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      remove();
      return;
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicate();
      return;
    } else return;
    event.preventDefault();
    setRevision((r) => r + 1);
  };

  return (
    <div className="flex h-[calc(100vh-var(--topbar-h)-2.5rem)] min-h-[32rem] flex-col gap-3">
      <PageHeader
        title="Vector Studio"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" icon={<GIcon name="folder_open" size={16} />} onClick={() => fileRef.current?.click()}>
              Open
            </Button>
            <Button size="sm" variant="secondary" icon={<GIcon name="image" size={16} />} onClick={() => void exportPng()}>
              PNG
            </Button>
            <Button size="sm" variant="secondary" icon={<GIcon name="polyline" size={16} />} onClick={exportEps}>
              EPS
            </Button>
            <Button size="sm" icon={<GIcon name="download" size={16} />} onClick={exportSvg}>
              SVG
            </Button>
          </div>
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importFile(file);
          e.target.value = '';
        }}
      />

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[3.25rem_minmax(0,1fr)_16.5rem]">
        {/* Tools */}
        <div className="flex gap-1.5 overflow-x-auto rounded-[var(--r-card)] border border-line bg-surface p-1.5 lg:flex-col lg:overflow-visible">
          {TOOLS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTool(entry.id)}
              title={entry.label}
              aria-label={entry.label}
              aria-pressed={tool === entry.id}
              className={clsx(
                'inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--r-control)] transition-colors',
                tool === entry.id
                  ? 'bg-brand text-on-brand'
                  : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
              )}
            >
              <GIcon name={entry.icon} size={19} />
            </button>
          ))}
          <div className="mx-1 hidden h-px bg-line lg:block" />
          <button
            type="button"
            onClick={undo}
            disabled={!history.length}
            title="Undo"
            aria-label="Undo"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--r-control)] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-35"
          >
            <GIcon name="undo" size={19} />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!future.length}
            title="Redo"
            aria-label="Redo"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--r-control)] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-35"
          >
            <GIcon name="redo" size={19} />
          </button>
        </div>

        {/* Canvas */}
        <div className="relative flex min-h-[24rem] flex-col overflow-hidden rounded-[var(--r-card)] border border-line bg-surface-2">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-2.5 py-1.5">
            <div className="flex items-center gap-2 text-[0.75rem] text-ink-muted">
              <span className="tabular-nums">
                {docSize.w} × {docSize.h}
              </span>
              {importedName && <span className="truncate">· {importedName}</span>}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setZoom((z) => Math.max(0.04, z / 1.25))} className="size-7 rounded-[var(--r-xs)] text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Zoom out">
                <GIcon name="remove" size={16} />
              </button>
              <span className="w-10 text-center text-[0.75rem] tabular-nums text-ink-muted">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(4, z * 1.25))} className="size-7 rounded-[var(--r-xs)] text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Zoom in">
                <GIcon name="add" size={16} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(Math.min(1, 620 / Math.max(docSize.w, docSize.h)))}
                className="size-7 rounded-[var(--r-xs)] text-ink-muted hover:bg-surface-2 hover:text-ink"
                aria-label="Fit"
              >
                <GIcon name="fit_screen" size={16} />
              </button>
            </div>
          </div>

          <div
            className="checkerboard relative flex flex-1 items-center justify-center overflow-auto p-6"
            onClick={(e) => {
              if (tool !== 'select') addShapeAt(e.clientX, e.clientY);
            }}
          >
            <div
              className="shadow-[0_10px_40px_-12px_rgb(0_0_0/0.45)] [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
              style={{
                width: docSize.w * zoom,
                height: docSize.h * zoom,
                outline: '1px solid var(--line-strong)',
                cursor: tool === 'select' ? 'default' : 'crosshair',
              }}
              tabIndex={0}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <div ref={svgHost} className="checkerboard h-full w-full" onDoubleClick={() => setTool('select')} />
            </div>
          </div>
        </div>

        {/* Inspector */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="rounded-[var(--r-card)] border border-line bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[0.6875rem] font-semibold tracking-wide text-ink-faint uppercase">Style</span>
              <span className="text-[0.6875rem] text-ink-faint">{selected ? selectedTag : 'nothing selected'}</span>
            </div>
            <div className="space-y-2.5">
              <div>
                <div className="mb-1 text-[0.75rem] text-ink-muted">Fill</div>
                <div className="flex flex-wrap gap-1">
                  {SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setProperty('fill', color)}
                      title={color}
                      aria-label={`Fill ${color}`}
                      className={clsx(
                        'size-6 rounded-[var(--r-xs)] border',
                        color === 'none' ? 'checkerboard border-line-strong' : 'border-black/10',
                        (selected ? selectedFill : fill) === color && 'ring-2 ring-brand ring-offset-1 ring-offset-surface',
                      )}
                      style={color === 'none' ? undefined : { backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[0.75rem] text-ink-muted">Stroke</div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={selectedStroke.startsWith('#') ? selectedStroke : stroke}
                    onChange={(e) => setProperty('stroke', e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded-[var(--r-xs)] border border-line bg-surface"
                    aria-label="Stroke colour"
                  />
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={selected ? selectedStrokeWidth : strokeWidth}
                    onChange={(e) => {
                      setStrokeWidth(Number(e.target.value));
                      setProperty('stroke-width', Number(e.target.value));
                    }}
                    className="flex-1 accent-[var(--brand)]"
                    aria-label="Stroke width"
                  />
                  <span className="w-6 text-right text-[0.75rem] tabular-nums text-ink-muted">
                    {selected ? selectedStrokeWidth : strokeWidth}
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-1 text-[0.75rem] text-ink-muted">Opacity</div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={Math.round(Number(selected?.getAttribute('opacity') ?? '1') * 100)}
                  onChange={(e) => setProperty('opacity', Number(e.target.value) / 100)}
                  className="w-full accent-[var(--brand)]"
                  aria-label="Opacity"
                  disabled={!selected}
                />
              </div>

              {selectedTag === 'text' && (
                <input
                  value={selected?.textContent ?? ''}
                  onChange={(e) => {
                    if (!selected) return;
                    selected.textContent = e.target.value;
                    setRevision((r) => r + 1);
                  }}
                  className="h-8 w-full rounded-[var(--r-control)] border border-line bg-surface px-2 text-[0.8125rem] text-ink"
                  aria-label="Text content"
                />
              )}

              <div className="flex gap-1">
                <button type="button" onClick={duplicate} disabled={!selected} className="flex-1 rounded-[var(--r-control)] border border-line py-1.5 text-[0.75rem] text-ink-muted hover:text-ink disabled:opacity-40">
                  Duplicate
                </button>
                <button type="button" onClick={() => reorder('front')} disabled={!selected} className="rounded-[var(--r-control)] border border-line px-2 text-[0.75rem] text-ink-muted hover:text-ink disabled:opacity-40" title="Bring to front" aria-label="Bring to front">
                  <GIcon name="flip_to_front" size={15} />
                </button>
                <button type="button" onClick={() => reorder('back')} disabled={!selected} className="rounded-[var(--r-control)] border border-line px-2 text-[0.75rem] text-ink-muted hover:text-ink disabled:opacity-40" title="Send to back" aria-label="Send to back">
                  <GIcon name="flip_to_back" size={15} />
                </button>
                <button type="button" onClick={remove} disabled={!selected} className="rounded-[var(--r-control)] border border-line px-2 text-danger hover:bg-danger-soft disabled:opacity-40" title="Delete" aria-label="Delete">
                  <GIcon name="delete" size={15} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--r-card)] border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-[0.6875rem] font-semibold tracking-wide text-ink-faint uppercase">Objects</span>
              <span className="text-[0.6875rem] tabular-nums text-ink-faint">{layers.length}</span>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto py-1">
              {layers.length === 0 && (
                <li className="px-3 py-2 text-[0.75rem] text-ink-faint">Use the tools on the left to draw something.</li>
              )}
              {layers.map((layer) => (
                <li key={layer.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(layer.id)}
                    className={clsx(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.75rem] transition-colors',
                      selectedId === layer.id ? 'bg-brand-soft text-brand-fg' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                    )}
                    style={{ paddingLeft: `${12 + layer.depth * 10}px` }}
                  >
                    <GIcon
                      name={
                        layer.tag === 'g'
                          ? 'folder'
                          : layer.tag === 'text'
                            ? 'title'
                            : layer.tag === 'path'
                              ? 'polyline'
                              : 'crop_square'
                      }
                      size={14}
                    />
                    <span className="truncate">{layer.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[var(--r-card)] border border-line bg-surface p-2.5">
            <div className="mb-1.5 text-[0.6875rem] font-semibold tracking-wide text-ink-faint uppercase">New canvas</div>
            <div className="grid grid-cols-2 gap-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => newDocument(preset.w, preset.h)}
                  className="rounded-[var(--r-control)] border border-line px-1.5 py-1 text-[0.6875rem] text-ink-muted hover:border-brand hover:text-ink"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
