# Accounts, passwords and two step verification

Everything an owner or a customer needs to know about signing in, recovering a
password, and protecting the account with an authenticator app. Written for
someone who has never administered a Supabase project before.

## What the customer sees

| Task | Where | What happens |
| --- | --- | --- |
| Create an account | Top right **Sign in → Create account** | The address, a password of 8 or more characters, optional display name. |
| Sign in | Top right **Sign in** | Email and password. If an authenticator is on, a second screen asks for the 6 digit code. |
| Forgot the password | **Sign in → Forgot password?** | A one time link is emailed. It opens a form that asks for a new password and signs the account back in. |
| Turn on two step verification | **Settings → Security → Enable** | Scan the QR code with Google Authenticator, type the 6 digit code, done. |
| Turn it off | **Settings → Security → Turn off** | Only possible from a session that already passed the code. |
| Lost the phone | Ask the administrator | The administrator clears the authenticator in **Admin console → Security → Clear 2FA**, then the customer signs in with the password and enrols a new device. |

Codes are standard TOTP: 6 digits, 30 second window, accepted one step either
side, so a code typed at second 29 still works. Google Authenticator, Authy,
Microsoft Authenticator and 1Password all produce the same codes.

## Password reset: how the link reaches the browser

Three shapes exist and the app understands all of them:

1. `?token_hash=…&type=recovery` — works in any browser, including a phone that
   requested the reset on a laptop. **This is the shape to prefer** (see the
   dashboard settings below).
2. `?code=…` (PKCE) — the default today. The code is tied to the browser that
   asked for the link, so opening the email somewhere else fails with a clear
   message and a "send a new link" path.
3. `#access_token=…&type=recovery` — the older implicit flow, still handled.

When the exchange succeeds the account panel opens on **Choose a new password**,
a banner stays visible while the reset is unclaimed, and finishing it closes the
panel with the new password already in use. Nothing about the reset reveals
whether an address exists: the screen always says "If that address has an
account, a reset link is on its way."

## Two step verification in the database, not just the screen

A stolen password alone must not be enough. `202611171004` … `1005` add the
server side rules:

| Rule | Function |
| --- | --- |
| Does this account own a verified authenticator? | `public.pro_has_totp(uuid)` |
| Is this request below aal2 while the account owns one? | `public.pro_needs_aal2()` |
| Refuse the write | `public.pro_assert_aal2()` (SQLSTATE `P0007`) |
| Admin rights | `pro_is_admin()` returns false at aal1, so every admin RPC, the admin console data and the `admin-config` edge function stop working until the code is entered |

With a verified factor present, an aal1 session can no longer:

* read its profile, wallet, credits, subscription, orders, invoices or
  generation history (row level security policies check `pro_needs_aal2()`);
* spend credits (`pro_consume_credits`, and therefore every generator);
* create a payment order or a crypto invoice (a `before insert` trigger);
* act as an administrator;
* read the entitlement — `pro_my_entitlement()` answers
  `{"active": false, "mfa_required": true, credits: 0, free features}`.

The app mirrors that: a restored session that still owes a code shows a banner,
opens the challenge, and the licence store reloads the moment the code passes.

### Making 2FA mandatory for administrators

**Admin console → Security → "Require an authenticator for administrator
accounts"**. The switch refuses to turn on until the administrator flipping it
has a verified authenticator, so nobody can lock themselves out. While it is on:

* an administrator without a factor keeps a normal user's rights only;
* the Security tab lists every account, whether it has a code, and when it last
  signed in.

## Administrator recovery kit

| Situation | Action |
| --- | --- |
| Customer lost the phone | **Security → Clear 2FA** on their row. Written to `admin_audit` as `mfa.reset`. |
| Customer lost the password | Ask them to use **Forgot password**; an administrator cannot see or set a password. |
| Expired plans still counted as active | **Security → Run expiry sweep** (`pro_admin_expire_subscriptions`). |
| Provider key leaked | **Providers → Replace key** (the old value is overwritten and never returned), then rotate it in the provider dashboard. |

## Settings that live in the Supabase dashboard

These four are not in the code because Supabase owns them. Each is a two minute
change under **Authentication**.

1. **Email templates → Reset password** — replace the link target so a reset
   works on any device:

   ```html
   <h2>Reset your password</h2>
   <p>Follow the link below to choose a new one. It expires in one hour.</p>
   <p><a href="{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=recovery">Reset password</a></p>
   <p>If you didn't ask for this, ignore the email.</p>
   ```

2. **Sign In / Providers → Email** — turn **Confirm email** on once SMTP is
   configured (below). Until then accounts are auto-confirmed, and a mistyped
   address cannot be detected by the mail server.
3. **Policies → Password** — minimum length `8`, and enable the leaked-password
   check (HaveIBeenPwned). The app already refuses anything weaker, this makes
   the API refuse it too.
4. **Policies → Sessions** — "Require current password when changing the
   password" on, so a stolen session cannot change the password by itself. The
   app asks for the current password anyway.

Mail: the built in sender allows **two messages per hour** and expects a custom
SMTP server for real traffic. Add one (Resend, Postmark, Brevo, Gmail app
password) under **Authentication → Emails → SMTP Settings**, otherwise reset
emails silently stop after the second request in an hour.

Rate limits already enforced by Supabase: 30 verifications and 30 OTP checks per
hour per address, 150 token refreshes per hour, refresh token rotation on with a
10 second reuse window.

## Provider API keys

The keys that pay for AI calls never reach a browser:

* stored in `public.pro_provider_keys`, which has row level security, **no
  policies and no grants**;
* written only by the `admin-config` edge function, which checks
  `pro_is_admin()` first (so the administrator needs aal2 when they own a code);
* returned to the screen as a hint such as `sk-a...f2c9`;
* validated before saving — wrong prefix, spaces, quotes or placeholder text are
  rejected with a plain message;
* removable with **Remove key**, which leaves the hint empty so the console shows
  "No key" again.

Customer supplied keys in **Settings → AI** stay in the browser's own storage and
are only used for local or bring-your-own-key calls.

## Verification

```bash
node tests/pro-platform-db.mjs          # schema, RLS, credits, aal2, admin kit
VITE_DEMO_MODE=1 npx vite --port 5173   # then, in another shell:
node scripts/qa/_auth-flow.mjs          # signup, reset, 2FA, admin console, layout
```

`_auth-flow.mjs` prints one line per check and screenshots the reset form, the
enrolment panel, the challenge, the provider dialog, the security tab and the
subscription page at desktop and phone widths.
