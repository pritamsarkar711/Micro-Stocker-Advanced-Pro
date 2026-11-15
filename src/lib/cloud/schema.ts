/**
 * SQL to run once in Supabase → SQL Editor.
 *
 * These two tables are the generic foundation (settings + offline-sync queue +
 * a key/value cache). They will be extended with the real domain tables as soon
 * as the feature spec is confirmed.
 */
export const SUPABASE_SQL = `-- ============================================================
--  Micro Stocker Advanced Pro - base schema
--  Run this once in Supabase Studio -> SQL Editor -> Run.
-- ============================================================

create table if not exists public.app_meta (
  id          uuid primary key default gen_random_uuid(),
  app         text not null default 'micro-stocker-advanced-pro',
  schema_version int not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into public.app_meta (app, schema_version)
select 'micro-stocker-advanced-pro', 1
where not exists (select 1 from public.app_meta);

-- Generic settings/state per device+user
create table if not exists public.kv_store (
  key         text not null,
  device_id   text not null default 'default',
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (key, device_id)
);

-- Offline-first write queue: rows are pushed here while offline and
-- replayed when the connection returns.
create table if not exists public.sync_queue (
  id          bigint generated always as identity primary key,
  entity      text not null,
  entity_id   text not null,
  operation   text not null check (operation in ('insert','update','delete')),
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  applied_at  timestamptz
);

create index if not exists sync_queue_pending_idx
  on public.sync_queue (created_at) where applied_at is null;

-- updated_at trigger helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists app_meta_touch on public.app_meta;
create trigger app_meta_touch before update on public.app_meta
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
--  Row Level Security
--  For a single-user desktop app the anon key is enough.
--  Tighten this (e.g. to auth.uid()) when multi-user login is added.
-- ------------------------------------------------------------
alter table public.app_meta   enable row level security;
alter table public.kv_store   enable row level security;
alter table public.sync_queue enable row level security;

drop policy if exists "app_meta read" on public.app_meta;
create policy "app_meta read" on public.app_meta
  for select using (true);

drop policy if exists "kv read" on public.kv_store;
create policy "kv read" on public.kv_store for select using (true);

drop policy if exists "kv write" on public.kv_store;
create policy "kv write" on public.kv_store for insert with check (true);

drop policy if exists "kv update" on public.kv_store;
create policy "kv update" on public.kv_store for update using (true);

drop policy if exists "sync read" on public.sync_queue;
create policy "sync read" on public.sync_queue for select using (true);

drop policy if exists "sync insert" on public.sync_queue;
create policy "sync insert" on public.sync_queue for insert with check (true);

drop policy if exists "sync update" on public.sync_queue;
create policy "sync update" on public.sync_queue for update using (true);
`;
