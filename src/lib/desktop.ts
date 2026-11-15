/**
 * Typed access to the Electron preload bridge (`window.desktop`).
 *
 * The exact same React code runs in three places:
 *   1. packaged desktop app  -> real bridge (files on disk, native dialogs,
 *                               native Real-ESRGAN binary)
 *   2. `npm run dev`         -> real bridge
 *   3. plain browser preview -> the fallbacks below (localStorage / downloads)
 *
 * That is what makes the UI testable before an installer exists.
 */

export interface AppInfo {
  name: string;
  version: string;
  electron?: string;
  chrome: string;
  node?: string;
  platform: string;
  arch?: string;
  isDev: boolean;
  userDataPath?: string;
  dataDir?: string;
}

export interface KvResult<T> {
  ok: boolean;
  value?: T;
  keys?: string[];
  error?: string;
  canceled?: boolean;
}

export interface ExportPayload {
  defaultName?: string;
  text: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface PickedFile {
  path: string;
  name: string;
  size: number;
}

export interface UpscalerRunArgs {
  inPath?: string;
  inBase64?: string;
  /** Renderer-side source; the preload converts it to base64 for the IPC call. */
  blob?: Blob;
  binary: string;
  modelId: string;
  /** Native 4× passes. */
  passes: number[];
  /** Left over to be applied by the renderer after the passes. */
  tailScale?: number;
  /** NCNN tile size; 0 = auto, lower values reduce VRAM use. */
  tileSize?: number;
  outFormat: 'png' | 'jpg' | 'webp';
  quality: number;
  onLog?: (label: string) => void;
}

export interface UpscalerRunResult {
  ok: boolean;
  blob?: Blob;
  error?: string;
  log?: string;
}

export interface DesktopBridge {
  isDesktop: boolean;
  platform: string;
  app: {
    info: () => Promise<AppInfo>;
    onNavigate: (callback: (path: string) => void) => () => void;
  };
  data: {
    read: <T>(key: string) => Promise<KvResult<T | null>>;
    write: (key: string, value: unknown) => Promise<KvResult<null>>;
    remove: (key: string) => Promise<KvResult<null>>;
    list: () => Promise<KvResult<null>>;
  };
  window: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<boolean>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onMaximizeChanged: (callback: (value: boolean) => void) => () => void;
  };
  view: {
    zoom: (delta: number) => Promise<number>;
    setZoom: (factor: number) => Promise<number>;
    getZoom: () => Promise<number>;
  };
  theme: { set: (theme: 'light' | 'dark' | 'system') => Promise<string> };
  shell: { openExternal: (url: string) => Promise<KvResult<null>> };
  fs: {
    exportText: (payload: ExportPayload) => Promise<KvResult<null> & { filePath?: string }>;
    openJson: () => Promise<KvResult<unknown>>;
    readBytes: (path: string) => Promise<Uint8Array>;
    writeBytes: (path: string, bytes: Uint8Array) => Promise<KvResult<null>>;
    pickFiles: (title?: string) => Promise<{ canceled: boolean; files: PickedFile[] }>;
    rename: (from: string, to: string) => Promise<KvResult<null>>;
  };
  upscaler: {
    ensure: (url: string, binary: string, models: string[]) => Promise<{ ok: boolean; path?: string; models?: string[]; error?: string }>;
    run: (args: UpscalerRunArgs) => Promise<UpscalerRunResult>;
  };
  watch: {
    start: () => Promise<{ ok: boolean; dir?: string; error?: string }>;
    stop: () => Promise<{ ok: boolean }>;
    onFile: (callback: (file: PickedFile) => void) => () => void;
  };
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

/* -------------------------------------------------------------------------- */
/* Browser fallback (used in the live preview and on the web build)            */
/* -------------------------------------------------------------------------- */

const LS_PREFIX = 'msap:data:';

const browserInfo = (): AppInfo => ({
  name: 'Micro Stocker Advanced Pro',
  version: '0.2.0',
  chrome: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? 'unknown',
  platform: 'browser',
  isDev: import.meta.env.DEV,
});

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function downloadText(filename: string, text: string) {
  downloadBlob(filename, new Blob([text], { type: 'text/plain;charset=utf-8' }));
}

function pickJsonFile(): Promise<KvResult<unknown>> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve({ ok: false, canceled: true });
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve({ ok: true, value: JSON.parse(String(reader.result)) });
        } catch (error) {
          resolve({ ok: false, error: String(error) });
        }
      };
      reader.onerror = () => resolve({ ok: false, error: 'Could not read file' });
      reader.readAsText(file);
    };
    input.click();
  });
}

