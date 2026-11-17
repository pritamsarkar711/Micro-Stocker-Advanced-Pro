import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { BgRemoveResult } from '@/lib/tools/bgremove';

interface Props {
  source: Blob;
  result: BgRemoveResult;
  onClose: () => void;
  onSave: (result: BgRemoveResult) => void;
}

/** Full-resolution alpha-mask editor. The original image is never modified. */
export function MaskEditor({ source, result, onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const undoRef = useRef<ImageData[]>([]);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<'erase' | 'restore'>('erase');
  const [size, setSize] = useState(40);
  const [opacity, setOpacity] = useState(100);
  const [zoom, setZoom] = useState(100);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [undoCount, setUndoCount] = useState(0);
  const [saving, setSaving] = useState(false);

  function redraw() {
    const canvas = canvasRef.current, mask = maskRef.current, original = sourceRef.current;
    if (!canvas || !mask || !original) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(original, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [original, cutout] = await Promise.all([createImageBitmap(source), createImageBitmap(result.transparentBlob)]);
      try {
        if (cancelled || !canvasRef.current) return;
        const width = original.width, height = original.height;
        const makeCanvas = () => { const c = document.createElement('canvas'); c.width = width; c.height = height; return c; };
        const originalCanvas = makeCanvas(), mask = makeCanvas(), temp = makeCanvas();
        const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true })!;
        originalCtx.drawImage(original, 0, 0);
        const tmpCtx = temp.getContext('2d', { willReadFrequently: true })!;
        tmpCtx.drawImage(cutout, 0, 0);
        const pixels = tmpCtx.getImageData(0, 0, width, height);
        const src = originalCtx.getImageData(0, 0, width, height).data;
        for (let i = 0; i < pixels.data.length; i += 4) {
          const alpha = src[i + 3];
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
          pixels.data[i + 3] = alpha ? Math.min(255, Math.round(pixels.data[i + 3] * 255 / alpha)) : 0;
        }
        mask.getContext('2d')!.putImageData(pixels, 0, 0);
        maskRef.current = mask;
        sourceRef.current = originalCanvas;
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        redraw();
        setReady(true);
      } finally { original.close(); cutout.close(); }
    })().catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to open editor'); });
    return () => { cancelled = true; };
  }, [source, result.transparentBlob]);

  function point(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * e.currentTarget.width / rect.width, y: (e.clientY - rect.top) * e.currentTarget.height / rect.height };
  }

  function paint(from: { x: number; y: number }, to: { x: number; y: number }) {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d')!;
    ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
    ctx.globalAlpha = opacity / 100;
    ctx.strokeStyle = 'white';
    ctx.fillStyle = 'white';
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x + 0.001, to.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    redraw();
  }

  function start(e: PointerEvent<HTMLCanvasElement>) {
    if (!ready || e.button !== 0 || !maskRef.current) return;
    e.preventDefault();
    const mask = maskRef.current;
    // Bound undo memory for large photos. Keep at least one full-resolution snapshot.
    const limit = Math.max(1, Math.min(10, Math.floor(64 * 1024 * 1024 / (mask.width * mask.height * 4))));
    undoRef.current.push(mask.getContext('2d')!.getImageData(0, 0, mask.width, mask.height));
    if (undoRef.current.length > limit) undoRef.current.shift();
    setUndoCount(undoRef.current.length);
    e.currentTarget.setPointerCapture(e.pointerId);
    lastRef.current = point(e);
    paint(lastRef.current, lastRef.current);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Could not encode image')), 'image/png'));
      onSave({ ...result, blob, transparentBlob: blob, filename: result.filename.replace(/\.[^.]+$/, '') + '_edited.png', sizeBytes: blob.size });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save image'); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Refine cutout" description="Paint to erase or restore the original image. Edits are saved as a transparent PNG." size="xl"
      footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!ready} loading={saving} onClick={() => void save()}>Apply edits</Button></div>}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant={mode === 'erase' ? 'primary' : 'outline'} onClick={() => setMode('erase')} aria-pressed={mode === 'erase'}>Erase</Button>
          <Button size="sm" variant={mode === 'restore' ? 'primary' : 'outline'} onClick={() => setMode('restore')} aria-pressed={mode === 'restore'}>Restore</Button>
          <label className="text-xs">Brush {size}px <input aria-label="Brush size" type="range" min="1" max="300" value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
          <label className="text-xs">Opacity {opacity}% <input aria-label="Brush opacity" type="range" min="1" max="100" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} /></label>
          <label className="text-xs">Zoom {zoom}% <input aria-label="Zoom" type="range" min="25" max="300" step="25" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
          <Button size="sm" variant="outline" disabled={!undoCount} onClick={() => { const data = undoRef.current.pop(); if (data && maskRef.current) { maskRef.current.getContext('2d')!.putImageData(data, 0, 0); setUndoCount(undoRef.current.length); redraw(); } }}>Undo</Button>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {!ready && !error && <p className="text-sm text-ink-muted">Preparing full-resolution image…</p>}
        <div className="checkerboard max-h-[55dvh] overflow-auto rounded border border-line">
          <canvas ref={canvasRef} aria-label="Cutout editor; paint with a mouse, pen or touch" className="block touch-none" style={{ width: `${zoom}%`, height: 'auto', cursor: 'crosshair' }}
            onPointerDown={start} onPointerMove={(e) => { if (!lastRef.current) return; const next = point(e); paint(lastRef.current, next); lastRef.current = next; }} onPointerUp={() => { lastRef.current = null; }} onPointerCancel={() => { lastRef.current = null; }} onLostPointerCapture={() => { lastRef.current = null; }} />
        </div>
      </div>
    </Modal>
  );
}
