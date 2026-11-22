# Pro platform

The desktop studio is free. A subscription unlocks four premium generators, the
JPG studio and the top tier upscale models. Everything else, including the
converters, the optimiser, the background remover, Vector Studio and the standard
upscale models, works without an account.

The Android build (vecmotion) does not ship the generators, Vector Studio or the
old Library/Export/Submissions/Platform Rules pages. Everything in it works
without an account; its plan is a minimal-fee subscription (`vecmotion` in the
`plans` table) that only keeps the project maintained. Desktop and Android share
the same tables; the Android client simply never sees the other plans.

## Where the pieces live

| Layer | Path | Notes |
| --- | --- | --- |
| Cloud generation edge function | `supabase/functions/ai-generate` | Server side, dormant until a provider key is stored |
| Schema + RPCs | `supabase/migrations/20261117100*.sql` | One migration series replaces the old activation-code licensing |
| Edge functions | `supabase/functions/{ai-generate,crypto-verify,admin-config}` | The only code that touches provider keys |

## Provider keys: server side only

Keys live in `public.pro_provider_keys`. That table has row level security
enabled, **no policies and no grants**, so `anon` and `authenticated` cannot read
it even by querying it directly. Only the service role (edge functions) can.

Two ways to install a key:

1. Admin panel, `Settings → Providers`, which calls the `admin-config` function.
   The function verifies the caller is an admin, writes the key with the service
   role, and returns only a masked hint (`sk-a...f2c9`).
2. Directly as an edge function secret if you prefer not to store it in Postgres:

```bash
supabase secrets set MOONSHOT_API_KEY=... DEEPSEEK_API_KEY=... MINIMAX_API_KEY=... OPENAI_API_KEY=...
```

Either way the browser never receives a key, no key appears in a bundle, and no
key is sent to the client in a network response.

## Deploying

```bash
supabase link --project-ref djlmbsaltjqsqpwqdvsg
supabase db push                     # migrations (already applied in this project)
supabase functions deploy ai-generate --no-verify-jwt=false
supabase functions deploy crypto-verify --no-verify-jwt=false
supabase functions deploy admin-config --no-verify-jwt=false
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
by the platform. Extra secrets for chain verification:

```bash
supabase secrets set BSCSCAN_API_KEY=... POLYGONSCAN_API_KEY=... TRON_API_KEY=... SOLANA_RPC_URL=...
```

Without those the crypto verifier answers `pending` and an administrator approves
the order by hand, which is the same path as bKash and Nagad.

The migrations and the three functions are live on `djlmbsaltjqsqpwqdvsg`, and the
`pro-exports` bucket exists. One thing is still missing: no provider key has been
stored yet, so a generation answers `provider key not configured` and nothing is
charged until an administrator adds a key under Providers in the admin console.
Without the explorer secrets the crypto verifier answers `pending` and an
administrator approves the order by hand. `deno check` on the functions needs
network access to `esm.sh`, so run it on a machine that has it.

## Making yourself an administrator

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Then reload the app. `pro_is_admin()` gates every admin RPC, and every change is
written to `admin_audit`. It also refuses to answer for an administrator whose
session is below aal2 while their account owns an authenticator, so the console
inherits two step verification with no extra code. See
[SECURITY.md](SECURITY.md) for the full model and the admin recovery actions.

## Pricing, credits and limits

Everything is data, not code:

* `plans` and `plan_prices` — three tiers, one, six and twelve month terms.
* `app_settings` — `fx_bdt_usd`, `credits` (cost per action), `security`
  (`require_admin_mfa`), `limits`
  (daily generations, rate limits, prompt length), `payment` (order windows),
  `free_tier` (what an unsubscribed visitor may do).
* `crypto_assets` — coin, network, address, decimals, USD rate, confirmations.
* `payment_methods` — bKash and Nagad numbers, instructions.

Margin is visible in the admin console: `pro_admin_stats()` returns revenue in
BDT, API spend in USD and BDT, and the resulting margin. The per action prices
and the arithmetic behind them are in [PRICING.md](PRICING.md).

## Payments

* **bKash / Nagad** — the customer sends money, submits the TrxID, and an
  administrator approves it. The same TrxID cannot be claimed twice: a unique
  index covers `(method, lower(txn_ref))` for every non-rejected order.
* **Crypto** — `pro_create_crypto_invoice` returns the address and the exact
  amount, computed server-side from the plan price. `crypto-verify` reads the
  chain, checks destination, token, amount (0.5% tolerance) and confirmations,
  then `pro_settle_crypto` writes the result. A hash that already settled another
  invoice is rejected, and a short payment never settles.

## Pro tools on the desktop

* **Image upscaler** - all models are free, including 4K and 8K output. Android
  shows only models that fit the device's RAM and capabilities.
* **Video upscaler** - 2K, 4K and 8K are all free. Android shows only device
  compatible render modes.
* Rendering happens on the machine, so it spends no credits. Credits meter the
  cloud generators only: `pro_begin_generation` reserves them, `pro_finish_generation`
  refunds a failed job.

## Tests

```bash
npm test                 # domain tests, the SQL suite against real Postgres (PGlite), SSR smoke
node scripts/qa/_signed-in-shots.mjs admin@demo.local /tmp/shots   # signed in pages
node scripts/qa/_admin-flow.mjs                                     # every admin tab, approves one order
node scripts/qa/_checkout-flow.mjs                                  # bKash order and a crypto invoice
```

The three browser passes need the dev server on port 5173 with
`VITE_DEMO_MODE=1`, and they fail the run on any page error.
