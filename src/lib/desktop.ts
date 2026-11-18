import { APP_NAME, APP_VERSION } from './version';

export interface AppInfo {
  name: string;
  version: string;
  electron?: string;
  chrome: string;
  node?: string;
  platform: 'win32' | 'darwin' | 'linux' | 'web';
  arch?: string;
  isDev: boolean;
  userDataPath?: string;
  dataDir?: string;
}

export interface DataResult<T = unknown> {
  ok: boolean;
  value?: T | null;
  keys?: string[];
  error?: string;
}

export interface ExportTextPayload {
  defaultName?: string;
  text: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface ExportResult {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

export interface OpenJsonResult<T = unknown> {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  value?: T;
  error?: string;
}

export interface PickedFile {
  path: string;
  name: string;
  size: number;
}

export interface NetRequestPayload {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface NetResponse {
  ok: boolean;
  status: number;
  text?: string;
  error?: string;
}

export interface ModelInstallFile {
  url: string;
  name?: string;
  subDir?: string;
  label?: string;
  extractZip?: boolean;
  executable?: string;
  skipIfExists?: boolean;
  checkName?: string;
}

export interface ModelInstallSpec {
  id: string;
  kind: 'image-upscale' | 'video-upscale' | 'bg-remove';
  sharedGroup?: string;
  binary?: string;
  primaryFile?: string;
  approxBytes?: number;
  files: ModelInstallFile[];
}

export interface InstalledModelRecord {
  id: string;
  kind: string;
  dir?: string;
  binary?: string;
  primaryFile?: string;
  sizeBytes: number;
  installedAt: string;
}

export interface ModelProgressEvent {
  id: string;
  phase: 'downloading' | 'extracting' | 'ready';
  fileIndex: number;
  fileCount: number;
  loadedBytes: number;
  totalBytes: number;
  speedBps: number;
  label: string;
}

export interface DesktopBridge {
  isDesktop: boolean;
  platform: AppInfo['platform'];
  app: {
    info: () => Promise<AppInfo>;
    onNavigate: (cb: (path: string) => void) => () => void;
  };
  data: {
    read: <T = unknown>(key: string) => Promise<DataResult<T>>;
    write: (key: string, value: unknown) => Promise<DataResult>;
    remove: (key: string) => Promise<DataResult>;
    list: () => Promise<DataResult>;
  };
  window: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<boolean>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onMaximizeChanged: (cb: (maximized: boolean) => void) => () => void;
  };
  view: {
    zoom: (delta: number) => Promise<number>;
    setZoom: (factor: number) => Promise<number>;
    getZoom: () => Promise<number>;
  };
  theme: {
    set: (theme: 'light' | 'dark' | 'system') => Promise<string>;
  };
  shell: {
    openExternal: (url: string) => Promise<{ ok: boolean; error?: string }>;
  };
  net: {
    request: (payload: NetRequestPayload) => Promise<NetResponse>;
  };
  fs: {
    exportText: (payload: ExportTextPayload) => Promise<ExportResult>;
    openJson: <T = unknown>() => Promise<OpenJsonResult<T>>;
    readBytes: (path: string) => Promise<Uint8Array>;
    writeBytes: (path: string, bytes: Uint8Array) => Promise<{ ok: boolean; error?: string }>;
    pickFiles: (title?: string) => Promise<{ canceled: boolean; files: PickedFile[] }>;
    rename: (from: string, to: string) => Promise<{ ok: boolean; error?: string }>;
  };
  watch: {
    start: () => Promise<{ ok: boolean; dir?: string; error?: string }>;
    stop: () => Promise<{ ok: boolean }>;
    onFile: (cb: (file: PickedFile) => void) => () => void;
  };
  models: {
    list: () => Promise<{ ok: boolean; items: InstalledModelRecord[]; root?: string }>;
    install: (spec: ModelInstallSpec) => Promise<{
      ok: boolean;
      canceled?: boolean;
      record?: InstalledModelRecord;
      error?: string;
    }>;
    cancel: (id: string) => Promise<{ ok: boolean }>;
    remove: (id: string) => Promise<{ ok: boolean }>;
    readBytes: (id: string, fileName?: string) => Promise<Uint8Array>;
    onProgress: (cb: (event: ModelProgressEvent) => void) => () => void;
  };
  upscaler: {
    ensure: (
      url: string,
      binary: string,
      models: string[],
      engineGroup?: string,
    ) => Promise<{ ok: boolean; path?: string; models?: string[]; error?: string }>;
    run: (args: {
      inPath?: string;
      inBase64?: string;
      blob?: Blob;
      binary: string;
      engineGroup?: string;
      engineFamily?: 'realesrgan' | 'realcugan' | 'waifu2x' | 'realsr' | 'srmd';
      modelsSubDir?: string;
      modelId: string;
      noiseLevel?: number;
      passes: Array<2 | 3 | 4>;
      tailScale: number;
      tileSize: number;
      outFormat: 'png' | 'jpg' | 'webp';
      quality: number;
    }) => Promise<{ ok: boolean; blob?: Blob; log?: string; error?: string }>;
  };
  video: {
    probeFfmpeg: () => Promise<{ ok: boolean; available: boolean }>;
  };
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

const LS_PREFIX = 'msap:data:';

const browserFallback: DesktopBridge = {
  isDesktop: false,
  platform: 'web',
  app: {
    info: async () => ({
      name: APP_NAME,
      version: APP_VERSION,
      chrome:
        (typeof navigator !== 'undefined' &&
          navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1]) ||
        'Web',
      platform: 'web',
      isDev: import.meta.env.DEV,
    }),
    onNavigate: () => () => {},
  },
  data: {
    read: async <T,>(key: string): Promise<DataResult<T>> => {
      try {
        const raw = localStorage.getItem(LS_PREFIX + key);
        return { ok: true, value: raw === null ? null : (JSON.parse(raw) as T) };
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    },
    write: async (key, value) => {
      try {
        localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
        return { ok: true };
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    },
    remove: async (key) => {
      try {
        localStorage.removeItem(LS_PREFIX + key);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    },
    list: async () => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LS_PREFIX)) keys.push(k.slice(LS_PREFIX.length));
      }
      return { ok: true, keys };
    },
  },
  window: {
    minimize: async () => {},
    toggleMaximize: async () => false,
    close: async () => {},
    isMaximized: async () => false,
    onMaximizeChanged: () => () => {},
  },
  view: {
    zoom: async (delta) => {
      const current = Number(document.documentElement.dataset.zoom || '1');
      const next = Math.min(2, Math.max(0.75, +(current + delta).toFixed(2)));
      document.documentElement.dataset.zoom = String(next);
      document.documentElement.style.fontSize = `${next * 100}%`;
      return next;
    },
    setZoom: async (factor) => {
      const next = Math.min(2, Math.max(0.75, +factor.toFixed(2)));
      document.documentElement.dataset.zoom = String(next);
      document.documentElement.style.fontSize = `${next * 100}%`;
      return next;
    },
    getZoom: async () => Number(document.documentElement.dataset.zoom || '1'),
  },
  theme: {
    set: async (theme) => theme,
  },
  shell: {
    openExternal: async (url) => {
      // Only real web links leave the app: a javascript: or data: URL typed
      // into a field must never become a navigation.
      if (!/^https?:\/\//i.test(String(url))) return { ok: false, error: 'Only http(s) links may be opened' };
      window.open(url, '_blank', 'noopener,noreferrer');
      return { ok: true };
    },
  },
  net: {
    request: async ({ url, method = 'GET', headers, body, timeoutMs = 60000 }) => {
      if (!/^https?:\/\//i.test(String(url))) {
        return { ok: false, status: 0, error: 'Only HTTP(S) requests are allowed' };
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { method, headers, body, signal: controller.signal });
        const text = await res.text();
        return { ok: res.ok, status: res.status, text };
      } catch (error) {
        return {
          ok: false,
          status: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  },
  fs: {
    exportText: async ({ defaultName = 'export.txt', text }) => {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 2000);
      return { ok: true, filePath: defaultName };
    },
    openJson: <T,>() =>
      new Promise<OpenJsonResult<T>>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            resolve({ ok: false, canceled: true });
            return;
          }
          try {
            const value = JSON.parse(await file.text()) as T;
            resolve({ ok: true, filePath: file.name, value });
          } catch (error) {
            resolve({ ok: false, error: String(error) });
          }
        };
        input.click();
      }),
    readBytes: async () => {
      throw new Error('Raw disk reads require the desktop app');
    },
    writeBytes: async () => ({ ok: false, error: 'In place writes require the desktop app' }),
    pickFiles: async () => ({ canceled: true, files: [] }),
    rename: async () => ({ ok: false, error: 'File renaming requires the desktop app' }),
  },
  watch: {
    start: async () => ({ ok: false, error: 'Folder watch is available in the desktop app' }),
    stop: async () => ({ ok: true }),
    onFile: () => () => {},
  },
  models: {
    list: async () => ({ ok: true, items: [] }),
    install: async () => ({ ok: false, error: 'Native runtime requires the desktop app' }),
    cancel: async () => ({ ok: true }),
    remove: async () => ({ ok: true }),
    readBytes: async () => {
      throw new Error('Model not installed');
    },
    onProgress: () => () => {},
  },
  upscaler: {
    ensure: async () => ({ ok: false, error: 'GPU runtime is available in the desktop app' }),
    run: async () => ({ ok: false, error: 'GPU runtime is available in the desktop app' }),
  },
  video: {
    probeFfmpeg: async () => ({ ok: true, available: false }),
  },
};

export const desktop: DesktopBridge =
  typeof window !== 'undefined' && window.desktop ? window.desktop : browserFallback;

/** Platform independent HTTP helper that avoids browser CORS inside Electron. */
export async function httpRequest(payload: NetRequestPayload): Promise<NetResponse> {
  if (typeof window !== 'undefined' && window.desktop?.net?.request) {
    return window.desktop.net.request(payload);
  }
  return browserFallback.net.request(payload);
}

/** Save any binary blob cleanly and release its object URL after download. */
export function triggerBlobDownload(blob: Blob, filename: string) {
  // On the phone there is no download folder to write to from a WebView, so the
  // same call writes through the Filesystem plugin and opens the share sheet.
  if ((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) {
    void import('@/lib/native/fileExport')
      .then((module) => module.saveBlobNative(blob, filename))
      .catch((error: unknown) => console.warn('could not save the file', error));
    return;
  }
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2500);
}
