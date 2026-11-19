-- Admin user management.
--
-- Until now the console could grant a plan or move credits, but it could not
-- stop an abusive account or remove a spam registration: the `blocked` flag
-- existed in the schema and was enforced everywhere (entitlement, pro_consume,
-- generation insert) yet nothing could set it. Deleting an account needs the
-- service role because it touches auth.users, so it has to be a security definer
-- function rather than a table write from the browser.
--
-- Both functions:
--   * refuse anybody who is not an administrator (pro_is_admin, which itself
--     requires aal2 once the administrator has an authenticator),
--   * refuse the caller's own account and any other administrator, so an
--     administrator cannot lock themselves out or remove the last admin,
--   * write an audit row before they change anything.

-- Directory listing with the two fields the console needed to show but never
-- had: when the account last signed in and whether the address is confirmed.
drop function if exists public.pro_admin_users(text);

create function public.pro_admin_users(p_search text default null)
returns table (
  user_id uuid, email text, display_name text, role text, blocked boolean,
  plan text, expires_at timestamptz, credits integer, spent_bdt integer,
  generations integer, joined timestamptz, last_seen timestamptz, confirmed boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pr.id, pr.email, pr.display_name, pr.role, pr.blocked,
         s.plan_slug, s.expires_at, coalesce(w.credits, 0), coalesce(w.lifetime_spent_bdt, 0),
         (select count(*)::int from public.generations g where g.user_id = pr.id),
         pr.created_at,
         au.last_sign_in_at,
         (au.email_confirmed_at is not null)
    from public.profiles pr
    left join public.subscriptions s on s.user_id = pr.id and s.status = 'active' and s.expires_at > now()
    left join public.wallets w on w.user_id = pr.id
    left join auth.users au on au.id = pr.id
   where public.pro_is_admin()
     and (p_search is null or p_search = ''
          or pr.email ilike '%' || p_search || '%'
          or pr.display_name ilike '%' || p_search || '%')
   order by pr.created_at desc
   limit 500;
$$;

revoke all on function public.pro_admin_users(text) from public;
revoke all on function public.pro_admin_users(text) from anon;
grant execute on function public.pro_admin_users(text) to authenticated;

-- Suspend / restore an account. Suspension is enforced by the entitlement and
-- credit functions, so the client cannot talk its way around it.
create or replace function public.pro_admin_set_blocked(p_user uuid, p_blocked boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.profiles%rowtype;
begin
  if not public.pro_is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'you cannot suspend your own account';
  end if;

  select * into target from public.profiles where id = p_user;
  if not found then
    raise exception 'account not found';
  end if;
  if target.role = 'admin' then
    raise exception 'administrator accounts cannot be suspended';
  end if;

  update public.profiles set blocked = p_blocked where id = p_user;

  insert into public.admin_audit (actor, action, target, detail)
  values (
    auth.uid(),
    case when p_blocked then 'user.suspend' else 'user.restore' end,
    p_user::text,
    jsonb_build_object('email', target.email, 'blocked', p_blocked)
  );

  return p_blocked;
end;
$$;

revoke all on function public.pro_admin_set_blocked(uuid, boolean) from public;
revoke all on function public.pro_admin_set_blocked(uuid, boolean) from anon;
grant execute on function public.pro_admin_set_blocked(uuid, boolean) to authenticated;

-- Permanently remove an account. Every table that references auth.users does so
-- with ON DELETE CASCADE, so this removes the profile, wallet, subscription,
-- orders, invoices, ledger entries, generations and workspace snapshots in one
-- statement. The audit row is written first and survives, because admin_audit
-- only references the acting administrator.
create or replace function public.pro_admin_delete_user(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.profiles%rowtype;
begin
  if not public.pro_is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'you cannot delete your own account';
  end if;

  select * into target from public.profiles where id = p_user;
  if not found then
    raise exception 'account not found';
  end if;
  if target.role = 'admin' then
    raise exception 'administrator accounts cannot be deleted';
  end if;
  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(), 'user.delete', p_user::text, jsonb_build_object('email', target.email));

  delete from auth.users where id = p_user;
  return true;
end;
$$;

revoke all on function public.pro_admin_delete_user(uuid) from public;
revoke all on function public.pro_admin_delete_user(uuid) from anon;
grant execute on function public.pro_admin_delete_user(uuid) to authenticated;

-- The console also lists "recent sign in" for security review.
create or replace function public.pro_admin_sessions()
returns table (user_id uuid, email text, last_seen timestamptz, confirmed boolean, blocked boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select au.id, au.email, au.last_sign_in_at, (au.email_confirmed_at is not null), coalesce(p.blocked, false)
    from auth.users au
    left join public.profiles p on p.id = au.id
   where public.pro_is_admin()
   order by au.last_sign_in_at desc nulls last
   limit 200;
$$;

revoke all on function public.pro_admin_sessions() from public;
revoke all on function public.pro_admin_sessions() from anon;
grant execute on function public.pro_admin_sessions() to authenticated;
