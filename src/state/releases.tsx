import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { kv } from '@/lib/kv';

/**
 * Model & property release registry.
 *
 * The PDFs themselves live in each portal (they require signed forms on their
 * own templates); this registry tracks WHO/WHAT is cleared, when it was
 * signed, expiry, and which library items rely on it — so the Export centre
 * can warn before you submit an unreleased recognisable person or property.
 */

export interface Release {
  id: string;
  kind: 'model' | 'property';
  name: string;
  signedAt: string; // yyyy-mm-dd
  expiresAt: string; // '' = never
  notes: string;
  fileName: string;
}

interface ReleasesState {
  ready: boolean;
  releases: Release[];
  addRelease: (release: Omit<Release, 'id'>) => Release;
  updateRelease: (id: string, patch: Partial<Release>) => void;
  deleteRelease: (id: string) => void;
}

const ReleasesContext = createContext<ReleasesState | null>(null);
const KEY = 'msap:releases';

export function ReleasesProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [releases, setReleases] = useState<Release[]>([]);

  useEffect(() => {
    kv.get<Release[]>(KEY, []).then((stored) => {
      setReleases(stored);
      setReady(true);
    });
  }, []);

  const persist = useCallback((next: Release[]) => {
    setReleases(next);
    void kv.set(KEY, next);
  }, []);

  const addRelease = useCallback(
    (release: Omit<Release, 'id'>) => {
      const created: Release = { ...release, id: `rel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` };
      persist([created, ...releases]);
      return created;
    },
    [persist, releases],
  );

  const updateRelease = useCallback(
    (id: string, patch: Partial<Release>) => persist(releases.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    [persist, releases],
  );

  const deleteRelease = useCallback((id: string) => persist(releases.filter((r) => r.id !== id)), [persist, releases]);

  const value = useMemo(() => ({ ready, releases, addRelease, updateRelease, deleteRelease }), [ready, releases, addRelease, updateRelease, deleteRelease]);
  return <ReleasesContext.Provider value={value}>{children}</ReleasesContext.Provider>;
}

export function useReleases(): ReleasesState {
  const ctx = useContext(ReleasesContext);
  if (!ctx) throw new Error('useReleases must be used inside <ReleasesProvider>');
  return ctx;
}

export function isExpired(release: Release): boolean {
  return Boolean(release.expiresAt) && new Date(release.expiresAt) < new Date();
}
