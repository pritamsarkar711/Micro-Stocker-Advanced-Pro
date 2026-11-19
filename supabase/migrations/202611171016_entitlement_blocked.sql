-- A suspended account must not look like a live one.
--
-- pro_entitlement() reported `blocked: true` but still handed the client the
-- plan's features, the credit balance and `active: true`. The dashboard then
-- looked fully unlocked, and every single action failed later with "account
-- blocked". This makes the payload agree with the enforcement: a suspended
-- account keeps its history but reports no plan, no credits and no features, so
-- the app can show one clear message instead of a broken workspace.
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
  is_blocked boolean;
  result jsonb;
begin
  select id, role, blocked into profile from public.profiles where id = p_user;
  is_blocked := coalesce(profile.blocked, false);
  free_features := public.pro_setting('free_tier');

  -- Two step verification still wins over everything: an administrator with an
  -- authenticator only sees a locked entitlement until the second factor is in.
  if p_user = auth.uid() and public.pro_needs_aal2() then
    return jsonb_build_object(
      'server_time', now(),
      'blocked', is_blocked,
      'is_admin', false,
      'mfa_required', true,
      'credits', 0,
      'active', false,
      'plan', null,
      'plan_name', null,
      'tier', 0,
      'features', free_features,
      'credit_costs', public.pro_setting('credits'),
      'limits', public.pro_setting('limits'),
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
    'blocked', is_blocked,
    'is_admin', coalesce(profile.role = 'admin', false),
    'mfa_required', false,
    'credits', case when is_blocked then 0 else coalesce(wallet, 0) end,
    'active', not is_blocked and (sub.plan_slug is not null or coalesce(profile.role = 'admin', false)),
    'plan', case when is_blocked then null else sub.plan_slug end,
    'plan_name', case when is_blocked then null else sub.name end,
    'tier', case when is_blocked then 0 else coalesce(sub.tier, 0) end,
    'features', case
                  when is_blocked then jsonb_build_object(
                    'vector', false, 'jpg', false, 'premium_upscale', false,
                    'video_premium', false, 'max_export_px', 0)
                  when profile.role = 'admin'
                    then '{"vector":true,"jpg":true,"premium_upscale":true,"video_premium":true,"max_export_px":10000}'::jsonb
                  else coalesce(sub.features, free_features)
                end,
    'credit_costs', public.pro_setting('credits'),
    'limits', public.pro_setting('limits'),
    'started_at', case when is_blocked then null else sub.started_at end,
    'expires_at', case when is_blocked then null else sub.expires_at end,
    'days_left', case when is_blocked then null
                      when sub.expires_at is null then null
                      else greatest(0, ceil(extract(epoch from (sub.expires_at - now())) / 86400.0))::int end,
    'seconds_left', case when is_blocked then null
                         when sub.expires_at is null then null
                         else greatest(0, floor(extract(epoch from (sub.expires_at - now()))))::bigint end
  );
  return result;
end;
$$;
revoke all on function public.pro_entitlement(uuid) from public, anon, authenticated;
