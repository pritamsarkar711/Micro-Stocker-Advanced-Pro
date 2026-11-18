import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { desktop, triggerBlobDownload } from '@/lib/desktop';
import { kv } from '@/lib/kv';
import { useToast } from '@/state/ToastState';
import {
  DEFAULT_FLAGS,
  EMPTY_METADATA,
  type ItemFlags,
  type StockFormat,
  type StockItem,
  type StockMetadata,
} from '@/lib/stock/types';
import { analyseBlob } from '@/lib/vision';
import { analyzeImageVisuals, draftMetadata, formatMetadataForClipboard } from '@/lib/stock/metadata';
import { canEmbedFormat, embedMetadata } from '@/lib/stock/xmp';
import { sanitizeFilename } from '@/lib/stock/validate';
import { PLATFORMS } from '@/lib/stock/platforms';
import { generateAiMetadata, loadAiSettings } from '@/lib/stock/ai';
import { generateCsv, generateUniversalCsv } from '@/lib/stock/csv';
import type { PlatformId } from '@/lib/stock/types';

const STORAGE_KEY = 'msap:library';
const ACCEPTED_EXT: Record<string, StockFormat> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  eps: 'eps',
  ai: 'ai',
  svg: 'svg',
  webp: 'webp',
  tif: 'tiff',
  tiff: 'tiff',
  avif: 'avif',
  bmp: 'bmp',
  gif: 'gif',
  ico: 'ico',
};

const MIME_BY_FORMAT: Record<StockFormat, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  eps: 'application/postscript',
  ai: 'application/postscript',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  tiff: 'image/tiff',
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  ico: 'image/x-icon',
};

export function formatOf(filename: string): StockFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ACCEPTED_EXT[ext] ?? null;
}

