-- Own-row policies for two factor accounts plus the administrator security kit.
-- Split from 202611171004 because the dashboard migration endpoint caps size.

/* ----------------------------------------------------------------- policies */

-- Own rows are hidden from aal1 sessions of two factor accounts. Admins keep
-- reading everything once their own session is at aal2.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select to authenticated
  using ((id = auth.uid() and not public.pro_needs_aal2()) or public.pro_is_admin());

drop policy if exists subscriptions_self_read on public.subscriptions;
create policy subscriptions_self_read on public.subscriptions for select to authenticated
  using ((user_id = auth.uid() and not public.pro_needs_aal2()) or public.pro_is_admin());

drop policy if exists wallets_self_read on public.wallets;
create policy wallets_self_read on public.wallets for select to authenticated
  using ((user_id = auth.uid() and not public.pro_needs_aal2()) or public.pro_is_admin());

drop policy if exists ledger_self_read on public.credit_ledger;
create policy ledger_self_read on public.credit_ledger for select to authenticated
  using ((user_id = auth.uid() and not public.pro_needs_aal2()) or public.pro_is_admin());

drop policy if exists generations_self_read on public.generations;
create policy generations_self_read on public.generations for select to authenticated
  using ((user_id = auth.uid() and not public.pro_needs_aal2()) or public.pro_is_admin());

drop policy if exists orders_self_read on public.payment_orders;
create policy orders_self_read on public.payment_orders for select to authenticated
  using ((user_id = auth.uid() and not public.pro_needs_aal2()) or public.pro_is_admin());

drop policy if exists invoices_self_read on public.crypto_invoices;
create policy invoices_self_read on public.crypto_invoices for select to authenticated
  using (
    public.pro_is_admin()
    or exists (
      select 1 from public.payment_orders o
       where o.id = order_id and o.user_id = auth.uid() and not public.pro_needs_aal2()
    )
  );

/* --------------------------------------------------- writes that cost money */

-- Order and invoice rows may only be created from a session that is fully
-- verified. Service role calls (no user claim) pass straight through.
create or replace function public.pro_guard_aal2()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.pro_assert_aal2();
  return new;
end;
$$;
revoke all on function public.pro_guard_aal2() from public, anon, authenticated;

drop trigger if exists payment_orders_aal2 on public.payment_orders;
create trigger payment_orders_aal2 before insert on public.payment_orders
  for each row execute function public.pro_guard_aal2();

drop trigger if exists crypto_invoices_aal2 on public.crypto_invoices;
create trigger crypto_invoices_aal2 before insert on public.crypto_invoices
  for each row execute function public.pro_guard_aal2();

/* ------------------------------------------------------- admin security kit */

-- Clear a lost authenticator so the owner can sign in again. Passwords are
-- never touched: the user still resets theirs through the email link.
create or replace function public.pro_admin_reset_mfa(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removed integer;
begin
  if not public.pro_is_admin() then raise exception 'not allowed'; end if;
  with gone as (
    delete from auth.mfa_factors
     where user_id = p_user and factor_type = 'totp'
     returning 1
  )
  select count(*)::int into removed from gone;
  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(), 'mfa.reset', p_user::text, jsonb_build_object('removed', removed));
  return removed;
end;
$$;
revoke all on function public.pro_admin_reset_mfa(uuid) from public, anon;
grant execute on function public.pro_admin_reset_mfa(uuid) to authenticated;

-- Who has 2FA, when they last signed in, whether they are blocked.
create or replace function public.pro_admin_security_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.pro_is_admin() then raise exception 'not allowed'; end if;
  return coalesce((
    select jsonb_agg(row order by row ->> 'email')
      from (
        select jsonb_build_object(
                 'user_id', u.id,
                 'email', u.email,
                 'role', coalesce(p.role, 'user'),
                 'blocked', coalesce(p.blocked, false),
                 'factors', (select count(*)::int from auth.mfa_factors f
                              where f.user_id = u.id and f.factor_type = 'totp' and f.status = 'verified'),
                 'last_sign_in_at', u.last_sign_in_at,
                 'created_at', u.created_at
               ) as row
          from auth.users u
          left join public.profiles p on p.id = u.id
      ) rows
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.pro_admin_security_overview() from public, anon;
grant execute on function public.pro_admin_security_overview() to authenticated;

-- Housekeeping the dashboard has no cron for: mark finished plans expired so
-- the admin views stop counting them as active.
create or replace function public.pro_admin_expire_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  touched integer;
begin
  if not public.pro_is_admin() then raise exception 'not allowed'; end if;
  with expired as (
    update public.subscriptions set status = 'expired'
     where status = 'active' and expires_at <= now()
     returning 1
  )
  select count(*)::int into touched from expired;
  delete from public.rate_events where window_start < now() - interval '1 day';
  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(), 'subscriptions.expire', 'sweep', jsonb_build_object('expired', touched));
  return touched;
end;
$$;
revoke all on function public.pro_admin_expire_subscriptions() from public, anon;
grant execute on function public.pro_admin_expire_subscriptions() to authenticated;

-- Refuse to switch on "admins must use 2FA" from an account that has no
-- authenticator yet, otherwise the switch would lock the owner out.
create or replace function public.pro_admin_set_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.pro_is_admin() then raise exception 'not allowed'; end if;
  if p_key = 'security'
     and coalesce((p_value ->> 'require_admin_mfa')::boolean, false)
     and not public.pro_has_totp(auth.uid()) then
    raise exception 'enable two step verification on your own account first' using errcode = 'P0008';
  end if;
  update public.app_settings set value = p_value, updated_at = now(), updated_by = auth.uid() where key = p_key;
  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(), 'setting.update', p_key, p_value);
end;
$$;
grant execute on function public.pro_admin_set_setting(text, jsonb) to authenticated;
