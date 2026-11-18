-- Row level security for the Pro platform.
-- Users read their own rows; admins read everything they need; all writes that
-- touch money or entitlement go through the RPCs in the previous migration.

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.subscriptions enable row level security;
alter table public.wallets enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.ai_providers enable row level security;
alter table public.ai_models enable row level security;
alter table public.pro_provider_keys enable row level security;
alter table public.api_usage enable row level security;
alter table public.generations enable row level security;
alter table public.app_settings enable row level security;
alter table public.payment_methods enable row level security;
alter table public.crypto_assets enable row level security;
alter table public.payment_orders enable row level security;
alter table public.crypto_invoices enable row level security;
alter table public.admin_audit enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.pro_is_admin());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for update to authenticated
  using (public.pro_is_admin()) with check (public.pro_is_admin());

drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select to authenticated, anon using (true);
drop policy if exists plans_admin_write on public.plans;
create policy plans_admin_write on public.plans for all to authenticated
  using (public.pro_is_admin()) with check (public.pro_is_admin());

drop policy if exists plan_prices_read on public.plan_prices;
create policy plan_prices_read on public.plan_prices for select to authenticated, anon using (true);
drop policy if exists plan_prices_admin_write on public.plan_prices;
create policy plan_prices_admin_write on public.plan_prices for all to authenticated
  using (public.pro_is_admin()) with check (public.pro_is_admin());

drop policy if exists subscriptions_self_read on public.subscriptions;
create policy subscriptions_self_read on public.subscriptions for select to authenticated
  using (user_id = auth.uid() or public.pro_is_admin());
drop policy if exists subscriptions_admin_write on public.subscriptions;
create policy subscriptions_admin_write on public.subscriptions for update to authenticated
  using (public.pro_is_admin()) with check (public.pro_is_admin());

drop policy if exists wallets_self_read on public.wallets;
create policy wallets_self_read on public.wallets for select to authenticated
  using (user_id = auth.uid() or public.pro_is_admin());

drop policy if exists ledger_self_read on public.credit_ledger;
create policy ledger_self_read on public.credit_ledger for select to authenticated
  using (user_id = auth.uid() or public.pro_is_admin());

drop policy if exists providers_read on public.ai_providers;
create policy providers_read on public.ai_providers for select to authenticated using (true);
drop policy if exists providers_admin_write on public.ai_providers;
create policy providers_admin_write on public.ai_providers for all to authenticated
  using (public.pro_is_admin()) with check (public.pro_is_admin());

drop policy if exists models_read on public.ai_models;
create policy models_read on public.ai_models for select to authenticated using (enabled or public.pro_is_admin());
drop policy if exists models_admin_write on public.ai_models;
create policy models_admin_write on public.ai_models for all to authenticated
  using (public.pro_is_admin()) with check (public.pro_is_admin());

drop policy if exists usage_admin_read on public.api_usage;
create policy usage_admin_read on public.api_usage for select to authenticated using (public.pro_is_admin());

drop policy if exists generations_self_read on public.generations;
create policy generations_self_read on public.generations for select to authenticated
  using (user_id = auth.uid() or public.pro_is_admin());

drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select to authenticated using (true);
drop policy if exists settings_admin_write on public.app_settings;
create policy settings_admin_write on public.app_settings for all to authenticated
  using (public.pro_is_admin()) with check (public.pro_is_admin());

drop policy if exists methods_read on public.payment_methods;
create policy methods_read on public.payment_methods for select to authenticated, anon using (enabled);
drop policy if exists methods_admin_write on public.payment_methods;
create policy methods_admin_write on public.payment_methods for all to authenticated
  using (public.pro_is_admin()) with check (public.pro_is_admin());

drop policy if exists assets_read on public.crypto_assets;
create policy assets_read on public.crypto_assets for select to authenticated, anon using (enabled);
drop policy if exists assets_admin_write on public.crypto_assets;
create policy assets_admin_write on public.crypto_assets for all to authenticated
  using (public.pro_is_admin()) with check (public.pro_is_admin());

drop policy if exists orders_self_read on public.payment_orders;
create policy orders_self_read on public.payment_orders for select to authenticated
  using (user_id = auth.uid() or public.pro_is_admin());
drop policy if exists orders_admin_write on public.payment_orders;
create policy orders_admin_write on public.payment_orders for update to authenticated
  using (public.pro_is_admin()) with check (public.pro_is_admin());

drop policy if exists invoices_self_read on public.crypto_invoices;
create policy invoices_self_read on public.crypto_invoices for select to authenticated
  using (exists (select 1 from public.payment_orders o where o.id = order_id and (o.user_id = auth.uid() or public.pro_is_admin())));

drop policy if exists audit_admin_read on public.admin_audit;
create policy audit_admin_read on public.admin_audit for select to authenticated using (public.pro_is_admin());

-- private export bucket: one folder per user, no public URLs
insert into storage.buckets (id, name, public, file_size_limit)
values ('pro-exports', 'pro-exports', false, 52428800)
on conflict (id) do nothing;

drop policy if exists exports_own_read on storage.objects;
create policy exports_own_read on storage.objects for select to authenticated
  using (bucket_id = 'pro-exports' and (storage.foldername(name))[1] = auth.uid()::text);
