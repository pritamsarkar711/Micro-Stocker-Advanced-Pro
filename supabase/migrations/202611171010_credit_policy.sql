-- Premium models belong to the plan, not to the credit wallet.
--
-- The upscaler, the video upscaler and the background remover charge nothing
-- when a premium model is chosen: a paid plan is the only requirement. Credits
-- are metered on the four generators (EPS, SVG, AI Illustrator, JPG), which are
-- the only tools that spend provider tokens.
update public.app_settings
   set value = value || '{"premium_upscale":0,"video_premium":0,"background":0}'::jsonb,
       updated_at = now()
 where key = 'credits';

-- Keep the rule in one place. A feature priced at zero still reserves the job
-- row so the audit trail is complete, but the wallet is not touched and a
-- subscriber with an empty balance can still run it.
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
  cost := greatest(0, coalesce((credits_cost ->> feature)::int, 1));

  insert into public.generations (user_id, kind, prompt, options, status, credits, model_id)
  values (auth.uid(), p_kind, p_prompt, coalesce(p_options, '{}'::jsonb), 'running', cost, p_model)
  returning id into generation_id;

  if cost > 0 then
    balance := public.pro_consume_credits(cost, 'generation:' || p_kind, generation_id::text);
  else
    select credits into balance from public.wallets where user_id = auth.uid();
  end if;

  return jsonb_build_object('generation_id', generation_id, 'credits', cost, 'balance', coalesce(balance, 0));
end;
$$;
revoke all on function public.pro_begin_generation(text, text, jsonb, text) from public, anon;
grant execute on function public.pro_begin_generation(text, text, jsonb, text) to authenticated;
