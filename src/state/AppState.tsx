import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { desktop } from '@/lib/desktop';
import { kv, STORAGE_KEYS } from '@/lib/kv';
import { APP_VERSION } from '@/lib/version';
import type { CurrencyCode } from '@/lib/format';

export type ThemeSetting = 'light' | 'dark' | 'system';
export type AccentSetting = 'pink';

export interface Settings {
  theme: ThemeSetting;
  accent: AccentSetting;
  density: 'comfortable' | 'compact';
  currency: CurrencyCode;
  sidebarCollapsed: boolean;
  reduceMotion: boolean;
  /** Ask before an asset leaves the library. */
  confirmRemove: boolean;
  /** Format the Image Optimizer starts on. */
  optimizeFormat: 'keep' | 'jpg' | 'webp' | 'avif' | 'png';
  /** Format the Image Upscaler writes. */
  upscaleFormat: 'jpg' | 'png' | 'webp';
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  accent: 'pink',
  density: 'comfortable',
  currency: 'BDT',
  sidebarCollapsed: false,
  reduceMotion: false,
  confirmRemove: true,
  optimizeFormat: 'keep',
  upscaleFormat: 'webp',
};

interface AppState {
  ready: boolean;
  settings: Settings;
  isDark: boolean;
  setThemeInstant: (theme: ThemeSetting) => void;
  setAccentInstant: (accent: AccentSetting) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;

  zoom: number;
  setZoom: (factor: number) => void;
  nudgeZoom: (delta: number) => void;

  runtime: {
    platform: string;
    isDesktop: boolean;
    version: string;
    electron?: string;
    chrome: string;
    node?: string;
    arch?: string;
    isDev: boolean;
    userDataPath?: string;
  };
}

const AppContext = createContext<AppState | null>(null);

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function resolveDark(theme: ThemeSetting): boolean {
  return theme === 'dark' || (theme === 'system' && systemPrefersDark());
}

/** Accept legacy accent names so existing installations keep their choice. */
/** The product ships one brand colour; legacy stored values all map to it. */
export function normalizeAccent(_value?: unknown): AccentSetting {
  return 'pink';
}

/**
 * Synchronously switch light and dark paint in a single frame with CSS
 * transitions temporarily paused so every surface updates immediately.
 */
function paintThemeDom(dark: boolean, accent: AccentSetting, theme: ThemeSetting) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('theme-switching');
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  void accent;
  const color = dark ? '#121619' : '#f4f6f9';
  document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.setAttribute('content', color));
  // Flush style recalculation before restoring control transitions.
  void root.offsetHeight;
  requestAnimationFrame(() => {
    root.classList.remove('theme-switching');
  });
  void desktop.theme.set(theme);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('msap:data:msap:settings') || localStorage.getItem('msap:data:settings')
          : null;
      const parsed = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        accent: normalizeAccent(parsed.accent),
        theme: parsed.theme ?? (systemPrefersDark() ? 'dark' : 'light'),
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [osDark, setOsDark] = useState<boolean>(() => systemPrefersDark());
  const [zoom, setZoomState] = useState(1);
  const [runtime, setRuntime] = useState<AppState['runtime']>({
    platform: desktop.platform,
    isDesktop: desktop.isDesktop,
    version: APP_VERSION,
    chrome: 'Unknown',
    isDev: import.meta.env.DEV,
  });

  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && osDark);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [storedSettings, info, storedZoom] = await Promise.all([
        kv.get<Partial<Settings>>(STORAGE_KEYS.settings, {}),
        desktop.app.info(),
        desktop.view.getZoom().catch(() => 1),
      ]);
      if (cancelled) return;

      const mergedSettings: Settings = {
        ...DEFAULT_SETTINGS,
        ...storedSettings,
        accent: normalizeAccent(storedSettings.accent),
        theme: storedSettings.theme ?? (systemPrefersDark() ? 'dark' : 'light'),
      };
      setSettings(mergedSettings);
      paintThemeDom(resolveDark(mergedSettings.theme), mergedSettings.accent, mergedSettings.theme);
      setZoomState(storedZoom || 1);
      setRuntime({
        platform: info.platform,
        isDesktop: desktop.isDesktop,
        version: info.version,
        electron: info.electron,
        chrome: info.chrome,
        node: info.node,
        arch: info.arch,
        isDev: info.isDev,
        userDataPath: info.userDataPath,
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.density = settings.density;
    root.classList.toggle('reduce-motion', settings.reduceMotion);
  }, [settings.density, settings.reduceMotion]);

  useEffect(() => {
    if (settings.theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      setOsDark(mql.matches);
      paintThemeDom(mql.matches, settings.accent, 'system');
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [settings.theme, settings.accent]);

  const setThemeInstant = useCallback((theme: ThemeSetting) => {
    setSettings((prev) => {
      const next = { ...prev, theme };
      paintThemeDom(resolveDark(theme), next.accent, theme);
      void kv.set(STORAGE_KEYS.settings, next);
      return next;
    });
  }, []);

  const setAccentInstant = useCallback((accent: AccentSetting) => {
    setSettings((prev) => {
      const next = { ...prev, accent };
      paintThemeDom(resolveDark(next.theme), accent, next.theme);
      void kv.set(STORAGE_KEYS.settings, next);
      return next;
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (patch.theme !== undefined || patch.accent !== undefined) {
        paintThemeDom(resolveDark(next.theme), next.accent, next.theme);
      }
      void kv.set(STORAGE_KEYS.settings, next);
      return next;
    });
  }, []);

  const setZoom = useCallback((factor: number) => {
    void desktop.view.setZoom(factor).then((actual) => setZoomState(actual));
  }, []);

  const nudgeZoom = useCallback((delta: number) => {
    void desktop.view.zoom(delta).then((actual) => setZoomState(actual));
  }, []);

  const resetSettings = useCallback(() => {
    const fresh: Settings = {
      ...DEFAULT_SETTINGS,
      theme: systemPrefersDark() ? 'dark' : 'light',
    };
    paintThemeDom(resolveDark(fresh.theme), fresh.accent, fresh.theme);
    setSettings(fresh);
    void kv.set(STORAGE_KEYS.settings, fresh);
    setZoom(1);
  }, [setZoom]);

  const value = useMemo<AppState>(
    () => ({
      ready,
      settings,
      isDark,
      setThemeInstant,
      setAccentInstant,
      updateSettings,
      resetSettings,
      zoom,
      setZoom,
      nudgeZoom,
      runtime,
    }),
    [
      ready,
      settings,
      isDark,
      setThemeInstant,
      setAccentInstant,
      updateSettings,
      resetSettings,
      zoom,
      setZoom,
      nudgeZoom,
      runtime,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
