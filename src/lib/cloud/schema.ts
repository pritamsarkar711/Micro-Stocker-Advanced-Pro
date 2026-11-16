/**
 * Supabase schema for workspace sync, instant email accounts and issue reports.
 * Paste into the Supabase SQL editor once to provision all tables.
 */
export const SCHEMA_SQL = `-- Micro Stocker Advanced Pro Cloud Schema (v2.0)

create table if not exists public.kv_store (
  key         text        not null,
  device_id   text        not null default 'default',
  value       jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (key, device_id)
);

create table if not exists public.user_accounts (
  id             uuid        primary key,
  email          text        not null unique,
  display_name   text        not null default '',
  password_hash  text        not null,
  password_salt  text        not null,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz not null default now()
);

create table if not exists public.issue_reports (
  id          uuid        primary key,
  category    text        not null,
  area        text        not null default 'general',
  subject     text        not null,
  details     text        not null,
  contact     text        not null default '',
  user_email  text        not null default '',
  app_version text        not null default '',
  platform    text        not null default '',
  status      text        not null default 'submitted',
  created_at  timestamptz not null default now()
);

create table if not exists public.app_meta (
  id              int         primary key default 1 check (id = 1),
  schema_version  text        not null default '2.0.0',
  installed_at    timestamptz not null default now()
);

insert into public.app_meta (id, schema_version)
  values (1, '2.0.0')
  on conflict (id) do update set schema_version = excluded.schema_version;

alter table public.kv_store      enable row level security;
alter table public.user_accounts enable row level security;
alter table public.issue_reports enable row level security;
alter table public.app_meta      enable row level security;

drop policy if exists "msap_kv_all"       on public.kv_store;
drop policy if exists "msap_accounts_all" on public.user_accounts;
drop policy if exists "msap_reports_all"  on public.issue_reports;
drop policy if exists "msap_meta_read"    on public.app_meta;

create policy "msap_kv_all" on public.kv_store
  for all to anon, authenticated using (true) with check (true);

create policy "msap_accounts_all" on public.user_accounts
  for all to anon, authenticated using (true) with check (true);

create policy "msap_reports_all" on public.issue_reports
  for all to anon, authenticated using (true) with check (true);

create policy "msap_meta_read" on public.app_meta
  for select to anon, authenticated using (true);
`;
