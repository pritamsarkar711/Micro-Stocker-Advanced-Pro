import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { StudioIcon, type StudioIconName } from '@/components/vector/StudioIcon';
import { ElementsPanel } from '@/components/vector/ElementsPanel';
import { LayersPanel } from '@/components/vector/LayersPanel';
import { NumberField } from '@/components/vector/NumberField';
import { useToast } from '@/state/ToastState';
import { triggerBlobDownload } from '@/lib/desktop';
import { sanitizeSvg } from '@/lib/stock/vectorcheck';
import { ALIGN_BUTTONS, DOC_PRESETS, TOOLS, num, round, shapePath, type Tool } from '@/lib/vector/tools';
import { TEMPLATES, VECTOR_PALETTE, type VectorElement } from '@/lib/vector/library';
import {
  boxInDocument,
  cloneElement,
  createDocument,
  createShape,
  distributeElements,
  documentSize,
  fillOf,
  groupElements,
  importDocumentInto,
  insertArtwork,
  listLayers,
  moveElement,
  nextShapeId,
  opacityOf,
  paintElement,
  parseSvgDocument,
  rotationOf,
  scaleElement,
  serializeSvg,
  setOpacity,
  strokeOf,
  svgToEps,
  svgToPngBlob,
  translateElement,
  ungroupElement,
  unionBox,
  type AlignMode,
  type Box,
} from '@/lib/vector/editor';

/* -------------------------------------------------------------------------- */
/*  Studio                                                                    */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = 'msap.vector.document.v2';
const SVG_NS = 'http://www.w3.org/2000/svg';

interface GestureBase {
  el: SVGElement;
  transform: string;
  box: Box;
}

type Gesture =
  | { kind: 'move'; startX: number; startY: number; bases: GestureBase[]; before: string; moved: boolean }
  | { kind: 'resize'; handle: string; startX: number; startY: number; base: GestureBase; before: string; moved: boolean }
  | { kind: 'rotate'; startX: number; startY: number; base: GestureBase; center: { x: number; y: number }; before: string; moved: boolean }
  | { kind: 'draw'; el: SVGElement; start: { x: number; y: number }; before: string }
  | { kind: 'pan'; startX: number; startY: number; left: number; top: number }
  | { kind: 'marquee'; startX: number; startY: number; before: string; additive: boolean }
  | null;

/* -------------------------------------------------------------------------- */
/*  Local helpers                                                             */
/* -------------------------------------------------------------------------- */

