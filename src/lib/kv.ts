import { desktop } from './desktop';

/**
 * Tiny key/value store used for settings, the offline cache and the cloud
 * config. On desktop it is a JSON file per key inside Electron's userData
 * folder; in a browser it falls back to localStorage.
 */
export const kv = {
  get: <T,>(key: string, fallback: T): Promise<T> =>
    desktop.data
      .read<T>(key)
      .then((r) => (r.ok && r.value !== null && r.value !== undefined ? (r.value as T) : fallback))
      .catch(() => fallback),

  set: (key: string, value: unknown): Promise<boolean> =>
    desktop.data
      .write(key, value)
      .then((r) => Boolean(r.ok))
      .catch(() => false),

  del: (key: string): Promise<boolean> =>
    desktop.data
      .remove(key)
      .then((r) => Boolean(r.ok))
      .catch(() => false),

  keys: (): Promise<string[]> =>
    desktop.data
      .list()
      .then((r) => (r.ok ? r.keys ?? [] : []))
      .catch(() => []),
};

export const STORAGE_KEYS = {
  settings: 'msap:settings',
  cloud: 'msap:cloud-config',
  cachePrefix: 'msap:cache:',
} as const;
