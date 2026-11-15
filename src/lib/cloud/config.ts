import type { SupabaseClient } from '@supabase/supabase-js';

export type CloudProvider = 'supabase' | 'none';

export interface CloudConfig {
  provider: CloudProvider;
  url: string;
  anonKey: string;
  enabled: boolean;
  savedAt: string | null;
}

export const EMPTY_CLOUD_CONFIG: CloudConfig = {
  provider: 'none',
  url: '',
  anonKey: '',
  enabled: false,
  savedAt: null,
};

/** Values baked in at build time from `.env.local` (optional). */
export const ENV_CLOUD: Partial<CloudConfig> = {
  url: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '',
  anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '',
};

export function isConfigured(config: CloudConfig | null | undefined): boolean {
  if (!config) return false;
  return Boolean(config.url && config.anonKey && /^https?:\/\//i.test(config.url));
}

export function mergeEnvConfig(config: CloudConfig): CloudConfig {
  if (isConfigured(config)) return config;
  if (ENV_CLOUD.url && ENV_CLOUD.anonKey) {
    return {
      ...config,
      provider: 'supabase',
      url: ENV_CLOUD.url as string,
      anonKey: ENV_CLOUD.anonKey as string,
      enabled: config.enabled,
    };
  }
  return config;
}

export type ConnectionState =
  | 'local' // no cloud configured -> offline/local storage
  | 'connecting'
  | 'online'
  | 'error';

export interface ConnectionReport {
  state: ConnectionState;
  message: string;
  latencyMs: number | null;
  checkedAt: string | null;
  hint?: string;
}

let client: SupabaseClient | null = null;
let clientKey = '';

/** Lazily create (and cache) a Supabase client for the given config. */
export async function getSupabase(config: CloudConfig): Promise<SupabaseClient | null> {
  if (!isConfigured(config)) return null;
  const key = `${config.url}|${config.anonKey.slice(0, 12)}`;
  if (client && clientKey === key) return client;

  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: { headers: { 'x-client-info': 'micro-stocker-advanced-pro' } },
  });
  clientKey = key;
  return client;
}

/**
 * Verify the credentials and report *why* something failed, in plain English.
 * `app_meta` is part of the schema in lib/cloud/schema.ts.
 */
export async function testCloudConnection(config: CloudConfig): Promise<ConnectionReport> {
  if (!isConfigured(config)) {
    return {
      state: 'local',
      message: 'No cloud project configured. Running fully offline.',
      latencyMs: null,
      checkedAt: new Date().toISOString(),
      hint: 'Add your Supabase URL + anon key below, or leave it empty to stay offline.',
    };
  }

  const started = performance.now();
  try {
    const supabase = await getSupabase(config);
    if (!supabase) throw new Error('Could not create the Supabase client');

    const { error } = await supabase.from('app_meta').select('id').limit(1);
    const latencyMs = Math.round(performance.now() - started);

    if (!error) {
      return {
        state: 'online',
        message: 'Connected. The app_meta table is readable.',
        latencyMs,
        checkedAt: new Date().toISOString(),
      };
    }

    const message = String(error.message ?? error);
    const code = (error as { code?: string }).code;

    if (code === '42P01' || /does not exist/i.test(message)) {
      return {
        state: 'error',
        message: 'Credentials work, but the database tables are missing.',
        latencyMs,
        checkedAt: new Date().toISOString(),
        hint: 'Run the SQL from "Schema" below in Supabase → SQL Editor, then test again.',
      };
    }
    if (/invalid api key|jwt|apikey/i.test(message) || code === 'PGRST301') {
      return {
        state: 'error',
        message: 'Rejected: the anon key looks wrong or was revoked.',
        latencyMs,
        checkedAt: new Date().toISOString(),
        hint: 'Copy the key again from Supabase → Project Settings → API (anon public).',
      };
    }
    if (/row-level security|permission denied/i.test(message)) {
      return {
        state: 'error',
        message: 'Connected, but Row Level Security blocked the read.',
        latencyMs,
        checkedAt: new Date().toISOString(),
        hint: 'Check the RLS policies in the generated SQL.',
      };
    }
    return {
      state: 'error',
      message: `Supabase error: ${message}`,
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - started);
    const message = error instanceof Error ? error.message : String(error);
    const looksLikeNetwork = /fetch|network|failed to fetch|ERR_|CORS/i.test(message);
    return {
      state: 'error',
      message: looksLikeNetwork
        ? 'Could not reach Supabase (network blocked or the URL is wrong).'
        : `Connection failed: ${message}`,
      latencyMs,
      checkedAt: new Date().toISOString(),
      hint: looksLikeNetwork
        ? 'Check the project URL, your internet connection, and that no firewall blocks *.supabase.co.'
        : undefined,
    };
  }
}
