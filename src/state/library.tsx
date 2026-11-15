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
import { desktop, isDesktop } from '@/lib/desktop';
import { kv } from '@/lib/kv';
import {
  DEFAULT_FLAGS,
  EMPTY_METADATA,
  type ItemFlags,
  type StockItem,
  type StockMetadata,
} from '@/lib/stock/types';
import { detectFormat, probeRasterDimensions, probeVectorDimensions } from '@/lib/stock/files';
import { embedMetadata, readEmbeddedMetadata } from '@/lib/stock/xmp';
import { adaptForPlatform, generateMetadata, type GenerateOptions } from '@/lib/stock/metadata';
import {
  EMPTY_AI_SETTINGS,
  generateWithProvider,
  getProvider,
  isAiReady,
  type AiSettings,
} from '@/lib/stock/ai';
import { DEFAULT_BANK, type KeywordBank } from '@/state/bank';
import { planApply, type ApplyResult, type MetadataRow } from '@/lib/stock/csvimport';
import { PLATFORMS } from '@/lib/stock/platforms';
import { useToast } from '@/state/ToastState';

const LIBRARY_KEY = 'msap:library';
const AI_CONFIG_KEY = 'msap:ai-config';

export const EMPTY_AI_CONFIG = EMPTY_AI_SETTINGS;

interface LibraryState {
  ready: boolean;
  items: StockItem[];
  selection: Set<string>;
  aiConfig: AiSettings;
  aiReady: boolean;
  setAiConfig: (config: AiSettings) => Promise<void>;

  importBrowserFiles: (files: File[]) => Promise<number>;
  importDesktopFiles: () => Promise<number>;
  addUpscaled: (name: string, blob: Blob, width: number, height: number) => Promise<StockItem>;

  getItemBytes: (id: string) => Promise<Uint8Array>;
  getItemBlob: (id: string) => Promise<Blob>;
  hasSource: (id: string) => boolean;

  setMetadata: (id: string, patch: Partial<StockMetadata>) => void;
  setFlags: (id: string, patch: Partial<ItemFlags>) => void;
  setReleaseIds: (id: string, releaseIds: string[]) => void;
  /** Apply rows from an imported metadata CSV, matched by filename. */
  applyMetadataRows: (rows: MetadataRow[]) => ApplyResult;
  renameItem: (id: string, name: string) => Promise<boolean>;
  removeItems: (ids: string[]) => void;
  replaceAll: (items: StockItem[]) => void;

  toggleSelect: (id: string) => void;
  setSelection: (ids: string[]) => void;

  generateFor: (
    ids: string[],
    options: GenerateOptions,
  ) => Promise<{ done: number; aiUsed: number; providerLabel: string; error: string | null }>;
  embedFor: (ids: string[], options: { backup: boolean }) => Promise<{ done: number; failed: string[] }>;
  replaceBytes: (id: string, bytes: Uint8Array, options?: { backup?: boolean }) => Promise<boolean>;

  watching: string | null;
  startWatch: () => Promise<void>;
  stopWatch: () => Promise<void>;
}

