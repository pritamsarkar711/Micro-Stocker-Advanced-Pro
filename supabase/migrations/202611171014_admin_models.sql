-- The console could edit the models that shipped with it but could not add one,
-- which meant a new provider model needed a release. These two functions close
-- that gap and keep the same guard the rest of the console uses.
create or replace function public.pro_admin_upsert_model(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_out public.ai_models;
begin
  if not public.pro_is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if coalesce(p_patch ->> 'id', '') = '' then raise exception 'model id required'; end if;
  if coalesce(p_patch ->> 'provider_id', '') = '' then raise exception 'provider required'; end if;

  insert into public.ai_models (
    id, provider_id, upstream_id, label, kind, premium, enabled,
    cost_in_per_mtok, cost_out_per_mtok, cost_per_image_usd, notes, sort
  ) values (
    p_patch ->> 'id',
    p_patch ->> 'provider_id',
    coalesce(p_patch ->> 'upstream_id', p_patch ->> 'id'),
    coalesce(p_patch ->> 'label', p_patch ->> 'id'),
    coalesce(p_patch ->> 'kind', 'vector'),
    coalesce((p_patch ->> 'premium')::boolean, false),
    coalesce((p_patch ->> 'enabled')::boolean, true),
    coalesce((p_patch ->> 'cost_in_per_mtok')::numeric, 0),
    coalesce((p_patch ->> 'cost_out_per_mtok')::numeric, 0),
    coalesce((p_patch ->> 'cost_per_image_usd')::numeric, 0),
    p_patch ->> 'notes',
    coalesce((p_patch ->> 'sort')::smallint, 50)
  )
  on conflict (id) do update set
    provider_id = excluded.provider_id,
    upstream_id = excluded.upstream_id,
    label = excluded.label,
    kind = excluded.kind,
    premium = excluded.premium,
    enabled = excluded.enabled,
    cost_in_per_mtok = excluded.cost_in_per_mtok,
    cost_out_per_mtok = excluded.cost_out_per_mtok,
    cost_per_image_usd = excluded.cost_per_image_usd,
    notes = coalesce(excluded.notes, public.ai_models.notes),
    sort = excluded.sort
  returning * into row_out;

  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(), 'model.upsert', row_out.id, p_patch);
  return to_jsonb(row_out);
end;
$$;
revoke all on function public.pro_admin_upsert_model(jsonb) from public, anon;
grant execute on function public.pro_admin_upsert_model(jsonb) to authenticated;

create or replace function public.pro_admin_upsert_provider(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_out public.ai_providers;
begin
  if not public.pro_is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if coalesce(p_patch ->> 'id', '') = '' then raise exception 'provider id required'; end if;
  if coalesce(p_patch ->> 'base_url', '') = '' then raise exception 'base url required'; end if;

  insert into public.ai_providers (id, label, base_url, enabled, sort)
  values (
    p_patch ->> 'id',
    coalesce(p_patch ->> 'label', p_patch ->> 'id'),
    p_patch ->> 'base_url',
    coalesce((p_patch ->> 'enabled')::boolean, true),
    coalesce((p_patch ->> 'sort')::smallint, 50)
  )
  on conflict (id) do update set
    label = excluded.label,
    base_url = excluded.base_url,
    enabled = excluded.enabled,
    sort = excluded.sort
  returning * into row_out;

  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(), 'provider.upsert', row_out.id, p_patch);
  return to_jsonb(row_out);
end;
$$;
revoke all on function public.pro_admin_upsert_provider(jsonb) from public, anon;
grant execute on function public.pro_admin_upsert_provider(jsonb) to authenticated;
