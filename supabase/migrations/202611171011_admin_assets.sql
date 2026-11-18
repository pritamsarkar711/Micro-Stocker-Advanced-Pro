-- The wallet editor needs every asset, including the ones switched off, while
-- the checkout only ever sees the enabled ones. Returning the rows from a
-- security definer function keeps the table closed to ordinary reads.
create or replace function public.pro_admin_assets()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.pro_is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return coalesce(
    (select jsonb_agg(to_jsonb(a) order by a.sort) from public.crypto_assets a),
    '[]'::jsonb
  );
end;
$$;
revoke all on function public.pro_admin_assets() from public, anon;
grant execute on function public.pro_admin_assets() to authenticated;
