-- Crypto hardening: real token contracts, transaction time checks, editable
-- wallets and an index the watcher can use.
--
-- Why this exists
--   1. The first seed used one placeholder wallet for every chain and no token
--      contract, so an ERC20 transfer could never be matched. `contract` now
--      distinguishes a token (match the log) from a native coin (match tx.to).
--   2. A transaction that happened before the invoice existed must never settle
--      an order. pro_settle_crypto now takes the chain timestamp.
--   3. Administrators can set their own wallet addresses from the console
--      instead of editing SQL.

alter table public.crypto_assets add column if not exists contract text;
alter table public.crypto_assets add column if not exists wallet_label text;

-- Real contracts. USDT and USDC on BNB Smart Chain, USDC and USDT on Polygon.
update public.crypto_assets set contract = '0x55d398326f99059fF775485246999027B3197955' where id = 'usdt-bep20';
update public.crypto_assets set contract = '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d' where id = 'usdc-bsc';
update public.crypto_assets set contract = '0xe9e7cea3dedca5984780bafc599bd69add087d56' where id = 'dai-bep20';
update public.crypto_assets set contract = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f' where id = 'usdc-polygon';

-- Solana tokens are identified by their mint address, not by a balance delta.
update public.crypto_assets set contract = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' where id = 'usdt-sol';
update public.crypto_assets set contract = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' where id = 'usdc-sol';

-- These two cannot be verified on chain by this function: a Binance UID has no
-- public ledger, and Litecoin has no reader here yet. Leaving them on would let
-- a customer pay into a void, so they stay off until a verifier exists.
update public.crypto_assets set enabled = false where id in ('usdt-binance-pay', 'ltc-litecoin');

create index if not exists crypto_invoices_open_idx
  on public.crypto_invoices (status, expires_at)
  where status in ('pending', 'seen');

create or replace function public.pro_admin_update_asset(p_id text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_out public.crypto_assets;
begin
  if not public.pro_is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.crypto_assets set
    symbol = coalesce(p_patch ->> 'symbol', symbol),
    name = coalesce(p_patch ->> 'name', name),
    network = coalesce(p_patch ->> 'network', network),
    address = coalesce(p_patch ->> 'address', address),
    contract = case when p_patch ? 'contract' then nullif(p_patch ->> 'contract', '') else contract end,
    wallet_label = coalesce(p_patch ->> 'wallet_label', wallet_label),
    decimals = coalesce((p_patch ->> 'decimals')::smallint, decimals),
    usd_rate = coalesce((p_patch ->> 'usd_rate')::numeric, usd_rate),
    min_usd = coalesce((p_patch ->> 'min_usd')::numeric, min_usd),
    confirmations = coalesce((p_patch ->> 'confirmations')::smallint, confirmations),
    enabled = coalesce((p_patch ->> 'enabled')::boolean, enabled),
    updated_at = now()
  where id = p_id
  returning * into row_out;

  if row_out.id is null then raise exception 'asset not found'; end if;
  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(), 'crypto.asset.update', p_id, p_patch);
  return to_jsonb(row_out);
end;
$$;
revoke all on function public.pro_admin_update_asset(text, jsonb) from public, anon;
grant execute on function public.pro_admin_update_asset(text, jsonb) to authenticated;

-- Settlement gains the chain timestamp. Anything older than the invoice is
-- refused, which stops a customer replaying a payment they made last month.
drop function if exists public.pro_settle_crypto(uuid, text, numeric, integer, jsonb);

create or replace function public.pro_settle_crypto(
  p_invoice uuid,
  p_tx text,
  p_received numeric,
  p_confirmations integer,
  p_payload jsonb default null,
  p_tx_time timestamptz default null
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

  -- A hash may settle one invoice, ever.
  if exists (select 1 from public.crypto_invoices
              where id <> p_invoice and lower(tx_hash) = lower(p_tx)) then
    update public.crypto_invoices set status = 'mismatch',
           payload = coalesce(p_payload, payload) || jsonb_build_object('reason', 'tx reused'),
           last_checked_at = now()
     where id = p_invoice;
    return jsonb_build_object('status', 'mismatch', 'reason', 'tx reused');
  end if;

  -- A payment made before the invoice existed belongs to somebody else.
  if p_tx_time is not null and p_tx_time < invoice_row.created_at - interval '10 minutes' then
    update public.crypto_invoices set status = 'mismatch',
           payload = coalesce(p_payload, payload) || jsonb_build_object('reason', 'tx older than invoice', 'tx_time', p_tx_time),
           last_checked_at = now()
     where id = p_invoice;
    return jsonb_build_object('status', 'mismatch', 'reason', 'tx older than invoice');
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
revoke all on function public.pro_settle_crypto(uuid, text, numeric, integer, jsonb, timestamptz) from public, anon, authenticated;
-- The verifier runs as the service role: revoking from PUBLIC also removes the
-- implicit grant it used to have, so the grant has to be explicit here.
grant execute on function public.pro_settle_crypto(uuid, text, numeric, integer, jsonb, timestamptz) to service_role;

-- What the watcher needs, in one secure call: open invoices with their asset.
create or replace function public.pro_watch_invoices()
returns table (
  id uuid, order_id uuid, user_id uuid, asset_id text, symbol text, network text,
  address text, contract text, decimals smallint, amount_expected numeric, confirmations_required smallint,
  created_at timestamptz, expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.id, i.order_id, o.user_id, i.asset_id, a.symbol, a.network, i.address, a.contract,
         a.decimals, i.amount_expected, a.confirmations, i.created_at, i.expires_at
    from public.crypto_invoices i
    join public.crypto_assets a on a.id = i.asset_id
    join public.payment_orders o on o.id = i.order_id
   where i.status in ('pending', 'seen')
     and i.expires_at > now() - interval '1 day'
     and o.status in ('awaiting', 'submitted')
   order by i.created_at
   limit 100;
$$;
revoke all on function public.pro_watch_invoices() from public, anon, authenticated;
grant execute on function public.pro_watch_invoices() to service_role;
