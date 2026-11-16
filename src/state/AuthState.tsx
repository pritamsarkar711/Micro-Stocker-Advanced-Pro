import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { kv } from '@/lib/kv';
import { getSupabase, isConfigured, type CloudConfig } from '@/lib/cloud/config';
import { useApp } from './AppState';

/**
 * Direct email & password account system with immediate sign in.
 * No email confirmation link or verification code is ever required.
 * Passwords are salted and hashed with PBKDF2 SHA256 via Web Crypto.
 */

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

const ACCOUNTS_KEY = 'msap:accounts';
const SESSION_KEY = 'msap:auth-session';
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
  if (!password || password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
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

async function syncAccountToCloud(cfg: CloudConfig, account: StoredAccount): Promise<boolean> {
  if (!isConfigured(cfg)) return false;
  try {
    const client = await getSupabase(cfg);
    if (!client) return false;
    const { error } = await client.from('user_accounts').upsert(
      {
        id: account.id,
        email: account.email,
        display_name: account.displayName,
        password_hash: account.passwordHash,
        password_salt: account.passwordSalt,
        created_at: account.createdAt,
        last_login_at: account.lastLoginAt,
      },
      { onConflict: 'email' },
    );
    return !error;
  } catch {
    return false;
  }
}

async function fetchAccountFromCloud(cfg: CloudConfig, email: string): Promise<StoredAccount | null> {
  if (!isConfigured(cfg)) return null;
  try {
    const client = await getSupabase(cfg);
    if (!client) return null;
    const { data, error } = await client
      .from('user_accounts')
      .select('id,email,display_name,password_hash,password_salt,created_at,last_login_at')
      .eq('email', normalizeEmail(email))
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      email: String(data.email),
      displayName: String(data.display_name || ''),
      passwordHash: String(data.password_hash),
      passwordSalt: String(data.password_salt),
      createdAt: String(data.created_at),
      lastLoginAt: String(data.last_login_at),
    };
  } catch {
    return null;
  }
}

export type AuthModalMode = 'login' | 'register' | 'account';

interface AuthState {
  ready: boolean;
  user: UserSession | null;
  modalOpen: boolean;
  modalMode: AuthModalMode;
  openAuth: (mode?: AuthModalMode) => void;
  closeAuth: () => void;
  register: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ ok: true; user: UserSession } | { ok: false; error: string }>;
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: true; user: UserSession } | { ok: false; error: string }>;
  updateDisplayName: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { cloud } = useApp();
  const [ready, setReady] = useState(false);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [user, setUser] = useState<UserSession | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<AuthModalMode>('login');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [savedAccounts, savedSession] = await Promise.all([
        kv.get<StoredAccount[]>(ACCOUNTS_KEY, []),
        kv.get<UserSession | null>(SESSION_KEY, null),
      ]);
      if (cancelled) return;
      setAccounts(Array.isArray(savedAccounts) ? savedAccounts : []);
      setUser(savedSession);
      setReady(true);
    })();
    return () => {
      cancelled = true;
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

  const register = useCallback<AuthState['register']>(
    async (email, password, displayName) => {
      const current = await kv.get<StoredAccount[]>(ACCOUNTS_KEY, accounts);
      const remoteExisting = await fetchAccountFromCloud(cloud, email);
      const pool = remoteExisting && !current.some((a) => a.email === remoteExisting.email)
        ? [...current, remoteExisting]
        : current;

      const created = await createAccountRecord(pool, email, password, displayName);
      if (!created.ok) return created;

      const synced = await syncAccountToCloud(cloud, created.account);
      const session: UserSession = { ...created.session, syncedToCloud: synced };
      const nextAccounts = [...pool, created.account];

      setAccounts(nextAccounts);
      setUser(session);
      await Promise.all([kv.set(ACCOUNTS_KEY, nextAccounts), kv.set(SESSION_KEY, session)]);
      return { ok: true, user: session };
    },
    [accounts, cloud],
  );

  const login = useCallback<AuthState['login']>(
    async (email, password) => {
      const current = await kv.get<StoredAccount[]>(ACCOUNTS_KEY, accounts);
      let pool = current;
      const normalized = normalizeEmail(email);
      if (!pool.some((a) => a.email === normalized)) {
        const remote = await fetchAccountFromCloud(cloud, normalized);
        if (remote) pool = [...pool, remote];
      }

      const result = await authenticateAccountRecord(pool, email, password);
      if (!result.ok) return result;

      const synced = await syncAccountToCloud(cloud, result.account);
      const session: UserSession = { ...result.session, syncedToCloud: synced };
      const nextAccounts = pool.map((a) => (a.email === result.account.email ? result.account : a));

      setAccounts(nextAccounts);
      setUser(session);
      await Promise.all([kv.set(ACCOUNTS_KEY, nextAccounts), kv.set(SESSION_KEY, session)]);
      return { ok: true, user: session };
    },
    [accounts, cloud],
  );

  const updateDisplayName = useCallback(
    async (name: string) => {
      const clean = name.trim();
      if (!user || !clean) return;
      const nextUser = { ...user, displayName: clean };
      const nextAccounts = accounts.map((a) => (a.id === user.id ? { ...a, displayName: clean } : a));
      setUser(nextUser);
      setAccounts(nextAccounts);
      await Promise.all([kv.set(SESSION_KEY, nextUser), kv.set(ACCOUNTS_KEY, nextAccounts)]);
      const updated = nextAccounts.find((a) => a.id === user.id);
      if (updated) void syncAccountToCloud(cloud, updated);
    },
    [accounts, cloud, user],
  );

  const logout = useCallback(async () => {
    setUser(null);
    await kv.del(SESSION_KEY);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    const nextAccounts = accounts.filter((a) => a.id !== user.id);
    setAccounts(nextAccounts);
    setUser(null);
    await Promise.all([kv.set(ACCOUNTS_KEY, nextAccounts), kv.del(SESSION_KEY)]);
    if (isConfigured(cloud)) {
      const client = await getSupabase(cloud);
      if (client) {
        try {
          await client.from('user_accounts').delete().eq('id', user.id);
        } catch {
          /* ignore remote removal errors */
        }
      }
    }
  }, [accounts, cloud, user]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      modalOpen,
      modalMode,
      openAuth,
      closeAuth,
      register,
      login,
      updateDisplayName,
      logout,
      deleteAccount,
    }),
    [
      ready,
      user,
      modalOpen,
      modalMode,
      openAuth,
      closeAuth,
      register,
      login,
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
