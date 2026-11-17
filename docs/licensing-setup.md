# Licensing deployment

The application now requires a centrally authenticated account. The licensing
service must be provisioned before making a release: an unconfigured build shows
“Service not configured” and cannot be used. Authentication and the paid-feature
checks require a network connection. Existing local-only accounts do **not**
constitute centrally verified accounts and are not automatically migrated.

1. Create a new Supabase project and configure Auth. Enable email confirmation
   and set up a reliable email service and rate limits before admitting users.
2. Review and apply `supabase/migrations/202611170001_licensing.sql` using the
   project's SQL editor. It must be tested against the target Supabase version
   before production use. Do not expose the `msap_private` schema through the
   Data API. Only public RPC functions should be exposed.
3. Register your own account and confirm its email. In the privileged SQL editor,
   add that account as an administrator using its real email address:

   ```sql
   insert into msap_private.admins(user_id)
   select id from auth.users where email = 'YOUR-ADMIN-EMAIL';
   ```

   Verify that exactly one row was inserted. Use a strong, unique administrator
   password and do not share credentials. The desktop app does not yet support
   completing MFA challenges, so administrator MFA enforcement and end-to-end
   testing must be implemented before production use.
4. Set `VITE_LICENSE_SUPABASE_URL` and `VITE_LICENSE_SUPABASE_ANON_KEY` to the
   project URL and **public** anon/publishable key when building the app. These
   are not secrets and are visible in the distributed application. Never put a
   service-role key or database password in `VITE_` variables or the app.
5. For GitHub Actions, set repository variables `MSAP_LICENSE_SUPABASE_URL`
   and `MSAP_LICENSE_SUPABASE_ANON_KEY` to the public project URL and public
   publishable key. The workflow maps these to the `VITE_` build variables.
   Never use a secret/service-role key here. Configure an SMTP provider for
   production email delivery before admitting users.
6. Point the confirmation links at a real URL. In **Authentication → URL
   Configuration** set **Site URL** to the hosted web build (for example
   `https://studio.example.com`), and add every origin you ship to **Redirect
   URLs**. A Supabase project still on the default `http://localhost:3000` sends
   every confirmation and recovery email to a dead address — that is the
   `localhost refused to connect` report. The app never invents a redirect: it
   uses `VITE_AUTH_REDIRECT_URL` when the build sets one, otherwise the current
   page origin, and for the packaged desktop app (`file://`, where an email link
   can never land) it asks the user to type the 6-digit code from the same email
   instead. Deploy the web build if you want link-based confirmation.
7. Sign in, open Subscription, and generate a trial or premium code. Copy the
   code immediately; only its hash is stored. Test redemption, reuse, revocation,
   simultaneous redemption, expiry, network failures, and admin authorization
   with separate ordinary and admin accounts before distributing a release.

The app revalidates premium access every thirty seconds. The last confirmed
answer is kept until the local countdown runs out, so a dropped connection does
not eject a paying contributor mid-session while an expired or blocked account
still locks on the next successful check. UI checks in a locally controlled desktop
application are not tamper-proof. They do not prevent patching, redistribution,
or reverse engineering; protect valuable server-side operations on the server.
The backend hostname is visible to a determined user through network inspection.

## Urgent: legacy projects

Previous releases included an unsafe SQL schema granting anonymous users full
access to `user_accounts`, `kv_store`, and `issue_reports`. If you ever applied
that schema to a Supabase project, its data may have been exposed. Immediately
apply the safety SQL available in the app's Cloud page or in
`src/lib/cloud/schema.ts` to **each existing project**, review other policies
and privileges in the Supabase dashboard, and rotate/reset affected passwords.
This only removes the known policies and grants; other permissive policies must
also be removed. Consult Supabase logs and your security adviser. The new app
no longer syncs legacy password hashes, library data or reports through that
unsafe path. Existing local data is not automatically migrated to accounts.
