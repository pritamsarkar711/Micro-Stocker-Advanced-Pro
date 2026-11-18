-- Security pass over the client facing surface.
--
-- 1. rate_events had row level security switched off. It holds the throttle
--    buckets, so a client that can write it can lift its own rate limit. Only
--    security definer functions touch it, so the table is now closed to clients
--    and the grants are removed as well.
-- 2. Anonymous clients kept the default table grants that Supabase hands out.
--    Row level security already refused those writes, but a single missing
--    policy would have turned that into a hole. The writes are revoked, so the
--    gate is now two rules deep instead of one. Reads stay in place because the
--    catalogue is read before sign in and row level security filters it.
alter table public.rate_events enable row level security;
revoke all on public.rate_events from anon, authenticated;
revoke all on public.rate_events from public;

revoke insert, update, delete, truncate, references, trigger on
  public.profiles,
  public.wallets,
  public.subscriptions,
  public.payment_orders,
  public.crypto_invoices,
  public.credit_ledger,
  public.generations,
  public.admin_audit,
  public.api_usage,
  public.workspace_snapshots
from anon;

revoke insert, update, delete, truncate, references, trigger on
  public.plans,
  public.plan_prices,
  public.payment_methods,
  public.crypto_assets,
  public.app_settings,
  public.ai_models,
  public.ai_providers
from anon;

-- Wallets, subscriptions and invoices are written only by the functions that
-- price and settle them, so the browser loses its write grants there too. The
-- admin console keeps its direct grants on the three tables it edits: ai_models,
-- ai_providers and plan_prices, each guarded by an admin only policy.
revoke insert, update, delete, truncate, references, trigger on
  public.wallets,
  public.subscriptions,
  public.crypto_invoices,
  public.credit_ledger,
  public.generations
from authenticated;

-- Workspace snapshots are written by the client directly, so its grants stay.
grant select, insert, update, delete on public.workspace_snapshots to authenticated;
