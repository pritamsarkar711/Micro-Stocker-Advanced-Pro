/**
 * Safety migration for older workspace-sync installations. The previous schema
 * exposed account hashes and workspace data to every anonymous client. It must
 * never be provisioned again. This migration deliberately disables legacy sync;
 * it does not delete data, and must be applied to each existing project.
 */
export const SCHEMA_SQL = `-- Disable unsafe legacy anonymous access (data is retained).
do $$
begin
  if to_regclass('public.user_accounts') is not null then
    execute 'drop policy if exists "msap_accounts_all" on public.user_accounts';
    execute 'alter table public.user_accounts enable row level security';
    execute 'revoke all on public.user_accounts from anon, authenticated';
  end if;
  if to_regclass('public.kv_store') is not null then
    execute 'drop policy if exists "msap_kv_all" on public.kv_store';
    execute 'alter table public.kv_store enable row level security';
    execute 'revoke all on public.kv_store from anon, authenticated';
  end if;
  if to_regclass('public.issue_reports') is not null then
    execute 'drop policy if exists "msap_reports_all" on public.issue_reports';
    execute 'alter table public.issue_reports enable row level security';
    execute 'revoke all on public.issue_reports from anon, authenticated';
  end if;
end $$;
`;
