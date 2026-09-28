# New Supabase project setup

Project: `https://gqmzxxygegmlifeewbzy.supabase.co` (ref `gqmzxxygegmlifeewbzy`).

## 1. Push the schema (CLI)

```bash
npx supabase login                                   # opens browser, once per machine
npx supabase link --project-ref gqmzxxygegmlifeewbzy # asks for the DB password (Dashboard → Settings → Database)
npx supabase db push --dry-run                       # lists the 57 migrations it will apply
npx supabase db push
```

No edge functions exist, so there is nothing to `functions deploy`.
Optional, after any schema change: regenerate client types

```bash
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

What the migrations create: 24 tables (RLS on all), enums, RPCs, triggers, realtime publication,
storage buckets `avatars` (5 MB) and `venue-photos` (8 MB) with their policies, 8 demo venues + courts.

## 2. Dashboard steps (manual)

1. **Settings → API keys**: copy the Project URL and the **publishable/anon** key.
   The `service_role` / secret key goes ONLY into the web host's server secrets, never into
   `VITE_*` variables or the iOS app.
2. **Authentication → Sign In / Providers → Email**: enabled, "Confirm email" ON.
   Password policy: minimum length 8, require lowercase + digits (matches the app's rules).
3. **Authentication → URL Configuration** (fill in once the web app is hosted, Phase 2):
   - Site URL: `https://<your-web-domain>`
   - Redirect URLs: `https://<your-web-domain>/**`, `http://localhost:8080/**`
     (+ the iOS deep-link scheme added in Phase 4)
4. **Authentication → Emails → SMTP**: set up custom SMTP (e.g. Resend, Postmark, Brevo).
   The built-in sender only sends a few emails per hour, which breaks sign-up confirmations in production.
   Optional: translate the templates (Confirm signup, Reset password) to Greek.
5. **Make yourself admin** after you sign up in the app (SQL Editor):
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'YOUR_EMAIL'
   on conflict (user_id, role) do nothing;
   ```

## 3. Data that only exists in the old project

Nothing below is in the repo: users (auth.users + password hashes), real venues/courts/prices,
bookings, chats, reviews, uploaded photos/avatars. The demo venues from the migrations are fake
and must be removed before release (Phase 4).

If you have DB access to the old project (`gfzopoagilepwznmorfo`) and want to keep its data:

```bash
# connection strings: Dashboard → Connect → Session pooler (URL-encode the password)
npx supabase db dump --db-url "$OLD_DB_URL" --data-only --use-copy -f old_data.sql
# empty the demo seed in the new project first, then restore with triggers disabled:
psql "$NEW_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
  -c "truncate public.courts, public.venues cascade" \
  -c "set session_replication_role = replica" \
  -f old_data.sql
```

Storage files (photos/avatars) are not in the SQL dump; download them from the old project's
Storage and re-upload them to the same bucket/path in the new project.
If the old project is Lovable Cloud without DB access, ask the previous owner for an export.

## 4. Security notes (verified locally against all migrations)

- RLS enabled on all 24 public tables, every table has policies, every SECURITY DEFINER function pins `search_path`.
- Double bookings: `bookings_no_overlap` exclusion constraint + advisory lock in the booking RPCs.
- `20260928120100_harden_booking_writes.sql`: players can no longer write `bookings` directly
  (only cancel their own active booking); creation goes through `create_slot_booking` /
  `create_whole_booking` (now SECURITY DEFINER, authenticated only). Owners/admins/service_role unchanged.
- Known gap (not fixed): opening hours, closures and allowed durations are validated in the web
  server (`src/lib/api/bookings.functions.ts`), not inside the RPCs, so a signed-in user calling the
  RPC directly can book outside opening hours at the normal price.
