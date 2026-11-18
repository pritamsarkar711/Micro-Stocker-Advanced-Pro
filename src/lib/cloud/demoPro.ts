/**
 * In-memory stand-in for the Pro RPCs (development preview only).
 *
 * It mirrors the server contract closely enough to exercise every screen: the
 * same plan grid, the same server-side pricing, the same "one TrxID, one order"
 * rule, the same credit and refund behaviour, and the same admin-only paths.
 * Production builds never import it unless VITE_DEMO_MODE is on in dev.
 */

const DAY = 86_400_000;
export const DEMO_ADMIN_ID = 'd0000000-0000-4000-8000-000000000001';
export const DEMO_ALICE_ID = 'd0000000-0000-4000-8000-000000000002';

type Json = Record<string, unknown>;

export interface DemoRow extends Json {
  id: string;
}

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

/** Invoices are quoted to six places at most, the precision wallets print. */
function quantize(value: number, decimals: number): number {
  const places = Math.min(decimals, 6);
  const scale = 10 ** places;
  return Math.ceil(value * scale) / scale;
}

export const plans: DemoRow[] = [
  { id: 'starter', slug: 'starter', name: 'Starter', tier: 1, tagline: 'Vector generators and every free tool', sort: 1, active: true, features: { vector: true, jpg: false, premium_upscale: false, video_premium: false, max_export_px: 4000, queue_priority: 1 } },
  { id: 'standard', slug: 'standard', name: 'Standard', tier: 2, tagline: 'Adds the JPG studio and the top upscale models', sort: 2, active: true, features: { vector: true, jpg: true, premium_upscale: true, video_premium: false, max_export_px: 6000, queue_priority: 2 } },
  { id: 'professional', slug: 'professional', name: 'Professional', tier: 3, tagline: 'Everything, including premium video upscaling', sort: 3, active: true, features: { vector: true, jpg: true, premium_upscale: true, video_premium: true, max_export_px: 8000, queue_priority: 3 } },
];

export const planPrices: DemoRow[] = [
  { id: 'starter-1', plan_slug: 'starter', months: 1, price_bdt: 299, price_usd: 2.45, credits: 150, active: true },
  { id: 'starter-6', plan_slug: 'starter', months: 6, price_bdt: 1590, price_usd: 13.05, credits: 900, active: true },
  { id: 'starter-12', plan_slug: 'starter', months: 12, price_bdt: 2690, price_usd: 22.05, credits: 1800, active: true },
  { id: 'standard-1', plan_slug: 'standard', months: 1, price_bdt: 699, price_usd: 5.75, credits: 450, active: true },
  { id: 'standard-6', plan_slug: 'standard', months: 6, price_bdt: 3690, price_usd: 30.25, credits: 2700, active: true },
  { id: 'standard-12', plan_slug: 'standard', months: 12, price_bdt: 6290, price_usd: 51.55, credits: 5400, active: true },
  { id: 'professional-1', plan_slug: 'professional', months: 1, price_bdt: 1299, price_usd: 10.65, credits: 1200, active: true },
  { id: 'professional-6', plan_slug: 'professional', months: 6, price_bdt: 6890, price_usd: 56.5, credits: 7200, active: true },
  { id: 'professional-12', plan_slug: 'professional', months: 12, price_bdt: 11690, price_usd: 95.8, credits: 14400, active: true },
];

export const paymentMethods: DemoRow[] = [
  { id: 'bkash', label: 'bKash', enabled: true, sort: 1, config: { numbers: ['01887799071'], type: 'personal', instructions: 'Send the exact amount with Send Money, then enter the TrxID.' } },
  { id: 'nagad', label: 'Nagad', enabled: true, sort: 2, config: { numbers: ['01887799071', '01617445106'], type: 'personal', instructions: 'Send the exact amount with Send Money, then enter the TrxID.' } },
  { id: 'crypto', label: 'Crypto', enabled: true, sort: 3, config: { auto: true, instructions: 'Pick a coin and network, then pay the exact amount to the invoice address.' } },
];

