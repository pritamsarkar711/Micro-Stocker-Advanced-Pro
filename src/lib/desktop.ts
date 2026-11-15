/**
 * Typed access to the Electron preload bridge (`window.desktop`).
 *
 * The exact same React code runs in three places:
 *   1. packaged desktop app  -> real bridge (files on disk, native dialogs)
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
  version: '0.1.0',
  chrome: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? 'unknown',
  platform: 'browser',
  isDev: import.meta.env.DEV,
});

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
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
  },
};

function applyBrowserZoom() {
  // rem-based layout: scaling the root font size scales the whole UI.
  document.documentElement.style.fontSize = `${browserZoom * 100}%`;
}

export const desktop: DesktopBridge = window.desktop ?? browserBridge;
export const isDesktop = desktop.isDesktop;
export const isMac = desktop.platform === 'darwin';
export const isWindows = desktop.platform === 'win32';
export const isLinux = desktop.platform === 'linux';
