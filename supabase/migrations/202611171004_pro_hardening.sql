-- Two step verification enforcement, admin recovery helpers and the profile
-- backfill that the earlier migrations could not do for accounts created before
-- the signup trigger existed.
--
-- Rules enforced here:
--   * a verified TOTP factor means every session must reach aal2 before it can
--     read own rows, spend credits or act as an administrator;
--   * an administrator can clear a lost authenticator for a user (audited);
--   * administrators can require 2FA for every admin account.

/* ---------------------------------------------------------- profile repair */

-- Accounts created before pro_on_auth_user_created was installed have no
-- profile row, which leaves them without entitlements and without a role.
insert into public.profiles (id, email, display_name)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data ->> 'display_name', split_part(coalesce(u.email, 'artist'), '@', 1))
  from auth.users u
on conflict (id) do nothing;

-- New accounts get their wallet in the same transaction, so credits start at 0
-- instead of "row missing".
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
  insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

/* ------------------------------------------------------- two factor helpers */

create or replace function public.pro_has_totp(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from auth.mfa_factors f
     where f.user_id = coalesce(p_user, auth.uid())
       and f.factor_type = 'totp'
       and f.status = 'verified'
  );
$$;
revoke all on function public.pro_has_totp(uuid) from public, anon;
grant execute on function public.pro_has_totp(uuid) to authenticated;

-- True when this request is signed in below aal2 while the account owns a
-- verified authenticator. Anonymous and single factor accounts are unaffected.
create or replace function public.pro_needs_aal2()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
     and exists (
       select 1 from auth.mfa_factors f
        where f.user_id = auth.uid()
          and f.factor_type = 'totp'
          and f.status = 'verified'
     );
$$;
revoke all on function public.pro_needs_aal2() from public, anon;
grant execute on function public.pro_needs_aal2() to authenticated;

create or replace function public.pro_assert_aal2()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.pro_needs_aal2() then
    raise exception 'two factor code required' using errcode = 'P0007';
  end if;
end;
$$;
revoke all on function public.pro_assert_aal2() from public, anon;
grant execute on function public.pro_assert_aal2() to authenticated;

/* -------------------------------------------------------------- admin gate */

-- Admin rights now need a second factor when the admin owns one, and, if the
-- site owner switched the policy on, a verified factor at all.
create or replace function public.pro_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not public.pro_needs_aal2()
     and exists (
       select 1 from public.profiles
        where id = auth.uid() and role = 'admin' and blocked = false
     )
     and (
       not coalesce((public.pro_setting('security') ->> 'require_admin_mfa')::boolean, false)
       or public.pro_has_totp(auth.uid())
     );
$$;
revoke all on function public.pro_is_admin() from public, anon;
grant execute on function public.pro_is_admin() to authenticated;

/* ------------------------------------------------------- settings defaults */

insert into public.app_settings (key, value, label) values
  ('security', '{"require_admin_mfa":false}', 'Security policy (admin 2FA)')
on conflict (key) do nothing;

/* ---------------------------------------------------------- entitlement read */

-- aal1 sessions of a two factor account get the free tier only: credits, plan
-- and features stay hidden until the code is verified.
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
  free_features := public.pro_setting('free_tier');

  if p_user = auth.uid() and public.pro_needs_aal2() then
    return jsonb_build_object(
      'server_time', now(),
      'blocked', coalesce(profile.blocked, false),
      'is_admin', false,
      'mfa_required', true,
      'credits', 0,
      'active', false,
      'plan', null,
      'plan_name', null,
      'tier', 0,
      'features', free_features,
      'expires_at', null,
      'days_left', null,
      'seconds_left', null
    );
  end if;

  select credits into wallet from public.wallets where user_id = p_user;
  select s.plan_slug, s.months, s.started_at, s.expires_at, p.name, p.tier, p.features
    into sub
    from public.subscriptions s
    join public.plans p on p.slug = s.plan_slug
   where s.user_id = p_user and s.status = 'active' and s.expires_at > now()
   order by s.expires_at desc
   limit 1;

  result := jsonb_build_object(
    'server_time', now(),
    'blocked', coalesce(profile.blocked, false),
    'is_admin', coalesce(profile.role = 'admin', false),
    'mfa_required', false,
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

/* ------------------------------------------------------------- credit spend */

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
  perform public.pro_assert_aal2();
  if p_amount is null or p_amount < 0 then raise exception 'bad amount'; end if;
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
