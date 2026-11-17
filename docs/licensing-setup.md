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
   Never use a secret/service-role key here. Verify that the email confirmation
   redirect URL is appropriate for the desktop flow; Supabase's default
   `localhost` redirect is not a production-ready end-user experience. Configure
   an SMTP provider for production email delivery before admitting users.
6. Sign in, open Subscription, and generate a trial or premium code. Copy the
   code immediately; only its hash is stored. Test redemption, reuse, revocation,
   simultaneous redemption, expiry, network failures, and admin authorization
   with separate ordinary and admin accounts before distributing a release.

The app periodically revalidates premium access and disables it after expiry or
when validation is unavailable. UI checks in a locally controlled desktop
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
