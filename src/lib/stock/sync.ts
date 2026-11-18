import type { StockItem } from './types';

/**
 * Cross device sync of library metadata.
 *
 * The desktop, the web build and the Android build all read and write the same
 * row in `workspace_snapshots`, keyed by the signed in account. Pixels stay on
 * the device that imported them; ids, titles, keywords, flags and platform
 * choices travel, so a file drafted on a laptop can be exported from a phone.
 */

export interface WorkspaceSnapshot {
  version: 1;
  items: Array<Omit<StockItem, 'thumbUrl' | 'inMemory'>>;
  savedAt: string;
  device?: string;
}

export interface SyncResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

export function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'device';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/electron/i.test(ua)) return 'Desktop';
  return 'Web';
}

function strip(item: StockItem): Omit<StockItem, 'thumbUrl' | 'inMemory'> {
  const { thumbUrl: _thumb, inMemory: _memory, ...rest } = item;
  return rest;
}

export function toSnapshot(items: StockItem[]): WorkspaceSnapshot {
  return { version: 1, items: items.map(strip), savedAt: new Date().toISOString(), device: deviceLabel() };
}

/** Newer wins per item id, so two devices cannot silently delete each other. */
export function mergeSnapshots(local: StockItem[], remote: WorkspaceSnapshot | null): StockItem[] {
  if (!remote?.items?.length) return local;
  const byId = new Map<string, StockItem>();
  for (const item of local) byId.set(item.id, item);
  for (const item of remote.items) {
    const current = byId.get(item.id);
    if (!current) {
      byId.set(item.id, { ...item, inMemory: false });
      continue;
    }
    const localAt = Date.parse(current.updatedAt ?? '') || 0;
    const remoteAt = Date.parse(item.updatedAt ?? '') || 0;
    if (remoteAt > localAt) byId.set(item.id, { ...current, ...item });
  }
  return [...byId.values()];
}

type SnapshotClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    upsert: (
      row: Record<string, unknown>,
      options: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

export async function pullWorkspace(client: unknown, userId: string): Promise<SyncResult<WorkspaceSnapshot | null>> {
  const db = client as SnapshotClient;
  const { data, error } = await db
    .from('workspace_snapshots')
    .select('payload, updated_at, item_count')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, value: null };
  const row = data as { payload?: WorkspaceSnapshot };
  return { ok: true, value: row.payload ?? null };
}

export async function pushWorkspace(
  client: unknown,
  userId: string,
  snapshot: WorkspaceSnapshot,
): Promise<SyncResult<string>> {
  const db = client as SnapshotClient;
  const { error } = await db.from('workspace_snapshots').upsert(
    {
      user_id: userId,
      payload: snapshot,
      item_count: snapshot.items.length,
      device_label: snapshot.device ?? deviceLabel(),
    },
    { onConflict: 'user_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: snapshot.savedAt };
}