const makeId = () => `it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

async function probeDimensions(blob: Blob, format: StockFormat): Promise<{ width?: number; height?: number }> {
  if (format === 'eps' || format === 'ai') return {};
  try {
    const bmp = await createImageBitmap(blob);
    const result = { width: bmp.width, height: bmp.height };
    bmp.close();
    return result;
  } catch {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const result = {
          width: img.naturalWidth || undefined,
          height: img.naturalHeight || undefined,
        };
        URL.revokeObjectURL(url);
        resolve(result);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({});
      };
      img.src = url;
    });
  }
}

type PersistedItem = Omit<StockItem, 'thumbUrl' | 'inMemory'>;

const serialize = (items: StockItem[]): PersistedItem[] =>
  items.map(({ thumbUrl: _thumb, inMemory: _mem, ...rest }) => rest);

export interface LibraryState {
  ready: boolean;
  items: StockItem[];
  selected: Set<string>;
  watchingDir: string | null;

  importFiles: (files: FileList | File[]) => Promise<StockItem[]>;
  importFromDialog: () => Promise<number>;
  addGeneratedBlob: (
    name: string,
    blob: Blob,
    extra?: { metadata?: Partial<StockMetadata>; flags?: Partial<ItemFlags> },
  ) => Promise<StockItem | null>;
  removeItems: (ids: string[]) => void;
  clearLibrary: () => void;
  replaceAll: (items: StockItem[]) => void;

  toggleSelect: (id: string) => void;
  selectOnly: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;

  updateMetadata: (id: string, patch: Partial<StockMetadata>) => void;
  updateFlags: (id: string, patch: Partial<ItemFlags>) => void;
  setReleases: (id: string, releaseIds: string[]) => void;
  applyToMany: (
    ids: string[],
    patch: { metadata?: Partial<StockMetadata>; addKeywords?: string[]; flags?: Partial<ItemFlags> },
  ) => void;
  autoDraft: (ids: string[]) => Promise<void>;
  aiDraft: (
    ids: string[],
    onProgress?: (done: number, total: number) => void,
  ) => Promise<{ ok: number; failed: number; embedded: number }>;

  getBlob: (id: string) => Promise<Blob | null>;
  /** Load a preview URL on demand, for rows that scroll into view. */
  ensureThumb: (id: string) => Promise<void>;
  embedInto: (ids: string[], options?: { downloadInBrowser?: boolean; silent?: boolean }) => Promise<{ ok: number; failed: number }>;
  downloadEmbeddedFile: (id: string) => Promise<boolean>;
  copyItemMetadata: (id: string) => Promise<boolean>;
  exportMetadataCsv: (ids: string[], platformId?: PlatformId | 'universal') => Promise<boolean>;
  renameSafe: (ids: string[], platformId?: keyof typeof PLATFORMS) => Promise<number>;

  startWatching: () => Promise<void>;
  stopWatching: () => Promise<void>;
}

const LibraryContext = createContext<LibraryState | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<StockItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [watchingDir, setWatchingDir] = useState<string | null>(null);

  const blobs = useRef<Map<string, Blob>>(new Map());
  const thumbs = useRef<Map<string, string>>(new Map());
  const itemsRef = useRef<StockItem[]>([]);
  itemsRef.current = items;

  const revokeThumb = useCallback((id: string) => {
    const url = thumbs.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      thumbs.current.delete(id);
    }
  }, []);

  const persist = useCallback((next: StockItem[]) => {
    setItems(next);
    void kv.set(STORAGE_KEY, serialize(next));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await kv.get<PersistedItem[]>(STORAGE_KEY, []);
      if (cancelled) return;
      // Only the first screenful is hydrated up front: reading every file in a
      // large library would stall startup and hold hundreds of full-size blobs
      // in memory. The rest load through ensureThumb as they scroll into view.
      const head = saved.slice(0, 60);
      const tail = saved.slice(60);
      const hydratedHead: StockItem[] = await Promise.all(
        head.map(async (item) => {
          if (item.path && desktop.isDesktop && item.format !== 'eps' && item.format !== 'ai') {
            try {
              const bytes = await desktop.fs.readBytes(item.path);
              const copy = new Uint8Array(bytes.byteLength);
              copy.set(bytes);
              const blob = new Blob([copy], { type: MIME_BY_FORMAT[item.format] });
              const url = URL.createObjectURL(blob);
              thumbs.current.set(item.id, url);
              return { ...item, thumbUrl: url };
            } catch {
              return item;
            }
          }
          return item;
        }),
      );
      if (!cancelled) {
        setItems([...hydratedHead, ...tail]);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      for (const url of thumbs.current.values()) URL.revokeObjectURL(url);
      thumbs.current.clear();
    };
  }, []);

  const importDiskEntry = useCallback(
    async (entry: { path: string; name: string; size: number }): Promise<StockItem | null> => {
      const format = formatOf(entry.name);
      if (!format) return null;
      let width: number | undefined;
      let height: number | undefined;
      let thumbUrl: string | undefined;
      const id = makeId();
      if (format !== 'eps' && format !== 'ai') {
        try {
          const bytes = await desktop.fs.readBytes(entry.path);
          const copy = new Uint8Array(bytes.byteLength);
          copy.set(bytes);
          const blob = new Blob([copy], { type: MIME_BY_FORMAT[format] });
          ({ width, height } = await probeDimensions(blob, format));
          thumbUrl = URL.createObjectURL(blob);
          thumbs.current.set(id, thumbUrl);
        } catch {
          /* keep metadata descriptor even if preview fails */
        }
      }
      const now = new Date().toISOString();
      return {
        id,
        name: entry.name,
        format,
        sizeBytes: entry.size,
        width,
        height,
        path: entry.path,
        thumbUrl,
        metadata: { ...EMPTY_METADATA, keywords: [], categories: [] },
        flags: { ...DEFAULT_FLAGS, illustration: format === 'eps' || format === 'ai' || format === 'svg' },
        embeddedAt: null,
        importedAt: now,
        updatedAt: now,
      };
    },
    [],
  );

  useEffect(() => {
    const off = desktop.watch.onFile(async (file) => {
      if (itemsRef.current.some((it) => it.path === file.path)) return;
      const built = await importDiskEntry(file);
      if (!built) return;
      persist([built, ...itemsRef.current]);
      toast.info(`Imported ${built.name}`);
    });
    return off;
  }, [importDiskEntry, persist, toast]);

  const importFiles = useCallback(
    async (list: FileList | File[]): Promise<StockItem[]> => {
      const arr = Array.from(list);
      const added: StockItem[] = [];
      let skipped = 0;
      for (const file of arr) {
        const format = formatOf(file.name);
        if (!format) {
          skipped++;
          continue;
        }
        const nativePath = (file as File & { path?: string }).path;
        const { width, height } = await probeDimensions(file, format);
        const id = makeId();
        const thumbUrl = format === 'eps' || format === 'ai' ? undefined : URL.createObjectURL(file);
        if (thumbUrl) thumbs.current.set(id, thumbUrl);
        const now = new Date().toISOString();
        const item: StockItem = {
          id,
          name: file.name,
          format,
          sizeBytes: file.size,
          width,
          height,
          path: nativePath || undefined,
          thumbUrl,
          inMemory: !nativePath,
          metadata: { ...EMPTY_METADATA, keywords: [], categories: [] },
          flags: { ...DEFAULT_FLAGS, illustration: format === 'eps' || format === 'ai' || format === 'svg' },
          embeddedAt: null,
          importedAt: now,
          updatedAt: now,
        };
        if (!nativePath) blobs.current.set(id, file);
        added.push(item);
      }
      if (added.length) persist([...added, ...itemsRef.current]);
      if (skipped) toast.info(`Skipped ${skipped} unsupported file${skipped === 1 ? '' : 's'}`);
      return added;
    },
    [persist, toast],
  );

  const addGeneratedBlob = useCallback<LibraryState['addGeneratedBlob']>(
    async (name, blob, extra) => {
      const format = formatOf(name);
      if (!format) return null;
      const { width, height } = await probeDimensions(blob, format);
      const id = makeId();
      const thumbUrl = format === 'eps' || format === 'ai' ? undefined : URL.createObjectURL(blob);
      if (thumbUrl) thumbs.current.set(id, thumbUrl);
      const now = new Date().toISOString();
      const item: StockItem = {
        id,
        name,
        format,
        sizeBytes: blob.size,
        width,
        height,
        thumbUrl,
        inMemory: true,
        metadata: {
          ...EMPTY_METADATA,
          ...extra?.metadata,
          keywords: [...(extra?.metadata?.keywords ?? [])],
          categories: [...(extra?.metadata?.categories ?? [])],
        },
        flags: {
          ...DEFAULT_FLAGS,
          illustration: format === 'eps' || format === 'ai' || format === 'svg',
          ...extra?.flags,
        },
        embeddedAt: null,
        importedAt: now,
        updatedAt: now,
      };
      blobs.current.set(id, blob);
      persist([item, ...itemsRef.current]);
      return item;
    },
    [persist],
  );

  const importFromDialog = useCallback(async () => {
    const result = await desktop.fs.pickFiles('Import stock files');
    if (result.canceled || !result.files.length) return 0;
    const built = (await Promise.all(result.files.map(importDiskEntry))).filter(
      (it): it is StockItem => it !== null,
    );
    if (built.length) persist([...built, ...itemsRef.current]);
    return built.length;
  }, [importDiskEntry, persist]);

  const removeItems = useCallback(
    (ids: string[]) => {
      const set = new Set(ids);
      for (const id of set) {
        blobs.current.delete(id);
        revokeThumb(id);
      }
      persist(itemsRef.current.filter((it) => !set.has(it.id)));
      setSelected((prev) => new Set(Array.from(prev).filter((id) => !set.has(id))));
    },
    [persist, revokeThumb],
  );

  const clearLibrary = useCallback(() => {
    blobs.current.clear();
    for (const id of Array.from(thumbs.current.keys())) revokeThumb(id);
    persist([]);
    setSelected(new Set());
  }, [persist, revokeThumb]);

  const replaceAll = useCallback(
    (next: StockItem[]) => {
      persist(next);
      setSelected(new Set());
    },
    [persist],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectOnly = useCallback((ids: string[]) => setSelected(new Set(ids)), []);
  const selectAll = useCallback(() => setSelected(new Set(itemsRef.current.map((it) => it.id))), []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const touch = (it: StockItem, patch: Partial<StockItem>): StockItem => ({
    ...it,
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  const updateMetadata = useCallback(
    (id: string, patch: Partial<StockMetadata>) => {
      persist(
        itemsRef.current.map((it) =>
          it.id === id ? touch(it, { metadata: { ...it.metadata, ...patch } }) : it,
        ),
      );
    },
    [persist],
  );

  const updateFlags = useCallback(
    (id: string, patch: Partial<ItemFlags>) => {
      persist(
        itemsRef.current.map((it) =>
          it.id === id ? touch(it, { flags: { ...it.flags, ...patch } }) : it,
        ),
      );
    },
    [persist],
  );

  const setReleases = useCallback(
    (id: string, releaseIds: string[]) => {
      persist(itemsRef.current.map((it) => (it.id === id ? touch(it, { releaseIds }) : it)));
    },
    [persist],
  );

  const applyToMany = useCallback<LibraryState['applyToMany']>(
    (ids, patch) => {
      const set = new Set(ids);
      persist(
        itemsRef.current.map((it) => {
          if (!set.has(it.id)) return it;
          let keywords = patch.metadata?.keywords ?? it.metadata.keywords;
          if (patch.addKeywords?.length) {
            const seen = new Set(keywords.map((k) => k.toLowerCase()));
            keywords = [...keywords];
            for (const w of patch.addKeywords) {
              const clean = w.trim().toLowerCase();
              if (clean && !seen.has(clean)) {
                seen.add(clean);
                keywords.push(clean);
              }
            }
          }
          return touch(it, {
            metadata: { ...it.metadata, ...patch.metadata, keywords },
            flags: patch.flags ? { ...it.flags, ...patch.flags } : it.flags,
          });
        }),
      );
    },
    [persist],
  );

  const getBlob = useCallback(async (id: string): Promise<Blob | null> => {
    const mem = blobs.current.get(id);
    if (mem) return mem;
    const item = itemsRef.current.find((it) => it.id === id);
    if (item?.path && desktop.isDesktop) {
      try {
        const bytes = await desktop.fs.readBytes(item.path);
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        return new Blob([copy], { type: MIME_BY_FORMAT[item.format] });
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const ensureThumb = useCallback(async (id: string) => {
    if (thumbs.current.has(id)) return;
    const item = itemsRef.current.find((it) => it.id === id);
    if (!item || !item.path || !desktop.isDesktop) return;
    if (item.format === 'eps' || item.format === 'ai') return;
    try {
      const bytes = await desktop.fs.readBytes(item.path);
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const url = URL.createObjectURL(new Blob([copy], { type: MIME_BY_FORMAT[item.format] }));
      if (thumbs.current.has(id)) {
        URL.revokeObjectURL(url);
        return;
      }
      thumbs.current.set(id, url);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, thumbUrl: url } : it)));
    } catch {
      /* a missing file simply keeps the format icon */
    }
  }, []);

  /** Write IPTC and XMP packets directly into in memory blobs or desktop files. */
  const embedSingleItem = useCallback(
    async (item: StockItem, downloadInBrowser: boolean): Promise<{ ok: boolean; newSize?: number; error?: string }> => {
      if (!canEmbedFormat(item.format)) {
        return { ok: false, error: `${item.format.toUpperCase()} does not hold inline IPTC or XMP` };
      }
      try {
        let source: Uint8Array;
        if (item.path && desktop.isDesktop) {
          source = await desktop.fs.readBytes(item.path);
        } else {
          const blob = blobs.current.get(item.id);
          if (!blob) return { ok: false, error: 'Reimport this file to embed metadata' };
          source = new Uint8Array(await blob.arrayBuffer());
        }

        const updated = embedMetadata(source, item.format, item.metadata, {
          aiGenerated: item.flags.aiGenerated,
        });
        const copy = new Uint8Array(updated.byteLength);
        copy.set(updated);
        const outBlob = new Blob([copy], { type: MIME_BY_FORMAT[item.format] });

        if (item.path && desktop.isDesktop) {
          const res = await desktop.fs.writeBytes(item.path, copy);
          if (!res.ok) return { ok: false, error: res.error || 'Disk write failed' };
        } else {
          blobs.current.set(item.id, outBlob);
          if (downloadInBrowser) {
            triggerBlobDownload(outBlob, item.name);
          }
        }
        return { ok: true, newSize: copy.byteLength };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    [],
  );

  const embedInto = useCallback<LibraryState['embedInto']>(
    async (ids, options) => {
      const downloadInBrowser = options?.downloadInBrowser ?? false;
      let ok = 0;
      let failed = 0;
      const stamped = new Map<string, number>();
      let lastError = '';

      for (const id of ids) {
        const item = itemsRef.current.find((it) => it.id === id);
        if (!item) continue;
        const res = await embedSingleItem(item, downloadInBrowser);
        if (res.ok) {
          ok++;
          stamped.set(id, res.newSize ?? item.sizeBytes);
        } else {
          failed++;
          if (res.error) lastError = res.error;
        }
      }

      if (stamped.size) {
        const now = new Date().toISOString();
        persist(
          itemsRef.current.map((it) =>
            stamped.has(it.id)
              ? { ...it, sizeBytes: stamped.get(it.id)!, embeddedAt: now, updatedAt: now }
              : it,
          ),
        );
      }
      if (failed && lastError && !options?.silent) {
        toast.error(`Embedded ${ok}, skipped ${failed}`, lastError);
      }
      return { ok, failed };
    },
    [embedSingleItem, persist, toast],
  );

  const downloadEmbeddedFile = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((it) => it.id === id);
      if (!item) return false;
      const res = await embedSingleItem(item, true);
      if (!res.ok) {
        toast.error('Embed failed', res.error);
        return false;
      }
      const now = new Date().toISOString();
      persist(
        itemsRef.current.map((it) =>
          it.id === id
            ? { ...it, sizeBytes: res.newSize ?? it.sizeBytes, embeddedAt: now, updatedAt: now }
            : it,
        ),
      );
      if (item.path && desktop.isDesktop) {
        toast.success('Metadata saved into file on disk', item.name);
      } else {
        toast.success('Downloaded upload ready file with embedded metadata', item.name);
      }
      return true;
    },
    [embedSingleItem, persist, toast],
  );

  const copyItemMetadata = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((it) => it.id === id);
      if (!item) return false;
      try {
        await navigator.clipboard.writeText(formatMetadataForClipboard(item.metadata));
        toast.success('Metadata copied to clipboard', item.name);
        return true;
      } catch {
        toast.error('Clipboard permission unavailable');
        return false;
      }
    },
    [toast],
  );

  const exportMetadataCsv = useCallback<LibraryState['exportMetadataCsv']>(
    async (ids, platformId = 'universal') => {
      const set = new Set(ids);
      const targets = itemsRef.current.filter((it) => set.has(it.id));
      if (!targets.length) {
        toast.info('Select at least one file first');
        return false;
      }
      try {
        if (platformId === 'universal') {
          const out = generateUniversalCsv(targets);
          await desktop.fs.exportText({
            defaultName: out.filename,
            text: out.content,
            filters: [{ name: 'CSV', extensions: ['csv'] }],
          });
          toast.success(`Saved ${out.filename}`, `${out.rowCount} rows`);
          return true;
        }
        const out = generateCsv(platformId, targets);
        if (out.rowCount === 0) {
          toast.error('No eligible rows for this marketplace', out.skipped[0]?.reason);
          return false;
        }
        await desktop.fs.exportText({
          defaultName: out.filename,
          text: out.content,
          filters: [{ name: 'CSV', extensions: ['csv'] }],
        });
        toast.success(`Saved ${out.filename}`, `${out.rowCount} rows`);
        return true;
      } catch (error) {
        toast.error('CSV export failed', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [toast],
  );

  const autoDraft = useCallback(
    async (ids: string[]) => {
      const ai = await loadAiSettings();
      const set = new Set(ids);
      const targets = itemsRef.current.filter((it) => set.has(it.id));
      const drafted = new Map<string, StockMetadata>();
      for (const item of targets) {
        const blob = await getBlob(item.id);
        // The offline engine reads the pixels. Without this the draft falls back
        // to the filename, which is what made old generations look templated.
        const [visuals, insight] = await Promise.all([analyzeImageVisuals(blob), analyseBlob(blob)]);
        drafted.set(item.id, draftMetadata(item, ai.targetKeywords, visuals, insight));
      }
      persist(
        itemsRef.current.map((it) => {
          const meta = drafted.get(it.id);
          return meta ? touch(it, { metadata: meta }) : it;
        }),
      );
      if (ai.autoEmbed && drafted.size) {
        await embedInto(Array.from(drafted.keys()), { downloadInBrowser: false, silent: true });
      }
    },
    [embedInto, getBlob, persist],
  );

  const aiDraft = useCallback<LibraryState['aiDraft']>(
    async (ids, onProgress) => {
      const settings = await loadAiSettings();
      let ok = 0;
      let failed = 0;
      let embedded = 0;
      let firstError: string | null = null;
      const targets = ids
        .map((id) => itemsRef.current.find((it) => it.id === id))
        .filter((it): it is StockItem => Boolean(it));

      for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        try {
          const imageBlob = await getBlob(item.id);
          const generated = await generateAiMetadata(item, settings, { imageBlob });
          const updatedList = itemsRef.current.map((it) =>
            it.id === item.id ? touch(it, { metadata: generated }) : it,
          );
          persist(updatedList);
          itemsRef.current = updatedList;
          ok++;

          if (settings.autoEmbed && canEmbedFormat(item.format)) {
            const fresh = updatedList.find((it) => it.id === item.id);
            if (fresh) {
              const emb = await embedSingleItem(fresh, false);
              if (emb.ok) {
                embedded++;
                const now = new Date().toISOString();
                const stamped = itemsRef.current.map((it) =>
                  it.id === item.id
                    ? { ...it, sizeBytes: emb.newSize ?? it.sizeBytes, embeddedAt: now, updatedAt: now }
                    : it,
                );
                persist(stamped);
                itemsRef.current = stamped;
              }
            }
          }
        } catch (error) {
          failed++;
          firstError ??= error instanceof Error ? error.message : String(error);
        }
        onProgress?.(i + 1, targets.length);
      }
      if (firstError) {
        toast.error(failed === targets.length ? 'Generation failed' : `${failed} failed`, firstError);
      }
      return { ok, failed, embedded };
    },
    [embedSingleItem, getBlob, persist, toast],
  );

  const renameSafe = useCallback<LibraryState['renameSafe']>(
    async (ids, platformId) => {
      const platform = platformId ? PLATFORMS[platformId] : undefined;
      let count = 0;
      const next: StockItem[] = [];
      for (const it of itemsRef.current) {
        if (!ids.includes(it.id)) {
          next.push(it);
          continue;
        }
        const { name, changed } = sanitizeFilename(it.name, platform);
        if (!changed) {
          next.push(it);
          continue;
        }
        if (it.path && desktop.isDesktop) {
          const slash = Math.max(it.path.lastIndexOf('/'), it.path.lastIndexOf('\\'));
          const to = `${it.path.slice(0, slash + 1)}${name}`;
          const res = await desktop.fs.rename(it.path, to);
          if (!res.ok) {
            next.push(it);
            continue;
          }
          next.push(touch(it, { name, path: to }));
        } else {
          next.push(touch(it, { name }));
        }
        count++;
      }
      if (count) persist(next);
      return count;
    },
    [persist],
  );

  const startWatching = useCallback(async () => {
    const res = await desktop.watch.start();
    if (res.ok && res.dir) {
      setWatchingDir(res.dir);
      toast.success('Watching folder', res.dir);
    } else if (res.error && res.error !== 'canceled') {
      toast.error('Could not watch folder', res.error);
    }
  }, [toast]);

  const stopWatching = useCallback(async () => {
    await desktop.watch.stop();
    setWatchingDir(null);
  }, []);

  const value = useMemo<LibraryState>(
    () => ({
      ready,
      items,
      selected,
      watchingDir,
      importFiles,
      importFromDialog,
      addGeneratedBlob,
      removeItems,
      clearLibrary,
      replaceAll,
      toggleSelect,
      selectOnly,
      selectAll,
      clearSelection,
      updateMetadata,
      updateFlags,
      setReleases,
      applyToMany,
      autoDraft,
      aiDraft,
      getBlob,
      ensureThumb,
      embedInto,
      downloadEmbeddedFile,
      copyItemMetadata,
      exportMetadataCsv,
      renameSafe,
      startWatching,
      stopWatching,
    }),
    [
      ready,
      items,
      selected,
      watchingDir,
      importFiles,
      importFromDialog,
      addGeneratedBlob,
      removeItems,
      clearLibrary,
      replaceAll,
      toggleSelect,
      selectOnly,
      selectAll,
      clearSelection,
      updateMetadata,
      updateFlags,
      setReleases,
      applyToMany,
      autoDraft,
      aiDraft,
      getBlob,
      ensureThumb,
      embedInto,
      downloadEmbeddedFile,
      copyItemMetadata,
      exportMetadataCsv,
      renameSafe,
      startWatching,
      stopWatching,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryState {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}