const LibraryContext = createContext<LibraryState | null>(null);

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<StockItem[]>([]);
  const [selection, setSelectionState] = useState<Set<string>>(new Set());
  const [aiConfig, setAiConfigState] = useState<AiSettings>(EMPTY_AI_CONFIG);
  const [watching, setWatching] = useState<string | null>(null);
  const sources = useRef(new Map<string, Uint8Array | File>());
  const toast = useToast();

  /* ---- restore descriptors (bytes are re-read on demand) ---- */
  useEffect(() => {
    (async () => {
      const [stored, storedAi] = await Promise.all([
        kv.get<Omit<StockItem, 'thumbUrl'>[]>(LIBRARY_KEY, []),
        kv.get<AiSettings>(AI_CONFIG_KEY, EMPTY_AI_CONFIG),
      ]);
      setItems(
        stored.map((item) => ({
          ...item,
          metadata: { ...EMPTY_METADATA, ...item.metadata },
          flags: { ...DEFAULT_FLAGS, ...item.flags },
          thumbUrl: undefined,
          inMemory: false,
        })),
      );
      setAiConfigState(storedAi);
      setReady(true);
    })();
  }, []);

  const persist = useCallback((next: StockItem[]) => {
    void kv.set(
      LIBRARY_KEY,
      next.map(({ thumbUrl: _thumb, ...rest }) => rest),
    );
  }, []);

  const mutate = useCallback(
    (updater: (prev: StockItem[]) => StockItem[]) => {
      setItems((prev) => {
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  /* ------------------------------ import ------------------------------ */

  const buildItem = useCallback(
    async (name: string, size: number, bytes: Uint8Array | null, sourceKey?: string): Promise<StockItem> => {
      const format = detectFormat(name) ?? 'jpg';
      let width: number | undefined;
      let height: number | undefined;
      let metadata = { ...EMPTY_METADATA };

      if (format === 'svg' || format === 'eps' || format === 'ai') {
        if (bytes) {
          const text = new TextDecoder().decode(bytes.subarray(0, 200_000));
          const dims = probeVectorDimensions(text, format === 'svg' ? 'svg' : 'eps');
          width = dims.width;
          height = dims.height;
          const embedded = readEmbeddedMetadata(bytes, format);
          if (embedded) metadata = { ...metadata, ...embedded, keywords: embedded.keywords ?? [], categories: embedded.categories ?? [] };
        }
      } else if (bytes) {
        const blob = new Blob([bytes as unknown as BlobPart]);
        const dims = await probeRasterDimensions(blob);
        width = dims.width;
        height = dims.height;
        const embedded = readEmbeddedMetadata(bytes, format);
        if (embedded) metadata = { ...metadata, ...embedded, keywords: embedded.keywords ?? [], categories: embedded.categories ?? [] };
      }

      const now = new Date().toISOString();
      const item: StockItem = {
        id: newId(),
        name,
        format,
        sizeBytes: size,
        width,
        height,
        metadata,
        flags: { ...DEFAULT_FLAGS },
        embeddedAt: metadata.title || metadata.keywords.length ? now : null,
        importedAt: now,
        updatedAt: now,
        inMemory: Boolean(sourceKey),
      };
      if (sourceKey && bytes) sources.current.set(sourceKey, bytes);
      return item;
    },
    [],
  );

  const importBrowserFiles = useCallback(
    async (files: File[]) => {
      const created: StockItem[] = [];
      for (const file of files) {
        if (!detectFormat(file.name)) continue;
        const bytes = new Uint8Array(await file.arrayBuffer());
        const item = await buildItem(file.name, file.size, bytes);
        const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart]));
        item.thumbUrl = url;
        sources.current.set(item.id, bytes);
        created.push(item);
      }
      if (created.length) {
        mutate((prev) => [...created, ...prev]);
        toast.success(`Imported ${created.length} file${created.length === 1 ? '' : 's'}`, 'Existing embedded metadata was read automatically.');
      }
      return created.length;
    },
    [buildItem, mutate, toast],
  );

  const importDesktopFiles = useCallback(async () => {
    const picked = await desktop.fs.pickFiles();
    if (picked.canceled || picked.files.length === 0) return 0;
    const created: StockItem[] = [];
    for (const file of picked.files) {
      if (!detectFormat(file.name)) continue;
      let bytes: Uint8Array | null = null;
      try {
        bytes = await desktop.fs.readBytes(file.path);
      } catch {
        bytes = null;
      }
      const item = await buildItem(file.name, file.size, bytes);
      item.path = file.path;
      if (bytes && ['jpg', 'png', 'webp', 'svg'].includes(item.format)) {
        item.thumbUrl = URL.createObjectURL(new Blob([bytes as unknown as BlobPart]));
      }
      created.push(item);
    }
    if (created.length) {
      mutate((prev) => [...created, ...prev]);
      toast.success(`Imported ${created.length} file${created.length === 1 ? '' : 's'}`, 'Existing embedded metadata was read automatically.');
    }
    return created.length;
  }, [buildItem, mutate, toast]);

  const addUpscaled = useCallback(
    async (name: string, blob: Blob, width: number, height: number) => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const now = new Date().toISOString();
      const item: StockItem = {
        id: newId(),
        name,
        format: detectFormat(name) ?? 'png',
        sizeBytes: bytes.length,
        width,
        height,
        path: undefined,
        thumbUrl: URL.createObjectURL(blob),
        inMemory: true,
        metadata: { ...EMPTY_METADATA },
        flags: { ...DEFAULT_FLAGS },
        embeddedAt: null,
        importedAt: now,
        updatedAt: now,
      };
      sources.current.set(item.id, bytes);
      mutate((prev) => [item, ...prev]);
      return item;
    },
    [mutate],
  );

  /* ------------------------------ sources ------------------------------ */

  const getItemBytes = useCallback(async (id: string): Promise<Uint8Array> => {
    const held = sources.current.get(id);
    if (held instanceof Uint8Array) return held;
    if (held instanceof File) return new Uint8Array(await held.arrayBuffer());
    const item = items.find((i) => i.id === id);
    if (item?.path) return desktop.fs.readBytes(item.path);
    throw new Error('File bytes are no longer in this session — re-import the file.');
  }, [items]);

  const getItemBlob = useCallback(
    async (id: string) => new Blob([await getItemBytes(id) as unknown as BlobPart]),
    [getItemBytes],
  );

  const hasSource = useCallback(
    (id: string) => sources.current.has(id) || Boolean(items.find((i) => i.id === id)?.path),
    [items],
  );

  /* ------------------------------ edits ------------------------------ */

  const setMetadata = useCallback(
    (id: string, patch: Partial<StockMetadata>) => {
      mutate((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, metadata: { ...item.metadata, ...patch }, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
    },
    [mutate],
  );

  const setFlags = useCallback(
    (id: string, patch: Partial<ItemFlags>) => {
      mutate((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, flags: { ...item.flags, ...patch }, updatedAt: new Date().toISOString() } : item,
        ),
      );
    },
    [mutate],
  );

  const setReleaseIds = useCallback(
    (id: string, releaseIds: string[]) => {
      mutate((prev) => prev.map((item) => (item.id === id ? { ...item, releaseIds, updatedAt: new Date().toISOString() } : item)));
    },
    [mutate],
  );

  const applyMetadataRows = useCallback(
    (rows: MetadataRow[]): ApplyResult => {
      const plan = planApply(items, rows);
      const stamp = new Date().toISOString();
      const patches = new Map<string, StockItem>();
      const missing: string[] = [];

      for (const row of rows) {
        const item = plan.get(row);
        if (!item) {
          if (missing.length < 10) missing.push(row.filename);
          continue;
        }
        const current = patches.get(item.id) ?? item;
        const metadata: StockMetadata = { ...current.metadata };
        if (row.title) metadata.title = row.title;
        if (row.description) metadata.description = row.description;
        if (row.keywords?.length) {
          metadata.keywords = Array.from(new Set([...metadata.keywords, ...row.keywords])).slice(0, 50);
        }
        if (row.categories?.length) {
          metadata.categories = Array.from(new Set([...metadata.categories, ...row.categories])).slice(0, 2);
        }
        const flags: ItemFlags = { ...current.flags };
        if (row.editorial !== undefined) flags.editorial = row.editorial;
        if (row.mature !== undefined) flags.mature = row.mature;
        if (row.illustration !== undefined) flags.illustration = row.illustration;
        if (row.aiGenerated) flags.aiGenerated = true;
        patches.set(item.id, { ...current, metadata, flags, updatedAt: stamp });
      }

      if (patches.size > 0) {
        mutate((prev) => prev.map((item) => patches.get(item.id) ?? item));
      }
      return { matched: patches.size, updated: plan.size, missing };
    },
    [items, mutate],
  );

  const renameItem = useCallback(
    async (id: string, name: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return false;
      if (item.path && isDesktop) {
        const sep = Math.max(item.path.lastIndexOf('\\'), item.path.lastIndexOf('/'));
        const dir = item.path.slice(0, sep + 1);
        const result = await desktop.fs.rename(item.path, dir + name);
        if (!result.ok) {
          toast.error('Rename failed', result.error);
          return false;
        }
      }
      mutate((prev) =>
        prev.map((i) => {
          if (i.id !== id) return i;
          if (!i.path) return { ...i, name };
          const sep = Math.max(i.path.lastIndexOf('\\'), i.path.lastIndexOf('/'));
          return { ...i, name, path: i.path.slice(0, sep + 1) + name };
        }),
      );
      return true;
    },
    [items, mutate, toast],
  );

  const removeItems = useCallback(
    (ids: string[]) => {
      for (const id of ids) {
        const item = items.find((i) => i.id === id);
        if (item?.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
        sources.current.delete(id);
      }
      mutate((prev) => prev.filter((i) => !ids.includes(i.id)));
      setSelectionState((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    },
    [items, mutate],
  );

  const replaceAll = useCallback(
    (items: StockItem[]) => {
      mutate(() => items);
    },
    [mutate],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectionState((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setSelection = useCallback((ids: string[]) => setSelectionState(new Set(ids)), []);

  /* --------------------- replace bytes (Prepare) --------------------- */

  const replaceBytes = useCallback(
    async (id: string, bytes: Uint8Array, options: { backup?: boolean } = {}) => {
      const item = items.find((i) => i.id === id);
      if (!item) return false;
      const raster = ['jpg', 'png', 'webp'].includes(item.format);
      if (isDesktop && item.path) {
        if (options.backup !== false) {
          const old = await getItemBytes(id).catch(() => null);
          if (old) await desktop.fs.writeBytes(`${item.path}.msap-backup`, old).catch(() => undefined);
        }
        const write = await desktop.fs.writeBytes(item.path, bytes);
        if (!write.ok) {
          toast.error('Could not write file', write.error);
          return false;
        }
      }
      sources.current.set(id, bytes);
      if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
      const dims = raster ? await probeRasterDimensions(new Blob([bytes as unknown as BlobPart])) : {};
      mutate((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                sizeBytes: bytes.length,
                width: dims.width ?? i.width,
                height: dims.height ?? i.height,
                thumbUrl: raster || i.format === 'svg' ? URL.createObjectURL(new Blob([bytes as unknown as BlobPart])) : i.thumbUrl,
                updatedAt: new Date().toISOString(),
              }
            : i,
        ),
      );
      return true;
    },
    [getItemBytes, items, mutate, toast],
  );

  /* ------------------------- watch folder (desktop) ------------------------- */

  const importDesktopPath = useCallback(
    async (path: string, name: string, size: number) => {
      if (!detectFormat(name)) return;
      const bytes = await desktop.fs.readBytes(path).catch(() => null);
      const item = await buildItem(name, size, bytes);
      item.path = path;
      if (bytes && ['jpg', 'png', 'webp', 'svg'].includes(item.format)) {
        item.thumbUrl = URL.createObjectURL(new Blob([bytes as unknown as BlobPart]));
      }
      mutate((prev) => (prev.some((p) => p.path === path) ? prev : [item, ...prev]));
    },
    [buildItem, mutate],
  );

  const startWatch = useCallback(async () => {
    const result = await desktop.watch.start();
    if (result.ok && result.dir) {
      setWatching(result.dir);
      toast.info('Watching folder', `New stock files in ${result.dir} are imported automatically.`);
    } else if (result.error !== 'canceled') {
      toast.error('Watch failed', result.error);
    }
  }, [toast]);

  const stopWatch = useCallback(async () => {
    await desktop.watch.stop();
    setWatching(null);
    toast.info('Folder watch stopped');
  }, [toast]);

  useEffect(() => desktop.watch.onFile((file) => void importDesktopPath(file.path, file.name, file.size)), [importDesktopPath]);

  /* --------------------------- generate / embed --------------------------- */

  const setAiConfig = useCallback(async (config: AiSettings) => {
    setAiConfigState(config);
    await kv.set(AI_CONFIG_KEY, config);
  }, []);

  const generateFor = useCallback(
    async (ids: string[], options: GenerateOptions) => {
      let aiUsed = 0;
      const useAi = isAiReady(aiConfig);
      const providerLabel = getProvider(aiConfig.provider).label;
      let lastError: string | null = null;
      const storedBank = await kv.get<Partial<KeywordBank>>('msap:keyword-bank', {});
      const bank = {
        synonyms: { ...DEFAULT_BANK.synonyms, ...storedBank.synonyms },
        categories: { ...DEFAULT_BANK.categories, ...storedBank.categories },
      };
      for (const id of ids) {
        const item = items.find((i) => i.id === id);
        if (!item) continue;
        let metadata: StockMetadata;
        if (useAi) {
          try {
            metadata = await generateWithProvider({ item, settings: aiConfig });
            aiUsed++;
          } catch (error) {
            // Never lose the batch: fall back to the offline generator and
            // surface exactly why the AI call failed.
            lastError = error instanceof Error ? error.message : String(error);
            metadata = generateMetadata(item, options, bank);
          }
        } else {
          metadata = generateMetadata(item, options, bank);
        }
        setMetadata(id, metadata);
      }
      return { done: ids.length, aiUsed, providerLabel, error: lastError };
    },
    [aiConfig, items, setMetadata],
  );

  const embedFor = useCallback(
    async (ids: string[], options: { backup: boolean }) => {
      const failed: string[] = [];
      let done = 0;
      for (const id of ids) {
        const item = items.find((i) => i.id === id);
        if (!item) continue;
        try {
          const bytes = await getItemBytes(id);
          const result = embedMetadata(bytes, item.format, item.metadata);
          if (!result.ok || (!result.bytes && !result.text)) {
            failed.push(`${item.name}: ${result.message}`);
            continue;
          }
          const outBytes = result.bytes ?? new TextEncoder().encode(result.text!);
          if (isDesktop && item.path) {
            if (options.backup) {
              await desktop.fs.writeBytes(`${item.path}.msap-backup`, bytes).catch(() => undefined);
            }
            const write = await desktop.fs.writeBytes(item.path, outBytes);
            if (!write.ok) {
              failed.push(`${item.name}: ${write.error}`);
              continue;
            }
          } else {
            sources.current.set(id, outBytes);
            if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
          }
          mutate((prev) =>
            prev.map((i) =>
              i.id === id
                ? {
                    ...i,
                    sizeBytes: outBytes.length,
                    embeddedAt: new Date().toISOString(),
                    thumbUrl: isDesktop && i.path ? i.thumbUrl : URL.createObjectURL(new Blob([outBytes as unknown as BlobPart])),
                  }
                : i,
            ),
          );
          done++;
        } catch (error) {
          failed.push(`${item.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      return { done, failed };
    },
    [getItemBytes, items, mutate],
  );

  const value = useMemo<LibraryState>(
    () => ({
      ready,
      items,
      selection,
      aiConfig,
      aiReady: isAiReady(aiConfig),
      setAiConfig,
      importBrowserFiles,
      importDesktopFiles,
      addUpscaled,
      getItemBytes,
      getItemBlob,
      hasSource,
      setMetadata,
      setFlags,
      setReleaseIds,
      applyMetadataRows,
      renameItem,
      removeItems,
      replaceAll,
      toggleSelect,
      setSelection,
      generateFor,
      embedFor,
      replaceBytes,
      watching,
      startWatch,
      stopWatch,
    }),
    [
      ready,
      items,
      selection,
      aiConfig,
      setAiConfig,
      importBrowserFiles,
      importDesktopFiles,
      addUpscaled,
      getItemBytes,
      getItemBlob,
      hasSource,
      setMetadata,
      setFlags,
      setReleaseIds,
      applyMetadataRows,
      renameItem,
      removeItems,
      replaceAll,
      toggleSelect,
      setSelection,
      generateFor,
      embedFor,
      replaceBytes,
      watching,
      startWatch,
      stopWatch,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

/** Convenience: platform-adapted copy of an item's metadata. */
export function adaptedMetadata(item: StockItem, platformId: keyof typeof PLATFORMS) {
  return adaptForPlatform(item.metadata, PLATFORMS[platformId]);
}

export function useLibrary(): LibraryState {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return ctx;
}
