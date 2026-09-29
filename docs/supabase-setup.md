# Supabase setup (voice social network)

The whole schema is one baseline migration: `supabase/migrations/20261003100000_voice_baseline.sql`.
It is already applied to the live project `gqmzxxygegmlifeewbzy` and recorded in the migration
history, so `supabase db push` from the Mac reports nothing to do.

## New or empty project (CLI)
```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push            # applies the baseline
```
The baseline also works on a database that still has the old court-booking schema: it drops every
old table/function/type in `public`, the `private` schema and the old storage policies. Accounts in
`auth.users` are kept and get a profile (username generated from the name, Greek → Latin).

## What it creates
- Tables (RLS on all): `profiles`, `friendships`, `blocks`, `notifications`, `voice_messages`,
  `daily_posts`, `reports`; private: `private.voice_message_audio`, `private.rate_events`.
- RPCs (signed-in users only): `search_users`, `my_friends`, `send_friend_request`,
  `accept_friend_request`, `remove_friend`, `block_user`, `unblock_user`, `my_blocked`,
  `send_voice_message`, `consume_voice_message`, `my_threads`, `today`, `prompt_schedule`,
  `publish_daily_post`, `feed`, `report_content`.
- Buckets: `daily-posts` (private, 2 MB, audio types), `avatars` (public URL, not listable, 5 MB).
- Realtime: `voice_messages`, `friendships`, `notifications`, `daily_posts`.
- pg_cron job `expire-voice-messages` (hourly): unheard messages expire after 10 days (audio deleted),
  history rows removed after 90 days, old rate-limit rows purged.

## Dashboard steps (manual)
1. **Authentication → URL Configuration**: Site URL = the Worker URL; Redirect URLs = `<url>/**` and
   `courtsie://**` (already set by `scripts/deploy-all.sh` when SUPABASE_ACCESS_TOKEN is present).
2. **Authentication → Emails → SMTP**: set a custom SMTP server before inviting real users (the built-in
   mailer only sends to members of the Supabase organisation).
3. **Moderation**: open reports are in Table Editor → `reports` (filter `resolved_at is null`). To ban
   someone set `profiles.disabled = true`; to remove a post delete its `daily_posts` row and the file in
   Storage → `daily-posts/<user id>/`. Set `resolved_at` when done (App Store: act within 24 h).

## Tests
Local, without Docker (see CLAUDE.md for the Postgres cluster):
`PGHOST=/tmp PGPORT=54329 PGUSER=postgres bash supabase/tests/run.sh` → `test_voice.sql`.