let browserZoom = 1;
function applyBrowserZoom() {
  document.documentElement.style.fontSize = `${browserZoom * 100}%`;
}

const browserBridge: DesktopBridge = {
  isDesktop: false,
  platform: 'browser',
  app: {
    info: async () => browserInfo(),
    onNavigate: () => () => undefined,
  },
  data: {
    read: async <T,>(key: string): Promise<KvResult<T | null>> => {
      try {
        const raw = localStorage.getItem(LS_PREFIX + key);
        return { ok: true, value: raw === null ? null : (JSON.parse(raw) as T) };
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    },
    write: async (key: string, value: unknown) => {
      try {
        localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
        return { ok: true, value: null };
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    },
    remove: async (key: string) => {
      localStorage.removeItem(LS_PREFIX + key);
      return { ok: true, value: null };
    },
    list: async () => ({
      ok: true,
      value: null,
      keys: Object.keys(localStorage)
        .filter((k) => k.startsWith(LS_PREFIX))
        .map((k) => k.slice(LS_PREFIX.length)),
    }),
  },
  window: {
    minimize: async () => undefined,
    toggleMaximize: async () => false,
    close: async () => window.close(),
    isMaximized: async () => false,
    onMaximizeChanged: () => () => undefined,
  },
  view: {
    zoom: async (delta: number) => {
      browserZoom = Math.min(2, Math.max(0.6, browserZoom + delta));
      applyBrowserZoom();
      return browserZoom;
    },
    setZoom: async (factor: number) => {
      browserZoom = Math.min(2, Math.max(0.6, factor));
      applyBrowserZoom();
      return browserZoom;
    },
    getZoom: async () => browserZoom,
  },
  theme: { set: async (theme) => theme },
  shell: {
    openExternal: async (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
      return { ok: true, value: null };
    },
  },
  fs: {
    exportText: async ({ defaultName = 'export.txt', text }) => {
      downloadText(defaultName, text);
      return { ok: true, value: null };
    },
    openJson: pickJsonFile,
    readBytes: async () => {
      throw new Error('Direct disk access requires the desktop build. Import files with the picker instead.');
    },
    writeBytes: async (_path, bytes) => {
      downloadBlob(_path.split(/[\\/]/).pop() ?? 'file.bin', new Blob([bytes as unknown as BlobPart]));
      return { ok: true, value: null };
    },
    pickFiles: async () => ({ canceled: true, files: [] }),
    rename: async () => ({ ok: false, error: 'Renaming on disk requires the desktop build.' }),
  },
  upscaler: {
    ensure: async () => ({ ok: false, error: 'Real-ESRGAN runs in the desktop build only.' }),
    run: async () => ({ ok: false, error: 'Real-ESRGAN runs in the desktop build only. Use the built-in resampler here.' }),
  },
  watch: {
    start: async () => ({ ok: false, error: 'Folder watching runs in the desktop build only.' }),
    stop: async () => ({ ok: true }),
    onFile: () => () => undefined,
  },
};

export const desktop: DesktopBridge = window.desktop ?? browserBridge;
export const isDesktop = desktop.isDesktop;
export const isMac = desktop.platform === 'darwin';
export const isWindows = desktop.platform === 'win32';
export const isLinux = desktop.platform === 'linux';
