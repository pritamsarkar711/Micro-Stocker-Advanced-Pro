import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { licensingClient } from '@/lib/cloud/licensing';
import { demoMode } from '@/lib/cloud/demo';
import { mergeSnapshots, pullWorkspace, pushWorkspace, toSnapshot } from '@/lib/stock/sync';
import { useAuth } from './AuthState';
import { useLibrary } from './library';

export type SyncStatus = 'off' | 'idle' | 'pulling' | 'pushing' | 'error';

interface SyncState {
  status: SyncStatus;
  lastSyncAt: string | null;
  error: string | null;
  /** Pull, merge, then push. Safe to call any time. */
  syncNow: () => Promise<{ ok: boolean; error?: string; merged?: number }>;
}

const WorkspaceSyncContext = createContext<SyncState | null>(null);

const AUTO_PUSH_DELAY = 20_000;

/**
 * Keeps the library metadata of one account identical on every platform.
 *
 * Sign in on the desktop, draft ten files, open the web build on a phone: the
 * same rows are already there. Pixels stay where they were imported, only the
 * metadata travels, so the sync stays small and fast.
 */
export function WorkspaceSyncProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const { items, replaceAll, ready: libraryReady } = useLibrary();
  const [status, setStatus] = useState<SyncStatus>('off');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = useRef(false);
  const pulledFor = useRef<string | null>(null);
  const lastPushed = useRef<string>('');
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const syncNow = useCallback(async () => {
    if (!user || demoMode || busy.current) return { ok: false as const, error: 'Sign in to sync' };
    const client = licensingClient();
    if (!client) return { ok: false as const, error: 'Backend unavailable' };
    busy.current = true;
    setStatus('pulling');
    setError(null);
    try {
      const remote = await pullWorkspace(client, user.id);
      if (!remote.ok) {
        setStatus('error');
        setError(remote.error ?? 'Could not reach the workspace');
        return { ok: false as const, error: remote.error };
      }
      const merged = mergeSnapshots(itemsRef.current, remote.value ?? null);
      if (merged.length !== itemsRef.current.length) {
        replaceAll(merged);
        itemsRef.current = merged;
      }
      const snapshot = toSnapshot(merged);
      lastPushed.current = snapshot.savedAt;
      setStatus('pushing');
      const pushed = await pushWorkspace(client, user.id, snapshot);
      if (!pushed.ok) {
        setStatus('error');
        setError(pushed.error ?? 'Could not save the workspace');
        return { ok: false as const, error: pushed.error };
      }
      setLastSyncAt(snapshot.savedAt);
      setStatus('idle');
      return { ok: true as const, merged: merged.length };
    } finally {
      busy.current = false;
    }
  }, [replaceAll, user]);

  // One pull per signed in account, as soon as both stores are ready.
  useEffect(() => {
    if (!authReady || !libraryReady || !user || demoMode) return;
    if (pulledFor.current === user.id) return;
    pulledFor.current = user.id;
    void syncNow();
  }, [authReady, libraryReady, user, syncNow]);

  useEffect(() => {
    if (!user) {
      pulledFor.current = null;
      lastPushed.current = '';
      setStatus('off');
      setLastSyncAt(null);
      setError(null);
    }
  }, [user]);

  // Push quietly after local edits, so the other platforms catch up.
  useEffect(() => {
    if (!user || demoMode || !libraryReady) return;
    const snapshot = toSnapshot(items);
    if (snapshot.savedAt === lastPushed.current) return;
    const timer = setTimeout(() => {
      if (busy.current) return;
      const client = licensingClient();
      if (!client) return;
      busy.current = true;
      setStatus('pushing');
      void pushWorkspace(client, user.id, snapshot)
        .then((result) => {
          busy.current = false;
          if (!result.ok) {
            setStatus('error');
            setError(result.error ?? 'Could not save the workspace');
            return;
          }
          lastPushed.current = snapshot.savedAt;
          setLastSyncAt(snapshot.savedAt);
          setStatus('idle');
        })
        .catch(() => {
          busy.current = false;
          setStatus('error');
        });
    }, AUTO_PUSH_DELAY);
    return () => clearTimeout(timer);
  }, [items, libraryReady, user]);

  const value = useMemo<SyncState>(
    () => ({ status, lastSyncAt, error, syncNow }),
    [status, lastSyncAt, error, syncNow],
  );
  return <WorkspaceSyncContext.Provider value={value}>{children}</WorkspaceSyncContext.Provider>;
}

export function useWorkspaceSync(): SyncState {
  const ctx = useContext(WorkspaceSyncContext);
  if (!ctx) throw new Error('useWorkspaceSync must be used inside WorkspaceSyncProvider');
  return ctx;
}
