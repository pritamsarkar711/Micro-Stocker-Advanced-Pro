-- Micro-Stocker Pro platform.
--
-- One migration replaces the former activation-code licensing schema: accounts
-- are optional, the desktop app runs free, and only the premium generators plus
-- the top-tier upscale models require a paid subscription.
--
-- Security model:
--   * every secret lives outside the client: provider keys sit in
--     public.pro_provider_keys, which has RLS enabled, no policies and no grants,
--     so only the service role (edge functions) can read it;
--   * entitlement, credits, prices and payment state are always computed here,
--     never accepted from the browser;
--   * all mutations go through security definer functions with a pinned
--     search_path and explicit execute grants.

create extension if not exists pgcrypto with schema extensions;

/* --------------------------------------------------------------- profiles */

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  country text,
  role text not null default 'user' check (role in ('user', 'support', 'admin')),
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create or replace function public.pro_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'artist'), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists pro_on_auth_user_created on auth.users;
create trigger pro_on_auth_user_created
  after insert on auth.users
  for each row execute function public.pro_handle_new_user();

create or replace function public.pro_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and blocked = false
  );
$$;
revoke all on function public.pro_is_admin() from public, anon;
grant execute on function public.pro_is_admin() to authenticated;

create or replace function public.pro_touch_profile()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;
revoke all on function public.pro_touch_profile() from public, anon;
grant execute on function public.pro_touch_profile() to authenticated;

/* ------------------------------------------------------------------ plans */

create table if not exists public.plans (
  slug text primary key,
  name text not null,
  tier smallint not null check (tier between 1 and 9),
  tagline text not null default '',
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort smallint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_prices (
  plan_slug text not null references public.plans(slug) on delete cascade,
  months smallint not null check (months between 1 and 36),
  price_bdt integer not null check (price_bdt >= 0),
  price_usd numeric(10, 2) not null default 0,
  credits integer not null check (credits >= 0),
  active boolean not null default true,
  primary key (plan_slug, months)
);

-- features: {"vector":true,"jpg":true,"premium_upscale":true,"video_premium":false,
--            "max_export_px":6000,"queue_priority":1}
insert into public.plans (slug, name, tier, tagline, features, sort) values
  ('starter', 'Starter', 1, 'Vector generators and every free tool',
   '{"vector":true,"jpg":false,"premium_upscale":false,"video_premium":false,"max_export_px":4000,"queue_priority":1}', 1),
  ('standard', 'Standard', 2, 'Adds the JPG studio and the top upscale models',
   '{"vector":true,"jpg":true,"premium_upscale":true,"video_premium":false,"max_export_px":6000,"queue_priority":2}', 2),
  ('professional', 'Professional', 3, 'Everything, including premium video upscaling',
   '{"vector":true,"jpg":true,"premium_upscale":true,"video_premium":true,"max_export_px":8000,"queue_priority":3}', 3)
on conflict (slug) do nothing;

insert into public.plan_prices (plan_slug, months, price_bdt, price_usd, credits) values
  ('starter', 1, 299, 2.45, 150),
  ('starter', 6, 1590, 13.05, 900),
  ('starter', 12, 2690, 22.05, 1800),
  ('standard', 1, 699, 5.75, 450),
  ('standard', 6, 3690, 30.25, 2700),
  ('standard', 12, 6290, 51.55, 5400),
  ('professional', 1, 1299, 10.65, 1200),
  ('professional', 6, 6890, 56.50, 7200),
  ('professional', 12, 11690, 95.80, 14400)
on conflict (plan_slug, months) do nothing;

/* ---------------------------------------------------------- subscriptions */

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_slug text not null references public.plans(slug),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled', 'refunded')),
  months smallint not null check (months between 1 and 36),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  order_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id, expires_at desc);
create unique index if not exists subscriptions_one_active
  on public.subscriptions (user_id) where status = 'active';

create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  lifetime_spent_bdt integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  balance_after integer not null,
  reason text not null,
  ref text,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);

/* --------------------------------------------------------- AI providers */

create table if not exists public.ai_providers (
  id text primary key,
  label text not null,
  base_url text not null,
  kind text not null default 'openai' check (kind in ('openai', 'anthropic', 'custom')),
  docs_url text,
  enabled boolean not null default true,
  key_hint text,
  key_updated_at timestamptz,
  sort smallint not null default 0
);

create table if not exists public.ai_models (
  id text primary key,
  provider_id text not null references public.ai_providers(id) on delete cascade,
  upstream_id text not null,
  label text not null,
  kind text not null check (kind in ('vector', 'image')),
  premium boolean not null default true,
  enabled boolean not null default true,
  cost_in_per_mtok numeric(10, 4) not null default 0,
  cost_out_per_mtok numeric(10, 4) not null default 0,
  cost_per_image_usd numeric(10, 4) not null default 0,
  notes text,
  sort smallint not null default 0
);

