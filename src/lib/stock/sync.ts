import { getSupabase, isConfigured, type CloudConfig } from '@/lib/cloud/config';
import type { StockItem } from './types';

/**
 * Supabase library sync (offline-first, last-write-wins per item).
 *
 * Uses the `kv_store` table from lib/cloud/schema.ts:
 *   key = 'library', device_id = this machine, value = item descriptors.
 * Pull merges every device's payload by id, keeping the newer `updatedAt`.
 */

type Descriptor = Omit<StockItem, 'thumbUrl'>;

export async function deviceId(): Promise<string> {
  const { kv } = await import('@/lib/kv');
  let id = await kv.get<string>('msap:device-id', '');
  if (!id) {
    id = `dev-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    await kv.set('msap:device-id', id);
  }
  return id;
}

const strip = (items: StockItem[]): Descriptor[] => items.map(({ thumbUrl: _thumb, ...rest }) => rest);

export async function pushLibrary(config: CloudConfig, items: StockItem[]): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured(config)) return { ok: false, error: 'No Supabase project configured.' };
  const supabase = await getSupabase(config);
  if (!supabase) return { ok: false, error: 'Supabase client unavailable.' };
  const device = await deviceId();
  const { error } = await supabase.from('kv_store').upsert(
    { key: 'library', device_id: device, value: strip(items), updated_at: new Date().toISOString() },
    { onConflict: 'key,device_id' },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function pullLibrary(
  config: CloudConfig,
  local: StockItem[],
): Promise<{ ok: boolean; merged: StockItem[]; remoteCount: number; error?: string }> {
  if (!isConfigured(config)) return { ok: false, merged: local, remoteCount: 0, error: 'No Supabase project configured.' };
  const supabase = await getSupabase(config);
  if (!supabase) return { ok: false, merged: local, remoteCount: 0, error: 'Supabase client unavailable.' };

  const { data, error } = await supabase.from('kv_store').select('device_id,value,updated_at').eq('key', 'library');
  if (error) return { ok: false, merged: local, remoteCount: 0, error: error.message };

  const byId = new Map<string, Descriptor>();
  for (const item of strip(local)) byId.set(item.id, item);
  let remoteCount = 0;
  for (const row of data ?? []) {
    const payload = (row.value ?? []) as Descriptor[];
    remoteCount += payload.length;
    for (const item of payload) {
      const existing = byId.get(item.id);
      if (!existing || new Date(item.updatedAt) > new Date(existing.updatedAt)) byId.set(item.id, item);
    }
  }
  const merged = Array.from(byId.values()).map((item) => ({ ...item, thumbUrl: undefined, inMemory: false }));
  return { ok: true, merged, remoteCount };
}
