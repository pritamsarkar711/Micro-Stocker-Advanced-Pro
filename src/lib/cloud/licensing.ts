import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// These are public project identifiers, not privileged keys. They are baked into
// the official build; user-editable workspace settings do not control licensing.
const url = (import.meta.env.VITE_LICENSE_SUPABASE_URL as string | undefined)?.trim();
const key = (import.meta.env.VITE_LICENSE_SUPABASE_ANON_KEY as string | undefined)?.trim();
export const licenseConfigured = Boolean(url && key && /^https:\/\//.test(url));
let client: SupabaseClient | null = null;
export function licensingClient(): SupabaseClient | null {
  if (!licenseConfigured || !url || !key) return null;
  return client ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'msap.license.auth' } });
}
