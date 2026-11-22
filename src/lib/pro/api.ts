/**
 * Typed access to the subscription backend.
 *
 * Every function here is a thin wrapper over a server-side RPC or an RLS-shaped
 * select. Nothing in this module decides what a user may do: it asks the server,
 * and the server answers with the entitlement it computed itself.
 */

import { licensingClient } from '@/lib/cloud/licensing';
import { isAndroid } from '@/lib/native/platform';

export interface PlanFeatures {
  vector?: boolean;
  jpg?: boolean;
  premium_upscale?: boolean;
  video_premium?: boolean;
  max_export_px?: number;
  queue_priority?: number;
}

export interface Plan {
  slug: string;
  name: string;
  tier: number;
  tagline: string;
  features: PlanFeatures;
  active: boolean;
  sort: number;
}

export interface PlanPrice {
  plan_slug: string;
  months: number;
  price_bdt: number;
  price_usd: number;
  credits: number;
  active: boolean;
}

export interface PaymentMethod {
  id: 'bkash' | 'nagad' | 'crypto';
  label: string;
  enabled: boolean;
  sort: number;
  config: { numbers?: string[]; instructions?: string; auto?: boolean; type?: string };
}

export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  network: string;
  address: string;
  /** Token contract; null for a chain's native coin. */
  contract?: string | null;
  wallet_label?: string | null;
  decimals: number;
  min_usd: number;
  confirmations: number;
  explorer: string;
  enabled: boolean;
  sort: number;
}

export interface Order {
  id: string;
  plan_slug: string;
  months: number;
  amount_bdt: number;
  credits: number;
  method: string;
  status: 'awaiting' | 'submitted' | 'approved' | 'rejected' | 'expired' | 'refunded';
  txn_ref: string | null;
  review_note: string | null;
  created_at: string;
  expires_at: string;
  user_id?: string;
}

export interface Invoice {
  invoice_id: string;
  order_id: string;
  asset_id: string;
  symbol: string;
  network: string;
  address: string;
  amount_expected: string | number;
  amount_received: string | number;
  status: 'pending' | 'seen' | 'confirmed' | 'mismatch' | 'expired';
  confirmations: number;
  required_confirmations: number;
  tx_hash: string | null;
  expires_at: string;
}

export interface Entitlement {
  active: boolean;
  authenticated: boolean;
  blocked: boolean;
  is_admin: boolean;
  credits: number;
  plan: string | null;
  plan_name: string | null;
  tier: number;
  expires_at: string | null;
  days_left: number | null;
  features: PlanFeatures;
}

export interface Quote {
  plan: string;
  plan_name: string;
  months: number;
  price_bdt: number;
  price_usd: number;
  credits: number;
  method: string;
  method_config: PaymentMethod['config'];
  crypto: Record<string, { amount: number; decimals: number }>;
}

export interface CryptoInvoice {
  invoice_id: string;
  order_id: string;
  asset: string;
  symbol: string;
  name: string;
  network: string;
  address: string;
  amount: number;
  amount_usd: number;
  decimals: number;
  confirmations_required: number;
  expires_at: string;
  explorer: string;
  status: string;
}

/** Provider invoices are in USD; the console shows and edits them in BDT. */
export const FX_BDT_USD = 122;

export interface AdminStats {
  window_days: number;
  revenue_bdt: number;
  api_cost_usd: number;
  api_cost_bdt: number;
  margin_bdt: number;
  margin_pct: number | null;
  orders_pending: number;
  orders_approved: number;
  active_subs: number;
  users: number;
  generations: number;
  generations_failed: number;
  by_model: Array<{ model_id: string | null; calls: number; tokens_in: number; tokens_out: number; cost_usd: number }>;
}

export interface AdminUser {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  blocked: boolean;
  plan: string | null;
  expires_at: string | null;
  credits: number;
  spent_bdt: number;
  generations: number;
  joined: string;
  last_seen: string | null;
  confirmed: boolean;
}

