import type { CloudConfig } from '@/lib/cloud/config';
import type { StockItem } from './types';

/** Legacy anonymous cloud sync was unsafe and is disabled until per-user sync is available. */
export async function deviceId(): Promise<string> {
  const { kv } = await import('@/lib/kv');
  let id = await kv.get<string>('msap:device-id', '');
  if (!id) { id = crypto.randomUUID(); await kv.set('msap:device-id', id); }
  return id;
}
export async function pushLibrary(_config: CloudConfig, _items: StockItem[]): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'Legacy cloud sync is disabled for privacy. Your library remains on this device.' };
}
export async function pullLibrary(_config: CloudConfig, local: StockItem[]): Promise<{ ok: boolean; merged: StockItem[]; remoteCount: number; error?: string }> {
  return { ok: false, merged: local, remoteCount: 0, error: 'Legacy cloud sync is disabled for privacy. Your library remains on this device.' };
}