insert into public.ai_providers (id, label, base_url, kind, docs_url, sort) values
  ('moonshot', 'Moonshot AI', 'https://api.moonshot.ai/v1', 'openai', 'https://platform.moonshot.ai/docs', 1),
  ('deepseek', 'DeepSeek', 'https://api.deepseek.com', 'openai', 'https://api-docs.deepseek.com', 2),
  ('minimax', 'MiniMax', 'https://api.minimax.io/v1', 'openai', 'https://platform.minimax.io/docs', 3),
  ('openai', 'OpenAI', 'https://api.openai.com/v1', 'openai', 'https://platform.openai.com/docs', 4)
on conflict (id) do nothing;

insert into public.ai_models (id, provider_id, upstream_id, label, kind, premium, cost_in_per_mtok, cost_out_per_mtok, cost_per_image_usd, notes, sort) values
  ('kimi-k2.5', 'moonshot', 'kimi-k2.5', 'Kimi K2.5', 'vector', true, 0.60, 3.00, 0, 'OpenAI compatible. Disable thinking with extra_body {"thinking":{"type":"disabled"}}.', 1),
  ('deepseek-flash', 'deepseek', 'deepseek-flash', 'DeepSeek V4.1 Flash', 'vector', true, 0.30, 1.20, 0, 'Peak price, 50% lower off peak. 1M context, vision.', 2),
  ('deepseek-v4-pro', 'deepseek', 'deepseek-v4-pro', 'DeepSeek V4 Pro', 'vector', true, 0.60, 2.40, 0, 'Deeper design reasoning, no vision.', 3),
  ('minimax-m3.1-flash', 'minimax', 'MiniMax-M3.1-Flash', 'MiniMax M3.1 Flash', 'vector', true, 0.15, 0.60, 0, '1M context, reasoning always on.', 4),
  ('gpt-image-1', 'openai', 'gpt-image-1', 'OpenAI Image', 'image', true, 0, 0, 0.0400, 'Premium photo and illustration renders for the JPG studio.', 5)
on conflict (id) do nothing;

-- Service-role only. No policies, no grants: the anon/authenticated roles cannot
-- read provider keys even if they query the table directly.
create table if not exists public.pro_provider_keys (
  provider_id text primary key references public.ai_providers(id) on delete cascade,
  secret text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.pro_provider_keys enable row level security;
revoke all on public.pro_provider_keys from public, anon, authenticated;

create table if not exists public.api_usage (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  provider_id text,
  model_id text,
  kind text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  images integer not null default 0,
  cost_usd numeric(10, 5) not null default 0,
  generation_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists api_usage_created_idx on public.api_usage (created_at desc);

/* ------------------------------------------------------------ generations */

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('eps', 'svg', 'ai', 'jpg')),
  prompt text not null,
  options jsonb not null default '{}'::jsonb,
  spec jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'blocked')),
  provider_id text,
  model_id text,
  quality jsonb,
  metadata jsonb,
  file_name text,
  file_bytes integer,
  cost_usd numeric(10, 5) not null default 0,
  credits integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists generations_user_idx on public.generations (user_id, created_at desc);

/* --------------------------------------------------------------- settings */

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  label text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.app_settings (key, value, label) values
  ('fx_bdt_usd', '122', 'BDT per USD'),
  ('credits', '{"vector":1,"jpg":5,"premium_upscale":2,"video_premium":6}', 'Credit cost per action'),
  ('limits', '{"daily_generations":60,"max_pending_orders":3,"max_prompt_chars":600,"rate_gen_per_minute":6}', 'Daily limits and rate limits'),
  ('payment', '{"order_ttl_minutes":90,"crypto_ttl_minutes":120,"review_hours":24}', 'Payment windows'),
  ('support', '{"email":"support@microstocker.app","whatsapp":"+8801887799071"}', 'Support contact'),
  ('free_tier', '{"vector":false,"jpg":false,"premium_upscale":false,"max_export_px":2000}', 'Free tier permissions')
on conflict (key) do nothing;

/* --------------------------------------------------------------- payments */

create table if not exists public.payment_methods (
  id text primary key,
  label text not null,
  enabled boolean not null default true,
  sort smallint not null default 0,
  config jsonb not null default '{}'::jsonb
);

insert into public.payment_methods (id, label, sort, config) values
  ('bkash', 'bKash', 1, '{"numbers":["01887799071"],"type":"personal","instructions":"Send the exact amount with Send Money, then enter the TrxID below."}'),
  ('nagad', 'Nagad', 2, '{"numbers":["01887799071","01617445106"],"type":"personal","instructions":"Send the exact amount with Send Money, then enter the TrxID below."}'),
  ('crypto', 'Crypto', 3, '{"auto":true,"network_confirmations":{"bep20":15,"trc20":19,"solana":1,"polygon":128},"instructions":"Pick a coin and network, then pay the exact amount to the invoice address."}')
on conflict (id) do nothing;

