import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { licensingClient } from '@/lib/cloud/licensing';

/** Legacy local-account helpers are retained for migration only. New sessions
 * are authenticated and verified by the centralized licensing service. */

export interface StoredAccount {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface UserSession {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  loggedInAt: string;
  syncedToCloud?: boolean;
}

const PBKDF2_ITERATIONS = 120_000;

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = toHex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateCredentials(
  email: string,
  password: string,
): { ok: true } | { ok: false; error: string } {
  const clean = normalizeEmail(email);
  if (!clean) return { ok: false, error: 'Enter your email address.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (!password || password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  if (password.length > 128) {
    return { ok: false, error: 'Password must be 128 characters or fewer.' };
  }
  return { ok: true };
}

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const saltBuf = new Uint8Array(saltBytes).buffer as ArrayBuffer;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return { hash: toHex(new Uint8Array(bits)), salt: toHex(saltBytes) };
}

export async function verifyPassword(password: string, hashHex: string, saltHex: string): Promise<boolean> {
  const derived = await hashPassword(password, saltHex);
  if (derived.hash.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.hash.length; i++) {
    diff |= derived.hash.charCodeAt(i) ^ hashHex.charCodeAt(i);
  }
  return diff === 0;
}

export async function createAccountRecord(
  existing: StoredAccount[],
  email: string,
  password: string,
  displayName?: string,
): Promise<{ ok: true; account: StoredAccount; session: UserSession } | { ok: false; error: string }> {
  const check = validateCredentials(email, password);
  if (!check.ok) return check;
  const normalized = normalizeEmail(email);
  if (existing.some((a) => a.email === normalized)) {
    return { ok: false, error: 'An account with this email already exists. Sign in instead.' };
  }
  const { hash, salt } = await hashPassword(password);
  const now = new Date().toISOString();
  const fallbackName = normalized.split('@')[0].replace(/[._-]+/g, ' ').trim() || 'Contributor';
  const name = (displayName ?? '').trim() || fallbackName;
  const account: StoredAccount = {
    id: makeUuid(),
    email: normalized,
    displayName: name,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: now,
    lastLoginAt: now,
  };
  const session: UserSession = {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    createdAt: account.createdAt,
    loggedInAt: now,
  };
  return { ok: true, account, session };
}

export async function authenticateAccountRecord(
  accounts: StoredAccount[],
  email: string,
  password: string,
): Promise<{ ok: true; account: StoredAccount; session: UserSession } | { ok: false; error: string }> {
  const normalized = normalizeEmail(email);
  if (!normalized || !password) {
    return { ok: false, error: 'Enter both email and password.' };
  }
  const account = accounts.find((a) => a.email === normalized);
  if (!account) {
    return { ok: false, error: 'No account found for this email.' };
  }
  const valid = await verifyPassword(password, account.passwordHash, account.passwordSalt);
  if (!valid) {
    return { ok: false, error: 'Incorrect password.' };
  }
  const now = new Date().toISOString();
  const updated: StoredAccount = { ...account, lastLoginAt: now };
  return {
    ok: true,
    account: updated,
    session: {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      createdAt: updated.createdAt,
      loggedInAt: now,
    },
  };
}

export type AuthModalMode = 'login' | 'register' | 'account';

export interface AuthNotice {
  tone: 'ok' | 'error' | 'info';
  message: string;
}

export interface RegisterResult {
  ok: boolean;
  error?: string;
  /** True when Supabase created the account but a confirmation email was sent. */
  needsVerification?: boolean;
  user?: UserSession;
}

