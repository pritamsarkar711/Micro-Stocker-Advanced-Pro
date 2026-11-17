/**
 * Development-only preview client.
 *
 * The live preview cannot reach a real Supabase project, so this module keeps an
 * in-memory stand-in for Auth and the licensing RPCs. It only activates when
 * `vite dev` runs with `VITE_DEMO_MODE=1`; production builds compile
 * `import.meta.env.DEV` to `false`, so a real server is always required.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';

export const demoMode = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === '1';

const SESSION_KEY = 'msap.demo.session';
const DAY = 86_400_000;

interface DemoUser {
  id: string;
  email: string;
  created_at: string;
  display_name: string;
  admin: boolean;
  expires_at: number | null;
  blocked: boolean;
}
interface DemoCode {
  id: string;
  code: string;
  kind: 'premium' | 'trial';
  duration_seconds: number;
  created_at: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
  revoked_at: string | null;
}
interface DemoAudit {
  id: number;
  action: string;
  actor_email: string | null;
  target_email: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

function uid(): string {
  return crypto.randomUUID();
}
function hex(bytes: number): string {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

const nowIso = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

const users: DemoUser[] = [
  { id: 'd0000000-0000-4000-8000-000000000001', email: 'admin@demo.local', created_at: daysAgo(120), display_name: 'Studio Admin', admin: true, expires_at: null, blocked: false },
  { id: 'd0000000-0000-4000-8000-000000000002', email: 'alice@demo.local', created_at: daysAgo(42), display_name: 'Alice Rahman', admin: false, expires_at: Date.now() + 21 * DAY, blocked: false },
  { id: 'd0000000-0000-4000-8000-000000000003', email: 'bob@demo.local', created_at: daysAgo(19), display_name: 'Bob Ahmed', admin: false, expires_at: null, blocked: false },
  { id: 'd0000000-0000-4000-8000-000000000004', email: 'carol@demo.local', created_at: daysAgo(7), display_name: 'Carol Das', admin: false, expires_at: Date.now() - 2 * DAY, blocked: false },
];

const codes: DemoCode[] = [
  { id: uid(), code: hex(20), kind: 'premium', duration_seconds: 30 * 86_400, created_at: daysAgo(40), redeemed_at: daysAgo(41), redeemed_by: users[1].id, revoked_at: null },
  { id: uid(), code: hex(20), kind: 'trial', duration_seconds: 7 * 86_400, created_at: daysAgo(20), redeemed_at: daysAgo(19), redeemed_by: users[3].id, revoked_at: null },
  { id: uid(), code: hex(20), kind: 'premium', duration_seconds: 90 * 86_400, created_at: daysAgo(12), redeemed_at: null, redeemed_by: null, revoked_at: null },
  { id: uid(), code: hex(20), kind: 'premium', duration_seconds: 365 * 86_400, created_at: daysAgo(9), redeemed_at: null, redeemed_by: null, revoked_at: null },
  { id: uid(), code: hex(20), kind: 'trial', duration_seconds: 7 * 86_400, created_at: daysAgo(5), redeemed_at: null, redeemed_by: null, revoked_at: daysAgo(4) },
  { id: uid(), code: hex(20), kind: 'premium', duration_seconds: 30 * 86_400, created_at: daysAgo(1), redeemed_at: null, redeemed_by: null, revoked_at: null },
];

const audit: DemoAudit[] = [
  { id: 2, action: 'grant_days', actor_email: 'admin@demo.local', target_email: 'alice@demo.local', detail: { days: 30 }, created_at: daysAgo(2) },
  { id: 1, action: 'create_code', actor_email: 'admin@demo.local', target_email: null, detail: { duration: '365d' }, created_at: daysAgo(9) },
];

let signedInId: string | null = null;
try {
  signedInId = localStorage.getItem(SESSION_KEY);
} catch {
  signedInId = null;
}

type Listener = (event: string, session: { user: User } | null) => void;
const listeners = new Set<Listener>();
function emit(event: string) {
  const user = currentUser();
  const session = user ? { user } : null;
  for (const listener of listeners) listener(event, session);
}

function toSupabaseUser(user: DemoUser): User {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    app_metadata: {},
    user_metadata: { display_name: user.display_name },
    aud: 'authenticated',
    role: 'authenticated',
    last_sign_in_at: nowIso(),
  } as User;
}

function currentUser(): User | null {
  const user = users.find((u) => u.id === signedInId);
  return user ? toSupabaseUser(user) : null;
}

function me(): DemoUser | null {
  return users.find((u) => u.id === signedInId) ?? null;
}

function ensureUser(email: string): DemoUser {
  const normalized = email.trim().toLowerCase();
  const existing = users.find((u) => u.email === normalized);
  if (existing) return existing;
  const created: DemoUser = {
    id: uid(),
    email: normalized,
    created_at: nowIso(),
    display_name: normalized.split('@')[0].replace(/[._-]+/g, ' '),
    admin: normalized.startsWith('admin'),
    expires_at: null,
    blocked: false,
  };
  users.push(created);
  return created;
}

function notAdmin() {
  return { data: null, error: { message: 'Not authorized' } };
}
function ok(data: unknown) {
  return { data, error: null };
}

function publicUserRow(user: DemoUser) {
  return {
    user_id: user.id,
    email: user.email,
    created_at: user.created_at,
    expires_at: user.expires_at ? new Date(user.expires_at).toISOString() : null,
    is_blocked: user.blocked,
  };
}


/* ------------------------------------------------------------------------- */
/*  Demo two factor (preview builds only)                                    */
/* ------------------------------------------------------------------------- */