create table if not exists public.crypto_assets (
  id text primary key,
  symbol text not null,
  name text not null,
  network text not null,
  address text not null,
  decimals smallint not null default 6,
  usd_rate numeric(18, 8) not null default 0,
  min_usd numeric(10, 2) not null default 5,
  confirmations smallint not null default 12,
  explorer text not null default '',
  explorer_api text,
  enabled boolean not null default true,
  sort smallint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.crypto_assets (id, symbol, name, network, address, decimals, usd_rate, min_usd, confirmations, explorer, sort) values
  ('usdc-bsc', 'USDC', 'USD Coin', 'BEP20', '0x22f65aab136a15e8307ac8c6ff1af5a692c92e2c', 18, 1, 5, 15, 'https://bscscan.com', 1),
  ('usdc-sol', 'USDC', 'USD Coin', 'Solana', 'CMcLrsGRQxMnUHGihi3aMZkfgSjfPyHhn2AoE9hGeb3Z', 6, 1, 5, 1, 'https://solscan.io', 2),
  ('usdc-polygon', 'USDC', 'USD Coin', 'Polygon', '0x22f65aab136a15e8307ac8c6ff1af5a692c92e2c', 6, 1, 5, 128, 'https://polygonscan.com', 3),
  ('usdt-bep20', 'USDT', 'Tether', 'BEP20', '0x22f65aab136a15e8307ac8c6ff1af5a692c92e2c', 18, 1, 5, 15, 'https://bscscan.com', 4),
  ('usdt-trc20', 'USDT', 'Tether', 'TRC20', 'TCkDdhqFKrThJ5xmZEZZ2QKAmCfLkHGZES', 6, 1, 5, 19, 'https://tronscan.org', 5),
  ('usdt-sol', 'USDT', 'Tether', 'Solana', 'CMcLrsGRQxMnUHGihi3aMZkfgSjfPyHhn2AoE9hGeb3Z', 6, 1, 5, 1, 'https://solscan.io', 6),
  ('bnb-bep20', 'BNB', 'BNB', 'BEP20', '0x22f65aab136a15e8307ac8c6ff1af5a692c92e2c', 18, 620, 10, 15, 'https://bscscan.com', 7),
  ('sol-solana', 'SOL', 'Solana', 'Solana', 'CMcLrsGRQxMnUHGihi3aMZkfgSjfPyHhn2AoE9hGeb3Z', 9, 165, 10, 1, 'https://solscan.io', 8),
  ('ltc-litecoin', 'LTC', 'Litecoin', 'Litecoin', 'LPBySh9zb4667sGA63M1krTHyoC7uXJ2iw', 8, 95, 10, 6, 'https://blockchair.com/litecoin', 9),
  ('dai-bep20', 'DAI', 'Dai', 'BEP20', '0x22f65aab136a15e8307ac8c6ff1af5a692c92e2c', 18, 1, 5, 15, 'https://bscscan.com', 10),
  ('usdt-binance-pay', 'USDT', 'Binance Pay', 'Binance UID', '1047103616', 2, 1, 5, 1, 'https://www.binance.com', 11)
on conflict (id) do nothing;

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_slug text not null references public.plans(slug),
  months smallint not null check (months between 1 and 36),
  amount_bdt integer not null check (amount_bdt > 0),
  credits integer not null default 0,
  method text not null references public.payment_methods(id),
  status text not null default 'awaiting' check (status in ('awaiting', 'submitted', 'approved', 'rejected', 'expired', 'refunded')),
  txn_ref text,
  sender_hint text,
  note text,
  contact text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  subscription_id uuid references public.subscriptions(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 minutes'
);
create index if not exists payment_orders_user_idx on public.payment_orders (user_id, created_at desc);
create index if not exists payment_orders_status_idx on public.payment_orders (status, created_at desc);
-- The same TrxID can never be claimed twice, by anyone.
create unique index if not exists payment_orders_unique_txn
  on public.payment_orders (method, lower(txn_ref)) where txn_ref is not null and status <> 'rejected';

create table if not exists public.crypto_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders(id) on delete cascade,
  asset_id text not null references public.crypto_assets(id),
  address text not null,
  amount_usd numeric(12, 2) not null,
  amount_expected numeric(24, 8) not null,
  amount_received numeric(24, 8) not null default 0,
  tx_hash text,
  confirmations integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'seen', 'confirmed', 'mismatch', 'expired')),
  payload jsonb,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '120 minutes'
);
create unique index if not exists crypto_invoices_tx_unique
  on public.crypto_invoices (lower(tx_hash)) where tx_hash is not null;
create unique index if not exists crypto_invoices_order_unique
  on public.crypto_invoices (order_id);

create table if not exists public.admin_audit (
  id bigserial primary key,
  actor uuid,
  action text not null,
  target text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.rate_events (
  bucket text primary key,
  hits integer not null default 0,
  window_start timestamptz not null default now()
);
revoke all on public.rate_events from public, anon, authenticated;