export const cryptoAssets: DemoRow[] = [
  { id: 'usdc-bsc', symbol: 'USDC', name: 'USD Coin', network: 'BEP20', address: '0x22f65aab136a15e8307ac8c6ff1af5a692c92e2c', contract: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', decimals: 18, usd_rate: 1, min_usd: 5, confirmations: 15, explorer: 'https://bscscan.com', enabled: true, sort: 1 },
  { id: 'usdc-sol', symbol: 'USDC', name: 'USD Coin', network: 'Solana', address: 'CMcLrsGRQxMnUHGihi3aMZkfgSjfPyHhn2AoE9hGeb3Z', contract: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, usd_rate: 1, min_usd: 5, confirmations: 1, explorer: 'https://solscan.io', enabled: true, sort: 2 },
  { id: 'usdc-polygon', symbol: 'USDC', name: 'USD Coin', network: 'Polygon', address: '0x22f65aab136a15e8307ac8c6ff1af5a692c92e2c', contract: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', decimals: 6, usd_rate: 1, min_usd: 5, confirmations: 128, explorer: 'https://polygonscan.com', enabled: true, sort: 3 },
  { id: 'usdt-bep20', symbol: 'USDT', name: 'Tether', network: 'BEP20', address: '0x22f65aab136a15e8307ac8c6ff1af5a692c92e2c', contract: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, usd_rate: 1, min_usd: 5, confirmations: 15, explorer: 'https://bscscan.com', enabled: true, sort: 4 },
  { id: 'usdt-trc20', symbol: 'USDT', name: 'Tether', network: 'TRC20', address: 'TCkDdhqFKrThJ5xmZEZZ2QKAmCfLkHGZES', decimals: 6, usd_rate: 1, min_usd: 5, confirmations: 19, explorer: 'https://tronscan.org', enabled: true, sort: 5 },
  { id: 'usdt-sol', symbol: 'USDT', name: 'Tether', network: 'Solana', address: 'CMcLrsGRQxMnUHGihi3aMZkfgSjfPyHhn2AoE9hGeb3Z', contract: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6, usd_rate: 1, min_usd: 5, confirmations: 1, explorer: 'https://solscan.io', enabled: true, sort: 6 },
  { id: 'bnb-bep20', symbol: 'BNB', name: 'BNB', network: 'BEP20', address: '0x22f65aab136a15e8307ac8c6ff1af5a692c92e2c', decimals: 18, usd_rate: 620, min_usd: 10, confirmations: 15, explorer: 'https://bscscan.com', enabled: true, sort: 7 },
  { id: 'sol-solana', symbol: 'SOL', name: 'Solana', network: 'Solana', address: 'CMcLrsGRQxMnUHGihi3aMZkfgSjfPyHhn2AoE9hGeb3Z', decimals: 9, usd_rate: 165, min_usd: 10, confirmations: 1, explorer: 'https://solscan.io', enabled: true, sort: 8 },
  { id: 'ltc-litecoin', symbol: 'LTC', name: 'Litecoin', network: 'Litecoin', address: 'LPBySh9zb4667sGA63M1krTHyoC7uXJ2iw', decimals: 8, usd_rate: 95, min_usd: 10, confirmations: 6, explorer: 'https://blockchair.com/litecoin', enabled: false, sort: 9 },
  { id: 'dai-bep20', symbol: 'DAI', name: 'Dai', network: 'BEP20', address: '0x22f65aab136a15e8307ac8c6ff1af5a692c92e2c', contract: '0xe9e7cea3dedca5984780bafc599bd69add087d56', decimals: 18, usd_rate: 1, min_usd: 5, confirmations: 15, explorer: 'https://bscscan.com', enabled: true, sort: 10 },
  { id: 'usdt-binance-pay', symbol: 'USDT', name: 'Binance Pay', network: 'Binance UID', address: '1047103616', decimals: 2, usd_rate: 1, min_usd: 5, confirmations: 1, explorer: 'https://www.binance.com', enabled: false, sort: 11 },
];

export const aiProviders: DemoRow[] = [
  { id: 'moonshot', label: 'Moonshot AI', base_url: 'https://api.moonshot.ai/v1', kind: 'openai', enabled: true, key_hint: 'sk-m...9f2c', key_updated_at: new Date(Date.now() - 3 * DAY).toISOString(), sort: 1 },
  { id: 'deepseek', label: 'DeepSeek', base_url: 'https://api.deepseek.com', kind: 'openai', enabled: true, key_hint: null, key_updated_at: null, sort: 2 },
  { id: 'minimax', label: 'MiniMax', base_url: 'https://api.minimax.io/v1', kind: 'openai', enabled: true, key_hint: null, key_updated_at: null, sort: 3 },
  { id: 'openai', label: 'OpenAI', base_url: 'https://api.openai.com/v1', kind: 'openai', enabled: true, key_hint: 'sk-p...41aa', key_updated_at: new Date(Date.now() - 11 * DAY).toISOString(), sort: 4 },
];

export const aiModels: DemoRow[] = [
  { id: 'kimi-k2.5', provider_id: 'moonshot', upstream_id: 'kimi-k2.5', label: 'Kimi K2.5', kind: 'vector', premium: true, enabled: true, cost_in_per_mtok: 0.6, cost_out_per_mtok: 3, cost_per_image_usd: 0, notes: 'OpenAI compatible, thinking can be disabled', sort: 1 },
  { id: 'deepseek-flash', provider_id: 'deepseek', upstream_id: 'deepseek-flash', label: 'DeepSeek V4.1 Flash', kind: 'vector', premium: true, enabled: true, cost_in_per_mtok: 0.3, cost_out_per_mtok: 1.2, cost_per_image_usd: 0, notes: '1M context, vision', sort: 2 },
  { id: 'deepseek-v4-pro', provider_id: 'deepseek', upstream_id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', kind: 'vector', premium: true, enabled: false, cost_in_per_mtok: 0.6, cost_out_per_mtok: 2.4, cost_per_image_usd: 0, notes: 'Deeper design reasoning', sort: 3 },
  { id: 'minimax-m3.1-flash', provider_id: 'minimax', upstream_id: 'MiniMax-M3.1-Flash', label: 'MiniMax M3.1 Flash', kind: 'vector', premium: true, enabled: true, cost_in_per_mtok: 0.15, cost_out_per_mtok: 0.6, cost_per_image_usd: 0, notes: '1M context', sort: 4 },
  { id: 'gpt-image-1', provider_id: 'openai', upstream_id: 'gpt-image-1', label: 'OpenAI Image', kind: 'image', premium: true, enabled: true, cost_in_per_mtok: 0, cost_out_per_mtok: 0, cost_per_image_usd: 0.04, notes: 'JPG studio renders', sort: 5 },
];

export const appSettings: DemoRow[] = [
  { id: 'fx_bdt_usd', key: 'fx_bdt_usd', value: 122, label: 'BDT per USD', updated_at: now() },
  { id: 'credits', key: 'credits', value: { vector: 1, jpg: 5, premium_upscale: 2, video_premium: 6 }, label: 'Credit cost per action', updated_at: now() },
  { id: 'limits', key: 'limits', value: { daily_generations: 60, max_pending_orders: 3, max_prompt_chars: 600, rate_gen_per_minute: 6 }, label: 'Daily limits and rate limits', updated_at: now() },
  { id: 'payment', key: 'payment', value: { order_ttl_minutes: 90, crypto_ttl_minutes: 120, review_hours: 24 }, label: 'Payment windows', updated_at: now() },
];

export const orders: DemoRow[] = [
  { id: 'e0000000-0000-4000-8000-00000000000a', user_id: DEMO_ALICE_ID, plan_slug: 'standard', months: 6, amount_bdt: 3690, credits: 2700, method: 'bkash', status: 'submitted', txn_ref: '8N7A2K9XQ1', sender_hint: '01700000000', contact: null, review_note: null, created_at: new Date(Date.now() - 40 * 60_000).toISOString(), expires_at: new Date(Date.now() + 50 * 60_000).toISOString() },
  { id: 'e0000000-0000-4000-8000-00000000000b', user_id: 'd0000000-0000-4000-8000-000000000003', plan_slug: 'starter', months: 1, amount_bdt: 299, credits: 150, method: 'nagad', status: 'approved', txn_ref: 'NGD77123', sender_hint: null, contact: null, review_note: null, created_at: new Date(Date.now() - 2 * DAY).toISOString(), expires_at: new Date(Date.now() - 2 * DAY + 90 * 60_000).toISOString() },
];

export const invoices: DemoRow[] = [];
export const walletCredits: Record<string, number> = { [DEMO_ADMIN_ID]: 0, [DEMO_ALICE_ID]: 180, 'd0000000-0000-4000-8000-000000000003': 150 };
export const usage: Array<{ model_id: string; calls: number; tokens_in: number; tokens_out: number; cost_usd: number }> = [
  { model_id: 'kimi-k2.5', calls: 34, tokens_in: 26100, tokens_out: 2050, cost_usd: 0.0219 },
  { model_id: 'deepseek-flash', calls: 21, tokens_in: 15900, tokens_out: 1310, cost_usd: 0.0063 },
  { model_id: 'gpt-image-1', calls: 4, tokens_in: 0, tokens_out: 0, cost_usd: 0.16 },
];

/** Recording of every mutation the preview performs, for the audit panel. */
export const auditLog: Array<{ id: number; actor: string | null; action: string; target: string | null; detail: unknown; created_at: string }> = [];
let auditId = 1;

function fail(message: string) {
  return { data: null, error: { message } };
}
function ok(data: unknown) {
  return { data, error: null };
}

export interface DemoCaller {
  id: string;
  admin: boolean;
  blocked: boolean;
  email: string;
}

function price(plan: string, months: number) {
  return planPrices.find((row) => row.plan_slug === plan && row.months === months);
}

function entitlementFor(caller: DemoCaller | null) {
  if (!caller) {
    return { active: false, authenticated: false, blocked: false, is_admin: false, credits: 0, plan: null, plan_name: null, tier: 0, expires_at: null, days_left: null, features: { vector: false, jpg: false, premium_upscale: false, video_premium: false, max_export_px: 2000 }, credit_costs: { vector: 2, jpg: 8, premium_upscale: 0, video_premium: 0, background: 0 }, limits: { daily_generations: 60, rate_gen_per_minute: 6, max_prompt_chars: 600 }, server_time: now() };
  }
  const sub = subscriptions.find((row) => row.user_id === caller.id && new Date(row.expires_at as string).getTime() > Date.now());
  const plan = sub ? plans.find((row) => row.slug === sub.plan_slug) : null;
  return {
    active: Boolean(plan) || caller.admin,
    authenticated: true,
    blocked: caller.blocked,
    is_admin: caller.admin,
    credits: walletCredits[caller.id] ?? 0,
    plan: plan?.slug ?? null,
    plan_name: plan?.name ?? null,
    tier: plan?.tier ?? 0,
    expires_at: (sub?.expires_at as string) ?? null,
    days_left: sub ? Math.max(0, Math.ceil((new Date(sub.expires_at as string).getTime() - Date.now()) / DAY)) : null,
    features: caller.admin
      ? { vector: true, jpg: true, premium_upscale: true, video_premium: true, max_export_px: 10000 }
      : (plan?.features as Json) ?? { vector: false, jpg: false, premium_upscale: false, video_premium: false },
    credit_costs: { vector: 2, jpg: 8, premium_upscale: 0, video_premium: 0, background: 0 },
    limits: { daily_generations: 60, rate_gen_per_minute: 6, max_prompt_chars: 600 },
    server_time: now(),
  };
}

export const subscriptions: DemoRow[] = [
  { id: 'f0000000-0000-4000-8000-000000000001', user_id: DEMO_ALICE_ID, plan_slug: 'starter', status: 'active', months: 1, started_at: new Date(Date.now() - 9 * DAY).toISOString(), expires_at: new Date(Date.now() + 21 * DAY).toISOString() },
];

export const generations: DemoRow[] = [
  { id: 'g0000000-0000-4000-8000-000000000001', user_id: DEMO_ALICE_ID, kind: 'eps', prompt: 'alpine sunrise', status: 'done', credits: 1, model_id: 'kimi-k2.5', quality: { pass: true, score: 100 }, created_at: new Date(Date.now() - 3 * 3600_000).toISOString() },
  { id: 'g0000000-0000-4000-8000-000000000002', user_id: DEMO_ALICE_ID, kind: 'jpg', prompt: 'ceramic mug', status: 'failed', credits: 5, model_id: 'gpt-image-1', quality: null, created_at: new Date(Date.now() - 26 * 3600_000).toISOString() },
];

/** Verified authenticator factors in the preview build (see demo.ts). */
function demoFactorCount(userId?: string): number {
  try {
    const raw = localStorage.getItem('msap.demo.mfa');
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return 0;
    return list.filter((item) => item?.verified && (!userId || item.userId === userId)).length;
  } catch {
    return 0;
  }
}

function record(action: string, caller: DemoCaller | null, target: string | null, detail: unknown) {
  auditLog.unshift({ id: auditId++, actor: caller?.id ?? null, action, target, detail, created_at: now() });
}

/** RPC handlers mirroring public.pro_* in the database. */
export const proRpcHandlers: Record<string, (params: Json, caller: DemoCaller | null) => unknown> = {
  pro_my_entitlement(_params, caller) {
    return ok(entitlementFor(caller));
  },
  pro_check_feature(params, caller) {
    const entitlement = entitlementFor(caller);
    const features = entitlement.features as Json;
    return ok(Boolean(features[String(params.p_feature)]) && Boolean(entitlement.active));
  },
  pro_quote(params) {
    const row = price(String(params.p_plan), Number(params.p_months));
    if (!row) return fail('plan unavailable');
    const method = paymentMethods.find((entry) => entry.id === params.p_method && entry.enabled);
    if (!method) return fail('method unavailable');
    const crypto: Record<string, { amount: number; decimals: number }> = {};
    for (const asset of cryptoAssets) {
      const amount = quantize(Number(row.price_usd) / Number(asset.usd_rate), Number(asset.decimals));
      crypto[String(asset.id)] = { amount, decimals: Number(asset.decimals) };
    }
    return ok({ ...row, plan: row.plan_slug, plan_name: plans.find((plan) => plan.slug === row.plan_slug)?.name, method: method.id, method_config: method.config, crypto, server_time: now() });
  },
  pro_submit_payment(params, caller) {
    if (!caller) return fail('not authenticated');
    const row = price(String(params.p_plan), Number(params.p_months));
    if (!row) return fail('plan unavailable');
    const method = String(params.p_method);
    const txn = String(params.p_txn_ref ?? '').trim().toUpperCase();
    if (method !== 'crypto') {
      if (txn.length < 6) return fail('transaction id required');
      if (orders.some((order) => order.method === method && String(order.txn_ref ?? '').toUpperCase() === txn && order.status !== 'rejected')) {
        return fail('transaction already claimed');
      }
    }
    const order: DemoRow = {
      id: uid(), user_id: caller.id, plan_slug: row.plan_slug, months: row.months, amount_bdt: row.price_bdt,
      credits: row.credits, method, status: txn || method === 'crypto' ? 'submitted' : 'awaiting', txn_ref: txn || null,
      sender_hint: params.p_sender ?? null, contact: params.p_contact ?? null, review_note: null,
      created_at: now(), expires_at: new Date(Date.now() + 90 * 60_000).toISOString(),
    };
    orders.unshift(order);
    record('order.create', caller, order.id, { plan: order.plan_slug, method });
    return ok({ order_id: order.id, status: order.status, amount_bdt: order.amount_bdt, credits: order.credits, expires_at: order.expires_at, method, instructions: paymentMethods.find((entry) => entry.id === method)?.config });
  },
  pro_my_orders(_params, caller) {
    if (!caller) return fail('not authenticated');
    return ok(orders.filter((order) => order.user_id === caller.id));
  },
  pro_my_invoices(_params, caller) {
    if (!caller) return fail('not authenticated');
    const mine = orders.filter((order) => order.user_id === caller.id).map((order) => order.id);
    return ok(
      invoices
        .filter((invoice) => mine.includes(String(invoice.order_id)))
        .map((invoice) => {
          const asset = cryptoAssets.find((entry) => entry.id === invoice.asset_id);
          return {
            invoice_id: invoice.id, order_id: invoice.order_id, asset_id: invoice.asset_id,
            symbol: asset?.symbol, network: asset?.network, address: invoice.address,
            amount_expected: invoice.amount_expected, amount_received: invoice.amount_received,
            status: invoice.status, confirmations: invoice.confirmations,
            required_confirmations: asset?.confirmations, tx_hash: invoice.tx_hash,
            expires_at: invoice.expires_at, created_at: invoice.created_at,
          };
        }),
    );
  },
  pro_admin_assets(_params, caller) {
    if (!caller || !caller.admin) return fail('not allowed');
    return ok(cryptoAssets);
  },
  pro_admin_update_asset(params, caller) {
    if (!caller || !caller.admin) return fail('not allowed');
    const asset = cryptoAssets.find((entry) => entry.id === params.p_id);
    if (!asset) return fail('asset not found');
    const patch = (params.p_patch ?? {}) as Record<string, unknown>;
    Object.assign(asset as unknown as Record<string, unknown>, patch);
    record('crypto.asset.update', caller, asset.id, patch);
    return ok(asset);
  },
  pro_create_crypto_invoice(params, caller) {
    if (!caller) return fail('not authenticated');
    const order = orders.find((entry) => entry.id === params.p_order && entry.user_id === caller.id);
    if (!order) return fail('order not found');
    const asset = cryptoAssets.find((entry) => entry.id === params.p_asset && entry.enabled);
    if (!asset) return fail('asset unavailable');
    const amount = quantize(Number(order.amount_bdt) / 122 / Number(asset.usd_rate), Number(asset.decimals));
    const existing = invoices.find((entry) => entry.order_id === order.id);
    const invoice = existing ?? {
      id: uid(), order_id: order.id, asset_id: asset.id, address: asset.address,
      amount_usd: Number((Number(order.amount_bdt) / 122).toFixed(2)), amount_expected: amount,
      amount_received: 0, tx_hash: null, confirmations: 0, status: 'pending',
      created_at: now(), expires_at: new Date(Date.now() + 120 * 60_000).toISOString(),
    };
    if (!existing) invoices.unshift(invoice);
    return ok({
      invoice_id: invoice.id, order_id: order.id, asset: asset.id, symbol: asset.symbol, name: asset.name,
      network: asset.network, address: invoice.address, amount, amount_usd: invoice.amount_usd,
      decimals: asset.decimals, confirmations_required: asset.confirmations, expires_at: invoice.expires_at,
      explorer: asset.explorer, status: invoice.status,
    });
  },
  pro_admin_stats(params) {
    const days = Number(params.p_days ?? 30);
    const revenue = orders.filter((order) => order.status === 'approved').reduce((sum, order) => sum + Number(order.amount_bdt), 0);
    const cost = usage.reduce((sum, row) => sum + row.cost_usd, 0);
    return ok({
      window_days: days, revenue_bdt: revenue, api_cost_usd: Number(cost.toFixed(4)),
      api_cost_bdt: Number((cost * 122).toFixed(2)), margin_bdt: Number((revenue - cost * 122).toFixed(2)),
      margin_pct: revenue > 0 ? Number((((revenue - cost * 122) / revenue) * 100).toFixed(1)) : null,
      orders_pending: orders.filter((order) => ['awaiting', 'submitted'].includes(String(order.status))).length,
      orders_approved: orders.filter((order) => order.status === 'approved').length,
      active_subs: subscriptions.filter((sub) => new Date(String(sub.expires_at)).getTime() > Date.now()).length,
      users: 4, generations: generations.length,
      generations_failed: generations.filter((row) => row.status === 'failed').length,
      by_model: usage,
    });
  },
  pro_admin_users() {
    return ok(
      [
        { user_id: DEMO_ADMIN_ID, email: 'admin@demo.local', display_name: 'Studio Admin', role: 'admin', blocked: false, plan: null, expires_at: null, credits: 0, spent_bdt: 0, generations: 0, joined: new Date(Date.now() - 120 * DAY).toISOString() },
        { user_id: DEMO_ALICE_ID, email: 'alice@demo.local', display_name: 'Alice Rahman', role: 'user', blocked: false, plan: 'starter', expires_at: subscriptions[0].expires_at, credits: walletCredits[DEMO_ALICE_ID], spent_bdt: 299, generations: generations.length, joined: new Date(Date.now() - 42 * DAY).toISOString() },
        { user_id: 'd0000000-0000-4000-8000-000000000003', email: 'bob@demo.local', display_name: 'Bob Ahmed', role: 'user', blocked: false, plan: 'starter', expires_at: new Date(Date.now() + 12 * DAY).toISOString(), credits: walletCredits['d0000000-0000-4000-8000-000000000003'], spent_bdt: 299, generations: 3, joined: new Date(Date.now() - 19 * DAY).toISOString() },
      ],
    );
  },
  pro_admin_review_order(params, caller) {
    if (!caller?.admin) return fail('not allowed');
    const order = orders.find((entry) => entry.id === params.p_order);
    if (!order) return fail('order not found');
    if (order.status === 'approved') return fail('already approved');
    if (params.p_approve) {
      const row = price(String(order.plan_slug), Number(order.months));
      const base = Math.max(Date.now(), ...subscriptions.filter((sub) => sub.user_id === order.user_id && sub.status === 'active').map((sub) => new Date(String(sub.expires_at)).getTime()));
      for (const sub of subscriptions) if (sub.user_id === order.user_id && sub.status === 'active') sub.status = 'cancelled';
      subscriptions.unshift({ id: uid(), user_id: order.user_id, plan_slug: order.plan_slug, status: 'active', months: order.months, started_at: now(), expires_at: new Date(base + (Number(order.months) === 12 ? 365 : Number(order.months) * 30) * DAY).toISOString() });
      walletCredits[String(order.user_id)] = (walletCredits[String(order.user_id)] ?? 0) + Number(row?.credits ?? order.credits);
      order.status = 'approved';
      record('order.approve', caller, String(order.id), { plan: order.plan_slug });
    } else {
      order.status = 'rejected';
      order.review_note = params.p_note ?? null;
      record('order.reject', caller, String(order.id), { note: params.p_note });
    }
    return ok({ order: order.id, status: order.status, subscription: null });
  },
  pro_admin_grant(params, caller) {
    if (!caller?.admin) return fail('not allowed');
    const row = price(String(params.p_plan), Number(params.p_months));
    for (const sub of subscriptions) if (sub.user_id === params.p_user && sub.status === 'active') sub.status = 'cancelled';
    const id = uid();
    subscriptions.unshift({ id, user_id: params.p_user, plan_slug: params.p_plan, status: 'active', months: params.p_months, started_at: now(), expires_at: new Date(Date.now() + (Number(params.p_months) === 12 ? 365 : Number(params.p_months) * 30) * DAY).toISOString() });
    walletCredits[String(params.p_user)] = (walletCredits[String(params.p_user)] ?? 0) + Number(row?.credits ?? 0);
    record('subscription.grant', caller, String(params.p_user), { plan: params.p_plan, months: params.p_months });
    return ok(id);
  },
  pro_add_credits(params, caller) {
    if (!caller?.admin) return fail('not allowed');
    walletCredits[String(params.p_user)] = Math.max(0, (walletCredits[String(params.p_user)] ?? 0) + Number(params.p_amount));
    record('credits.adjust', caller, String(params.p_user), { delta: params.p_amount, reason: params.p_reason });
    return ok(walletCredits[String(params.p_user)]);
  },
  pro_admin_security_overview(_params, caller) {
    if (!caller?.admin) return fail('not allowed');
    const factors = demoFactorCount(caller.id);
    const people = [
      { user_id: DEMO_ADMIN_ID, email: 'admin@demo.local', role: 'admin', blocked: false },
      { user_id: DEMO_ALICE_ID, email: 'alice@demo.local', role: 'user', blocked: false },
      { user_id: 'd0000000-0000-4000-8000-000000000003', email: 'bob@demo.local', role: 'user', blocked: false },
      { user_id: 'd0000000-0000-4000-8000-000000000004', email: 'carol@demo.local', role: 'user', blocked: true },
    ];
    return ok(
      people.map((person) => ({
        ...person,
        factors: person.user_id === caller.id ? factors : 0,
        last_sign_in_at: now(),
        created_at: new Date(Date.now() - 30 * DAY).toISOString(),
      })),
    );
  },
  pro_admin_reset_mfa(params, caller) {
    if (!caller?.admin) return fail('not allowed');
    const target = String(params.p_user ?? '');
    const removed = demoFactorCount(target);
    if (removed) {
      try {
        const raw = localStorage.getItem('msap.demo.mfa');
        const list = raw ? JSON.parse(raw) : [];
        localStorage.setItem('msap.demo.mfa', JSON.stringify((Array.isArray(list) ? list : []).filter((item) => item.userId !== target)));
      } catch {
        /* ignore */
      }
    }
    record('mfa.reset', caller, String(params.p_user), { removed });
    return ok(removed);
  },
  pro_admin_expire_subscriptions(_params, caller) {
    if (!caller?.admin) return fail('not allowed');
    let touched = 0;
    for (const sub of subscriptions) {
      if (sub.status === 'active' && new Date(String(sub.expires_at)).getTime() <= Date.now()) {
        sub.status = 'expired';
        touched += 1;
      }
    }
    record('subscriptions.expire', caller, 'sweep', { expired: touched });
    return ok(touched);
  },
  pro_admin_set_setting(params, caller) {
    if (!caller?.admin) return fail('not allowed');
    if (params.p_key === 'security' && (params.p_value as Json)?.require_admin_mfa && demoFactorCount(caller.id) === 0) {
      return fail('enable two step verification on your own account first');
    }
    const row = appSettings.find((entry) => entry.key === params.p_key);
    if (row) {
      row.value = params.p_value;
      row.updated_at = now();
    }
    record('setting.update', caller, String(params.p_key), params.p_value);
    return ok(null);
  },
  pro_admin_audit_tail() {
    return ok(auditLog);
  },
  pro_attach_quality(params, caller) {
    const generation = generations.find((row) => row.id === params.p_id && (!caller || row.user_id === caller.id));
    if (generation) {
      generation.quality = params.p_quality;
      generation.file_name = params.p_file_name;
    }
    return ok(null);
  },
  pro_begin_generation(params, caller) {
    if (!caller) return fail('not authenticated');
    const entitlement = entitlementFor(caller);
    if (!entitlement.active) return fail('subscription required');
    const feature = params.p_kind === 'jpg' ? 'jpg' : 'vector';
    if (!(entitlement.features as Json)[feature]) return fail(`plan does not include ${feature}`);
    const cost = params.p_kind === 'jpg' ? 8 : 2;
    if ((walletCredits[caller.id] ?? 0) < cost) return fail('insufficient credits');
    walletCredits[caller.id] = (walletCredits[caller.id] ?? 0) - cost;
    const id = uid();
    generations.unshift({ id, user_id: caller.id, kind: params.p_kind, prompt: params.p_prompt, status: 'running', credits: cost, created_at: now() });
    return ok({ generation_id: id, credits: cost, balance: walletCredits[caller.id] });
  },
  pro_finish_generation(params, caller) {
    const generation = generations.find((row) => row.id === params.p_id);
    if (!generation) return fail('generation not found');
    generation.status = params.p_status;
    if (params.p_status !== 'done' && caller) {
      walletCredits[caller.id] = (walletCredits[caller.id] ?? 0) + Number(generation.credits ?? 0);
    }
    return ok({ status: params.p_status, refunded: params.p_status === 'done' ? 0 : generation.credits });
  },
};

/** Tables the preview can read through `.from(name).select()`. */
export const proTables: Record<string, DemoRow[]> = {
  plans,
  plan_prices: planPrices,
  payment_methods: paymentMethods,
  crypto_assets: cryptoAssets,
  ai_providers: aiProviders,
  ai_models: aiModels,
  app_settings: appSettings,
  payment_orders: orders,
  generations,
};
