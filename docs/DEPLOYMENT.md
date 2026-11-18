# Deployment runbook

Three pieces run in three places. Nothing here touches the desktop installer, which
is built by `.github/workflows/release.yml` on a version tag.

| Piece | Where it lives | What it does |
| --- | --- | --- |
| Web studio | Vercel (`vercel.json` in the repo root) | Same React app in a browser: free tools, sign in, subscription checkout |
| Platform backend | Supabase project `djlmbsaltjqsqpwqdvsg` | Accounts, plans, orders, credits, provider keys, the three edge functions |
| Desktop build | GitHub Releases | Windows installer and portable exe |

Work through the phases in order. Phase 1 has to exist before phase 2 can name a
redirect URL, and phase 3 has to exist before a paid generation can succeed.

## Where things stand

| Item | State |
| --- | --- |
| Vercel project | `micro-stocker-studio` (`prj_YNLMtNwTa2f72vkLyKf3kZmRMDmb`) in team `team_C38SFrCJLympE3xaFSlgU7TM` |
| Production URL | https://micro-stocker-studio.vercel.app |
| Build settings | Vite, `npm ci --ignore-scripts`, `npx vite build`, output `dist`, from `vercel.json` |
| Environment variables | `VITE_LICENSE_SUPABASE_URL`, `VITE_LICENSE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV` |
| Supabase auth | Site URL set to the production URL, redirect list covers the production and preview hosts plus `localhost:5173` |
| Deployment protection | **On**, so the `.vercel.app` URL asks for a Vercel login. Turn it off for production (step 0) |
| Provider keys | **Missing**, so paid generation answers `provider key not configured` |
| Accounts | 2 sign-ins, profiles backfilled, `pritamsarkar1321@gmail.com` is the administrator |
| Database | migrations `…1001` to `…1007` applied: plans, payments, credits, two step verification |
| Two step verification | available to every account; the admin-only policy switch is off |
| Email | Supabase built-in sender, **2 messages per hour**, confirm-email still off |

### Step 0: make the site public

Project -> **Settings -> Deployment Protection** -> Vercel Authentication ->
**Standard Protection** off for Production, or set the whole feature to
**Disabled**. `all_except_custom_domains` (the current mode) keeps the
`.vercel.app` host behind a Vercel login and only lets custom domains through, so
either disable it or attach your own domain in phase 6.

---

## Phase 1: the web studio on Vercel

### 1.1 Create the project

Vercel dashboard, **Add New → Project → Import Git Repository**, pick
`pritamsarkar711/Micro-Stocker-Advanced-Pro`, branch `main`.

The repo ships `vercel.json`, so the build settings are already correct:

```
Framework preset   Vite
Install command    npm ci --ignore-scripts
Build command      npx vite build
Output directory   dist
```

`--ignore-scripts` matters: the `postinstall` hook downloads Electron, which a
browser build never uses and which makes the install step slow and flaky.

### 1.2 Add the environment variables

Project → **Settings → Environment Variables**. Every value is public by design
(they end up in the browser bundle), so use type **Plain** and tick Production,
Preview and Development.

| Key | Value |
| --- | --- |
| `VITE_LICENSE_SUPABASE_URL` | `https://djlmbsaltjqsqpwqdvsg.supabase.co` |
| `VITE_LICENSE_SUPABASE_ANON_KEY` | the project's `anon` public key |
| `VITE_SUPABASE_URL` | same URL, used by Settings → Cloud connection |
| `VITE_SUPABASE_ANON_KEY` | same anon key |
| `VITE_APP_ENV` | `production` |

Find the anon key in Supabase → **Project Settings → API Keys → anon public**.
Never put the `service_role` key in Vercel: it bypasses row level security and
would be readable in the bundle.

Leave `VITE_DEMO_MODE` unset. It switches the app to the in-memory demo backend.

Vite bakes these values into the bundle at build time, so **any change needs a new
deployment**, not a restart.

### 1.3 Deploy and verify

**Deployments → Redeploy**, or push any commit to `main`.

Check, on the production URL:

1. The studio opens straight into Overview, no sign-in wall.
2. Browser console has no errors.
3. Account → Sign in with a real account, then reload: the session survives.
4. Subscription shows the three tiers in taka, and the current plan and credits.
5. A generator route (`#/generate/svg`) shows the Pro gate for a free account.

### 1.4 Automatic previews

Every pull request gets a preview URL with the same environment variables. Use it
to check a change before merging; production only follows `main`.

---

## Phase 2: tell Supabase about the new origin

Supabase → **Authentication → URL Configuration**:

- **Site URL**: the Vercel production URL, for example
  `https://micro-stocker.vercel.app`
- **Redirect URLs**: add every origin that can sign in:
  - `https://micro-stocker.vercel.app/**`
  - `https://*.vercel.app/**` while you use preview deployments
  - `http://localhost:5173/**` for local work

