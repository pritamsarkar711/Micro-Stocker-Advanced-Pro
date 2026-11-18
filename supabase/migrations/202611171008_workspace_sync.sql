-- Cross device workspace sync.
--
-- The desktop build, the web build and the Android build share one account and
-- one workspace. This table stores the metadata side of the library (ids,
-- titles, keywords, flags, platform choice). Pixels stay on the device that
-- imported them, so nothing large ever travels.
--
-- Self only: a row is readable and writable by its owner and by nobody else.
-- Admin access is deliberately absent, the library is private user content.

create table if not exists public.workspace_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  item_count integer not null default 0,
  device_label text,
  updated_at timestamptz not null default now()
);

alter table public.workspace_snapshots enable row level security;
revoke all on public.workspace_snapshots from public, anon;
grant select, insert, update, delete on public.workspace_snapshots to authenticated;

drop policy if exists workspace_self_read on public.workspace_snapshots;
create policy workspace_self_read on public.workspace_snapshots for select to authenticated
  using (user_id = auth.uid());

drop policy if exists workspace_self_write on public.workspace_snapshots;
create policy workspace_self_write on public.workspace_snapshots for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists workspace_self_update on public.workspace_snapshots;
create policy workspace_self_update on public.workspace_snapshots for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists workspace_self_delete on public.workspace_snapshots;
create policy workspace_self_delete on public.workspace_snapshots for delete to authenticated
  using (user_id = auth.uid());

-- Size guard so one client cannot fill the table with a gigabyte of JSON.
create or replace function public.workspace_guard()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if pg_column_size(new.payload) > 4 * 1024 * 1024 then
    raise exception 'workspace snapshot too large' using errcode = 'P0009';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists workspace_guard_insert on public.workspace_snapshots;
create trigger workspace_guard_insert before insert on public.workspace_snapshots
  for each row execute function public.workspace_guard();

drop trigger if exists workspace_guard_update on public.workspace_snapshots;
create trigger workspace_guard_update before update on public.workspace_snapshots
  for each row execute function public.workspace_guard();