export interface AiProvider {
  id: string;
  label: string;
  base_url: string;
  kind: string;
  enabled: boolean;
  key_hint: string | null;
  key_updated_at: string | null;
}

export interface AiModel {
  id: string;
  provider_id: string;
  upstream_id: string;
  label: string;
  kind: 'vector' | 'image';
  premium: boolean;
  enabled: boolean;
  cost_in_per_mtok: number;
  cost_out_per_mtok: number;
  cost_per_image_usd: number;
  notes: string | null;
}

export interface Setting {
  key: string;
  value: unknown;
  label: string;
  updated_at: string;
}

type Failure = { error: string };

function messageOf(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return 'request failed';
}

/**
 * Supabase's client has no request timeout, so a stalled mobile connection used
 * to leave a screen spinning forever. Every call now fails in 20 seconds with a
 * message the UI can show.
 */
const RPC_TIMEOUT_MS = 20_000;

function withTimeout<T>(task: Promise<T>, label: string): Promise<T | { error: string }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ error: string }>((resolve) => {
    timer = setTimeout(() => resolve({ error: `${label} timed out. Check the connection and try again.` }), RPC_TIMEOUT_MS);
  });
  return Promise.race([task, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T | Failure> {
  const client = licensingClient();
  if (!client) return { error: 'Cloud project is not connected' };
  const result = await withTimeout(
    Promise.resolve(client.rpc(name, params)) as unknown as Promise<{ data: T | null; error: unknown }>,
    'The server did not answer',
  );
  if (!result || typeof result !== 'object') return { error: 'The server did not answer' };
  if ('error' in result && result.error && !(result as { data?: unknown }).data) {
    // A timeout resolves with `{ error: string }`; a PostgREST failure carries
    // an error object that still has to be turned into readable text.
    return { error: typeof result.error === 'string' ? result.error : messageOf(result.error) };
  }
  return (result as { data: T }).data as T;
}

async function select<T>(table: string, build?: (query: unknown) => unknown): Promise<T[] | Failure> {
  const client = licensingClient();
  if (!client) return { error: 'Cloud project is not connected' };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = (client as any).from(table).select('*');
  if (build) query = build(query);
  const result = await withTimeout(
    Promise.resolve(query) as Promise<{ data: T[] | null; error: unknown }>,
    `Loading ${table}`,
  );
  if (!result || typeof result !== 'object') return { error: `Loading ${table} failed` };
  if ('error' in result && result.error) {
    return { error: typeof result.error === 'string' ? result.error : messageOf(result.error) };
  }
  return ((result as { data: T[] | null }).data ?? []) as T[];
}

export function isFailure<T>(value: T | Failure): value is Failure {
  return Boolean(value && typeof value === 'object' && 'error' in (value as object));
}

/* --------------------------------------------------------------- catalogue */

export async function loadCatalog() {
  const [plans, prices, methods, assets] = await Promise.all([
    select<Plan>('plans', (q) => (q as { order(column: string): unknown }).order('tier')),
    select<PlanPrice>('plan_prices', (q) => (q as { order(column: string): unknown }).order('months')),
    select<PaymentMethod>('payment_methods', (q) => (q as { order(column: string): unknown }).order('sort')),
    select<CryptoAsset>('crypto_assets', (q) => (q as { order(column: string): unknown }).order('sort')),
  ]);
  const androidOnly = isAndroid();
  return {
    // vecmotion sells a single minimal-fee plan; the desktop catalogue stays intact.
    plans: isFailure(plans) ? [] : plans.filter((plan) => plan.active && (!androidOnly || plan.slug === 'vecmotion')),
    prices: isFailure(prices) ? [] : prices.filter((price) => price.active && (!androidOnly || price.plan_slug === 'vecmotion')),
    methods: isFailure(methods) ? [] : methods.filter((method) => method.enabled),
    assets: isFailure(assets) ? [] : assets.filter((asset) => asset.enabled),
    error: [plans, prices, methods, assets].find(isFailure)?.error,
  };
}

export const entitlement = () => rpc<Entitlement>('pro_my_entitlement');

export const quote = (plan: string, months: number, method: string) => rpc<Quote>('pro_quote', { p_plan: plan, p_months: months, p_method: method });

export interface SubmitInput {
  plan: string;
  months: number;
  method: string;
  txnRef?: string;
  sender?: string;
  note?: string;
  contact?: string;
}

export const submitPayment = (input: SubmitInput) =>
  rpc<{ order_id: string; status: string; amount_bdt: number; credits: number; expires_at: string; method: string; instructions: PaymentMethod['config'] }>(
    'pro_submit_payment',
    {
      p_plan: input.plan,
      p_months: input.months,
      p_method: input.method,
      p_txn_ref: input.txnRef ?? null,
      p_sender: input.sender ?? null,
      p_note: input.note ?? null,
      p_contact: input.contact ?? null,
    },
  );

export const myOrders = () => rpc<Order[]>('pro_my_orders');
export const myInvoices = () => rpc<Invoice[]>('pro_my_invoices');
export const createCryptoInvoice = (orderId: string, asset: string) =>
  rpc<CryptoInvoice>('pro_create_crypto_invoice', { p_order: orderId, p_asset: asset });

export interface CryptoCheck {
  status: string;
  confirmed?: boolean;
  message?: string;
  reason?: string;
  /** Raw failure text from the chain reader, when the network answered badly. */
  error?: string;
  confirmations?: number;
  required?: number;
  amount?: number;
  network?: string;
  tx_hash?: string;
}

export async function verifyCrypto(invoiceId: string, txHash?: string) {
  const client = licensingClient();
  if (!client) return { error: 'Cloud project is not connected' } as Failure;
  const result = await withTimeout(
    Promise.resolve(client.functions.invoke('crypto-verify', { body: { invoice_id: invoiceId, tx_hash: txHash } })) as unknown as Promise<{ data: CryptoCheck | null; error: unknown }>,
    'The chain check did not answer',
  );
  if ('error' in result && result.error) {
    return { error: typeof result.error === 'string' ? result.error : messageOf(result.error) } as Failure;
  }
  return (result as { data: CryptoCheck }).data;
}

/* ------------------------------------------------------------------- admin */

export const adminStats = (days = 30) => rpc<AdminStats>('pro_admin_stats', { p_days: days });
export const adminUsers = (search?: string) => rpc<AdminUser[]>('pro_admin_users', { p_search: search ?? null });
export const adminUpsertModel = (patch: Partial<AiModel> & { id: string }) =>
  rpc<AiModel>('pro_admin_upsert_model', { p_patch: patch });
export const adminUpsertProvider = (patch: Partial<AiProvider> & { id: string; base_url: string }) =>
  rpc<AiProvider>('pro_admin_upsert_provider', { p_patch: patch });
export const adminAssets = () => rpc<CryptoAsset[]>('pro_admin_assets');
export const adminUpdateAsset = (id: string, patch: Partial<CryptoAsset>) =>
  rpc<CryptoAsset>('pro_admin_update_asset', { p_id: id, p_patch: patch });
export const adminReviewOrder = (orderId: string, approve: boolean, note?: string) =>
  rpc<{ order: string; status: string; subscription: string | null }>('pro_admin_review_order', { p_order: orderId, p_approve: approve, p_note: note ?? null });
export const adminSetBlocked = (userId: string, blocked: boolean) =>
  rpc<boolean>('pro_admin_set_blocked', { p_user: userId, p_blocked: blocked });
export const adminDeleteUser = (userId: string) => rpc<boolean>('pro_admin_delete_user', { p_user: userId });
export const adminGrant = (userId: string, plan: string, months: number, note?: string) =>
  rpc<string>('pro_admin_grant', { p_user: userId, p_plan: plan, p_months: months, p_note: note ?? 'manual grant' });
export const adminAdjustCredits = (userId: string, delta: number, reason: string) =>
  rpc<number>('pro_add_credits', { p_user: userId, p_amount: delta, p_reason: reason });
export const adminAudit = () => rpc<Array<{ id: number; actor: string | null; action: string; target: string | null; detail: unknown; created_at: string }>>('pro_admin_audit_tail', { p_limit: 60 });

export const adminOrders = () =>
  select<Order & { user_id: string; contact: string | null; sender_hint: string | null; review_note: string | null }>('payment_orders', (q) =>
    (q as { order(column: string, options: { ascending: boolean }): unknown }).order('created_at', { ascending: false }),
  );

export const adminProviders = () => select<AiProvider>('ai_providers', (q) => (q as { order(column: string): unknown }).order('sort'));
export const adminModels = () => select<AiModel>('ai_models', (q) => (q as { order(column: string): unknown }).order('sort'));
export const adminSettings = () => select<Setting>('app_settings', (q) => (q as { order(column: string): unknown }).order('key'));

export const updateModel = async (id: string, patch: Partial<AiModel>) =>
  update('ai_models', id, patch);
export const updateProvider = async (id: string, patch: Partial<AiProvider>) =>
  update('ai_providers', id, patch);
export const updatePrice = async (plan: string, months: number, patch: Partial<PlanPrice>) => {
  const client = licensingClient();
  if (!client) return { error: 'Cloud project is not connected' } as Failure;
  const { error } = await (client as unknown as { from(table: string): { update(values: unknown): { match(query: unknown): Promise<{ error: unknown }> } } })
    .from('plan_prices')
    .update(patch)
    .match({ plan_slug: plan, months });
  return error ? ({ error: messageOf(error) } as Failure) : { ok: true };
};
export const updateSetting = (key: string, value: unknown) => rpc<void>('pro_admin_set_setting', { p_key: key, p_value: value });

export interface AdminSecurityUser {
  user_id: string;
  email: string | null;
  role: string;
  blocked: boolean;
  /** Verified authenticator factors on the account. */
  factors: number;
  last_sign_in_at: string | null;
  created_at: string;
}

export const adminSecurityOverview = () => rpc<AdminSecurityUser[]>('pro_admin_security_overview');
export const adminResetMfa = (userId: string) => rpc<number>('pro_admin_reset_mfa', { p_user: userId });
export const adminExpireSubscriptions = () => rpc<number>('pro_admin_expire_subscriptions');
export const clearProviderKey = async (providerId: string) => {
  const client = licensingClient();
  if (!client) return { error: 'Cloud project is not connected' } as Failure;
  const { data, error } = await client.functions.invoke('admin-config', { body: { action: 'clear-key', provider_id: providerId } });
  if (error) return { error: messageOf(error) } as Failure;
  return data as { ok: boolean };
};

export const setProviderKey = async (providerId: string, secret: string) => {
  const client = licensingClient();
  if (!client) return { error: 'Cloud project is not connected' } as Failure;
  const { data, error } = await client.functions.invoke('admin-config', { body: { action: 'set-key', provider_id: providerId, secret } });
  if (error) return { error: messageOf(error) } as Failure;
  return data as { ok: boolean; key_hint: string };
};

async function update<T>(table: string, id: string, patch: Partial<T>) {
  const client = licensingClient();
  if (!client) return { error: 'Cloud project is not connected' } as Failure;
  const { error } = await (client as unknown as { from(table: string): { update(values: unknown): { eq(column: string, value: string): Promise<{ error: unknown }> } } })
    .from(table)
    .update(patch)
    .eq('id', id);
  return error ? ({ error: messageOf(error) } as Failure) : { ok: true };
}

/** Formats a monthly price for display, keeping the term discount honest. */
export function monthlyEquivalent(price: number, months: number): number {
  return Math.round(price / months);
}

export function termLabel(months: number): string {
  if (months === 1) return 'Monthly';
  if (months === 6) return '6 months';
  if (months === 12) return 'Yearly';
  return `${months} months`;
}
