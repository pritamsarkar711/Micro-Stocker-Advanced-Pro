import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { demoClient, demoMode } from './demo';

// These are public project identifiers, not privileged keys. They are baked into
// the official build; user-editable workspace settings do not control licensing.
const url = (import.meta.env.VITE_LICENSE_SUPABASE_URL as string | undefined)?.trim();
const key = (import.meta.env.VITE_LICENSE_SUPABASE_ANON_KEY as string | undefined)?.trim();
export const licenseConfigured = demoMode || Boolean(url && key && /^https:\/\//.test(url));

let client: SupabaseClient | null = null;

export function licensingClient(): SupabaseClient | null {
  if (demoMode) return demoClient();
  if (!licenseConfigured || !url || !key) return null;
  return (client ??= createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // PKCE keeps the confirmation link single-use and avoids putting access
      // tokens in the address bar hash (which the hash router also uses).
      flowType: 'pkce',
      storageKey: 'msap.license.auth',
    },
    global: {
      headers: { 'x-client-info': 'micro-stocker-advanced-pro' },
    },
  }));
}
