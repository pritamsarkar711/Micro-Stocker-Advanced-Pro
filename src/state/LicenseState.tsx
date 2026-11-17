import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { licensingClient } from '@/lib/cloud/licensing';
import { useAuth } from './AuthState';

interface LicenseState {
  loading: boolean;
  error: string;
  isAdmin: boolean;
  isBlocked: boolean;
  verified: boolean;
  expiresAt: string | null;
  remainingMs: number;
  premium: boolean;
  refresh: () => Promise<void>;
  redeem: (code: string) => Promise<void>;
}
const Context = createContext<LicenseState | null>(null);

export function LicenseProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [fresh, setFresh] = useState(false);
  const freshUntil = useRef(0);
  const deadline = useRef(0);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++request.current;
    const client = licensingClient();
    if (!client || !user) { deadline.current = 0; freshUntil.current = 0; setFresh(false); setRemainingMs(0); setIsAdmin(false); setIsBlocked(false); setExpiresAt(null); setLoading(false); return; }
    const startedAt = performance.now();
    try {
      const { data, error: failure } = await client.rpc('msap_my_entitlement');
      if (version !== request.current) return;
      if (failure || !Array.isArray(data) || !data[0]) throw new Error(failure?.message || 'No entitlement response');
      const row = data[0] as { expires_at: string | null; server_time: string; is_admin: boolean; is_blocked: boolean };
      if (typeof row.is_blocked !== 'boolean' || typeof row.is_admin !== 'boolean') throw new Error('Incompatible licensing service');
      const expiry = row.expires_at ? Date.parse(row.expires_at) : 0;
      const serverTime = Date.parse(row.server_time);
      if (!Number.isFinite(serverTime) || (row.expires_at && !Number.isFinite(expiry))) throw new Error('Invalid entitlement response');
      const left = Math.max(0, expiry - serverTime);
      // Anchor to request start so network latency never extends access.
      deadline.current = startedAt + left;
      freshUntil.current = startedAt + 45_000;
      setFresh(performance.now() < freshUntil.current);
      setRemainingMs(Math.max(0, deadline.current - performance.now())); setExpiresAt(row.expires_at); setIsAdmin(row.is_admin === true); setIsBlocked(row.is_blocked === true); setError('');
    } catch (e) {
      if (version !== request.current) return;
      deadline.current = 0; freshUntil.current = 0; setFresh(false); setRemainingMs(0); setExpiresAt(null); setIsAdmin(false); setIsBlocked(false);
      setError(e instanceof Error ? e.message : 'Could not verify subscription');
    } finally { if (version === request.current) setLoading(false); }
  }, [user]);
  useEffect(() => {
    setLoading(true); void refresh();
    const recheck = window.setInterval(() => void refresh(), 30_000);
    const tick = window.setInterval(() => { setRemainingMs(Math.max(0, deadline.current - performance.now())); setFresh(performance.now() < freshUntil.current); }, 1000);
    return () => { ++request.current; clearInterval(recheck); clearInterval(tick); };
  }, [refresh]);
  const redeem = useCallback(async (code: string) => {
    const client = licensingClient();
    if (!client) throw new Error('Licensing service is unavailable');
    const { error: failure } = await client.rpc('msap_redeem_code', { p_code: code.trim() });
    if (failure) throw new Error(failure.message);
    await refresh();
  }, [refresh]);
  return <Context.Provider value={{ loading, error, isAdmin, isBlocked, verified: fresh && !error, expiresAt, remainingMs, premium: !error && fresh && !isBlocked && remainingMs > 0, refresh, redeem }}>{children}</Context.Provider>;
}
export function useLicense() {
  const value = useContext(Context);
  if (!value) throw new Error('useLicense must be used inside LicenseProvider');
  return value;
}
