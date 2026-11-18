import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { licensingClient } from '@/lib/cloud/licensing';
import { useAuth } from './AuthState';

/**
 * Subscription state, sourced from the server.
 *
 * The desktop studio is free and usable without an account, so this provider
 * never blocks anything by itself. It only answers one question: does the signed
 * in account hold an active plan, and which features does that plan include?
 * Every premium surface asks here and the server is always the authority; the
 * local copy exists so the UI does not flicker while the network answers.
 */

export interface PlanFeatures {
  vector: boolean;
  jpg: boolean;
  premium_upscale: boolean;
  video_premium: boolean;
  max_export_px?: number;
  queue_priority?: number;
}

const FREE_FEATURES: PlanFeatures = {
  vector: false,
  jpg: false,
  premium_upscale: false,
  video_premium: false,
  max_export_px: 2000,
};

interface LicenseState {
  loading: boolean;
  error: string;
  isAdmin: boolean;
  isBlocked: boolean;
  /** Kept for the gates: the app is always usable unless the account is blocked. */
  verified: boolean;
  expiresAt: string | null;
  remainingMs: number;
  /** Active paid plan (or administrator). */
  premium: boolean;
  plan: string | null;
  planName: string | null;
  credits: number;
  features: PlanFeatures;
  hasFeature: (feature: keyof PlanFeatures) => boolean;
  /** True when the answer came from a live server call in this session. */
  online: boolean;
  refresh: () => Promise<void>;
}

const Context = createContext<LicenseState | null>(null);

interface EntitlementRow {
  active?: boolean;
  authenticated?: boolean;
  blocked?: boolean;
  is_admin?: boolean;
  credits?: number;
  plan?: string | null;
  plan_name?: string | null;
  expires_at?: string | null;
  seconds_left?: number | null;
  features?: Partial<PlanFeatures>;
  server_time?: string;
}

export function LicenseProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entitlement, setEntitlement] = useState<EntitlementRow | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(false);
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++request.current;
    const client = licensingClient();
    if (!client || !user?.id) {
      setEntitlement(null);
      setDeadline(0);
      setLoading(false);
      setError('');
      setOnline(false);
      return;
    }
    try {
      const { data, error: rpcError } = await client.rpc('pro_my_entitlement');
      if (version !== request.current) return;
      if (rpcError) throw new Error(rpcError.message);
      const row = (data ?? {}) as EntitlementRow;
      setEntitlement(row);
      const seconds = typeof row.seconds_left === 'number' ? row.seconds_left : 0;
      setDeadline(seconds > 0 ? Date.now() + seconds * 1000 : 0);
      setError('');
      setOnline(true);
    } catch (cause) {
      if (version !== request.current) return;
      setError(cause instanceof Error ? cause.message : 'could not reach the subscription service');
      setOnline(false);
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;
    const poll = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(poll);
  }, [refresh, user?.id]);

  useEffect(() => {
    if (!deadline) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [deadline]);

  const value = useMemo<LicenseState>(() => {
    const features: PlanFeatures = { ...FREE_FEATURES, ...(entitlement?.features ?? {}) };
    const remainingMs = deadline ? Math.max(0, deadline - now) : 0;
    const active = Boolean(entitlement?.active) && Boolean(entitlement?.plan);
    // Access is lost the moment the clock runs out, even before the next poll.
    const premium = (active && (remainingMs > 0 || !deadline)) || Boolean(entitlement?.is_admin);
    return {
      loading,
      error,
      isAdmin: Boolean(entitlement?.is_admin),
      isBlocked: Boolean(entitlement?.blocked),
      verified: !entitlement?.blocked,
      expiresAt: entitlement?.expires_at ?? null,
      remainingMs,
      premium,
      plan: entitlement?.plan ?? null,
      planName: entitlement?.plan_name ?? null,
      credits: entitlement?.credits ?? 0,
      features: premium ? features : FREE_FEATURES,
      hasFeature: (feature) => premium && Boolean(features[feature]),
      online,
      refresh,
    };
  }, [deadline, entitlement, error, loading, now, online, refresh]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLicense(): LicenseState {
  const context = useContext(Context);
  if (!context) throw new Error('useLicense must be used inside LicenseProvider');
  return context;
}
