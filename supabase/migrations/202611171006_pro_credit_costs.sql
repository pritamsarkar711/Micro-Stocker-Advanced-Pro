-- Credit prices that keep every plan profitable against real model costs.
--
-- Worst case is Professional paid yearly (৳11,690 for 14,400 credits, so
-- ৳0.812 per credit). At those numbers:
--   * vector  2 credits = ৳1.62   · Kimi K2.5 ≈ ৳1.19  (27% margin)
--                               · DeepSeek Flash ≈ ৳0.48 (70% margin)
--   * jpg     8 credits = ৳6.50   · gpt-image-1 ≈ ৳4.88 (25% margin)
--   * upscale 2 credits, video 6 credits · computed on the user's machine
-- Nothing had been sold when this changed, so no customer lost value.
update public.app_settings
   set value = '{"vector":2,"jpg":8,"premium_upscale":2,"video_premium":6}'::jsonb,
       updated_at = now()
 where key = 'credits';

-- The client reads the prices and limits from the entitlement it already asks
-- for, so a generator button never hard codes a number the server does not use.
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
    'credit_costs', public.pro_setting('credits'),
    'limits', public.pro_setting('limits'),
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