interface AuthState {
  ready: boolean;
  user: UserSession | null;
  modalOpen: boolean;
  modalMode: AuthModalMode;
  /** Address waiting for email confirmation (drives the verify panel). */
  pendingEmail: string | null;
  /** Non-blocking banner shown on the sign-in screen (link expired, confirmed…). */
  notice: AuthNotice | null;
  /** True when the user arrived from a password-recovery link. */
  recovery: boolean;
  openAuth: (mode?: AuthModalMode) => void;
  closeAuth: () => void;
  setPendingEmail: (email: string | null) => void;
  clearNotice: () => void;
  dismissRecovery: () => void;
  register: (email: string, password: string, displayName?: string) => Promise<RegisterResult>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; user?: UserSession }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ ok: boolean; error?: string }>;
  resendVerification: (email: string) => Promise<{ ok: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ ok: boolean; error?: string }>;
  updateDisplayName: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function toUser(user: User): UserSession {
  return {
    id: user.id,
    email: user.email ?? '',
    displayName: String(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Contributor'),
    createdAt: user.created_at,
    loggedInAt: user.last_sign_in_at || user.created_at,
    syncedToCloud: true,
  };
}

/**
 * Public URL Supabase should return the browser to after an email link.
 * Configure `VITE_AUTH_REDIRECT_URL` for the desktop build: a `file://` URL can
 * never be an email redirect target, so the desktop app verifies with the
 * 6-digit code instead (or through the hosted web build).
 */
export function authRedirectUrl(): string | undefined {
  const override = (import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined)?.trim();
  if (override) return override;
  if (typeof window === 'undefined') return undefined;
  if (window.location.protocol === 'file:') return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

/** Turn raw Supabase/GoTrue errors into copy a contributor can act on. */
export function friendlyAuthError(raw: string | undefined | null): string {
  const message = (raw ?? '').trim();
  const lower = message.toLowerCase();
  if (!message) return 'Something went wrong. Please try again.';
  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
    return 'Your email is not verified yet. Open the confirmation link we emailed you, or resend it below.';
  }
  if (lower.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (lower.includes('password should be at least')) return 'Password must be at least 8 characters.';
  if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('security purposes')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (lower.includes('token has expired') || lower.includes('otp_expired') || lower.includes('expired')) {
    return 'That link or code has expired. Request a new confirmation email below.';
  }
  if (lower.includes('invalid') && (lower.includes('token') || lower.includes('otp'))) {
    return 'That verification code is not valid. Check the email and try again.';
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network')) {
    return 'Network error. Check your connection and try again.';
  }
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserSession | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<AuthModalMode>('login');
  const [pendingEmail, setPendingEmailState] = useState<string | null>(null);
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    const client = licensingClient();
    if (!client) {
      setReady(true);
      return;
    }
    let active = true;
    let authRevision = 0;

    // Supabase hands back `?error=…&error_code=…&error_description=…` when a
    // confirmation link is expired or already used. Surface it in plain words
    // and strip it from the address bar so a refresh starts clean.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('error_code') || params.get('error');
      const description = params.get('error_description');
      if (code || description) {
        setNotice({ tone: 'error', message: friendlyAuthError(description || code) });
        const url = new URL(window.location.href);
        ['error', 'error_code', 'error_description'].forEach((key) => url.searchParams.delete(key));
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    }

    const refresh = async () => {
      const revision = ++authRevision;
      const { data, error } = await client.auth.getUser();
      if (active && revision === authRevision) {
        setUser(!error && data.user ? toUser(data.user) : null);
        setReady(true);
      }
    };
    void refresh();

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        ++authRevision;
        if (active) {
          setUser(null);
          setReady(true);
        }
      } else if (event === 'PASSWORD_RECOVERY') {
        ++authRevision;
        if (active) {
          setRecovery(true);
          setReady(true);
          if (session?.user) setUser(toUser(session.user));
        }
      } else if (event !== 'INITIAL_SESSION') {
        ++authRevision;
        setTimeout(() => {
          if (active) void refresh();
        }, 0);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const openAuth = useCallback(
    (mode?: AuthModalMode) => {
      setModalMode(mode ?? (user ? 'account' : 'login'));
      setModalOpen(true);
    },
    [user],
  );
  const closeAuth = useCallback(() => setModalOpen(false), []);
  const setPendingEmail = useCallback((email: string | null) => {
    setPendingEmailState(email);
    setNotice(null);
  }, []);
  const clearNotice = useCallback(() => setNotice(null), []);
  const dismissRecovery = useCallback(() => setRecovery(false), []);

  const register = useCallback<AuthState['register']>(async (email, password, displayName) => {
    const check = validateCredentials(email, password);
    if (!check.ok) return { ok: false, error: check.error };
    const client = licensingClient();
    if (!client) {
      return { ok: false, error: 'This build is not connected to the licensing service. Contact the administrator.' };
    }
    const cleanEmail = normalizeEmail(email);
    const redirectTo = authRedirectUrl();
    const { data, error } = await client.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { display_name: displayName?.trim() || '' },
        ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
      },
    });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };
    if (!data.session || !data.user) {
      setPendingEmailState(cleanEmail);
      setNotice({
        tone: 'ok',
        message: 'Account created. Enter the 6-digit code from the confirmation email, or open the link in it.',
      });
      return { ok: true, needsVerification: true };
    }
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data.user) {
      return { ok: false, error: 'Unable to verify your session. Please sign in.' };
    }
    const session = toUser(verified.data.user);
    setUser(session);
    return { ok: true, user: session };
  }, []);

  const login = useCallback<AuthState['login']>(async (email, password) => {
    const client = licensingClient();
    if (!client) {
      return { ok: false, error: 'This build is not connected to the licensing service. Contact the administrator.' };
    }
    const cleanEmail = normalizeEmail(email);
    const { error } = await client.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) {
      const friendly = friendlyAuthError(error.message);
      if (friendly.toLowerCase().includes('not verified')) setPendingEmailState(cleanEmail);
      return { ok: false, error: friendly };
    }
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data.user) {
      return { ok: false, error: 'Unable to verify your session. Please try again.' };
    }
    const session = toUser(verified.data.user);
    setUser(session);
    setPendingEmailState(null);
    return { ok: true, user: session };
  }, []);

  const verifyEmailOtp = useCallback<AuthState['verifyEmailOtp']>(async (email, token) => {
    const client = licensingClient();
    if (!client) return { ok: false, error: 'Licensing service unavailable.' };
    const clean = normalizeEmail(email);
    const code = token.replace(/\D/g, '');
    if (code.length < 6) return { ok: false, error: 'Enter the 6-digit code from your email.' };
    const { data, error } = await client.auth.verifyOtp({ email: clean, token: code, type: 'signup' });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };
    if (!data.session && !data.user) return { ok: false, error: 'Verification failed. Request a new code.' };
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data.user) {
      return { ok: true };
    }
    setUser(toUser(verified.data.user));
    setPendingEmailState(null);
    return { ok: true };
  }, []);

  const resendVerification = useCallback<AuthState['resendVerification']>(async (email) => {
    const client = licensingClient();
    if (!client) return { ok: false, error: 'Licensing service unavailable.' };
    const redirectTo = authRedirectUrl();
    const { error } = await client.auth.resend({
      type: 'signup',
      email: normalizeEmail(email),
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };
    return { ok: true };
  }, []);

  const requestPasswordReset = useCallback<AuthState['requestPasswordReset']>(async (email) => {
    const client = licensingClient();
    if (!client) return { ok: false, error: 'Licensing service unavailable.' };
    const redirectTo = authRedirectUrl();
    const { error } = await client.auth.resetPasswordForEmail(normalizeEmail(email), {
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };
    return { ok: true };
  }, []);

  const updatePassword = useCallback<AuthState['updatePassword']>(async (password) => {
    const client = licensingClient();
    if (!client) return { ok: false, error: 'Licensing service unavailable.' };
    if (!password || password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
    if (password.length > 128) return { ok: false, error: 'Password must be 128 characters or fewer.' };
    const { error } = await client.auth.updateUser({ password });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };
    setRecovery(false);
    return { ok: true };
  }, []);

  const updateDisplayName = useCallback(async (name: string) => {
    const client = licensingClient();
    if (!client || !name.trim()) return;
    const { data, error } = await client.auth.updateUser({ data: { display_name: name.trim().slice(0, 60) } });
    if (error) throw error;
    if (data.user) setUser(toUser(data.user));
  }, []);

  const logout = useCallback(async () => {
    const client = licensingClient();
    if (client) await client.auth.signOut();
    setUser(null);
    setPendingEmailState(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    // Account deletion requires an administrative endpoint; never claim a local
    // deletion removed a centralized account.
    throw new Error('Contact the administrator to delete your account.');
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      modalOpen,
      modalMode,
      pendingEmail,
      notice,
      recovery,
      openAuth,
      closeAuth,
      setPendingEmail,
      clearNotice,
      dismissRecovery,
      register,
      login,
      verifyEmailOtp,
      resendVerification,
      requestPasswordReset,
      updatePassword,
      updateDisplayName,
      logout,
      deleteAccount,
    }),
    [
      ready,
      user,
      modalOpen,
      modalMode,
      pendingEmail,
      notice,
      recovery,
      openAuth,
      closeAuth,
      setPendingEmail,
      clearNotice,
      dismissRecovery,
      register,
      login,
      verifyEmailOtp,
      resendVerification,
      requestPasswordReset,
      updatePassword,
      updateDisplayName,
      logout,
      deleteAccount,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