const MFA_KEY = 'msap.demo.mfa';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

interface DemoFactor {
  id: string;
  friendlyName: string;
  createdAt: string;
  secret: string;
  verified: boolean;
}

function readFactors(): DemoFactor[] {
  try {
    const raw = localStorage.getItem(MFA_KEY);
    const parsed = raw ? (JSON.parse(raw) as DemoFactor[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFactors(list: DemoFactor[]): void {
  try {
    localStorage.setItem(MFA_KEY, JSON.stringify(list));
  } catch {
    /* preview storage is best effort */
  }
}

function randomSecret(bytes = 20): string {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes));
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function decodeBase32(secret: string): Uint8Array<ArrayBuffer> {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = B32.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const bytes = new Uint8Array(new ArrayBuffer(out.length));
  bytes.set(out);
  return bytes;
}

/** RFC 6238 TOTP so the preview validates real authenticator codes. */
async function totpFor(secret: string, offset = 0): Promise<string> {
  const counter = Math.floor(Date.now() / 30_000) + offset;
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(4, counter, false);
  const key = await crypto.subtle.importKey('raw', decodeBase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, buffer));
  const start = digest[19] & 0x0f;
  const code =
    ((digest[start] & 0x7f) << 24) | (digest[start + 1] << 16) | (digest[start + 2] << 8) | digest[start + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

let demoAal: 'aal1' | 'aal2' = 'aal1';

const demoAuth = {
  async getUser() {
    const user = currentUser();
    return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'No session' } };
  },
  async getSession() {
    const user = currentUser();
    return { data: { session: user ? { user, access_token: 'demo' } : null }, error: null };
  },
  mfa: {
    async listFactors() {
      const factors = readFactors().map((factor) => ({
        id: factor.id,
        friendly_name: factor.friendlyName,
        factor_type: 'totp',
        status: factor.verified ? 'verified' : 'unverified',
        created_at: factor.createdAt,
        updated_at: factor.createdAt,
      }));
      return { data: { all: factors, totp: factors }, error: null };
    },
    async enroll({ friendlyName }: { friendlyName?: string } = {}) {
      const factor: DemoFactor = {
        id: `factor_${Math.random().toString(36).slice(2, 12)}`,
        friendlyName: friendlyName || 'Authentication app',
        createdAt: nowIso(),
        secret: randomSecret(),
        verified: false,
      };
      writeFactors([...readFactors(), factor]);
      const email = me()?.email ?? 'account';
      return {
        data: {
          id: factor.id,
          type: 'totp',
          friendly_name: factor.friendlyName,
          totp: {
            qr_code: '',
            secret: factor.secret,
            uri: `otpauth://totp/Micro%20Stocker%20Advanced%20Pro:${encodeURIComponent(email)}?secret=${factor.secret}&issuer=Micro%20Stocker%20Advanced%20Pro`,
          },
        },
        error: null,
      };
    },
    async challenge() {
      return { data: { id: `challenge_${Math.random().toString(36).slice(2, 10)}`, expires_at: Date.now() + 300_000 }, error: null };
    },
    async verify({ factorId, code }: { factorId: string; code: string }) {
      const factor = readFactors().find((item) => item.id === factorId);
      if (!factor) return { data: null, error: { message: 'Factor not found' } };
      const trimmed = String(code ?? '').replace(/\D/g, '');
      if (trimmed.length !== 6) return { data: null, error: { message: 'Invalid TOTP code entered' } };
      const candidates = await Promise.all([totpFor(factor.secret, -1), totpFor(factor.secret, 0), totpFor(factor.secret, 1)]);
      if (!candidates.includes(trimmed)) {
        return { data: null, error: { message: 'Invalid TOTP code entered' } };
      }
      writeFactors(readFactors().map((item) => (item.id === factorId ? { ...item, verified: true } : item)));
      demoAal = 'aal2';
      return { data: { access_token: 'demo', token_type: 'bearer' }, error: null };
    },
    async unenroll({ factorId }: { factorId: string }) {
      writeFactors(readFactors().filter((item) => item.id !== factorId));
      demoAal = 'aal1';
      return { data: { id: factorId }, error: null };
    },
    async getAuthenticatorAssuranceLevel() {
      const hasFactor = Boolean(readFactors().some((factor) => factor.verified));
      return {
        data: {
          currentLevel: hasFactor ? demoAal : 'aal1',
          nextLevel: hasFactor ? 'aal2' : 'aal1',
          currentAuthenticationMethods: hasFactor ? [{ method: 'password', timestamp: Date.now() }] : [],
        },
        error: null,
      };
    },
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    if (!password || password.length < 8) {
      return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
    }
    const user = ensureUser(email);
    signedInId = user.id;
    demoAal = 'aal1';
    try {
      localStorage.setItem(SESSION_KEY, user.id);
    } catch {
      /* ignore */
    }
    emit('SIGNED_IN');
    return { data: { user: toSupabaseUser(user), session: { user: toSupabaseUser(user) } }, error: null };
  },
  async signUp({ email, options }: { email: string; options?: { data?: { display_name?: string } } }) {
    const user = ensureUser(email);
    if (options?.data?.display_name) user.display_name = options.data.display_name;
    return { data: { user: toSupabaseUser(user), session: null }, error: null };
  },
  async verifyOtp({ email, token }: { email: string; token: string }) {
    if (!/^\d{6,}$/.test(token)) return { data: null, error: { message: 'Token has expired or is invalid' } };
    const user = ensureUser(email);
    signedInId = user.id;
    demoAal = 'aal1';
    try {
      localStorage.setItem(SESSION_KEY, user.id);
    } catch {
      /* ignore */
    }
    emit('SIGNED_IN');
    return { data: { user: toSupabaseUser(user), session: { user: toSupabaseUser(user) } }, error: null };
  },
  async resend() {
    return { data: {}, error: null };
  },
  async resetPasswordForEmail() {
    return { data: {}, error: null };
  },
  async updateUser(patch: { data?: { display_name?: string }; password?: string }) {
    const user = me();
    if (!user) return { data: { user: null }, error: { message: 'No session' } };
    if (patch.password && patch.password.length < 8) {
      return { data: { user: null }, error: { message: 'Password should be at least 8 characters' } };
    }
    if (patch.data?.display_name) user.display_name = patch.data.display_name;
    return { data: { user: toSupabaseUser(user) }, error: null };
  },
  async signOut() {
    signedInId = null;
    demoAal = 'aal1';
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    emit('SIGNED_OUT');
    return { error: null };
  },
  onAuthStateChange(callback: Listener) {
    listeners.add(callback);
    setTimeout(() => callback('INITIAL_SESSION', currentUser() ? { user: currentUser()! } : null), 0);
    return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
  },
};

const rpcHandlers: Record<string, (params: Record<string, unknown>) => unknown> = {
  msap_my_entitlement() {
    const user = me();
    if (!user) return { data: null, error: { message: 'Not signed in' } };
    return ok([
      {
        expires_at: user.expires_at ? new Date(user.expires_at).toISOString() : null,
        server_time: nowIso(),
        is_admin: user.admin,
        is_blocked: user.blocked,
      },
    ]);
  },
  msap_redeem_code(params) {
    const user = me();
    if (!user) return { data: null, error: { message: 'Sign in first' } };
    if (user.blocked) return { data: null, error: { message: 'Account disabled' } };
    const raw = String(params.p_code ?? '').trim().toUpperCase();
    if (!/^[A-F0-9]{40}$/.test(raw)) return { data: null, error: { message: 'Invalid or unavailable code' } };
    const record = codes.find((c) => c.code === raw && !c.redeemed_at && !c.revoked_at);
    if (!record) return { data: null, error: { message: 'Invalid or unavailable code' } };
    record.redeemed_at = nowIso();
    record.redeemed_by = user.id;
    const base = Math.max(user.expires_at ?? 0, Date.now());
    user.expires_at = base + record.duration_seconds * 1000;
    return ok([{ expires_at: new Date(user.expires_at).toISOString(), server_time: nowIso() }]);
  },
  msap_create_code(params) {
    const user = me();
    if (!user?.admin) return notAdmin();
    const created: DemoCode = {
      id: uid(),
      code: hex(20),
      kind: (params.p_kind as 'premium' | 'trial') ?? 'premium',
      duration_seconds: Number(params.p_duration_seconds ?? 0),
      created_at: nowIso(),
      redeemed_at: null,
      redeemed_by: null,
      revoked_at: null,
    };
    codes.unshift(created);
    audit.unshift({ id: audit.length + 10, action: 'create_code', actor_email: user.email, target_email: null, detail: { duration: created.duration_seconds }, created_at: nowIso() });
    return ok([{ code: created.code, id: created.id, created_at: created.created_at }]);
  },
  msap_admin_codes() {
    if (!me()?.admin) return notAdmin();
    return ok(
      codes.map(({ id, kind, duration_seconds, created_at, redeemed_at, redeemed_by, revoked_at }) => ({
        id,
        kind,
        duration_seconds,
        created_at,
        redeemed_at,
        redeemed_by,
        revoked_at,
      })),
    );
  },
  msap_admin_users() {
    if (!me()?.admin) return notAdmin();
    return ok(users.map(publicUserRow));
  },
  msap_admin_revoke_code(params) {
    const user = me();
    if (!user?.admin) return notAdmin();
    const record = codes.find((c) => c.id === params.p_id);
    if (!record || record.redeemed_at) return { data: null, error: { message: 'Code is already used or not found' } };
    record.revoked_at = nowIso();
    return ok(null);
  },
  msap_admin_set_expiry(params) {
    if (!me()?.admin) return notAdmin();
    const target = users.find((u) => u.id === params.p_user_id);
    if (!target) return { data: null, error: { message: 'User not found' } };
    const parsed = Date.parse(String(params.p_expires_at ?? ''));
    if (!Number.isFinite(parsed)) return { data: null, error: { message: 'Invalid date' } };
    target.expires_at = parsed;
    return ok(null);
  },
  msap_admin_set_blocked(params) {
    const actor = me();
    if (!actor?.admin) return notAdmin();
    if (params.p_user_id === actor.id && params.p_blocked) {
      return { data: null, error: { message: 'Cannot block your own account' } };
    }
    const target = users.find((u) => u.id === params.p_user_id);
    if (!target) return { data: null, error: { message: 'User not found' } };
    target.blocked = Boolean(params.p_blocked);
    return ok(null);
  },
  msap_admin_grant_days(params) {
    if (!me()?.admin) return notAdmin();
    const target = users.find((u) => u.id === params.p_user_id);
    if (!target) return { data: null, error: { message: 'User not found' } };
    const days = Number(params.p_days ?? 0);
    target.expires_at = Math.max(target.expires_at ?? 0, Date.now()) + days * DAY;
    audit.unshift({ id: audit.length + 10, action: 'grant_days', actor_email: me()?.email ?? null, target_email: target.email, detail: { days }, created_at: nowIso() });
    return ok([{ expires_at: new Date(target.expires_at).toISOString() }]);
  },
  msap_admin_grant_email(params) {
    if (!me()?.admin) return notAdmin();
    const target = users.find((u) => u.email === String(params.p_email ?? '').trim().toLowerCase());
    if (!target) return { data: null, error: { message: 'No account found for that email' } };
    const days = Number(params.p_days ?? 0);
    target.expires_at = Math.max(target.expires_at ?? 0, Date.now()) + days * DAY;
    audit.unshift({ id: audit.length + 10, action: 'grant_days', actor_email: me()?.email ?? null, target_email: target.email, detail: { days }, created_at: nowIso() });
    return ok([{ user_id: target.id, expires_at: new Date(target.expires_at).toISOString() }]);
  },
  msap_admin_stats() {
    if (!me()?.admin) return notAdmin();
    return ok([
      {
        users_total: users.length,
        users_active: users.filter((u) => (u.expires_at ?? 0) > Date.now()).length,
        users_blocked: users.filter((u) => u.blocked).length,
        codes_total: codes.length,
        codes_available: codes.filter((c) => !c.redeemed_at && !c.revoked_at).length,
        codes_redeemed: codes.filter((c) => c.redeemed_at).length,
      },
    ]);
  },
  msap_admin_audit() {
    if (!me()?.admin) return notAdmin();
    return ok(audit);
  },
};

/** In-memory Supabase-shaped client (development preview only). */
function buildDemoClient(): SupabaseClient {
  return {
    auth: demoAuth,
    async rpc(name: string, params: Record<string, unknown> = {}) {
      const handler = rpcHandlers[name];
      if (!handler) return { data: null, error: { message: `Unknown RPC ${name}` } };
      return handler(params);
    },
  } as unknown as SupabaseClient;
}

// Stable singleton: callers rely on referential equality (effect deps, memo).
const instance = buildDemoClient();
export function demoClient(): SupabaseClient {
  return instance;
}
