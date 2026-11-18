// PostgreSQL-level tests for the Pro platform. PGlite runs the real migrations.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite({ extensions: { pgcrypto } });

const asUser = async (id, aal = 'aal1') => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: id ?? null, aal })]);
  await db.exec('set role authenticated');
};

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create schema extensions;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now(), last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable
      as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
    -- Supabase keeps authenticators here; the aal2 rules read this table.
    create table auth.mfa_factors(
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      factor_type text not null default 'totp',
      status text not null default 'unverified',
      friendly_name text,
      created_at timestamptz default now()
    );
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    grant execute on function auth.jwt() to authenticated, anon;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
    alter table storage.objects enable row level security;
    grant usage on schema public to anon, authenticated;
    grant usage on schema storage to anon, authenticated;
    grant all on storage.buckets, storage.objects to authenticated, anon;
    -- Supabase's bootstrap grants table privileges to the API roles; RLS is what
    -- actually restricts rows, so the mirror here has to do the same.
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `);

  const files = (await readdir('supabase/migrations')).filter((name) => name.endsWith('.sql')).sort();
  for (const file of files) await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));

  const admin = '00000000-0000-4000-8000-000000000001';
  const alice = '00000000-0000-4000-8000-000000000002';
  const bob = '00000000-0000-4000-8000-000000000003';
  await db.query('insert into auth.users(id,email) values ($1,$2),($3,$4),($5,$6)', [
    admin, 'admin@example.test', alice, 'alice@example.test', bob, 'bob@example.test',
  ]);
  await db.query("update public.profiles set role = 'admin' where id = $1", [admin]);

  // Anonymous visitors get the free tier and cannot generate anything.
  await db.exec('reset role');
  const anonEntitlement = (await db.query('select public.pro_my_entitlement() as e')).rows[0].e;
  assert.equal(anonEntitlement.active, false);
  assert.equal(anonEntitlement.features.vector, false);
  await db.exec("set role anon");
  await assert.rejects(db.query("select public.pro_begin_generation('eps', 'a mountain', '{}'::jsonb, null)"), /permission denied/);

  // Provider keys are invisible to every signed-in role.
  await asUser(alice);
  await assert.rejects(db.query('select * from public.pro_provider_keys'), /permission denied/);

  // No subscription: the generator is refused before a single credit moves.
  await assert.rejects(
    db.query("select public.pro_begin_generation('eps', 'alpine sunrise', '{}'::jsonb, null)"),
    /subscription required/,
  );

  // A payment order is priced by the server, not by the browser.
  const order = (await db.query(
    "select public.pro_submit_payment('standard', 1, 'bkash', '8N7A2K9XQ1', '01700000000', null, null) as o",
  )).rows[0].o;
  assert.equal(order.amount_bdt, 699);
  assert.equal(order.status, 'submitted');

  // The same TrxID cannot be claimed twice, by anyone.
  await asUser(bob);
  await assert.rejects(
    db.query("select public.pro_submit_payment('starter', 1, 'bkash', '8n7a2k9xq1', null, null, null)"),
    /already claimed/,
  );

  // Only an administrator can approve.
  await asUser(alice);
  await assert.rejects(db.query('select public.pro_admin_review_order($1, true)', [order.order_id]), /not allowed/);
  await assert.rejects(db.query('select public.pro_admin_stats(30)'), /not allowed/);

  await asUser(admin);
  await db.query('select public.pro_admin_review_order($1, true)', [order.order_id]);

  await asUser(alice);
  const entitled = (await db.query('select public.pro_my_entitlement() as e')).rows[0].e;
  assert.equal(entitled.active, true);
  assert.equal(entitled.plan, 'standard');
  assert.equal(entitled.features.vector, true);
  assert.equal(entitled.features.jpg, true);
  assert.ok(entitled.credits >= 450, 'plan credits were granted');
  const days = Math.round((new Date(entitled.expires_at) - new Date(entitled.server_time)) / 86_400_000);
  assert.equal(days, 30, 'one month is exactly 30 days');

  // Generating spends whatever app_settings charges for that action.
  const costs = (await db.query("select value from public.app_settings where key = 'credits'")).rows[0].value;
  const balanceBefore = entitled.credits;
  const started = (await db.query("select public.pro_begin_generation('eps', 'alpine sunrise', '{}'::jsonb, null) as s")).rows[0].s;
  assert.equal(started.credits, costs.vector);
  assert.equal(started.balance, balanceBefore - costs.vector);
  await db.query('select public.pro_attach_quality($1, $2::jsonb, $3::jsonb, $4, $5)', [
    started.generation_id, JSON.stringify({ pass: true, score: 100 }), JSON.stringify({ title: 'Alpine' }), 'alpine.eps', 4096,
  ]);
  const generation = (await db.query('select quality, file_name from public.generations where id = $1', [started.generation_id])).rows[0];
  assert.equal(generation.file_name, 'alpine.eps');
  assert.equal(generation.quality.score, 100);

  // A failed job refunds the credit.
  const second = (await db.query("select public.pro_begin_generation('svg', 'snowflake', '{}'::jsonb, null) as s")).rows[0].s;
  const finished = (await db.query('select public.pro_finish_generation($1, $2, null, null, null, null, null, 0, $3) as r', [
    second.generation_id, 'failed', 'provider error',
  ])).rows[0].r;
  assert.equal(finished.refunded, costs.vector);
  const afterRefund = (await db.query('select credits from public.wallets where user_id = $1', [alice])).rows[0].credits;
  assert.equal(afterRefund, balanceBefore - costs.vector);

  // Plans without the JPG studio are refused that tool even when active.
  await asUser(bob);
  await asUser(admin);
  await db.query("select public.pro_admin_grant($1, 'starter', 1)", [bob]);
  await asUser(bob);
  await assert.rejects(db.query("select public.pro_begin_generation('jpg', 'studio portrait', '{}'::jsonb, null)"), /plan does not include jpg/);
  await assert.rejects(db.query('select * from public.provider_secrets'), /does not exist|permission denied/);

  // Crypto: a short payment never settles, a confirmed one does.
  await asUser(alice);
  const cryptoOrder = (await db.query(
    "select public.pro_submit_payment('professional', 1, 'crypto', null, null, null, null) as o",
  )).rows[0].o;
  const invoice = (await db.query('select public.pro_create_crypto_invoice($1, $2) as i', [cryptoOrder.order_id, 'usdt-trc20'])).rows[0].i;
  assert.equal(invoice.address, 'TCkDdhqFKrThJ5xmZEZZ2QKAmCfLkHGZES');
  await db.exec('reset role');
  const short = (await db.query('select public.pro_settle_crypto($1, $2, $3, $4) as r', [invoice.invoice_id, 'a'.repeat(64), 1, 25])).rows[0].r;
  assert.equal(short.status, 'mismatch');
  const confirmed = (await db.query('select public.pro_settle_crypto($1, $2, $3, $4) as r', [
    invoice.invoice_id, 'b'.repeat(64), Number(invoice.amount), 25,
  ])).rows[0].r;
  assert.equal(confirmed.status, 'confirmed');
  const cryptoOrderRow = (await db.query('select status from public.payment_orders where id = $1', [cryptoOrder.order_id])).rows[0];
  assert.equal(cryptoOrderRow.status, 'approved');

  // Reusing the same chain transaction on a second invoice is rejected.
  const secondOrder = (await db.query("select public.pro_submit_payment('standard', 1, 'crypto', null, null, null, null) as o", [])).rows[0].o;
  const secondInvoice = (await db.query('select public.pro_create_crypto_invoice($1, $2) as i', [secondOrder.order_id, 'usdt-trc20'])).rows[0].i;
  await db.exec('reset role');
  const reused = (await db.query('select public.pro_settle_crypto($1, $2, $3, $4) as r', [
    secondInvoice.invoice_id, 'b'.repeat(64), Number(secondInvoice.amount), 30,
  ])).rows[0].r;
  assert.equal(reused.status, 'mismatch');

  // Expiry takes access away the moment the clock passes.
  await db.exec('reset role');
  await db.query("update public.subscriptions set expires_at = now() - interval '1 second' where user_id = $1 and status = 'active'", [alice]);
  await asUser(alice);
  const expired = (await db.query('select public.pro_my_entitlement() as e')).rows[0].e;
  assert.equal(expired.active, false);
  await assert.rejects(db.query("select public.pro_begin_generation('eps', 'late request', '{}'::jsonb, null)"), /subscription required/);

  /* ------------------------------------------------- two step verification */

  // A verified authenticator on alice: her aal1 session gets nothing back.
  await db.exec('reset role');
  await db.query("insert into auth.mfa_factors(user_id, status) values ($1, 'verified')", [alice]);
  await asUser(alice, 'aal1');
  const locked = (await db.query('select public.pro_my_entitlement() as e')).rows[0].e;
  assert.equal(locked.mfa_required, true, 'aal1 with a factor must say so');
  assert.equal(locked.active, false);
  assert.equal(locked.credits, 0);
  assert.equal(locked.features.vector, false);
  const ownRows = await db.query('select count(*)::int as n from public.wallets');
  assert.equal(ownRows.rows[0].n, 0, 'own wallet row is hidden at aal1');
  // Generators stop at the entitlement ("subscription required") first, so the
  // credit guard is proven directly.
  await assert.rejects(
    db.query("select public.pro_consume_credits(1, 'test')"),
    /two factor code required/,
  );

  // The same account at aal2 is fully back (the expiry test above cancelled her
  // plan, so give her a fresh one first).
  await asUser(admin, 'aal1');
  await db.query("select public.pro_admin_grant($1, 'standard', 1)", [alice]);
  await asUser(alice, 'aal2');
  const unlocked = (await db.query('select public.pro_my_entitlement() as e')).rows[0].e;
  assert.equal(unlocked.mfa_required, false);
  assert.equal(unlocked.active, true);
  assert.ok(unlocked.credits > 0);
  assert.equal((await db.query('select count(*)::int as n from public.wallets')).rows[0].n, 1);

  // Admins see who has a code, and can clear a lost one.
  await asUser(admin, 'aal1');
  const overview = (await db.query('select public.pro_admin_security_overview() as o')).rows[0].o;
  assert.equal(overview.find((row) => row.email === 'alice@example.test').factors, 1);
  assert.equal((await db.query('select public.pro_admin_reset_mfa($1) as n', [alice])).rows[0].n, 1);
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int as n from auth.mfa_factors where user_id = $1', [alice])).rows[0].n, 0);
  await asUser(alice, 'aal1');
  assert.equal((await db.query('select public.pro_my_entitlement() as e')).rows[0].e.active, true);

  console.log('Pro platform SQL: free tier, gating, credits, refunds, pricing, orders, crypto settlement, expiry and 2FA passed');
} finally {
  await db.close();
}
