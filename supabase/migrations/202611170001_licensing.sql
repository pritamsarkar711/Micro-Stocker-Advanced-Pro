-- Run in a NEW Supabase project after reviewing the deployment guide.
-- Never put a service_role key in a client application.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists msap_private;
revoke all on schema msap_private from public, anon, authenticated;

create table if not exists msap_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists msap_private.activation_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash bytea not null unique,
  duration_seconds integer not null check (duration_seconds between 60 and 315360000),
  kind text not null check (kind in ('premium', 'trial')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  revoked_at timestamptz
);
create table if not exists msap_private.blocked_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  blocked_at timestamptz not null default now(),
  blocked_by uuid not null references auth.users(id)
);
create table if not exists msap_private.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
revoke all on all tables in schema msap_private from public, anon, authenticated;

create or replace function public.msap_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from msap_private.admins where user_id = auth.uid()) and not exists (select 1 from msap_private.blocked_users where user_id = auth.uid()) $$;

create or replace function public.msap_my_entitlement()
returns table(expires_at timestamptz, server_time timestamptz, is_admin boolean, is_blocked boolean)
language sql stable security definer set search_path = ''
as $$ select e.expires_at, now(), public.msap_is_admin(), exists (select 1 from msap_private.blocked_users b where b.user_id = auth.uid())
      from (select 1) as anchor left join msap_private.entitlements e on e.user_id = auth.uid()
      where auth.uid() is not null $$;

create or replace function public.msap_create_code(p_duration_seconds integer, p_kind text)
returns table(code text, id uuid, created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare raw_code text; new_id uuid; new_created timestamptz;
begin
  if not public.msap_is_admin() then raise exception 'Not authorized'; end if;
  if p_duration_seconds is null or p_duration_seconds not between 60 and 315360000 or p_kind is null or p_kind not in ('premium','trial') then
    raise exception 'Invalid duration or code type';
  end if;
  raw_code := upper(encode(extensions.gen_random_bytes(20), 'hex'));
  insert into msap_private.activation_codes(code_hash, duration_seconds, kind, created_by)
    values (extensions.digest(raw_code, 'sha256'), p_duration_seconds, p_kind, auth.uid())
    returning activation_codes.id, activation_codes.created_at into new_id, new_created;
  return query select raw_code, new_id, new_created;
end $$;

create or replace function public.msap_redeem_code(p_code text)
returns table(expires_at timestamptz, server_time timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare c msap_private.activation_codes%rowtype; new_expiry timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from msap_private.blocked_users where user_id = auth.uid()) then raise exception 'Account disabled'; end if;
  if p_code is null or length(trim(p_code)) <> 40 or upper(trim(p_code)) !~ '^[A-F0-9]{40}$' then raise exception 'Invalid or unavailable code'; end if;
  select * into c from msap_private.activation_codes
    where code_hash = extensions.digest(upper(trim(p_code)), 'sha256') for update;
  if not found or c.redeemed_at is not null or c.revoked_at is not null then raise exception 'Invalid or unavailable code'; end if;
  insert into msap_private.entitlements as ent (user_id, expires_at)
    values (auth.uid(), now() + make_interval(secs => c.duration_seconds))
    on conflict (user_id) do update set expires_at = greatest(ent.expires_at, now()) + make_interval(secs => c.duration_seconds), updated_at = now()
    returning ent.expires_at into new_expiry;
  update msap_private.activation_codes set redeemed_by = auth.uid(), redeemed_at = now() where id = c.id;
  return query select new_expiry, now();
end $$;

create or replace function public.msap_admin_codes()
returns table(id uuid, kind text, duration_seconds integer, created_at timestamptz, redeemed_at timestamptz, redeemed_by uuid, revoked_at timestamptz)
language plpgsql security definer set search_path = ''
as $$ begin
  if not public.msap_is_admin() then raise exception 'Not authorized'; end if;
  return query select c.id,c.kind,c.duration_seconds,c.created_at,c.redeemed_at,c.redeemed_by,c.revoked_at from msap_private.activation_codes c order by c.created_at desc limit 500;
end $$;

create or replace function public.msap_admin_users()
returns table(user_id uuid, email text, created_at timestamptz, expires_at timestamptz, is_blocked boolean)
language plpgsql security definer set search_path = ''
as $$ begin
  if not public.msap_is_admin() then raise exception 'Not authorized'; end if;
  return query select u.id,u.email::text,u.created_at,e.expires_at, exists (select 1 from msap_private.blocked_users b where b.user_id = u.id) from auth.users u left join msap_private.entitlements e on e.user_id = u.id order by u.created_at desc limit 500;
end $$;

create or replace function public.msap_admin_revoke_code(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$ begin
  if not public.msap_is_admin() then raise exception 'Not authorized'; end if;
  update msap_private.activation_codes set revoked_at = now() where id = p_id and redeemed_at is null;
  if not found then raise exception 'Code is already used or not found'; end if;
end $$;

create or replace function public.msap_admin_set_expiry(p_user_id uuid, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = ''
as $$ begin
  if not public.msap_is_admin() then raise exception 'Not authorized'; end if;
  if p_user_id is null or p_expires_at is null then raise exception 'User and expiry are required'; end if;
  insert into msap_private.entitlements(user_id, expires_at) values (p_user_id, p_expires_at)
    on conflict (user_id) do update set expires_at = excluded.expires_at, updated_at = now();
end $$;

create or replace function public.msap_admin_set_blocked(p_user_id uuid, p_blocked boolean)
returns void language plpgsql security definer set search_path = ''
as $$ begin
  if not public.msap_is_admin() then raise exception 'Not authorized'; end if;
  if p_user_id is null or p_blocked is null then raise exception 'User and status are required'; end if;
  if p_user_id = auth.uid() and p_blocked then raise exception 'Cannot block your own account'; end if;
  if p_blocked then
    insert into msap_private.blocked_users(user_id, blocked_by) values (p_user_id, auth.uid()) on conflict (user_id) do nothing;
  else
    delete from msap_private.blocked_users where user_id = p_user_id;
  end if;
end $$;

revoke all on function public.msap_is_admin() from public, anon;
revoke all on function public.msap_my_entitlement() from public, anon;
revoke all on function public.msap_create_code(integer,text) from public, anon;
revoke all on function public.msap_redeem_code(text) from public, anon;
revoke all on function public.msap_admin_codes() from public, anon;
revoke all on function public.msap_admin_users() from public, anon;
revoke all on function public.msap_admin_revoke_code(uuid) from public, anon;
revoke all on function public.msap_admin_set_expiry(uuid,timestamptz) from public, anon;
revoke all on function public.msap_admin_set_blocked(uuid,boolean) from public, anon;
grant execute on function public.msap_is_admin(), public.msap_my_entitlement(), public.msap_create_code(integer,text), public.msap_redeem_code(text), public.msap_admin_codes(), public.msap_admin_users(), public.msap_admin_revoke_code(uuid), public.msap_admin_set_expiry(uuid,timestamptz), public.msap_admin_set_blocked(uuid,boolean) to authenticated;
