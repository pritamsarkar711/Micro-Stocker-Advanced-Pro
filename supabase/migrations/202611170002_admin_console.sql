-- ---------------------------------------------------------------------------
-- Admin console support: audit trail, server-side statistics and the
-- grant/extend helpers used by the administrator dashboard.
--
-- Apply after 202611170001_licensing.sql. Everything here is SECURITY DEFINER
-- with an empty search_path and an explicit administrator check, so a regular
-- authenticated user can never reach private tables.
-- ---------------------------------------------------------------------------

create table if not exists msap_private.audit_log (
  id bigserial primary key,
  actor uuid,
  action text not null,
  target_user uuid,
  target_code uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

revoke all on all tables in schema msap_private from public, anon, authenticated;
revoke all on sequence msap_private.audit_log_id_seq from public, anon, authenticated;

create index if not exists activation_codes_created_idx
  on msap_private.activation_codes (created_at desc);
create index if not exists entitlements_expiry_idx
  on msap_private.entitlements (expires_at);
create index if not exists audit_log_created_idx
  on msap_private.audit_log (created_at desc);

/* Grant or extend access for a user id by a whole number of days. ---------- */
create or replace function public.msap_admin_grant_days(p_user_id uuid, p_days integer)
returns table (expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare new_expiry timestamptz;
begin
  if not public.msap_is_admin() then raise exception 'Not authorized'; end if;
  if p_user_id is null then raise exception 'User is required'; end if;
  if p_days is null or p_days < 1 or p_days > 3650 then raise exception 'Days must be between 1 and 3650'; end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then raise exception 'User not found'; end if;

  insert into msap_private.entitlements as ent (user_id, expires_at)
    values (p_user_id, now() + make_interval(days => p_days))
    on conflict (user_id) do update
      set expires_at = greatest(ent.expires_at, now()) + make_interval(days => p_days),
          updated_at = now()
    returning ent.expires_at into new_expiry;

  insert into msap_private.audit_log (actor, action, target_user, detail)
    values (auth.uid(), 'grant_days', p_user_id, jsonb_build_object('days', p_days, 'expires_at', new_expiry));

  return query select new_expiry;
end $$;

/* Grant by email address (the administrator's usual workflow). ------------- */
create or replace function public.msap_admin_grant_email(p_email text, p_days integer)
returns table (user_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare target uuid;
begin
  if not public.msap_is_admin() then raise exception 'Not authorized'; end if;
  if p_email is null or length(trim(p_email)) < 3 then raise exception 'Email is required'; end if;
  select u.id into target from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
  if target is null then raise exception 'No account found for that email'; end if;
  return query select target, g.expires_at from public.msap_admin_grant_days(target, p_days) as g;
end $$;

/* Dashboard counters computed on the server. ------------------------------- */
create or replace function public.msap_admin_stats()
returns table (
  users_total bigint,
  users_active bigint,
  users_blocked bigint,
  codes_total bigint,
  codes_available bigint,
  codes_redeemed bigint
)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.msap_is_admin() then raise exception 'Not authorized'; end if;
  return query select
    (select count(*) from auth.users),
    (select count(*) from msap_private.entitlements e where e.expires_at > now()),
    (select count(*) from msap_private.blocked_users),
    (select count(*) from msap_private.activation_codes),
    (select count(*) from msap_private.activation_codes c where c.redeemed_at is null and c.revoked_at is null),
    (select count(*) from msap_private.activation_codes c where c.redeemed_at is not null);
end $$;

/* Recent administrator activity. ------------------------------------------ */
create or replace function public.msap_admin_audit()
returns table (
  id bigint,
  action text,
  actor_email text,
  target_email text,
  detail jsonb,
  created_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.msap_is_admin() then raise exception 'Not authorized'; end if;
  return query
    select l.id, l.action, a.email::text, t.email::text, l.detail, l.created_at
    from msap_private.audit_log l
    left join auth.users a on a.id = l.actor
    left join auth.users t on t.id = l.target_user
    order by l.created_at desc
    limit 200;
end $$;

revoke all on function
  public.msap_admin_grant_days(uuid, integer),
  public.msap_admin_grant_email(text, integer),
  public.msap_admin_stats(),
  public.msap_admin_audit()
from public, anon;

grant execute on function
  public.msap_admin_grant_days(uuid, integer),
  public.msap_admin_grant_email(text, integer),
  public.msap_admin_stats(),
  public.msap_admin_audit()
to authenticated;

-- PostgREST caches function signatures; refresh it so a fresh deploy can call
-- these RPCs immediately instead of answering "not in the schema cache".
notify pgrst, 'reload schema';
