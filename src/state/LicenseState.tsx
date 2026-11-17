import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { licensingClient } from '@/lib/cloud/licensing';
import { useAuth } from './AuthState';

interface LicenseState {
  loading: boolean;
  error: string;
  isAdmin: boolean;
  isBlocked: boolean;
  /** The account is unlocked and must not be bounced back to a gate. */
  verified: boolean;
  expiresAt: string | null;
  remainingMs: number;
  /** Admin accounts always have full access; regular users need time left. */
  premium: boolean;
  refresh: () => Promise<void>;
  redeem: (code: string) => Promise<void>;
}

const Context = createContext<LicenseState | null>(null);

/**
 * Entitlement state machine.
 *
 * The server answer is authoritative, but a background re-check must never
 * unmount the workspace: losing a half-typed activation code or an upload queue
 * every thirty seconds is worse than trusting the last answer until the local
 * countdown runs out. Once a check succeeds the account stays unlocked for as
 * long as `remainingMs` keeps running, so the studio also keeps working offline.
 */
export function LicenseProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  /** Set once the server answers; cleared on sign-out. Never cleared by a failed re-check. */
  const [serverOk, setServerOk] = useState(false);
  const deadline = useRef(0);
  const request = useRef(0);
  const checkedFor = useRef<string | null>(null);

  const reset = useCallback(() => {
    deadline.current = 0;
    setServerOk(false);
    setRemainingMs(0);
    setIsAdmin(false);
    setIsBlocked(false);
    setExpiresAt(null);
  }, []);

  const refresh = useCallback(async () => {
    const version = ++request.current;
    const client = licensingClient();
    const userId = user?.id ?? null;
    if (!client || !userId) {
      checkedFor.current = null;
      reset();
      setError('');
      setLoading(false);
      return;
    }
    const startedAt = performance.now();
    try {
      const { data, error: failure } = await client.rpc('msap_my_entitlement');
      if (version !== request.current) return;
      if (failure || !Array.isArray(data) || !data[0]) {
        throw new Error(failure?.message || 'No entitlement response');
      }
      const row = data[0] as {
        expires_at: string | null;
        server_time: string;
        is_admin: boolean;
        is_blocked: boolean;
      };
      if (typeof row.is_blocked !== 'boolean' || typeof row.is_admin !== 'boolean') {
        throw new Error('Incompatible licensing service');
      }
      const expiry = row.expires_at ? Date.parse(row.expires_at) : 0;
      const serverTime = Date.parse(row.server_time);
      if (!Number.isFinite(serverTime) || (row.expires_at && !Number.isFinite(expiry))) {
        throw new Error('Invalid entitlement response');
      }
      const left = Math.max(0, expiry - serverTime);
      // Anchor to request start so network latency never extends access.
      deadline.current = startedAt + left;
      setRemainingMs(Math.max(0, left));
      setExpiresAt(row.expires_at);
      setIsAdmin(row.is_admin === true);
      setIsBlocked(row.is_blocked === true);
      setServerOk(true);
      setError('');
      checkedFor.current = userId;
    } catch (e) {
      if (version !== request.current) return;
      // Keep the previous entitlement: a flaky network must not eject the user.
      setError(e instanceof Error ? e.message : 'Could not verify subscription');
      checkedFor.current = userId;
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, [user, reset]);

  useEffect(() => {
    // A different account starts from scratch; a re-check for the same account
    // leaves the workspace mounted.
    if (checkedFor.current !== (user?.id ?? null)) {
      reset();
      setError('');
      setLoading(true);
    }
    void refresh();
    const recheck = window.setInterval(() => void refresh(), 30_000);
    const tick = window.setInterval(() => {
      const left = Math.max(0, deadline.current - performance.now());
      // Coarse updates: four renders a minute instead of sixty across the app.
      const rounded = Math.floor(left / 15_000) * 15_000;
      setRemainingMs((prev) => (prev === rounded ? prev : rounded));
    }, 1000);
    return () => {
      ++request.current;
      clearInterval(recheck);
      clearInterval(tick);
    };
  }, [refresh, reset, user]);

  const redeem = useCallback(
    async (code: string) => {
      const client = licensingClient();
      if (!client) throw new Error('Licensing service is unavailable');
      const { error: failure } = await client.rpc('msap_redeem_code', { p_code: code.trim() });
      if (failure) throw new Error(failure.message);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<LicenseState>(() => {
    const verified = serverOk && !isBlocked;
    return {
      loading,
      error,
      isAdmin,
      isBlocked,
      verified,
      expiresAt,
      remainingMs,
      premium: verified && (isAdmin || remainingMs > 0),
      refresh,
      redeem,
    };
  }, [loading, error, isAdmin, isBlocked, serverOk, expiresAt, remainingMs, refresh, redeem]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLicense() {
  const value = useContext(Context);
  if (!value) throw new Error('useLicense must be used inside LicenseProvider');
  return value;
}