export function VectorPage() {
  const toast = useToast();
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const svgHost = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const [revision, setRevision] = useState(0);
  const [tool, setTool] = useState<Tool>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedIdsRef = useRef<string[]>([]);
  selectedIdsRef.current = selectedIds;
  const [hasSelection, setHasSelection] = useState(false);

  const [zoom, setZoom] = useState(0.2);
  const [doc, setDoc] = useState({ w: 2000, h: 2000 });
  const [docName, setDocName] = useState('Untitled artwork');

  const historyRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [futureCount, setFutureCount] = useState(0);

  const [tab, setTab] = useState<'design' | 'elements' | 'layers'>('design');
  const [category, setCategory] = useState('all');
  const [menu, setMenu] = useState<'new' | 'export' | null>(null);
  const [present, setPresent] = useState(false);

  const [previewUrl, setPreviewUrl] = useState('');
  const [previewBytes, setPreviewBytes] = useState(0);

  const gesture = useRef<Gesture>(null);
  const inserts = useRef(0);
  const spaceDown = useRef(false);
  const snapGuides = useRef<{ v: number[]; h: number[] }>({ v: [], h: [] });

  /* ---------------------------------------------------------------- mount */

  const mount = useCallback((svg: SVGSVGElement) => {
    svgRef.current = svg;
    svg.setAttribute('xmlns', SVG_NS);
    const host = svgHost.current;
    if (host) host.replaceChildren(svg);
    const size = documentSize(svg);
    setDoc(size);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let restored: SVGSVGElement | null = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) restored = parseSvgDocument(saved);
    } catch {
      restored = null;
    }
    mount(restored ?? createDocument(2000, 2000, null));
  }, [mount]);

  /* --------------------------------------------------------------- derived */

  const layers = useMemo(() => {
    void revision;
    return svgRef.current ? listLayers(svgRef.current) : [];
  }, [revision]);

  const selectedEls = useMemo(() => {
    void revision;
    const root = svgRef.current;
    if (!root || !selectedIds.length) return [] as SVGElement[];
    return selectedIds
      .map((id) => root.querySelector<SVGElement>(`[id="${id}"]`))
      .filter((el): el is SVGElement => Boolean(el));
  }, [revision, selectedIds]);

  const single = selectedEls.length === 1 ? selectedEls[0]! : null;
  const singleTag = single?.tagName.toLowerCase() ?? '';
  const selectionBox = useMemo(() => {
    void revision;
    const root = svgRef.current;
    if (!root || !selectedEls.length) return null;
    return unionBox(selectedEls.map((el) => boxInDocument(el, root)));
  }, [revision, selectedEls]);

  const fillValue = single ? (fillOf(single) === 'none' ? 'none' : fillOf(single)) : '#c2185b';
  const strokeValue = single ? strokeOf(single) : { color: 'none', width: 0 };
  const opacityValue = single ? opacityOf(single) : 1;
  const rotationValue = single ? rotationOf(single) : 0;

  /* -------------------------------------------------------------- history */

  const snapshotText = useCallback(() => (svgRef.current ? serializeSvg(svgRef.current) : ''), []);

  const syncCounts = useCallback(() => {
    setHistoryCount(historyRef.current.length);
    setFutureCount(futureRef.current.length);
  }, []);

  const commit = useCallback(
    (before: string) => {
      if (!before) return;
      historyRef.current = [...historyRef.current.slice(-79), before];
      futureRef.current = [];
      syncCounts();
    },
    [syncCounts],
  );

  const bump = useCallback(() => setRevision((value) => value + 1), []);

  /** Slider drags mutate live and commit one history step on release. */
  const sliderBefore = useRef<string | null>(null);
  const beginSlider = useCallback(() => {
    if (!sliderBefore.current) sliderBefore.current = snapshotText();
  }, [snapshotText]);
  const endSlider = useCallback(() => {
    if (sliderBefore.current) {
      commit(sliderBefore.current);
      sliderBefore.current = null;
    }
  }, [commit]);

  const mutate = useCallback(
    (fn: () => void) => {
      const before = snapshotText();
      fn();
      commit(before);
      bump();
    },
    [bump, commit, snapshotText],
  );

  const restore = useCallback(
    (text: string) => {
      try {
        mount(parseSvgDocument(text));
        setSelectedIds((ids) => ids.filter((id) => Boolean(svgRef.current?.querySelector(`[id="${id}"]`))));
      } catch {
        toast.error('That step could not be restored.');
      }
    },
    [mount, toast],
  );

  const undo = useCallback(() => {
    const stack = historyRef.current;
    if (!stack.length) return;
    const previous = stack[stack.length - 1]!;
    historyRef.current = stack.slice(0, -1);
    const current = snapshotText();
    if (current) futureRef.current = [current, ...futureRef.current].slice(0, 80);
    restore(previous);
    syncCounts();
  }, [restore, snapshotText, syncCounts]);

  const redo = useCallback(() => {
    const stack = futureRef.current;
    if (!stack.length) return;
    const next = stack[0]!;
    futureRef.current = stack.slice(1);
    const current = snapshotText();
    if (current) historyRef.current = [...historyRef.current.slice(-79), current];
    restore(next);
    syncCounts();
  }, [restore, snapshotText, syncCounts]);

  /* ------------------------------------------------------------- autosave */

  useEffect(() => {
    if (!svgRef.current) return undefined;
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, serializeSvg(svgRef.current!));
      } catch {
        /* storage is full; autosave is best effort */
      }
    }, 900);
    return () => window.clearTimeout(handle);
  }, [revision]);

  /* ---------------------------------------------------------- live preview */

  useEffect(() => {
    if (!svgRef.current) return undefined;
    const handle = window.setTimeout(() => {
      const text = serializeSvg(svgRef.current!);
      setPreviewUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`);
      setPreviewBytes(new Blob([text]).size);
    }, 220);
    return () => window.clearTimeout(handle);
  }, [revision, doc.w, doc.h]);

  /* -------------------------------------------------------------- overlay */

  const syncOverlay = useCallback(() => {
    const frame = frameRef.current;
    const overlay = overlayRef.current;
    const svg = svgRef.current;
    if (!frame || !overlay || !svg) return;
    const ids = selectedIdsRef.current;
    const rects = ids
      .map((id) => svg.querySelector<SVGGraphicsElement>(`[id="${id}"]`)?.getBoundingClientRect() ?? null)
      .filter((rect): rect is DOMRect => Boolean(rect) && (rect!.width > 0 || rect!.height > 0));
    if (!rects.length) {
      overlay.style.display = 'none';
      setHasSelection(false);
      return;
    }
    const host = frame.getBoundingClientRect();
    const left = Math.min(...rects.map((rect) => rect.left)) - host.left;
    const top = Math.min(...rects.map((rect) => rect.top)) - host.top;
    const right = Math.max(...rects.map((rect) => rect.right)) - host.left;
    const bottom = Math.max(...rects.map((rect) => rect.bottom)) - host.top;
    overlay.style.display = 'block';
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
    overlay.style.width = `${Math.max(1, right - left)}px`;
    overlay.style.height = `${Math.max(1, bottom - top)}px`;
    setHasSelection(true);
  }, []);

  useLayoutEffect(() => {
    syncOverlay();
  }, [syncOverlay, revision, zoom, selectedIds, doc.w, doc.h]);

  useEffect(() => {
    const onResize = () => syncOverlay();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [syncOverlay]);

  const drawGuides = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.querySelectorAll('[data-guide]').forEach((node) => node.remove());
    const { v, h } = snapGuides.current;
    v.forEach((x) => {
      const line = document.createElement('div');
      line.dataset.guide = 'v';
      line.style.cssText = `position:absolute;top:0;left:${(x / doc.w) * 100}%;height:100%;width:1px;background:var(--brand);opacity:.85;pointer-events:none;z-index:30`;
      frame.appendChild(line);
    });
    h.forEach((y) => {
      const line = document.createElement('div');
      line.dataset.guide = 'h';
      line.style.cssText = `position:absolute;left:0;top:${(y / doc.h) * 100}%;width:100%;height:1px;background:var(--brand);opacity:.85;pointer-events:none;z-index:30`;
      frame.appendChild(line);
    });
  }, [doc.h, doc.w]);

  const clearGuides = useCallback(() => {
    snapGuides.current = { v: [], h: [] };
    frameRef.current?.querySelectorAll('[data-guide]').forEach((node) => node.remove());
  }, []);

  /* ------------------------------------------------------------ selection */

  const select = useCallback((ids: string[], additive = false) => {
    setSelectedIds((prev) => {
      if (!additive) return ids;
      const next = new Set(prev);
      ids.forEach((id) => (next.has(id) ? next.delete(id) : next.add(id)));
      return Array.from(next);
    });
  }, []);

  /* ---------------------------------------------------------------- tools */

  const toDocPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / Math.max(1, rect.width)) * doc.w,
        y: ((clientY - rect.top) / Math.max(1, rect.height)) * doc.h,
      };
    },
    [doc.h, doc.w],
  );

  const pick = useCallback((target: Element | null): SVGElement | null => {
    const svg = svgRef.current;
    if (!svg || !target) return null;
    let node: Element | null = target;
    while (node && node !== svg) {
      if (node instanceof SVGElement && node.getAttribute('id') && node.getAttribute('data-locked') !== '1') {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }, []);

  const makeShape = useCallback(
    (activeTool: Tool, point: { x: number; y: number }): SVGElement => {
      const svg = svgRef.current!;
      const fill = '#c2185b';
      const stroke = '#16181c';
      const base = Math.max(80, Math.min(doc.w, doc.h) * 0.18);
      let el: SVGElement;
      if (activeTool === 'text') {
        el = document.createElementNS(SVG_NS, 'text');
        el.setAttribute('id', `text-${Date.now().toString(36)}`);
        el.setAttribute('x', String(round(point.x)));
        el.setAttribute('y', String(round(point.y)));
        el.setAttribute('font-family', 'IBM Plex Sans, Arial');
        el.setAttribute('font-size', String(round(Math.min(doc.w, doc.h) * 0.08)));
        el.setAttribute('font-weight', '700');
        el.setAttribute('fill', '#16181c');
        el.textContent = 'Your text';
        svg.appendChild(el);
        return el;
      }
      if (activeTool === 'rect' || activeTool === 'roundrect') {
        el = createShape('rect', { x: point.x, y: point.y, w: base, h: base }, fill, stroke, 0);
        if (activeTool === 'roundrect') el.setAttribute('rx', String(round(base * 0.16)));
        el.setAttribute('data-shape', 'rect');
      } else if (activeTool === 'ellipse' || activeTool === 'circle') {
        el = createShape('ellipse', { x: point.x, y: point.y, w: base, h: base }, fill, stroke, 0);
        el.setAttribute('data-shape', activeTool);
      } else if (activeTool === 'line' || activeTool === 'arrow') {
        el = createShape('line', { x: point.x, y: point.y, w: base, h: base }, 'none', stroke, Math.max(4, Math.min(doc.w, doc.h) * 0.006));
        el.setAttribute('data-shape', 'line');
      } else {
        el = document.createElementNS(SVG_NS, 'path');
        el.setAttribute('id', `${activeTool}-${Date.now().toString(36)}`);
        el.setAttribute('data-shape', activeTool);
        el.setAttribute('d', shapePath(activeTool, { x: point.x, y: point.y, w: base, h: base }));
        el.setAttribute('fill', fill);
      }
      svg.appendChild(el);
      return el;
    },
    [doc.h, doc.w],
  );

  const applyDrawGeometry = useCallback((el: SVGElement, start: { x: number; y: number }, point: { x: number; y: number }) => {
    const x = Math.min(start.x, point.x);
    const y = Math.min(start.y, point.y);
    const w = Math.max(2, Math.abs(point.x - start.x));
    const h = Math.max(2, Math.abs(point.y - start.y));
    const tag = el.tagName.toLowerCase();
    const shape = el.getAttribute('data-shape') ?? '';
    if (tag === 'rect') {
      el.setAttribute('x', String(round(x)));
      el.setAttribute('y', String(round(y)));
      el.setAttribute('width', String(round(w)));
      el.setAttribute('height', String(round(h)));
    } else if (tag === 'ellipse') {
      const size = shape === 'circle' ? Math.max(w, h) : 0;
      const finalW = size || w;
      const finalH = size || h;
      el.setAttribute('cx', String(round(x + finalW / 2)));
      el.setAttribute('cy', String(round(y + finalH / 2)));
      el.setAttribute('rx', String(round(finalW / 2)));
      el.setAttribute('ry', String(round(finalH / 2)));
    } else if (tag === 'line') {
      el.setAttribute('x1', String(round(start.x)));
      el.setAttribute('y1', String(round(start.y)));
      el.setAttribute('x2', String(round(point.x)));
      el.setAttribute('y2', String(round(point.y)));
    } else if (tag === 'path') {
      el.setAttribute('d', shapePath(shape as Tool, { x, y, w, h }));
    }
  }, []);

  const defaultBox = useCallback(
    (point: { x: number; y: number }) => {
      const size = Math.max(80, Math.min(doc.w, doc.h) * 0.18);
      return { x: point.x - size / 2, y: point.y - size / 2, w: size, h: size };
    },
    [doc.h, doc.w],
  );

  /* ---------------------------------------------------------- interaction */

  const beginMove = useCallback(
    (event: React.PointerEvent<HTMLElement>, ids: string[]) => {
      const root = svgRef.current!;
      const bases = ids
        .map((id) => {
          const el = root.querySelector<SVGElement>(`[id="${id}"]`);
          return el ? { el, transform: el.getAttribute('transform') ?? '', box: boxInDocument(el, root) } : null;
        })
        .filter((entry): entry is GestureBase => Boolean(entry));
      gesture.current = {
        kind: 'move',
        startX: event.clientX,
        startY: event.clientY,
        bases,
        before: snapshotText(),
        moved: false,
      };
      frameRef.current?.setPointerCapture(event.pointerId);
    },
    [snapshotText],
  );

  const onFramePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const frame = frameRef.current;
      if (!frame || !svgRef.current) return;
      setMenu(null);
      if (event.button === 1 || spaceDown.current) {
        const stage = stageRef.current;
        if (!stage) return;
        gesture.current = { kind: 'pan', startX: event.clientX, startY: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
        frame.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      if (event.button !== 0) return;

      const point = toDocPoint(event.clientX, event.clientY);

      if (tool !== 'select') {
        const before = snapshotText();
        const el = makeShape(tool, point);
        const id = el.getAttribute('id');
        if (id) select([id]);
        if (tool === 'text') {
          commit(before);
          setTool('select');
          bump();
          window.setTimeout(() => textInputRef.current?.focus(), 60);
          return;
        }
        gesture.current = { kind: 'draw', el, start: point, before };
        frame.setPointerCapture(event.pointerId);
        bump();
        return;
      }

      const picked = pick(event.target as Element);
      if (picked) {
        const id = picked.getAttribute('id')!;
        const current = selectedIdsRef.current;
        if (event.shiftKey) {
          select([id], true);
          if (current.includes(id)) return;
          beginMove(event, [...current, id]);
          return;
        }
        if (!current.includes(id)) select([id]);
        beginMove(event, current.includes(id) ? current : [id]);
        syncOverlay();
        return;
      }

      if (!event.shiftKey) select([]);
      gesture.current = { kind: 'marquee', startX: event.clientX, startY: event.clientY, before: '', additive: event.shiftKey };
      frame.setPointerCapture(event.pointerId);
    },
    [beginMove, bump, commit, makeShape, pick, select, snapshotText, syncOverlay, toDocPoint, tool],
  );

  const onFramePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const active = gesture.current;
      if (!active) return;

      if (active.kind === 'pan') {
        const stage = stageRef.current;
        if (!stage) return;
        stage.scrollLeft = active.left - (event.clientX - active.startX);
        stage.scrollTop = active.top - (event.clientY - active.startY);
        return;
      }

      if (active.kind === 'marquee') {
        const frame = frameRef.current;
        const box = marqueeRef.current;
        if (!frame || !box) return;
        const host = frame.getBoundingClientRect();
        const x = Math.min(active.startX, event.clientX) - host.left;
        const y = Math.min(active.startY, event.clientY) - host.top;
        box.style.display = 'block';
        box.style.left = `${x}px`;
        box.style.top = `${y}px`;
        box.style.width = `${Math.abs(event.clientX - active.startX)}px`;
        box.style.height = `${Math.abs(event.clientY - active.startY)}px`;
        return;
      }

      if (active.kind === 'draw') {
        applyDrawGeometry(active.el, active.start, toDocPoint(event.clientX, event.clientY));
        syncOverlay();
        return;
      }

      if (active.kind === 'move') {
        const dxRaw = (event.clientX - active.startX) / zoom;
        const dyRaw = (event.clientY - active.startY) / zoom;
        if (!active.moved && Math.abs(dxRaw) + Math.abs(dyRaw) < 1.5) return;
        active.moved = true;
        const union = unionBox(active.bases.map((base) => base.box));
        let dx = dxRaw;
        let dy = dyRaw;
        snapGuides.current = { v: [], h: [] };
        if (union) {
          const threshold = 7 / zoom;
          let bestX: { delta: number; guide: number } | null = null;
          const xs = [union.x + dx, union.x + union.w / 2 + dx, union.x + union.w + dx];
          [0, doc.w / 2, doc.w].forEach((target) => {
            xs.forEach((edge) => {
              const delta = target - edge;
              if (Math.abs(delta) < threshold && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) bestX = { delta, guide: target };
            });
          });
          if (bestX) {
            dx += (bestX as { delta: number }).delta;
            snapGuides.current.v.push((bestX as { guide: number }).guide);
          }
          let bestY: { delta: number; guide: number } | null = null;
          const ys = [union.y + dy, union.y + union.h / 2 + dy, union.y + union.h + dy];
          [0, doc.h / 2, doc.h].forEach((target) => {
            ys.forEach((edge) => {
              const delta = target - edge;
              if (Math.abs(delta) < threshold && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) bestY = { delta, guide: target };
            });
          });
          if (bestY) {
            dy += (bestY as { delta: number }).delta;
            snapGuides.current.h.push((bestY as { guide: number }).guide);
          }
        }
        active.bases.forEach((base) => {
          base.el.setAttribute('transform', `translate(${round(dx)} ${round(dy)}) ${base.transform}`.trim());
        });
        drawGuides();
        syncOverlay();
        return;
      }

      if (active.kind === 'resize') {
        const dx = (event.clientX - active.startX) / zoom;
        const dy = (event.clientY - active.startY) / zoom;
        const box = active.base.box;
        const handle = active.handle;
        let nx = box.x;
        let ny = box.y;
        let nw = box.w;
        let nh = box.h;
        if (handle.includes('w')) {
          nx = box.x + dx;
          nw = box.w - dx;
        }
        if (handle.includes('e')) nw = box.w + dx;
        if (handle.includes('n')) {
          ny = box.y + dy;
          nh = box.h - dy;
        }
        if (handle.includes('s')) nh = box.h + dy;
        if (event.shiftKey && handle.length === 2 && nw > 1 && nh > 1) {
          const ratio = box.h / Math.max(1e-6, box.w);
          if (Math.abs(nw - box.w) > Math.abs(nh - box.h)) nh = nw * ratio;
          else nw = nh / Math.max(1e-6, ratio);
          if (handle.includes('n')) ny = box.y + box.h - nh;
          if (handle.includes('w')) nx = box.x + box.w - nw;
        }
        nw = Math.max(2, nw);
        nh = Math.max(2, nh);
        const anchorX = handle.includes('w') ? box.x + box.w : box.x;
        const anchorY = handle.includes('n') ? box.y + box.h : box.y;
        const sx = nw / Math.max(1e-6, box.w);
        const sy = nh / Math.max(1e-6, box.h);
        active.moved = true;
        active.base.el.setAttribute(
          'transform',
          `translate(${round(anchorX)} ${round(anchorY)}) scale(${round(sx, 4)} ${round(sy, 4)}) translate(${round(-anchorX)} ${round(-anchorY)}) ${active.base.transform}`.trim(),
        );
        void nx;
        void ny;
        syncOverlay();
        return;
      }

      if (active.kind === 'rotate') {
        const point = toDocPoint(event.clientX, event.clientY);
        const startAngle = Math.atan2(active.startY - active.center.y, active.startX - active.center.x);
        const angle = Math.atan2(point.y - active.center.y, point.x - active.center.x);
        let delta = ((angle - startAngle) * 180) / Math.PI;
        if (event.shiftKey) delta = Math.round(delta / 15) * 15;
        active.moved = true;
        active.base.el.setAttribute(
          'transform',
          `rotate(${round(delta)} ${round(active.center.x)} ${round(active.center.y)}) ${active.base.transform}`.trim(),
        );
        syncOverlay();
      }
    },
    [applyDrawGeometry, doc.h, doc.w, drawGuides, syncOverlay, toDocPoint, zoom],
  );

  const onFramePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const active = gesture.current;
      gesture.current = null;
      clearGuides();
      const marquee = marqueeRef.current;
      if (marquee) marquee.style.display = 'none';
      frameRef.current?.releasePointerCapture?.(event.pointerId);
      if (!active) return;

      if (active.kind === 'move' || active.kind === 'resize' || active.kind === 'rotate') {
        if (active.moved) commit(active.before);
      } else if (active.kind === 'draw') {
        const start = toDocPoint(active.start.x, active.start.y);
        const box = (active.el as SVGGraphicsElement).getBBox();
        if (box.width < 3 && box.height < 3) {
          const fallback = defaultBox(start);
          if (active.el.tagName.toLowerCase() === 'path') {
            active.el.setAttribute('d', shapePath(active.el.getAttribute('data-shape') as Tool, fallback));
          } else {
            applyDrawGeometry(active.el, { x: fallback.x + fallback.w / 2, y: fallback.y + fallback.h / 2 }, { x: fallback.x, y: fallback.y });
          }
        }
        commit(active.before);
      } else if (active.kind === 'marquee') {
        const host = frameRef.current?.getBoundingClientRect();
        if (host && svgRef.current) {
          const x1 = Math.min(active.startX, event.clientX);
          const y1 = Math.min(active.startY, event.clientY);
          const x2 = Math.max(active.startX, event.clientX);
          const y2 = Math.max(active.startY, event.clientY);
          if (x2 - x1 > 4 && y2 - y1 > 4) {
            const root = svgRef.current;
            const hits = listLayers(root)
              .filter((layer) => layer.depth === 0 && !layer.hidden)
              .filter((layer) => {
                const el = root.querySelector<SVGElement>(`[id="${layer.id}"]`);
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                return rect.right > x1 && rect.left < x2 && rect.bottom > y1 && rect.top < y2;
              })
              .map((layer) => layer.id);
            if (hits.length) select(hits, active.additive);
          }
        }
      }
      syncOverlay();
      bump();
    },
    [applyDrawGeometry, bump, clearGuides, commit, defaultBox, select, syncOverlay, toDocPoint],
  );

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLElement>, handle: string) => {
      event.stopPropagation();
      event.preventDefault();
      const root = svgRef.current;
      if (!root || !single) return;
      gesture.current = {
        kind: 'resize',
        handle,
        startX: event.clientX,
        startY: event.clientY,
        base: { el: single, transform: single.getAttribute('transform') ?? '', box: boxInDocument(single, root) },
        before: snapshotText(),
        moved: false,
      };
      frameRef.current?.setPointerCapture(event.pointerId);
    },
    [single, snapshotText],
  );

  const startRotate = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      event.stopPropagation();
      event.preventDefault();
      const root = svgRef.current;
      if (!root || !single) return;
      const box = boxInDocument(single, root);
      const point = toDocPoint(event.clientX, event.clientY);
      gesture.current = {
        kind: 'rotate',
        startX: point.x,
        startY: point.y,
        base: { el: single, transform: single.getAttribute('transform') ?? '', box },
        center: { x: box.x + box.w / 2, y: box.y + box.h / 2 },
        before: snapshotText(),
        moved: false,
      };
      frameRef.current?.setPointerCapture(event.pointerId);
    },
    [single, snapshotText, toDocPoint],
  );

  /* ------------------------------------------------------------- documents */

  const fitView = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const size = documentSize(svgRef.current ?? createDocument(doc.w, doc.h, null));
    const availableW = stage.clientWidth - 96;
    const availableH = stage.clientHeight - 96;
    const next = Math.min(availableW / size.w, availableH / size.h);
    setZoom(Math.max(0.02, Math.min(3, next)));
  }, [doc.h, doc.w]);

  useEffect(() => {
    const handle = window.setTimeout(() => fitView(), 60);
    return () => window.clearTimeout(handle);
    // Only fit the first time the studio opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setZoom((value) => Math.max(0.02, Math.min(4, value * factor)));
  }, []);

  const newDocument = useCallback(
    (width: number, height: number, name = 'Untitled artwork') => {
      const before = snapshotText();
      mount(createDocument(width, height, null));
      setDocName(name);
      setSelectedIds([]);
      commit(before);
      setMenu(null);
      window.setTimeout(() => fitView(), 30);
      toast.success(`New ${width} × ${height} canvas`);
    },
    [commit, fitView, mount, snapshotText, toast],
  );

  const applyTemplate = useCallback(
    (id: string) => {
      const template = TEMPLATES.find((item) => item.id === id);
      if (!template) return;
      try {
        const before = snapshotText();
        mount(parseSvgDocument(template.svg));
        setDocName(template.name);
        setSelectedIds([]);
        commit(before);
        setMenu(null);
        window.setTimeout(() => fitView(), 30);
        toast.success(`${template.name} ready to edit`);
      } catch {
        toast.error('That template could not be opened.');
      }
    },
    [commit, fitView, mount, snapshotText, toast],
  );

  const loadFile = useCallback(
    async (file: File, mode: 'open' | 'place') => {
      try {
        const text = await file.text();
        const parsed = parseSvgDocument(text);
        if (mode === 'open') {
          const before = snapshotText();
          mount(parsed);
          setDocName(file.name.replace(/\.svg$/i, ''));
          setSelectedIds([]);
          commit(before);
          window.setTimeout(() => fitView(), 30);
          toast.success(`Opened ${file.name}. Every object stays editable`);
        } else {
          const root = svgRef.current;
          if (!root) return;
          const size = Math.min(doc.w, doc.h) * 0.6;
          mutate(() => {
            const group = importDocumentInto(root, parsed, {
              x: doc.w / 2 - size / 2,
              y: doc.h / 2 - size / 2,
              w: size,
              h: size,
            });
            if (group?.getAttribute('id')) setSelectedIds([group.getAttribute('id')!]);
          });
          toast.success(`Placed ${file.name} on the canvas`);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'That file is not valid SVG.');
      }
    },
    [commit, doc.h, doc.w, fitView, mount, mutate, snapshotText, toast],
  );

  const addElement = useCallback(
    (element: VectorElement) => {
      const root = svgRef.current;
      if (!root) return;
      const size = Math.min(doc.w, doc.h) * 0.3;
      const step = Math.min(doc.w, doc.h) * 0.06 * (inserts.current % 4);
      inserts.current += 1;
      mutate(() => {
        const group = insertArtwork(root, element.body, {
          frame: { x: doc.w / 2 - size / 2 + step, y: doc.h / 2 - size / 2 + step, w: size, h: size },
          fill: '#c2185b',
          stroke: '#16181c',
          strokeWidth: element.strokeWidth ?? 4,
          outline: element.mode === 'stroke',
          name: element.name,
        });
        const id = group?.getAttribute('id');
        if (id) setSelectedIds([id]);
      });
    },
    [doc.h, doc.w, mutate],
  );

  /* ------------------------------------------------------------ properties */

  const setFillColor = useCallback(
    (color: string) => {
      if (!selectedEls.length) return;
      mutate(() => {
        selectedEls.forEach((el) => {
          if (color === 'none') {
            el.setAttribute('fill', 'none');
            el.querySelectorAll<SVGElement>('[fill]').forEach((node) => node.setAttribute('fill', 'none'));
          } else {
            paintElement(el, 'fill', color);
          }
        });
      });
    },
    [mutate, selectedEls],
  );

  const setStrokeColor = useCallback(
    (color: string) => {
      if (!selectedEls.length) return;
      mutate(() => {
        selectedEls.forEach((el) => {
          const width = strokeOf(el).width || Math.max(2, Math.min(doc.w, doc.h) * 0.004);
          paintElement(el, 'stroke', color, width);
        });
      });
    },
    [doc.h, doc.w, mutate, selectedEls],
  );

  const setStrokeWidth = useCallback(
    (width: number, silent = false) => {
      if (!selectedEls.length) return;
      const apply = () =>
        selectedEls.forEach((el) => {
          const color = strokeOf(el).color;
          paintElement(el, 'stroke', color === 'none' ? '#16181c' : color, width);
        });
      if (silent) {
        if (!sliderBefore.current) sliderBefore.current = snapshotText();
        apply();
        bump();
      } else {
        mutate(apply);
      }
    },
    [bump, mutate, selectedEls, snapshotText],
  );

  const setOpacityValue = useCallback(
    (value: number, silent = false) => {
      if (!selectedEls.length) return;
      const apply = () => selectedEls.forEach((el) => setOpacity(el, value));
      if (silent) {
        if (!sliderBefore.current) sliderBefore.current = snapshotText();
        apply();
        bump();
      } else {
        mutate(apply);
      }
    },
    [bump, mutate, selectedEls, snapshotText],
  );

  const setRotationValue = useCallback(
    (deg: number, silent = false) => {
      const root = svgRef.current;
      if (!root || !selectedEls.length) return;
      const apply = () =>
        selectedEls.forEach((el) => {
          const box = boxInDocument(el, root);
          const delta = deg - rotationOf(el);
          el.setAttribute(
            'transform',
            `rotate(${round(delta)} ${round(box.x + box.w / 2)} ${round(box.y + box.h / 2)}) ${el.getAttribute('transform') ?? ''}`.trim(),
          );
        });
      if (silent) {
        if (!sliderBefore.current) sliderBefore.current = snapshotText();
        apply();
        bump();
      } else {
        mutate(apply);
      }
    },
    [bump, mutate, selectedEls, snapshotText],
  );

  const setPosition = useCallback(
    (axis: 'x' | 'y', value: number) => {
      const root = svgRef.current;
      if (!root || !single) return;
      const box = boxInDocument(single, root);
      const delta = axis === 'x' ? value - box.x : value - box.y;
      if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) return;
      mutate(() => translateElement(single, axis === 'x' ? round(delta, 3) : 0, axis === 'y' ? round(delta, 3) : 0));
    },
    [mutate, single],
  );

  const setSize = useCallback(
    (axis: 'w' | 'h', value: number) => {
      const root = svgRef.current;
      if (!root || !single || !Number.isFinite(value) || value <= 1) return;
      const box = boxInDocument(single, root);
      const current = axis === 'w' ? box.w : box.h;
      if (current < 0.01) return;
      const factor = value / current;
      mutate(() => scaleElement(single, axis === 'w' ? factor : 1, axis === 'h' ? factor : 1, box.x, box.y));
    },
    [mutate, single],
  );

  const setRadius = useCallback(
    (value: number) => {
      if (!selectedEls.length) return;
      mutate(() => {
        selectedEls.forEach((el) => {
          if (el.tagName.toLowerCase() === 'rect') el.setAttribute('rx', String(Math.max(0, round(value))));
        });
      });
    },
    [mutate, selectedEls],
  );

  const setTextProp = useCallback(
    (prop: 'content' | 'size' | 'weight' | 'align' | 'spacing', value: string | number) => {
      if (!single || singleTag !== 'text') return;
      mutate(() => {
        if (prop === 'content') single.textContent = String(value);
        if (prop === 'size') single.setAttribute('font-size', String(round(Number(value))));
        if (prop === 'weight') single.setAttribute('font-weight', String(value));
        if (prop === 'align') single.setAttribute('text-anchor', String(value));
        if (prop === 'spacing') single.setAttribute('letter-spacing', String(round(Number(value))));
      });
    },
    [mutate, single, singleTag],
  );

  const setBackground = useCallback(
    (color: 'none' | '#ffffff' | '#f5f6f8' | '#16181c') => {
      const root = svgRef.current;
      if (!root) return;
      mutate(() => {
        let bg = root.querySelector<SVGRectElement>('#background');
        if (color === 'none') {
          bg?.remove();
          return;
        }
        if (!bg) {
          bg = document.createElementNS(SVG_NS, 'rect');
          bg.setAttribute('id', 'background');
          bg.setAttribute('x', '0');
          bg.setAttribute('y', '0');
          bg.setAttribute('width', String(doc.w));
          bg.setAttribute('height', String(doc.h));
          root.insertBefore(bg, root.firstChild);
        }
        bg.setAttribute('fill', color);
      });
    },
    [doc.h, doc.w, mutate],
  );

  /* -------------------------------------------------------------- arrange */

  const arrange = useCallback(
    (direction: 'front' | 'back' | 'up' | 'down') => {
      if (!selectedEls.length) return;
      mutate(() => selectedEls.forEach((el) => moveElement(el, direction)));
    },
    [mutate, selectedEls],
  );

  const align = useCallback(
    (mode: AlignMode) => {
      const root = svgRef.current;
      if (!root || !selectedEls.length) return;
      const frame =
        selectedEls.length === 1
          ? { x: 0, y: 0, w: doc.w, h: doc.h }
          : unionBox(selectedEls.map((el) => boxInDocument(el, root))) ?? { x: 0, y: 0, w: doc.w, h: doc.h };
      mutate(() => {
        selectedEls.forEach((el) => {
          const box = boxInDocument(el, root);
          let dx = 0;
          let dy = 0;
          if (mode === 'left') dx = frame.x - box.x;
          if (mode === 'center') dx = frame.x + frame.w / 2 - (box.x + box.w / 2);
          if (mode === 'right') dx = frame.x + frame.w - (box.x + box.w);
          if (mode === 'top') dy = frame.y - box.y;
          if (mode === 'middle') dy = frame.y + frame.h / 2 - (box.y + box.h / 2);
          if (mode === 'bottom') dy = frame.y + frame.h - (box.y + box.h);
          if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) translateElement(el, round(dx, 3), round(dy, 3));
        });
      });
    },
    [doc.h, doc.w, mutate, selectedEls],
  );

  const distribute = useCallback(
    (axis: 'x' | 'y') => {
      const root = svgRef.current;
      if (!root || selectedEls.length < 3) return;
      mutate(() => distributeElements(root, selectedEls, axis));
    },
    [mutate, selectedEls],
  );

  const groupSelection = useCallback(() => {
    if (selectedEls.length < 2) return;
    mutate(() => {
      const group = groupElements(selectedEls);
      const id = group?.getAttribute('id');
      if (id) setSelectedIds([id]);
    });
  }, [mutate, selectedEls]);

  const ungroupSelection = useCallback(() => {
    const groups = selectedEls.filter((el) => el.tagName.toLowerCase() === 'g');
    if (!groups.length) return;
    mutate(() => {
      const freed: string[] = [];
      groups.forEach((group) => {
        ungroupElement(group).forEach((child) => {
          const id = child.getAttribute('id');
          if (id) freed.push(id);
        });
      });
      if (freed.length) setSelectedIds(freed);
    });
  }, [mutate, selectedEls]);

  const duplicateSelection = useCallback(() => {
    const root = svgRef.current;
    if (!root || !selectedEls.length) return;
    const offset = Math.max(12, Math.min(doc.w, doc.h) * 0.02);
    mutate(() => {
      const created: string[] = [];
      selectedEls.forEach((el) => {
        const clone = cloneElement(el, offset);
        el.parentNode?.appendChild(clone);
        const id = clone.getAttribute('id');
        if (id) created.push(id);
      });
      if (created.length) setSelectedIds(created);
    });
  }, [doc.h, doc.w, mutate, selectedEls]);

  const deleteSelection = useCallback(() => {
    if (!selectedEls.length) return;
    mutate(() => {
      selectedEls.forEach((el) => el.remove());
      setSelectedIds([]);
    });
  }, [mutate, selectedEls]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (!selectedEls.length) return;
      mutate(() => selectedEls.forEach((el) => translateElement(el, dx, dy)));
    },
    [mutate, selectedEls],
  );

  const flipSelection = useCallback(
    (axis: 'x' | 'y') => {
      const root = svgRef.current;
      if (!root || !selectedEls.length || !selectionBox) return;
      const cx = selectionBox.x + selectionBox.w / 2;
      const cy = selectionBox.y + selectionBox.h / 2;
      mutate(() =>
        selectedEls.forEach((el) =>
          scaleElement(el, axis === 'x' ? -1 : 1, axis === 'y' ? -1 : 1, cx, cy),
        ),
      );
    },
    [mutate, selectedEls, selectionBox],
  );

  const centreOnCanvas = useCallback(() => {
    const root = svgRef.current;
    if (!root || !selectedEls.length) return;
    const box = unionBox(selectedEls.map((el) => boxInDocument(el, root)));
    if (!box) return;
    const dx = doc.w / 2 - (box.x + box.w / 2);
    const dy = doc.h / 2 - (box.y + box.h / 2);
    mutate(() => selectedEls.forEach((el) => translateElement(el, round(dx, 3), round(dy, 3))));
  }, [doc.h, doc.w, mutate, selectedEls]);

  const renameLayer = useCallback(
    (id: string, name: string) => {
      const el = svgRef.current?.querySelector<SVGElement>(`[id="${id}"]`);
      if (!el || !name.trim()) return;
      mutate(() => el.setAttribute('data-name', name.trim()));
    },
    [mutate],
  );

  const reorderLayer = useCallback(
    (id: string, targetId: string, place: 'above' | 'below') => {
      const root = svgRef.current;
      const el = root?.querySelector<SVGElement>(`[id="${id}"]`);
      const target = root?.querySelector<SVGElement>(`[id="${targetId}"]`);
      if (!root || !el || !target || el === target || el.contains(target) || target.contains(el)) return;
      if (el.parentNode !== target.parentNode) return;
      mutate(() => {
        // The list shows the topmost object first, so "above" means later in the DOM.
        if (place === 'above') target.parentNode?.insertBefore(target, el);
        else target.parentNode?.insertBefore(el, target.nextSibling);
      });
    },
    [mutate],
  );

  const clipboard = useRef<string[]>([]);

  const copySelection = useCallback(() => {
    if (!selectedEls.length) return;
    const serialiser = new XMLSerializer();
    clipboard.current = selectedEls.map((el) => serialiser.serializeToString(el));
  }, [selectedEls]);

  const pasteClipboard = useCallback(() => {
    const root = svgRef.current;
    if (!root || !clipboard.current.length) return;
    const offset = Math.max(12, Math.min(doc.w, doc.h) * 0.03);
    mutate(() => {
      const created: string[] = [];
      clipboard.current.forEach((text) => {
        try {
          const parsed = new DOMParser().parseFromString(
            `<svg xmlns="http://www.w3.org/2000/svg">${text}</svg>`,
            'image/svg+xml',
          );
          const source = parsed.documentElement.firstElementChild;
          if (!source) return;
          const node = root.ownerDocument.importNode(source, true) as SVGElement;
          const tag = node.tagName.toLowerCase();
          node.setAttribute('id', nextShapeId(tag));
          if (node.getAttribute('data-locked') === '1') node.removeAttribute('data-locked');
          root.appendChild(node);
          translateElement(node, offset, offset);
          created.push(node.getAttribute('id')!);
        } catch {
          /* skip malformed clipboard entry */
        }
      });
      if (created.length) setSelectedIds(created);
    });
  }, [doc.h, doc.w, mutate]);

  const selectAll = useCallback(() => {
    const root = svgRef.current;
    if (!root) return;
    const ids = listLayers(root)
      .filter((layer) => layer.depth === 0 && !layer.hidden && layer.tag !== 'defs')
      .map((layer) => layer.id)
      .filter((id) => id !== 'background');
    select(ids);
  }, [select]);

  const toggleLayer = useCallback(
    (id: string, kind: 'visible' | 'locked') => {
      const root = svgRef.current;
      const el = root?.querySelector<SVGElement>(`[id="${id}"]`);
      if (!root || !el) return;
      mutate(() => {
        if (kind === 'visible') {
          if (el.getAttribute('display') === 'none') {
            el.removeAttribute('display');
            el.style.removeProperty('display');
          } else {
            el.setAttribute('display', 'none');
          }
        } else if (el.getAttribute('data-locked') === '1') {
          el.removeAttribute('data-locked');
        } else {
          el.setAttribute('data-locked', '1');
        }
      });
    },
    [mutate],
  );

  /* --------------------------------------------------------------- export */

  const svgExportText = useCallback(() => {
    const root = svgRef.current;
    if (!root) return '';
    const text = serializeSvg(root);
    const sized = text.replace(/^<svg([^>]*?)\/?>/, (_match, attrs: string) => {
      const cleaned = attrs.replace(/\s(width|height)="[^"]*"/g, '');
      return `<svg${cleaned} width="${round(doc.w)}" height="${round(doc.h)}">`;
    });
    return sanitizeSvg(sized).text;
  }, [doc.h, doc.w]);

  const exportArtwork = useCallback(
    async (kind: 'svg' | 'png1' | 'png2' | 'png4' | 'eps') => {
      setMenu(null);
      const root = svgRef.current;
      if (!root) return;
      try {
        if (kind === 'svg') {
          triggerBlobDownload(new Blob([svgExportText()], { type: 'image/svg+xml' }), `${docName || 'artwork'}.svg`);
          toast.success('SVG exported', 'Editable vectors, ready for any marketplace.');
          return;
        }
        if (kind === 'eps') {
          const { eps, skipped } = svgToEps(root, docName || 'Micro Stocker Advanced Pro');
          triggerBlobDownload(new Blob([eps], { type: 'application/postscript' }), `${docName || 'artwork'}.eps`);
          if (skipped.length) toast.info(`EPS exported. Skipped: ${Array.from(new Set(skipped)).join(', ')}`);
          else toast.success('EPS exported');
          return;
        }
        const scale = kind === 'png1' ? 1 : kind === 'png2' ? 2 : 4;
        const blob = await svgToPngBlob(svgExportText(), doc.w, doc.h, scale);
        triggerBlobDownload(blob, `${docName || 'artwork'}@${scale}x.png`);
        toast.success(`PNG exported at ${scale}×`, `${Math.round(doc.w * scale)} × ${Math.round(doc.h * scale)} px`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Export failed.');
      }
    },
    [doc.h, doc.w, docName, svgExportText, toast],
  );

  const copySvg = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(svgExportText());
      toast.success('SVG copied to clipboard');
    } catch {
      toast.error('Clipboard access was blocked by the browser.');
    }
    setMenu(null);
  }, [svgExportText, toast]);

  /* ------------------------------------------------------------- shortcuts */

  const actions = useRef({
    undo,
    redo,
    deleteSelection,
    duplicateSelection,
    groupSelection,
    ungroupSelection,
    selectAll,
    fitView,
    zoomBy,
    setTool,
    nudge,
    arrange,
    flipSelection,
    copySelection,
    pasteClipboard,
  });
  actions.current = {
    undo,
    redo,
    deleteSelection,
    duplicateSelection,
    groupSelection,
    ungroupSelection,
    selectAll,
    fitView,
    zoomBy,
    setTool,
    nudge,
    arrange,
    flipSelection,
    copySelection,
    pasteClipboard,
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const textInput =
        target instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'color', 'file', 'button'].includes(target.type);
      const typing = Boolean(target && (textInput || target.tagName === 'TEXTAREA' || target.isContentEditable));
      if (event.code === 'Space' && !typing) {
        spaceDown.current = true;
        return;
      }
      if (typing) return;
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (meta && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) actions.current.redo();
        else actions.current.undo();
        return;
      }
      if (meta && key === 'y') {
        event.preventDefault();
        actions.current.redo();
        return;
      }
      if (meta && key === 'd') {
        event.preventDefault();
        actions.current.duplicateSelection();
        return;
      }
      if (meta && key === 'a') {
        event.preventDefault();
        actions.current.selectAll();
        return;
      }
      if (meta && key === 'c') {
        actions.current.copySelection();
        return;
      }
      if (meta && key === 'v') {
        event.preventDefault();
        actions.current.pasteClipboard();
        return;
      }
      if (event.shiftKey && key === 'h') {
        actions.current.flipSelection('x');
        return;
      }
      if (event.shiftKey && key === 'v') {
        actions.current.flipSelection('y');
        return;
      }
      if (meta && key === 'g') {
        event.preventDefault();
        if (event.shiftKey) actions.current.ungroupSelection();
        else actions.current.groupSelection();
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        event.preventDefault();
        actions.current.deleteSelection();
        return;
      }
      if (key === 'escape') {
        setSelectedIds([]);
        setMenu(null);
        setPresent(false);
        return;
      }
      if (key === 'arrowleft' || key === 'arrowright' || key === 'arrowup' || key === 'arrowdown') {
        event.preventDefault();
        const step = event.shiftKey ? 20 : 2;
        const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
        const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
        actions.current.nudge(dx, dy);
        return;
      }
      if (key === ']') {
        actions.current.arrange('front');
        return;
      }
      if (key === '[') {
        actions.current.arrange('back');
        return;
      }
      if (key === '+' || key === '=') {
        actions.current.zoomBy(1.15);
        return;
      }
      if (key === '-') {
        actions.current.zoomBy(1 / 1.15);
        return;
      }
      if (key === '0') {
        actions.current.fitView();
        return;
      }
      const shortcut = TOOLS.find((item) => item.shortcut.toLowerCase() === key);
      if (shortcut && !meta && !event.shiftKey) actions.current.setTool(shortcut.id);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const closeSlider = () => endSlider();
    window.addEventListener('pointerup', closeSlider);
    window.addEventListener('pointercancel', closeSlider);
    return () => {
      window.removeEventListener('pointerup', closeSlider);
      window.removeEventListener('pointercancel', closeSlider);
    };
  }, [endSlider]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  /* ------------------------------------------------------------------ view */

  const handles = [
    { id: 'nw', cls: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize' },
    { id: 'n', cls: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize' },
    { id: 'ne', cls: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize' },
    { id: 'e', cls: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize' },
    { id: 'se', cls: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize' },
    { id: 's', cls: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize' },
    { id: 'sw', cls: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize' },
    { id: 'w', cls: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize' },
  ];

  const toolButton = (item: (typeof TOOLS)[number], horizontal = false) => (
    <button
      key={item.id}
      type="button"
      onClick={() => setTool(item.id)}
      title={`${item.label} (${item.shortcut})`}
      aria-label={item.label}
      aria-pressed={tool === item.id}
      className={clsx(
        'flex items-center justify-center rounded-[var(--r-control)] transition-colors',
        horizontal ? 'size-8 shrink-0' : 'size-8 w-full',
        tool === item.id ? 'bg-brand-solid text-white' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
      )}
    >
      <StudioIcon name={item.icon} size={17} />
    </button>
  );

  return (
    <div className="flex flex-col gap-2.5">
      <h1 className="sr-only">Vector Studio</h1>
      {/* Top bar ------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--r-card)] border border-line bg-surface px-2 py-1.5">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu(menu === 'new' ? null : 'new')}
            className="inline-flex h-8 items-center gap-1 rounded-[var(--r-control)] border border-line px-2 text-[0.75rem] font-semibold text-ink hover:border-brand"
            aria-haspopup="menu"
            aria-expanded={menu === 'new'}
          >
            <StudioIcon name="plus" size={14} />
            New
            <StudioIcon name="chevron_down" size={12} />
          </button>
          {menu === 'new' && (
            <div className="absolute top-full left-0 z-40 mt-1 w-[17.5rem] rounded-[var(--r-card)] border border-line bg-surface p-2 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.35)]">
              <div className="mb-1 px-1 text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Canvas</div>
              <div className="mb-2 grid grid-cols-2 gap-1">
                {DOC_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => newDocument(preset.w, preset.h)}
                    className="rounded-[var(--r-control)] border border-line px-1.5 py-1 text-left hover:border-brand"
                  >
                    <span className="block text-[0.75rem] font-medium text-ink">{preset.label}</span>
                    <span className="block text-2xs text-ink-faint">{preset.size}</span>
                  </button>
                ))}
              </div>
              <div className="mb-1 px-1 text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Templates</div>
              <div className="grid gap-0.5">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template.id)}
                    className="flex items-center justify-between rounded-[var(--r-control)] px-1.5 py-1 text-left text-[0.75rem] text-ink-muted hover:bg-surface-2 hover:text-ink"
                  >
                    <span>{template.name}</span>
                    <span className="text-2xs text-ink-faint">{template.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex h-8 items-center gap-1 rounded-[var(--r-control)] border border-line px-2 text-[0.75rem] font-medium text-ink-muted hover:border-brand hover:text-ink"
        >
          <StudioIcon name="image" size={14} />
          Open SVG
        </button>

        <span className="mx-0.5 hidden h-5 w-px bg-line sm:block" />

        <button
          type="button"
          onClick={undo}
          disabled={!historyCount}
          className="flex size-8 items-center justify-center rounded-[var(--r-control)] text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-35"
          aria-label="Undo"
          title="Undo (⌘Z)"
        >
          <StudioIcon name="undo" size={16} />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!futureCount}
          className="flex size-8 items-center justify-center rounded-[var(--r-control)] text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-35"
          aria-label="Redo"
          title="Redo (⇧⌘Z)"
        >
          <StudioIcon name="redo" size={16} />
        </button>

        <input
          value={docName}
          onChange={(event) => setDocName(event.target.value)}
          aria-label="Artwork name"
          className="hidden h-8 min-w-0 flex-1 rounded-[var(--r-control)] border border-transparent px-2 text-[0.8125rem] font-medium text-ink hover:border-line focus:border-brand focus:outline-none sm:block sm:max-w-[18rem]"
        />

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.2)}
            className="flex size-8 items-center justify-center rounded-[var(--r-control)] text-ink-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Zoom out"
          >
            <StudioIcon name="minus" size={16} />
          </button>
          <span className="w-11 text-center text-[0.75rem] tabular-nums text-ink-muted">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => zoomBy(1.2)}
            className="flex size-8 items-center justify-center rounded-[var(--r-control)] text-ink-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Zoom in"
          >
            <StudioIcon name="plus" size={16} />
          </button>
          <button
            type="button"
            onClick={fitView}
            className="flex size-8 items-center justify-center rounded-[var(--r-control)] text-ink-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Fit canvas"
            title="Fit (0)"
          >
            <StudioIcon name="fit" size={16} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu(menu === 'export' ? null : 'export')}
              className="inline-flex h-8 items-center gap-1 rounded-[var(--r-control)] bg-brand-solid px-2.5 text-[0.75rem] font-semibold text-white hover:brightness-110"
              aria-haspopup="menu"
              aria-expanded={menu === 'export'}
            >
              <StudioIcon name="download" size={14} />
              Export
              <StudioIcon name="chevron_down" size={12} />
            </button>
            {menu === 'export' && (
              <div className="absolute top-full right-0 z-40 mt-1 w-52 rounded-[var(--r-card)] border border-line bg-surface p-1 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.35)]">
                {[
                  { id: 'svg' as const, label: 'SVG', hint: 'Editable vector' },
                  { id: 'png1' as const, label: 'PNG 1×', hint: `${doc.w} × ${doc.h}` },
                  { id: 'png2' as const, label: 'PNG 2×', hint: `${doc.w * 2} × ${doc.h * 2}` },
                  { id: 'png4' as const, label: 'PNG 4×', hint: `${doc.w * 4} × ${doc.h * 4}` },
                  { id: 'eps' as const, label: 'EPS', hint: 'Print & marketplace' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void exportArtwork(item.id)}
                    className="flex w-full items-center justify-between rounded-[var(--r-control)] px-2 py-1.5 text-left text-[0.8125rem] text-ink-muted hover:bg-surface-2 hover:text-ink"
                  >
                    <span>{item.label}</span>
                    <span className="text-2xs text-ink-faint">{item.hint}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void copySvg()}
                  className="flex w-full items-center gap-2 rounded-[var(--r-control)] border-t border-line px-2 py-1.5 text-left text-[0.8125rem] text-ink-muted hover:bg-surface-2 hover:text-ink"
                >
                  <StudioIcon name="copy" size={13} />
                  Copy SVG
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workspace ------------------------------------------------------ */}
      <div className="flex min-h-0 flex-col gap-2.5 lg:h-[calc(100dvh-11.25rem)] lg:flex-row">
        {/* Tool rail */}
        <div className="hidden w-11 shrink-0 flex-col gap-1 rounded-[var(--r-card)] border border-line bg-surface p-1 lg:flex">
          {TOOLS.map((item) => toolButton(item))}
          <div className="mt-auto flex flex-col gap-1 border-t border-line pt-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-8 w-full items-center justify-center rounded-[var(--r-control)] text-ink-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Open SVG"
              title="Open an SVG file"
            >
              <StudioIcon name="image" size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPresent(true)}
              className="flex h-8 w-full items-center justify-center rounded-[var(--r-control)] text-ink-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Present artwork"
              title="Present"
            >
              <StudioIcon name="preview" size={16} />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--r-card)] border border-line bg-surface">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-1.5 py-1.5 lg:hidden">
            {TOOLS.map((item) => toolButton(item, true))}
          </div>
          <div
            ref={stageRef}
            className="relative h-[52vh] min-h-[300px] overflow-auto lg:h-auto lg:min-h-0 lg:flex-1"
            style={{ background: 'var(--surface-2)' }}
          >
            <div className="flex min-h-full min-w-full items-center justify-center p-6 sm:p-10">
              <div
                ref={frameRef}
                data-testid="vector-frame"
                className="relative shrink-0 touch-none shadow-[0_18px_50px_-18px_rgb(0_0_0/0.45)]"
                style={{
                  width: Math.max(20, doc.w * zoom),
                  height: Math.max(20, doc.h * zoom),
                  outline: '1px solid var(--line-strong)',
                  cursor: tool === 'select' ? 'default' : 'crosshair',
                  background: 'var(--surface)',
                }}
                onPointerDown={onFramePointerDown}
                onPointerMove={onFramePointerMove}
                onPointerUp={onFramePointerUp}
                onPointerCancel={onFramePointerUp}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files?.[0];
                  if (file) void loadFile(file, 'place');
                }}
              >
                <div ref={svgHost} className="checkerboard h-full w-full [&_svg]:block [&_svg]:h-full [&_svg]:w-full" />

                <div
                  ref={marqueeRef}
                  className="pointer-events-none absolute z-30 border border-brand bg-brand/10"
                  style={{ display: 'none' }}
                />

                <div ref={overlayRef} className="pointer-events-none absolute z-20" style={{ display: 'none' }}>
                  <div className="absolute inset-0 border border-brand" />
                  {hasSelection && selectedEls.length === 1 && (
                    <>
                      <div className="absolute -top-7 left-1/2 h-7 w-px -translate-x-1/2 bg-brand" />
                      <button
                        type="button"
                        onPointerDown={startRotate}
                        data-handle="rotate"
                        aria-label="Rotate selection"
                        title="Drag to rotate"
                        className="pointer-events-auto absolute -top-9 left-1/2 flex size-4 -translate-x-1/2 items-center justify-center rounded-full border border-brand bg-surface text-brand"
                      >
                        <StudioIcon name="rotate" size={10} />
                      </button>
                      {handles.map((handle) => (
                        <span
                          key={handle.id}
                          role="presentation"
                          onPointerDown={(event) => startResize(event, handle.id)}
                          data-handle={handle.id}
                          className={clsx('pointer-events-auto absolute size-2 rounded-[1px] border border-brand bg-surface', handle.cls)}
                        />
                      ))}
                    </>
                  )}
                  {selectedEls.length > 1 && (
                    <span className="absolute -top-6 left-0 rounded-[var(--r-xs)] bg-brand-solid px-1.5 py-0.5 text-2xs font-semibold text-white">
                      {selectedEls.length} selected
                    </span>
                  )}
                </div>
              </div>
            </div>

          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-2.5 py-1 text-2xs text-ink-faint">
            <span>
              {doc.w} × {doc.h} px · {layers.filter((layer) => layer.depth === 0).length}{' '}
              {layers.filter((layer) => layer.depth === 0).length === 1 ? 'object' : 'objects'}
            </span>
          </div>
        </div>

        {/* Inspector */}
        <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-[var(--r-card)] border border-line bg-surface lg:w-[19rem]">
          <div className="border-b border-line p-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Live preview</span>
              <button
                type="button"
                onClick={() => setPresent(true)}
                className="text-2xs font-semibold text-brand hover:text-brand-hover"
              >
                Present
              </button>
            </div>
            <div className="mt-1.5 flex justify-center">
              <div
                className="checkerboard relative h-24 overflow-hidden rounded-[var(--r-control)]"
                style={{ aspectRatio: `${doc.w} / ${doc.h}`, maxWidth: '100%' }}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Live artwork preview" className="absolute inset-0 h-full w-full object-contain" />
                ) : null}
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between text-2xs text-ink-faint">
              <span>
                {doc.w} × {doc.h}
              </span>
              <span>{previewBytes ? `${Math.max(1, Math.round(previewBytes / 1024))} KB` : ''}</span>
            </div>
          </div>

          <div className="flex border-b border-line">
            {([
              { id: 'design', label: 'Design', icon: 'ruler' },
              { id: 'elements', label: 'Elements', icon: 'grid' },
              { id: 'layers', label: 'Layers', icon: 'layers' },
            ] as const).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={clsx(
                  'flex flex-1 items-center justify-center gap-1 border-b-2 py-2 text-2xs font-semibold transition-colors',
                  tab === item.id ? 'border-brand text-ink' : 'border-transparent text-ink-faint hover:text-ink',
                )}
              >
                <StudioIcon name={item.icon} size={13} />
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'elements' && (
            <ElementsPanel active={category} onCategory={setCategory} onInsert={addElement} onTemplate={applyTemplate} />
          )}

          {tab === 'layers' && (
            <LayersPanel
              layers={layers}
              selectedIds={selectedIds}
              onSelect={(id, additive) => select([id], additive)}
              onToggle={toggleLayer}
              onRename={renameLayer}
              onReorder={reorderLayer}
              onDelete={(id) => {
                const root = svgRef.current;
                const el = root?.querySelector<SVGElement>(`[id="${id}"]`);
                if (!el) return;
                mutate(() => {
                  el.remove();
                  setSelectedIds((ids) => ids.filter((item) => item !== id));
                });
              }}
            />
          )}

          {tab === 'design' && (
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {!selectedEls.length && (
                <div className="space-y-2">
                  <div className="rounded-[var(--r-control)] border border-line p-2">
                    <div className="mb-1 text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Canvas</div>
                    <div className="grid grid-cols-2 gap-1">
                      {DOC_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => newDocument(preset.w, preset.h)}
                          className={clsx(
                            'rounded-[var(--r-control)] border px-1.5 py-1 text-left transition-colors',
                            doc.w === preset.w && doc.h === preset.h ? 'border-brand text-ink' : 'border-line text-ink-muted hover:text-ink',
                          )}
                        >
                          <span className="block text-[0.75rem] font-medium">{preset.label}</span>
                          <span className="block text-2xs text-ink-faint">{preset.size}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[var(--r-control)] border border-line p-2">
                    <div className="mb-1.5 text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Background</div>
                    <div className="flex items-center gap-1">
                      {[
                        { id: 'none', color: 'transparent', label: 'Transparent' },
                        { id: '#ffffff', color: '#ffffff', label: 'White' },
                        { id: '#f5f6f8', color: '#f5f6f8', label: 'Paper' },
                        { id: '#16181c', color: '#16181c', label: 'Ink' },
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setBackground(option.id as 'none' | '#ffffff' | '#f5f6f8' | '#16181c')}
                          title={option.label}
                          aria-label={option.label}
                          className={clsx('size-6 rounded-[var(--r-xs)] border border-black/10', option.id === 'none' && 'checkerboard')}
                          style={{ backgroundColor: option.color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedEls.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-[var(--r-control)] bg-surface-2 px-2 py-1">
                    <span className="truncate text-[0.75rem] font-semibold text-ink">
                      {selectedEls.length === 1 ? singleTag || 'object' : `${selectedEls.length} objects`}
                    </span>
                    <span className="text-2xs text-ink-faint">
                      {selectionBox ? `${Math.round(selectionBox.w)} × ${Math.round(selectionBox.h)}` : ''}
                    </span>
                  </div>

                  {selectionBox && (
                    <div className="grid grid-cols-2 gap-1">
                      <NumberField label="X" value={selectionBox.x} onCommit={(value) => setPosition('x', value)} />
                      <NumberField label="Y" value={selectionBox.y} onCommit={(value) => setPosition('y', value)} />
                      <NumberField label="W" value={selectionBox.w} onCommit={(value) => setSize('w', value)} />
                      <NumberField label="H" value={selectionBox.h} onCommit={(value) => setSize('h', value)} />
                    </div>
                  )}

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Fill</span>
                      <input
                        type="color"
                        value={fillValue === 'none' ? '#ffffff' : fillValue}
                        onChange={(event) => setFillColor(event.target.value)}
                        aria-label="Custom fill colour"
                        className="h-5 w-6 cursor-pointer rounded-[var(--r-xs)] border border-line bg-surface p-0"
                      />
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                      {VECTOR_PALETTE.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFillColor(color)}
                          title={color === 'none' ? 'No fill' : color}
                          aria-label={color === 'none' ? 'No fill' : `Fill ${color}`}
                          className={clsx(
                            'aspect-square rounded-[var(--r-xs)] border border-black/10 transition-transform hover:scale-110',
                            color === 'none' && 'checkerboard',
                            fillValue === color && 'ring-2 ring-brand ring-offset-1 ring-offset-surface',
                          )}
                          style={color === 'none' ? undefined : { backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Stroke</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          value={strokeValue.color === 'none' ? '#16181c' : strokeValue.color}
                          onChange={(event) => setStrokeColor(event.target.value)}
                          aria-label="Stroke colour"
                          className="h-5 w-6 cursor-pointer rounded-[var(--r-xs)] border border-line bg-surface p-0"
                        />
                        <span className="w-6 text-right text-2xs tabular-nums text-ink-faint">{Math.round(strokeValue.width)}</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      value={Math.min(40, Math.round(strokeValue.width))}
                      onPointerDown={beginSlider}
                      onPointerUp={endSlider}
                      onChange={(event) => setStrokeWidth(Number(event.target.value), true)}
                      aria-label="Stroke width"
                      className="w-full accent-[var(--brand)]"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Opacity</span>
                      <span className="text-2xs tabular-nums text-ink-faint">{Math.round(opacityValue * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={Math.round(opacityValue * 100)}
                      onPointerDown={beginSlider}
                      onPointerUp={endSlider}
                      onChange={(event) => setOpacityValue(Number(event.target.value) / 100, true)}
                      aria-label="Opacity"
                      className="w-full accent-[var(--brand)]"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Rotation</span>
                      <span className="text-2xs tabular-nums text-ink-faint">{Math.round(rotationValue)}°</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      step={1}
                      value={((Math.round(rotationValue) % 360) + 360) % 360}
                      onPointerDown={beginSlider}
                      onPointerUp={endSlider}
                      onChange={(event) => setRotationValue(Number(event.target.value), true)}
                      aria-label="Rotation"
                      className="w-full accent-[var(--brand)]"
                    />
                  </div>

                  {singleTag === 'rect' && (
                    <NumberField
                      label="Corner"
                      value={num(single?.getAttribute('rx'), 0)}
                      onCommit={(value) => setRadius(value)}
                    />
                  )}

                  {singleTag === 'text' && single && (
                    <div className="space-y-1.5 rounded-[var(--r-control)] border border-line p-1.5">
                      <textarea
                        ref={textInputRef}
                        defaultValue={single.textContent ?? ''}
                        key={`${selectedIds[0]}-${revision}`}
                        onBlur={(event) => setTextProp('content', event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            setTextProp('content', (event.target as HTMLTextAreaElement).value);
                            (event.target as HTMLTextAreaElement).blur();
                          }
                        }}
                        rows={2}
                        className="w-full resize-none rounded-[var(--r-xs)] border border-line bg-surface px-1.5 py-1 text-[0.75rem] text-ink focus:border-brand focus:outline-none"
                        aria-label="Text content"
                      />
                      <div className="flex items-center gap-1">
                        <NumberField
                          label="Size"
                          value={num(single.getAttribute('font-size'), 40)}
                          onCommit={(value) => setTextProp('size', value)}
                        />
                        <NumberField
                          label="Track"
                          value={num(single.getAttribute('letter-spacing'), 0)}
                          onCommit={(value) => setTextProp('spacing', value)}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        {['400', '600', '700', '800'].map((weight) => (
                          <button
                            key={weight}
                            type="button"
                            onClick={() => setTextProp('weight', weight)}
                            className={clsx(
                              'flex-1 rounded-[var(--r-xs)] border py-0.5 text-2xs',
                              num(single.getAttribute('font-weight'), 400) === Number(weight)
                                ? 'border-brand text-ink'
                                : 'border-line text-ink-muted hover:text-ink',
                            )}
                            style={{ fontWeight: Number(weight) }}
                          >
                            {weight === '400' ? 'Reg' : weight === '600' ? 'Semi' : weight === '700' ? 'Bold' : 'Black'}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        {[
                          { id: 'start', label: 'Left' },
                          { id: 'middle', label: 'Centre' },
                          { id: 'end', label: 'Right' },
                        ].map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setTextProp('align', option.id)}
                            className={clsx(
                              'flex-1 rounded-[var(--r-xs)] border py-0.5 text-2xs',
                              (single.getAttribute('text-anchor') ?? 'start') === option.id
                                ? 'border-brand text-ink'
                                : 'border-line text-ink-muted hover:text-ink',
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-1 text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Transform</div>
                    <div className="flex gap-1">
                      {[
                        { icon: 'flip_h' as StudioIconName, label: 'Flip horizontal', run: () => flipSelection('x') },
                        { icon: 'flip_v' as StudioIconName, label: 'Flip vertical', run: () => flipSelection('y') },
                        { icon: 'centre' as StudioIconName, label: 'Centre on canvas', run: centreOnCanvas },
                        { icon: 'copy' as StudioIconName, label: 'Duplicate', run: duplicateSelection },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={item.run}
                          title={item.label}
                          aria-label={item.label}
                          className="flex h-7 flex-1 items-center justify-center rounded-[var(--r-xs)] border border-line text-ink-muted hover:border-brand hover:text-ink"
                        >
                          <StudioIcon name={item.icon} size={14} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Align</div>
                    <div className="flex gap-1">
                      {ALIGN_BUTTONS.map((item) => (
                        <button
                          key={item.mode}
                          type="button"
                          onClick={() => align(item.mode)}
                          title={item.label}
                          aria-label={item.label}
                          className="flex h-7 flex-1 items-center justify-center rounded-[var(--r-xs)] border border-line text-ink-muted hover:border-brand hover:text-ink"
                        >
                          <StudioIcon name={item.icon} size={14} />
                        </button>
                      ))}
                    </div>
                    {selectedEls.length > 2 && (
                      <div className="mt-1 flex gap-1">
                        <button
                          type="button"
                          onClick={() => distribute('x')}
                          className="flex-1 rounded-[var(--r-xs)] border border-line py-1 text-2xs text-ink-muted hover:border-brand hover:text-ink"
                        >
                          Distribute across
                        </button>
                        <button
                          type="button"
                          onClick={() => distribute('y')}
                          className="flex-1 rounded-[var(--r-xs)] border border-line py-1 text-2xs text-ink-muted hover:border-brand hover:text-ink"
                        >
                          Distribute down
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-1 text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Arrange</div>
                    <div className="flex gap-1">
                      {[
                        { dir: 'front' as const, icon: 'front' as StudioIconName, label: 'Bring to front' },
                        { dir: 'up' as const, icon: 'up' as StudioIconName, label: 'Bring forward' },
                        { dir: 'down' as const, icon: 'down' as StudioIconName, label: 'Send backward' },
                        { dir: 'back' as const, icon: 'back' as StudioIconName, label: 'Send to back' },
                      ].map((action) => (
                        <button
                          key={action.dir}
                          type="button"
                          onClick={() => arrange(action.dir)}
                          title={action.label}
                          aria-label={action.label}
                          className="flex h-7 flex-1 items-center justify-center rounded-[var(--r-xs)] border border-line text-ink-muted hover:border-brand hover:text-ink"
                        >
                          <StudioIcon name={action.icon} size={14} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={groupSelection}
                      disabled={selectedEls.length < 2}
                      className="flex h-7 flex-1 items-center justify-center gap-1 rounded-[var(--r-xs)] border border-line text-2xs text-ink-muted hover:border-brand hover:text-ink disabled:opacity-40"
                    >
                      <StudioIcon name="group" size={13} />
                      Group
                    </button>
                    <button
                      type="button"
                      onClick={ungroupSelection}
                      disabled={!selectedEls.some((el) => el.tagName.toLowerCase() === 'g')}
                      className="flex h-7 flex-1 items-center justify-center gap-1 rounded-[var(--r-xs)] border border-line text-2xs text-ink-muted hover:border-brand hover:text-ink disabled:opacity-40"
                    >
                      <StudioIcon name="ungroup" size={13} />
                      Ungroup
                    </button>
                  </div>

                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={duplicateSelection}
                      className="flex h-7 flex-1 items-center justify-center gap-1 rounded-[var(--r-xs)] border border-line text-2xs text-ink-muted hover:border-brand hover:text-ink"
                    >
                      <StudioIcon name="copy" size={13} />
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelection}
                      className="flex h-7 flex-1 items-center justify-center gap-1 rounded-[var(--r-xs)] border border-line text-2xs text-danger hover:border-danger hover:bg-danger-soft"
                    >
                      <StudioIcon name="trash" size={13} />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void loadFile(file, 'open');
          event.target.value = '';
        }}
      />

      {present && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Artwork presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setPresent(false);
          }}
        >
          <div className="checkerboard relative h-[74vh] w-[min(84vw,1100px)] overflow-hidden rounded-[var(--r-card)]">
            {previewUrl ? <img src={previewUrl} alt="Artwork" className="absolute inset-0 h-full w-full object-contain p-4" /> : null}
          </div>
          <div className="flex items-center gap-3 text-[0.75rem] text-white/80">
            <span>
              {doc.w} × {doc.h} px
            </span>
            <button
              type="button"
              onClick={() => setPresent(false)}
              className="rounded-[var(--r-control)] border border-white/30 px-2.5 py-1 text-white hover:bg-white/10"
            >
              Close (Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Numeric field                                                             */
/* -------------------------------------------------------------------------- */
