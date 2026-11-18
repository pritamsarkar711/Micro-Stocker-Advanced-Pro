-- Entitlements, credits, orders and admin actions.
-- Everything the client can do is an RPC; the browser never writes these tables.

/* ---------------------------------------------------------------- helpers */

create or replace function public.pro_feature_for_kind(p_kind text)
returns text
language sql
immutable
as $$
  select case p_kind
    when 'eps' then 'vector'
    when 'svg' then 'vector'
    when 'ai' then 'vector'
    when 'jpg' then 'jpg'
    else p_kind
  end;
$$;

create or replace function public.pro_setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(value, '{}'::jsonb) from public.app_settings where key = p_key;
$$;
revoke all on function public.pro_setting(text) from public, anon, authenticated;

create or replace function public.pro_rate_hit(p_bucket text, p_limit integer, p_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_hits integer;
begin
  insert into public.rate_events (bucket, hits, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
    set hits = case when public.rate_events.window_start < now() - make_interval(secs => p_seconds) then 1 else public.rate_events.hits + 1 end,
        window_start = case when public.rate_events.window_start < now() - make_interval(secs => p_seconds) then now() else public.rate_events.window_start end
  returning hits into current_hits;
  return current_hits <= p_limit;
end;
$$;
revoke all on function public.pro_rate_hit(text, integer, integer) from public, anon, authenticated;

create or replace function public.pro_duration(p_months integer)
returns interval
language sql
immutable
as $$
  select case when p_months = 12 then interval '365 days' else make_interval(days => p_months * 30) end;
$$;

/* ------------------------------------------------------------ entitlement */

create or replace function public.pro_entitlement(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  profile record;
  sub record;
  wallet integer;
  free_features jsonb;
  result jsonb;
begin
  select id, role, blocked into profile from public.profiles where id = p_user;
  select credits into wallet from public.wallets where user_id = p_user;
  select s.plan_slug, s.months, s.started_at, s.expires_at, p.name, p.tier, p.features
    into sub
    from public.subscriptions s
    join public.plans p on p.slug = s.plan_slug
   where s.user_id = p_user and s.status = 'active' and s.expires_at > now()
   order by s.expires_at desc
   limit 1;

  free_features := public.pro_setting('free_tier');

  result := jsonb_build_object(
    'server_time', now(),
    'blocked', coalesce(profile.blocked, false),
    'is_admin', coalesce(profile.role = 'admin', false),
    'credits', coalesce(wallet, 0),
    'active', sub.plan_slug is not null or coalesce(profile.role = 'admin', false),
    'plan', sub.plan_slug,
    'plan_name', sub.name,
    'tier', coalesce(sub.tier, 0),
    'features', case when profile.role = 'admin'
                     then '{"vector":true,"jpg":true,"premium_upscale":true,"video_premium":true,"max_export_px":10000}'::jsonb
                     else coalesce(sub.features, free_features) end,
    'started_at', sub.started_at,
    'expires_at', sub.expires_at,
    'days_left', case when sub.expires_at is null then null
                      else greatest(0, ceil(extract(epoch from (sub.expires_at - now())) / 86400.0))::int end,
    'seconds_left', case when sub.expires_at is null then null
                         else greatest(0, floor(extract(epoch from (sub.expires_at - now()))))::bigint end
  );
  return result;
end;
$$;
revoke all on function public.pro_entitlement(uuid) from public, anon, authenticated;

create or replace function public.pro_my_entitlement()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('active', false, 'authenticated', false,
      'features', public.pro_setting('free_tier'), 'server_time', now());
  end if;
  return public.pro_entitlement(auth.uid()) || jsonb_build_object('authenticated', true);
end;
$$;
grant execute on function public.pro_my_entitlement() to authenticated, anon;

create or replace function public.pro_check_feature(p_feature text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  entitlement jsonb;
begin
  if auth.uid() is null then return false; end if;
  entitlement := public.pro_entitlement(auth.uid());
  if (entitlement ->> 'blocked')::boolean then return false; end if;
  return coalesce((entitlement -> 'features' ->> p_feature)::boolean, false)
     and coalesce((entitlement ->> 'active')::boolean, false);
end;
$$;
grant execute on function public.pro_check_feature(text) to authenticated;

/* ---------------------------------------------------------------- credits */

create or replace function public.pro_consume_credits(p_amount integer, p_reason text, p_ref text default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  balance integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.wallets (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select credits into balance from public.wallets where user_id = auth.uid() for update;
  if balance < p_amount then
    raise exception 'insufficient credits' using errcode = 'P0001';
  end if;
  update public.wallets set credits = credits - p_amount, updated_at = now() where user_id = auth.uid() returning credits into balance;
  insert into public.credit_ledger (user_id, delta, balance_after, reason, ref)
  values (auth.uid(), -p_amount, balance, p_reason, p_ref);
  return balance;
end;
$$;
revoke all on function public.pro_consume_credits(integer, text, text) from public, anon;
grant execute on function public.pro_consume_credits(integer, text, text) to authenticated;

create or replace function public.pro_add_credits(p_user uuid, p_amount integer, p_reason text, p_ref text default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  balance integer;
begin
  if not public.pro_is_admin() then raise exception 'not allowed'; end if;
  insert into public.wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.wallets set credits = greatest(0, credits + p_amount), updated_at = now()
   where user_id = p_user returning credits into balance;
  insert into public.credit_ledger (user_id, delta, balance_after, reason, ref)
  values (p_user, p_amount, balance, p_reason, p_ref);
  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(), 'credits.adjust', p_user::text, jsonb_build_object('delta', p_amount, 'reason', p_reason));
  return balance;
end;
$$;
revoke all on function public.pro_add_credits(uuid, integer, text, text) from public, anon;
grant execute on function public.pro_add_credits(uuid, integer, text, text) to authenticated;

/* ------------------------------------------------------------ generations */

create or replace function public.pro_begin_generation(
  p_kind text,
  p_prompt text,
  p_options jsonb default '{}'::jsonb,
  p_model text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  entitlement jsonb;
  feature text;
  limits jsonb;
  credits_cost jsonb;
  cost integer;
  today_count integer;
  generation_id uuid;
  balance integer;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = 'P0001'; end if;
  entitlement := public.pro_entitlement(auth.uid());
  if (entitlement ->> 'blocked')::boolean then raise exception 'account blocked'; end if;
  if not coalesce((entitlement ->> 'active')::boolean, false) then
    raise exception 'subscription required' using errcode = 'P0002';
  end if;

  feature := public.pro_feature_for_kind(p_kind);
  if not coalesce((entitlement -> 'features' ->> feature)::boolean, false) then
    raise exception 'plan does not include %', feature using errcode = 'P0003';
  end if;

  limits := public.pro_setting('limits');
  if length(coalesce(p_prompt, '')) < 3 then raise exception 'prompt too short' using errcode = 'P0004'; end if;
  if length(p_prompt) > coalesce((limits ->> 'max_prompt_chars')::int, 600) then
    raise exception 'prompt too long' using errcode = 'P0004';
  end if;
  if not public.pro_rate_hit('gen:' || auth.uid()::text, coalesce((limits ->> 'rate_gen_per_minute')::int, 6), 60) then
    raise exception 'slow down' using errcode = 'P0005';
  end if;

  select count(*) into today_count from public.generations
   where user_id = auth.uid() and created_at > now() - interval '1 day';
  if today_count >= coalesce((limits ->> 'daily_generations')::int, 60) then
    raise exception 'daily limit reached' using errcode = 'P0006';
  end if;

  credits_cost := public.pro_setting('credits');
  cost := coalesce((credits_cost ->> p_kind)::int, 1);

  -- Reserve the job first, then charge against it: both statements run in this
  -- transaction, so a failed charge rolls the row back and nothing leaks.
  insert into public.generations (user_id, kind, prompt, options, status, credits, model_id)
  values (auth.uid(), p_kind, p_prompt, coalesce(p_options, '{}'::jsonb), 'running', cost, p_model)
  returning id into generation_id;

  balance := public.pro_consume_credits(cost, 'generation:' || p_kind, generation_id::text);

  return jsonb_build_object('generation_id', generation_id, 'credits', cost, 'balance', balance);
end;
$$;
revoke all on function public.pro_begin_generation(text, text, jsonb, text) from public, anon;
grant execute on function public.pro_begin_generation(text, text, jsonb, text) to authenticated;

create or replace function public.pro_finish_generation(
  p_id uuid,
  p_status text,
  p_spec jsonb default null,
  p_quality jsonb default null,
  p_metadata jsonb default null,
  p_file_name text default null,
  p_file_bytes integer default null,
  p_cost_usd numeric default 0,
  p_error text default null,
  p_provider text default null,
  p_model text default null,
  p_in_tokens integer default 0,
  p_out_tokens integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  generation record;
  refunded integer := 0;
  balance integer;
begin
  select * into generation from public.generations where id = p_id for update;
  if generation.id is null then raise exception 'generation not found'; end if;
  if generation.user_id <> auth.uid() then
    raise exception 'not allowed' using errcode = 'P0001';
  end if;
  if generation.status <> 'running' then
    return jsonb_build_object('status', generation.status);
  end if;

  if p_status <> 'done' then
    refunded := generation.credits;
    if refunded > 0 then
      insert into public.wallets (user_id) values (generation.user_id) on conflict (user_id) do nothing;
      update public.wallets set credits = credits + refunded, updated_at = now()
       where user_id = generation.user_id returning credits into balance;
      insert into public.credit_ledger (user_id, delta, balance_after, reason, ref)
      values (generation.user_id, refunded, balance, 'refund:generation', p_id::text);
    end if;
  end if;

  update public.generations set
    status = p_status,
    spec = coalesce(p_spec, spec),
    quality = coalesce(p_quality, quality),
    metadata = coalesce(p_metadata, metadata),
    file_name = coalesce(p_file_name, file_name),
    file_bytes = coalesce(p_file_bytes, file_bytes),
    cost_usd = coalesce(p_cost_usd, 0),
    error = p_error,
    provider_id = coalesce(p_provider, provider_id),
    model_id = coalesce(p_model, model_id),
    completed_at = now()
  where id = p_id;

  if p_provider is not null then
    insert into public.api_usage (user_id, provider_id, model_id, kind, input_tokens, output_tokens, images, cost_usd, generation_id)
    values (generation.user_id, p_provider, p_model, generation.kind, coalesce(p_in_tokens, 0), coalesce(p_out_tokens, 0),
            case when generation.kind = 'jpg' then 1 else 0 end, coalesce(p_cost_usd, 0), p_id);
  end if;

  return jsonb_build_object('status', p_status, 'refunded', refunded);
end;
$$;
revoke all on function public.pro_finish_generation(uuid, text, jsonb, jsonb, jsonb, text, integer, numeric, text, text, text, integer, integer) from public, anon;
grant execute on function public.pro_finish_generation(uuid, text, jsonb, jsonb, jsonb, text, integer, numeric, text, text, text, integer, integer) to authenticated;

/* ---------------------------------------------------------------- pricing */

create or replace function public.pro_quote(p_plan text, p_months integer, p_method text default 'bkash')
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  price record;
  method record;
  amounts jsonb;
begin
  select pp.plan_slug, pp.months, pp.price_bdt, pp.price_usd, pp.credits, p.name, p.features
    into price
    from public.plan_prices pp
    join public.plans p on p.slug = pp.plan_slug
   where pp.plan_slug = p_plan and pp.months = p_months and pp.active and p.active;
  if price.plan_slug is null then raise exception 'plan unavailable'; end if;
  select * into method from public.payment_methods where id = p_method and enabled;
  if method.id is null then raise exception 'method unavailable'; end if;
  amounts := jsonb_build_object();
  select jsonb_object_agg(id, jsonb_build_object('amount', ceil(price.price_usd / nullif(usd_rate, 0) * power(10, decimals)) / power(10, decimals), 'decimals', decimals))
    into amounts from public.crypto_assets where enabled;
  return jsonb_build_object(
    'plan', price.plan_slug, 'plan_name', price.name, 'months', price.months,
    'price_bdt', price.price_bdt, 'price_usd', price.price_usd, 'credits', price.credits,
    'method', method.id, 'method_config', method.config,
    'crypto', amounts, 'server_time', now()
  );
end;
$$;
grant execute on function public.pro_quote(text, integer, text) to authenticated;

/* ---------------------------------------------------------------- payments */

create or replace function public.pro_submit_payment(
  p_plan text,
  p_months integer,
  p_method text,
  p_txn_ref text default null,
  p_sender text default null,
  p_note text default null,
  p_contact text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  price record;
  v_method record;
  pending integer;
  limits jsonb;
  order_row public.payment_orders;
  clean_txn text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = 'P0001'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and blocked) then
    raise exception 'account blocked';
  end if;

  select pp.price_bdt, pp.price_usd, pp.credits, p.name into price
    from public.plan_prices pp join public.plans p on p.slug = pp.plan_slug
   where pp.plan_slug = p_plan and pp.months = p_months and pp.active and p.active;
  if price.price_bdt is null then raise exception 'plan unavailable'; end if;

  select * into v_method from public.payment_methods where id = p_method and enabled;
  if v_method.id is null then raise exception 'method unavailable'; end if;

  limits := public.pro_setting('limits');
  if not public.pro_rate_hit('order:' || auth.uid()::text, 6, 3600) then
    raise exception 'too many attempts' using errcode = 'P0005';
  end if;
  select count(*) into pending from public.payment_orders
   where user_id = auth.uid() and status in ('awaiting', 'submitted');
  if pending >= coalesce((limits ->> 'max_pending_orders')::int, 3) then
    raise exception 'too many open orders' using errcode = 'P0006';
  end if;

  clean_txn := nullif(upper(regexp_replace(coalesce(p_txn_ref, ''), '\s', '', 'g')), '');
  if p_method in ('bkash', 'nagad') then
    if clean_txn is null or length(clean_txn) < 6 then
      raise exception 'transaction id required' using errcode = 'P0004';
    end if;
    if exists (select 1 from public.payment_orders o where o.method = p_method and lower(o.txn_ref) = lower(clean_txn) and o.status <> 'rejected') then
      raise exception 'transaction already claimed' using errcode = 'P0007';
    end if;
  end if;

  insert into public.payment_orders (user_id, plan_slug, months, amount_bdt, credits, method, status, txn_ref, sender_hint, note, contact, expires_at)
  values (auth.uid(), p_plan, p_months, price.price_bdt, price.credits, p_method,
          case when clean_txn is null then 'awaiting' else 'submitted' end,
          clean_txn, left(p_sender, 80), left(p_note, 240), left(p_contact, 80),
          now() + make_interval(mins => coalesce((public.pro_setting('payment') ->> 'order_ttl_minutes')::int, 90)))
  returning * into order_row;

  return jsonb_build_object(
    'order_id', order_row.id, 'status', order_row.status, 'amount_bdt', order_row.amount_bdt,
    'credits', order_row.credits, 'expires_at', order_row.expires_at, 'method', order_row.method,
    'instructions', v_method.config
  );
end;
$$;
revoke all on function public.pro_submit_payment(text, integer, text, text, text, text, text) from public, anon;
grant execute on function public.pro_submit_payment(text, integer, text, text, text, text, text) to authenticated;

create or replace function public.pro_activate_order(p_order uuid, p_actor uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  order_row public.payment_orders;
  sub_id uuid;
  new_expiry timestamptz;
  balance integer;
begin
  select * into order_row from public.payment_orders where id = p_order for update;
  if order_row.id is null then raise exception 'order not found'; end if;
  if order_row.status = 'approved' then return order_row.subscription_id; end if;
  if order_row.status = 'rejected' then raise exception 'order rejected'; end if;

  -- Extend from the current expiry when a subscription is still running, so a
  -- renewal never loses the days that are left.
  select greatest(now(), coalesce(max(expires_at), now())) into new_expiry
    from public.subscriptions
   where user_id = order_row.user_id and status = 'active' and expires_at > now();

  -- One active row per user is enforced by a unique index, so a renewal closes
  -- the old row first; its remaining days are carried into the new expiry above.
  update public.subscriptions set status = 'cancelled'
   where user_id = order_row.user_id and status = 'active';

  insert into public.subscriptions (user_id, plan_slug, status, months, started_at, expires_at, order_id, created_by)
  values (order_row.user_id, order_row.plan_slug, 'active', order_row.months, now(),
          new_expiry + public.pro_duration(order_row.months), p_order, p_actor)
  returning id into sub_id;

  insert into public.wallets (user_id) values (order_row.user_id) on conflict (user_id) do nothing;
  update public.wallets set credits = credits + order_row.credits,
                            lifetime_spent_bdt = lifetime_spent_bdt + order_row.amount_bdt,
                            updated_at = now()
   where user_id = order_row.user_id returning credits into balance;
  insert into public.credit_ledger (user_id, delta, balance_after, reason, ref)
  values (order_row.user_id, order_row.credits, balance, 'subscription:' || order_row.plan_slug, p_order::text);

  update public.payment_orders set status = 'approved', subscription_id = sub_id,
         reviewed_by = coalesce(p_actor, reviewed_by), reviewed_at = now()
   where id = p_order;

  return sub_id;
end;
$$;
revoke all on function public.pro_activate_order(uuid, uuid) from public, anon, authenticated;

create or replace function public.pro_my_orders()
returns setof public.payment_orders
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.payment_orders where user_id = auth.uid() order by created_at desc limit 50;
$$;
grant execute on function public.pro_my_orders() to authenticated;

create or replace function public.pro_my_invoices()
returns table (
  invoice_id uuid, order_id uuid, asset_id text, symbol text, network text, address text,
  amount_expected numeric, amount_received numeric, status text, confirmations integer,
  required_confirmations smallint, tx_hash text, expires_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.id, i.order_id, i.asset_id, a.symbol, a.network, i.address, i.amount_expected,
         i.amount_received, i.status, i.confirmations, a.confirmations, i.tx_hash, i.expires_at, i.created_at
    from public.crypto_invoices i
    join public.crypto_assets a on a.id = i.asset_id
    join public.payment_orders o on o.id = i.order_id
   where o.user_id = auth.uid()
   order by i.created_at desc
   limit 20;
$$;
grant execute on function public.pro_my_invoices() to authenticated;

create or replace function public.pro_create_crypto_invoice(p_order uuid, p_asset text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  order_row public.payment_orders;
  asset record;
  invoice_row public.crypto_invoices;
  amount numeric;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into order_row from public.payment_orders where id = p_order;
  if order_row.id is null or order_row.user_id <> auth.uid() then raise exception 'order not found'; end if;
  if order_row.status not in ('awaiting', 'submitted') then raise exception 'order closed'; end if;
  if order_row.expires_at < now() then raise exception 'order expired'; end if;
  if order_row.method <> 'crypto' then raise exception 'not a crypto order'; end if;

  select * into asset from public.crypto_assets where id = p_asset and enabled;
  if asset.id is null then raise exception 'asset unavailable'; end if;
  amount := ceil(order_row.amount_bdt / coalesce((public.pro_setting('fx_bdt_usd') #>> '{}')::numeric, 122)
                 / nullif(asset.usd_rate, 0) * power(10, asset.decimals)) / power(10, asset.decimals);
  if amount * asset.usd_rate < asset.min_usd then
    raise exception 'amount below network minimum';
  end if;

  insert into public.crypto_invoices (order_id, asset_id, address, amount_usd, amount_expected, expires_at)
  values (p_order, asset.id, asset.address, order_row.amount_bdt / coalesce((public.pro_setting('fx_bdt_usd') #>> '{}')::numeric, 122),
          amount, now() + make_interval(mins => coalesce((public.pro_setting('payment') ->> 'crypto_ttl_minutes')::int, 120)))
  on conflict (order_id) do update set
    asset_id = excluded.asset_id, address = excluded.address,
    amount_expected = excluded.amount_expected, expires_at = excluded.expires_at,
    status = case when public.crypto_invoices.status = 'confirmed' then 'confirmed' else 'pending' end,
    confirmations = case when public.crypto_invoices.status = 'confirmed' then public.crypto_invoices.confirmations else 0 end
  returning * into invoice_row;

  return jsonb_build_object(
    'invoice_id', invoice_row.id, 'order_id', invoice_row.order_id,
    'asset', asset.id, 'symbol', asset.symbol, 'name', asset.name, 'network', asset.network,
    'address', invoice_row.address, 'amount', invoice_row.amount_expected,
    'amount_usd', invoice_row.amount_usd, 'decimals', asset.decimals,
    'confirmations_required', asset.confirmations, 'expires_at', invoice_row.expires_at,
    'explorer', asset.explorer, 'status', invoice_row.status
  );
end;
$$;
revoke all on function public.pro_create_crypto_invoice(uuid, text) from public, anon;
grant execute on function public.pro_create_crypto_invoice(uuid, text) to authenticated;

/**
 * Settlement is service-role only: it is called by the verifier edge function
 * after the chain confirms amount, network, destination and confirmations.
 */
create or replace function public.pro_settle_crypto(
  p_invoice uuid,
  p_tx text,
  p_received numeric,
  p_confirmations integer,
  p_payload jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invoice_row public.crypto_invoices;
  asset record;
  tolerance numeric := 0.995;
  expected_confirmations integer;
  order_row public.payment_orders;
  sub_id uuid;
begin
  select * into invoice_row from public.crypto_invoices where id = p_invoice for update;
  if invoice_row.id is null then raise exception 'invoice not found'; end if;
  if invoice_row.status = 'confirmed' then
    return jsonb_build_object('status', 'confirmed', 'invoice', invoice_row.id);
  end if;
  if invoice_row.expires_at < now() - interval '1 day' then
    update public.crypto_invoices set status = 'expired' where id = p_invoice;
    return jsonb_build_object('status', 'expired');
  end if;

  select * into asset from public.crypto_assets where id = invoice_row.asset_id;
  expected_confirmations := asset.confirmations;

  if p_tx is null or p_tx = '' then
    update public.crypto_invoices set last_checked_at = now(), payload = coalesce(p_payload, payload)
     where id = p_invoice;
    return jsonb_build_object('status', 'pending', 'confirmations', 0);
  end if;

  if exists (select 1 from public.crypto_invoices
              where id <> p_invoice and lower(tx_hash) = lower(p_tx) and status = 'confirmed') then
    update public.crypto_invoices set status = 'mismatch',
           payload = coalesce(p_payload, payload) || jsonb_build_object('reason', 'tx reused'),
           last_checked_at = now()
     where id = p_invoice;
    return jsonb_build_object('status', 'mismatch', 'reason', 'tx reused');
  end if;

  if coalesce(p_received, 0) < invoice_row.amount_expected * tolerance then
    update public.crypto_invoices set status = 'mismatch', amount_received = coalesce(p_received, 0),
           tx_hash = p_tx, confirmations = coalesce(p_confirmations, 0),
           payload = coalesce(p_payload, payload) || jsonb_build_object('reason', 'amount short'),
           last_checked_at = now()
     where id = p_invoice;
    return jsonb_build_object('status', 'mismatch', 'reason', 'amount short');
  end if;

  if coalesce(p_confirmations, 0) < expected_confirmations then
    update public.crypto_invoices set status = 'seen', amount_received = p_received, tx_hash = p_tx,
           confirmations = coalesce(p_confirmations, 0), payload = coalesce(p_payload, payload),
           last_checked_at = now()
     where id = p_invoice;
    return jsonb_build_object('status', 'seen', 'confirmations', coalesce(p_confirmations, 0), 'required', expected_confirmations);
  end if;

  update public.crypto_invoices set status = 'confirmed', amount_received = p_received, tx_hash = p_tx,
         confirmations = coalesce(p_confirmations, 0), payload = coalesce(p_payload, payload),
         last_checked_at = now()
   where id = p_invoice;

  select * into order_row from public.payment_orders where id = invoice_row.order_id;
  if order_row.status <> 'approved' then
    update public.payment_orders set status = 'submitted', txn_ref = p_tx, reviewed_at = now()
     where id = order_row.id;
    sub_id := public.pro_activate_order(order_row.id, null);
  end if;

  return jsonb_build_object('status', 'confirmed', 'invoice', p_invoice, 'subscription', sub_id);
end;
$$;
revoke all on function public.pro_settle_crypto(uuid, text, numeric, integer, jsonb) from public, anon, authenticated;

/* ------------------------------------------------------------------ admin */

create or replace function public.pro_admin_review_order(p_order uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  order_row public.payment_orders;
  sub_id uuid;
begin
  if not public.pro_is_admin() then raise exception 'not allowed'; end if;
  select * into order_row from public.payment_orders where id = p_order for update;
  if order_row.id is null then raise exception 'order not found'; end if;
  if order_row.status = 'approved' then raise exception 'already approved'; end if;

  if p_approve then
    sub_id := public.pro_activate_order(p_order, auth.uid());
  else
    update public.payment_orders set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
           review_note = left(p_note, 240)
     where id = p_order;
  end if;

  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(), case when p_approve then 'order.approve' else 'order.reject' end,
          p_order::text, jsonb_build_object('note', p_note));

  return jsonb_build_object('order', p_order, 'status', case when p_approve then 'approved' else 'rejected' end, 'subscription', sub_id);
end;
$$;
revoke all on function public.pro_admin_review_order(uuid, boolean, text) from public, anon;
grant execute on function public.pro_admin_review_order(uuid, boolean, text) to authenticated;

create or replace function public.pro_admin_grant(p_user uuid, p_plan text, p_months integer, p_note text default 'manual grant')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  price record;
  sub_id uuid;
  new_expiry timestamptz;
  balance integer;
begin
  if not public.pro_is_admin() then raise exception 'not allowed'; end if;
  select pp.credits, pp.price_bdt into price from public.plan_prices pp
   where pp.plan_slug = p_plan and pp.months = p_months;
  select greatest(now(), coalesce(max(expires_at), now())) into new_expiry
    from public.subscriptions where user_id = p_user and status = 'active' and expires_at > now();
  update public.subscriptions set status = 'cancelled'
   where user_id = p_user and status = 'active';

  insert into public.subscriptions (user_id, plan_slug, status, months, started_at, expires_at, created_by)
  values (p_user, p_plan, 'active', p_months, now(), new_expiry + public.pro_duration(p_months), auth.uid())
  returning id into sub_id;

  if coalesce(price.credits, 0) > 0 then
    insert into public.wallets (user_id) values (p_user) on conflict (user_id) do nothing;
    update public.wallets set credits = credits + price.credits, updated_at = now()
     where user_id = p_user returning credits into balance;
    insert into public.credit_ledger (user_id, delta, balance_after, reason, ref)
    values (p_user, price.credits, balance, 'grant:' || p_plan, sub_id::text);
  end if;

  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(), 'subscription.grant', p_user::text,
          jsonb_build_object('plan', p_plan, 'months', p_months, 'note', p_note));
  return sub_id;
end;
$$;
revoke all on function public.pro_admin_grant(uuid, text, integer, text) from public, anon;
grant execute on function public.pro_admin_grant(uuid, text, integer, text) to authenticated;

create or replace function public.pro_admin_users(p_search text default null)
returns table (
  user_id uuid, email text, display_name text, role text, blocked boolean,
  plan text, expires_at timestamptz, credits integer, spent_bdt integer,
  generations integer, joined timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pr.id, pr.email, pr.display_name, pr.role, pr.blocked,
         s.plan_slug, s.expires_at, coalesce(w.credits, 0), coalesce(w.lifetime_spent_bdt, 0),
         (select count(*)::int from public.generations g where g.user_id = pr.id),
         pr.created_at
    from public.profiles pr
    left join public.subscriptions s on s.user_id = pr.id and s.status = 'active' and s.expires_at > now()
    left join public.wallets w on w.user_id = pr.id
   where public.pro_is_admin()
     and (p_search is null or pr.email ilike '%' || p_search || '%' or pr.display_name ilike '%' || p_search || '%')
   order by pr.created_at desc
   limit 200;
$$;
grant execute on function public.pro_admin_users(text) to authenticated;

create or replace function public.pro_admin_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  fx numeric := coalesce((public.pro_setting('fx_bdt_usd') #>> '{}')::numeric, 122);
  revenue integer;
  expense numeric;
  result jsonb;
begin
  if not public.pro_is_admin() then raise exception 'not allowed'; end if;
  select coalesce(sum(amount_bdt), 0)::int into revenue
    from public.payment_orders
   where status = 'approved' and created_at > now() - make_interval(days => p_days);
  select coalesce(sum(cost_usd), 0) into expense
    from public.api_usage where created_at > now() - make_interval(days => p_days);

  result := jsonb_build_object(
    'window_days', p_days,
    'revenue_bdt', revenue,
    'api_cost_usd', round(expense, 4),
    'api_cost_bdt', round(expense * fx, 2),
    'margin_bdt', round(revenue - expense * fx, 2),
    'margin_pct', case when revenue > 0 then round((revenue - expense * fx) / revenue * 100, 1) else null end,
    'orders_pending', (select count(*) from public.payment_orders where status in ('awaiting', 'submitted')),
    'orders_approved', (select count(*) from public.payment_orders where status = 'approved' and created_at > now() - make_interval(days => p_days)),
    'active_subs', (select count(*) from public.subscriptions where status = 'active' and expires_at > now()),
    'users', (select count(*) from public.profiles),
    'generations', (select count(*) from public.generations where created_at > now() - make_interval(days => p_days)),
    'generations_failed', (select count(*) from public.generations where status = 'failed' and created_at > now() - make_interval(days => p_days)),
    'by_model', coalesce((select jsonb_agg(row_to_json(t)) from (
        select model_id, count(*)::int as calls, coalesce(sum(input_tokens), 0)::int as tokens_in,
               coalesce(sum(output_tokens), 0)::int as tokens_out, round(sum(cost_usd), 4) as cost_usd
          from public.api_usage where created_at > now() - make_interval(days => p_days)
         group by model_id order by calls desc) t), '[]'::jsonb)
  );
  return result;
end;
$$;
grant execute on function public.pro_admin_stats(integer) to authenticated;

create or replace function public.pro_admin_set_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.pro_is_admin() then raise exception 'not allowed'; end if;
  update public.app_settings set value = p_value, updated_at = now(), updated_by = auth.uid() where key = p_key;
  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(), 'setting.update', p_key, p_value);
end;
$$;
grant execute on function public.pro_admin_set_setting(text, jsonb) to authenticated;

create or replace function public.pro_expire_subscriptions()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  with expired as (
    update public.subscriptions set status = 'expired'
     where status = 'active' and expires_at <= now()
     returning 1
  )
  select count(*)::int from expired;
$$;
revoke all on function public.pro_expire_subscriptions() from public, anon, authenticated;

create or replace function public.pro_admin_audit_tail(p_limit integer default 100)
returns setof public.admin_audit
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.admin_audit where public.pro_is_admin() order by created_at desc limit p_limit;
$$;
grant execute on function public.pro_admin_audit_tail(integer) to authenticated;

/**
 * Attach the rendered quality report and metadata to a finished generation.
 * The brief is produced by the edge function; the artwork itself is rendered on
 * the desktop, so its measurements arrive here afterwards.
 */
create or replace function public.pro_attach_quality(
  p_id uuid,
  p_quality jsonb,
  p_metadata jsonb default null,
  p_file_name text default null,
  p_file_bytes integer default null
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.generations set
    quality = coalesce(p_quality, quality),
    metadata = coalesce(p_metadata, metadata),
    file_name = coalesce(p_file_name, file_name),
    file_bytes = coalesce(p_file_bytes, file_bytes)
  where id = p_id and user_id = auth.uid();
$$;
revoke all on function public.pro_attach_quality(uuid, jsonb, jsonb, text, integer) from public, anon;
grant execute on function public.pro_attach_quality(uuid, jsonb, jsonb, text, integer) to authenticated;
