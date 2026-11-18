# Pro platform

The desktop studio is free. A subscription unlocks four premium generators, the
JPG studio and the top tier upscale models. Everything else, including the
converters, the optimiser, the background remover, Vector Studio and the standard
upscale models, works without an account.

## Where the pieces live

| Layer | Path | Notes |
| --- | --- | --- |
| Design engine | `src/lib/generate/` | Palettes, glyphs, primitives, renderer, EPS/AI serialiser, quality gate, seasonal ideas |
| Orchestration | `src/lib/generate/run.ts` | Calls the edge function, renders locally, runs the quality gate, retries a failed composition |
| UI | `src/pages/GeneratePage.tsx` | One page for EPS, SVG, AI and JPG |
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

## Making yourself an administrator

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Then reload the app. `pro_is_admin()` gates every admin RPC, and every change is
written to `admin_audit`.

## Pricing, credits and limits

Everything is data, not code:

* `plans` and `plan_prices` — three tiers, one, six and twelve month terms.
* `app_settings` — `fx_bdt_usd`, `credits` (cost per action), `limits`
  (daily generations, rate limits, prompt length), `payment` (order windows),
  `free_tier` (what an unsubscribed visitor may do).
* `crypto_assets` — coin, network, address, decimals, USD rate, confirmations.
* `payment_methods` — bKash and Nagad numbers, instructions.

Margin is visible in the admin console: `pro_admin_stats()` returns revenue in
BDT, API spend in USD and BDT, and the resulting margin.

## Payments

* **bKash / Nagad** — the customer sends money, submits the TrxID, and an
  administrator approves it. The same TrxID cannot be claimed twice: a unique
  index covers `(method, lower(txn_ref))` for every non-rejected order.
* **Crypto** — `pro_create_crypto_invoice` returns the address and the exact
  amount, computed server-side from the plan price. `crypto-verify` reads the
  chain, checks destination, token, amount (0.5% tolerance) and confirmations,
  then `pro_settle_crypto` writes the result. A hash that already settled another
  invoice is rejected, and a short payment never settles.

## What the quality gate checks

`checkArtwork` runs before a download exists: path syntax, artboard bounds,
palette consistency, title/description/keyword lengths, banned words, raster
absence, live text, PostScript header and vector content. Warnings cover
duplicate shapes, node budget, contrast and canvas coverage. A failed check
rejects the job and refunds the credit through `pro_finish_generation`.

## Tests

```bash
npm test                 # domain tests, the SQL suite against real Postgres (PGlite), SSR smoke
npm run qa:generate      # renders ten specs, verifies the gate, EPS header and AI trailer
```