Supabase → **Authentication → Providers → Email**: keep "Confirm email" on for a
public site, and set the SMTP sender (Authentication → Emails) if you want branded
messages. The default sender is rate limited and often lands in spam.

Without this phase, password reset links and email confirmations bounce back to
`localhost`.

---

## Phase 2b: finish the security settings (5 minutes)

The code side is done and tested; these four switches belong to Supabase. Open
**Authentication** in the dashboard.

1. **Emails → Reset password**: replace the link with
   `<a href="{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>`.
   Without it a reset link only works in the browser that asked for it.
2. **Providers → Email**: add a custom SMTP server, then turn **Confirm email**
   on. The built-in sender allows two messages per hour, so password resets stop
   working after the second request in an hour.
3. **Policies → Password**: minimum length 8, leaked-password protection on.
4. **Policies → Sessions**: "Require current password when changing the password"
   on.

Then open the app, sign in, go to **Settings → Security**, and turn on two step
verification for the administrator account. After that open **Admin console →
Security** and flip "Require an authenticator for administrator accounts".

Details, including how a locked-out customer is helped, are in
[SECURITY.md](SECURITY.md).

---

## Phase 3: make paid generation actually work

The generators call the `ai-generate` edge function, which reads the provider key
from `pro_provider_keys` with the service role. That table is empty today, so every
generation answers `provider key not configured` and charges nothing.

1. Sign in to the app as an administrator.
2. **Admin console → Providers**, press **Add key** on the provider you use
   (Moonshot AI for the vector briefs, OpenAI for the JPG studio). The dialog
   names the page to create the key on and the shape of the value.
3. Paste the key and press **Store key**. Only a hint such as `sk-a...f2c9` is
   ever shown again; **Remove key** deletes it if it leaks.
4. Make sure the model you want is enabled under **Models**, and that its cost per
   million tokens is right. Those numbers drive the margin figure on the Overview.
5. Run one generation on a Pro account and check **Overview → Spend by model**
   shows the call.

Crypto payments also need explorer credentials on the Supabase side:

```bash
supabase secrets set \
  BSCSCAN_API_KEY=... \
  POLYGONSCAN_API_KEY=... \
  TRON_API_KEY=... \
  SOLANA_RPC_URL=https://...
```

Without them the verifier answers `pending` and an administrator approves the order
by hand, exactly like bKash and Nagad.

---

## Phase 4: become an administrator

Already done for `pritamsarkar1321@gmail.com` on this project. For another
account, sign it up first, then run:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Reload the app: **Admin console** appears in the sidebar. Every admin RPC checks
`pro_is_admin()` on the server, so this is the only way in, and every change is
written to `admin_audit`.

---

## Phase 5: rehearse a payment before announcing anything

1. Create a customer account with no plan.
2. Buy a monthly Starter plan with bKash, paste a real TrxID, submit.
3. **Admin console → Orders**: the order is `submitted`, the TrxID is shown once.
   Approve it with a note.
4. The customer page shows the plan, the expiry date and the credits; the generator
   gate is gone. **Users** shows the new balance.
5. Buy again with the same TrxID: it is refused.
6. Crypto: create an invoice, pay the exact amount, press **Check payment** until it
   reports the required confirmations. A short payment must report `mismatch`, never
   settle.

---

## Phase 6: a custom domain

Vercel → Project → **Domains → Add**, then point DNS at Vercel:

| Record | Name | Value |
| --- | --- | --- |
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Then update phase 2 with the new origin (Site URL and redirect URLs) and redeploy so
the canonical link and any absolute URLs use the real domain.

---

## Phase 7: routine changes

- **Plan prices, credits, limits, provider keys**: admin console, no deploy.
- **Frontend code**: merge to `main`, Vercel deploys, previews come from pull
  requests.
- **Environment variables**: edit in Vercel, then redeploy; old deployments keep the
  old values.
- **Desktop build**: bump `version` in `package.json`, `src/lib/version.ts` and
  `package-lock.json`, update `CHANGELOG.md`, tag `v<version>`, push the tag. CI runs
  `npm run verify`, builds the installer, installs it silently, launches it and
  publishes a draft release that you then promote.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Sign in works locally, fails on Vercel | Origin missing from redirect URLs | Phase 2 |
| `provider key not configured` | No key in `pro_provider_keys` | Phase 3 |
| Crypto stays `pending` | Explorer secrets missing, or the hash is not visible yet | Phase 3 |
| Prices or plans missing | Wrong project URL in `VITE_LICENSE_SUPABASE_*` | Fix the env var, redeploy |
| Blank page after deploy | Asset path or build output changed | Check that `dist` is the output directory |
| 404 on a deep link | A path with an extension hit the SPA rewrite | Link through the hash router (`/#/route`) |
| Vercel build takes minutes and fails | `postinstall` tried to download Electron | Keep `npm ci --ignore-scripts` |
