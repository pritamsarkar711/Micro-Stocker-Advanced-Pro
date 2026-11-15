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
import type { CurrencyCode } from '@/lib/format';
import {
  EMPTY_CLOUD_CONFIG,
  isConfigured,
  mergeEnvConfig,
  testCloudConnection,
  type CloudConfig,
  type ConnectionReport,
} from '@/lib/cloud/config';

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  density: 'comfortable' | 'compact';
  currency: CurrencyCode;
  sidebarCollapsed: boolean;
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  density: 'comfortable',
  currency: 'BDT',
  sidebarCollapsed: false,
  reduceMotion: false,
};

/* -------------------------------------------------------------------------- */
/* Context value                                                               */
/* -------------------------------------------------------------------------- */

interface AppState {
  ready: boolean;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;

  cloud: CloudConfig;
  saveCloud: (config: CloudConfig) => Promise<boolean>;
  clearCloud: () => Promise<void>;
  connection: ConnectionReport;
  recheckConnection: () => Promise<void>;

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

const INITIAL_REPORT: ConnectionReport = {
  state: 'local',
  message: 'Checking…',
  latencyMs: null,
  checkedAt: null,
};

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [cloud, setCloud] = useState<CloudConfig>(EMPTY_CLOUD_CONFIG);
  const [connection, setConnection] = useState<ConnectionReport>(INITIAL_REPORT);
  const [zoom, setZoomState] = useState(1);
  const [runtime, setRuntime] = useState<AppState['runtime']>({
    platform: desktop.platform,
    isDesktop: desktop.isDesktop,
    version: '0.1.0',
    chrome: '—',
    isDev: import.meta.env.DEV,
  });

  /* ---- load persisted state ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [storedSettings, storedCloud, info, storedZoom] = await Promise.all([
        kv.get<Partial<Settings>>(STORAGE_KEYS.settings, {}),
        kv.get<CloudConfig>(STORAGE_KEYS.cloud, EMPTY_CLOUD_CONFIG),
        desktop.app.info(),
        desktop.view.getZoom().catch(() => 1),
      ]);
      if (cancelled) return;

      const mergedSettings: Settings = { ...DEFAULT_SETTINGS, ...storedSettings };
      // Respect the OS preference until the user explicitly chooses one.
      if (!storedSettings.theme) {
        mergedSettings.theme = systemPrefersDark() ? 'dark' : 'light';
      }

      const mergedCloud = mergeEnvConfig(storedCloud);

      setSettings(mergedSettings);
      setCloud(mergedCloud);
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

      if (isConfigured(mergedCloud)) {
        setConnection({ state: 'connecting', message: 'Connecting to Supabase…', latencyMs: null, checkedAt: null });
        const report = await testCloudConnection(mergedCloud);
        if (!cancelled) setConnection(report);
      } else {
        setConnection({
          state: 'local',
          message: 'Offline mode — data is stored on this computer.',
          latencyMs: null,
          checkedAt: new Date().toISOString(),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- apply theme ---- */
  useEffect(() => {
    const root = document.documentElement;
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemPrefersDark());
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.dataset.density = settings.density;
    root.classList.toggle('reduce-motion', settings.reduceMotion);
    void desktop.theme.set(settings.theme);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#070b16' : '#f4f6fb');

    if (settings.theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const isDark = mql.matches;
      root.classList.toggle('dark', isDark);
      root.style.colorScheme = isDark ? 'dark' : 'light';
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [settings.theme, settings.density, settings.reduceMotion]);

  /* ---- keyboard shortcuts (desktop-grade niceties) ---- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === '=' || key === '+') {
        event.preventDefault();
        nudgeZoom(0.1);
      } else if (key === '-') {
        event.preventDefault();
        nudgeZoom(-0.1);
      } else if (key === '0') {
        event.preventDefault();
        setZoom(1);
      } else if (key === 'b') {
        event.preventDefault();
        setSettings((s) => {
          const next = { ...s, sidebarCollapsed: !s.sidebarCollapsed };
          void kv.set(STORAGE_KEYS.settings, next);
          return next;
        });
      } else if (key === 'k') {
        event.preventDefault();
        document.dispatchEvent(new CustomEvent('msap:focus-search'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void kv.set(STORAGE_KEYS.settings, next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS, theme: systemPrefersDark() ? 'dark' : 'light' });
    void kv.set(STORAGE_KEYS.settings, {});
    setZoom(1);
  }, []);

  const setZoom = useCallback((factor: number) => {
    void desktop.view.setZoom(factor).then((actual) => setZoomState(actual));
  }, []);

  const nudgeZoom = useCallback((delta: number) => {
    void desktop.view.zoom(delta).then((actual) => setZoomState(actual));
  }, []);

  const recheckConnection = useCallback(async () => {
    if (!isConfigured(cloud)) {
      setConnection({
        state: 'local',
        message: 'Offline mode — data is stored on this computer.',
        latencyMs: null,
        checkedAt: new Date().toISOString(),
      });
      return;
    }
    setConnection({ state: 'connecting', message: 'Connecting to Supabase…', latencyMs: null, checkedAt: null });
    const report = await testCloudConnection(cloud);
    setConnection(report);
  }, [cloud]);

  const saveCloud = useCallback(async (config: CloudConfig) => {
    const next: CloudConfig = { ...config, savedAt: new Date().toISOString() };
    const ok = await kv.set(STORAGE_KEYS.cloud, next);
    setCloud(next);
    setConnection({ state: 'connecting', message: 'Connecting to Supabase…', latencyMs: null, checkedAt: null });
    const report = await testCloudConnection(next);
    setConnection(report);
    return ok && report.state !== 'error';
  }, []);

  const clearCloud = useCallback(async () => {
    await kv.del(STORAGE_KEYS.cloud);
    setCloud(EMPTY_CLOUD_CONFIG);
    setConnection({
      state: 'local',
      message: 'Offline mode — data is stored on this computer.',
      latencyMs: null,
      checkedAt: new Date().toISOString(),
    });
  }, []);

  const value = useMemo<AppState>(
    () => ({
      ready,
      settings,
      updateSettings,
      resetSettings,
      cloud,
      saveCloud,
      clearCloud,
      connection,
      recheckConnection,
      zoom,
      setZoom,
      nudgeZoom,
      runtime,
    }),
    [
      ready,
      settings,
      updateSettings,
      resetSettings,
      cloud,
      saveCloud,
      clearCloud,
      connection,
      recheckConnection,
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
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
