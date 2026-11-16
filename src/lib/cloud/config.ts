import type { SupabaseClient } from '@supabase/supabase-js';

export interface CloudConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  projectLabel?: string;
  savedAt?: string;
}

export type ConnectionState = 'local' | 'connecting' | 'online' | 'schema-missing' | 'error';

export interface ConnectionReport {
  state: ConnectionState;
  message: string;
  latencyMs: number | null;
  checkedAt: string | null;
}

export const EMPTY_CLOUD_CONFIG: CloudConfig = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  projectLabel: '',
};

export function mergeEnvConfig(stored: CloudConfig | null | undefined): CloudConfig {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';
  const envLabel = (import.meta.env.VITE_SUPABASE_LABEL as string | undefined)?.trim() ?? '';
  return {
    supabaseUrl: stored?.supabaseUrl?.trim() || envUrl,
    supabaseAnonKey: stored?.supabaseAnonKey?.trim() || envKey,
    projectLabel: stored?.projectLabel?.trim() || envLabel,
    savedAt: stored?.savedAt,
  };
}

export function isConfigured(cfg: CloudConfig | null | undefined): cfg is CloudConfig {
  if (!cfg) return false;
  return Boolean(cfg.supabaseUrl.trim() && cfg.supabaseAnonKey.trim());
}

export function validateConfig(cfg: CloudConfig): string | null {
  const url = cfg.supabaseUrl.trim();
  const key = cfg.supabaseAnonKey.trim();
  if (!url && !key) return null;
  if (!url) return 'Project URL is required.';
  if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(url)) {
    return 'Project URL must start with https://';
  }
  if (!key || key.length < 24) {
    return 'Public key looks incomplete.';
  }
  return null;
}

let cached: { signature: string; client: SupabaseClient } | null = null;

export async function getSupabase(cfg: CloudConfig): Promise<SupabaseClient | null> {
  if (!isConfigured(cfg)) return null;
  const url = cfg.supabaseUrl.trim().replace(/\/+$/, '');
  const key = cfg.supabaseAnonKey.trim();
  const signature = `${url}::${key}`;
  if (cached && cached.signature === signature) return cached.client;

  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'msap.supabase.auth',
    },
    global: {
      headers: { 'x-client-info': 'micro-stocker-advanced-pro' },
    },
  });
  cached = { signature, client };
  return client;
}

export async function testCloudConnection(cfg: CloudConfig): Promise<ConnectionReport> {
  const checkedAt = new Date().toISOString();
  if (!isConfigured(cfg)) {
    return {
      state: 'local',
      message: 'Stored on this device',
      latencyMs: null,
      checkedAt,
    };
  }

  const invalid = validateConfig(cfg);
  if (invalid) {
    return { state: 'error', message: invalid, latencyMs: null, checkedAt };
  }

  const started = performance.now();
  try {
    const client = await getSupabase(cfg);
    if (!client) {
      return { state: 'local', message: 'Stored on this device', latencyMs: null, checkedAt };
    }

    const { error } = await client
      .from('app_meta')
      .select('schema_version', { head: false })
      .limit(1);

    const latencyMs = Math.round(performance.now() - started);

    if (!error) {
      return {
        state: 'online',
        message: 'Connected',
        latencyMs,
        checkedAt,
      };
    }

    const missing =
      error.code === '42P01' ||
      error.code === 'PGRST205' ||
      /relation .* does not exist|could not find the table/i.test(error.message);

    if (missing) {
      return {
        state: 'schema-missing',
        message: 'Connected, schema setup required',
        latencyMs,
        checkedAt,
      };
    }

    return {
      state: 'error',
      message: error.message || 'Connection error',
      latencyMs,
      checkedAt,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - started);
    return {
      state: 'error',
      message: error instanceof Error ? error.message : String(error),
      latencyMs,
      checkedAt,
    };
  }
}
