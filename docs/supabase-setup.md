# Supabase setup (Speak)

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

## Speak (migration `20261005100000_speak_social.sql`)
- Tables: `follows`, `sections` (8 fixed), `topics` (admin/news/daily), `posts`, `post_likes`, `post_listens`;
  private `admins`. Bucket `voices` (public URL, not listable). RPCs: `follow_user`, `unfollow_user`,
  `remove_follower`, `profile_stats`, `create_post`, `unrepost`, `like_post`, `unlike_post`, `record_listen`,
  `feed_posts(scope …)`, `trending_topics`, `am_i_admin`, `admin_create_topic`, `admin_update_topic`.
- Make someone an admin (SQL Editor): `insert into private.admins (user_id) select id from auth.users where email = '…';`
- Moderate a post: `update public.posts set hidden = true where id = '…';` (the file stays until the author
  or you delete it in Storage → voices).

## News (migration `20261008100000_speak_news.sql`)
- Feeds live in `private.news_feeds` (add one: `insert into private.news_feeds (section_id, name, url) values (…)`).
  Jobs `fetch-news` / `ingest-news` run every 3 hours (pg_net + pg_cron); only headline + link are stored, at most
  2 per feed per run. Admins can refresh, switch feeds off, create topics / the topic of the day and hide or pin
  topics in the app (Settings → Manage topics).

## Dashboard steps (manual)
1. **Authentication → URL Configuration**: Site URL = the Worker URL; Redirect URLs = `<url>/**` and
   `courtsie://**` (already set by `scripts/deploy-all.sh` when SUPABASE_ACCESS_TOKEN is present).
2. **Authentication → Emails → SMTP**: set a custom SMTP server before inviting real users (the built-in
   mailer only sends to members of the Supabase organisation, 2 emails/hour). Until then **Confirm email is
   OFF** (`mailer_autoconfirm: true`, set 2026-09-29) so sign-ups work; turn it back ON once SMTP is set.
3. **Moderation**: open reports are in Table Editor → `reports` (filter `resolved_at is null`). To ban
   someone set `profiles.disabled = true`; to remove a post delete its `daily_posts` row and the file in
   Storage → `daily-posts/<user id>/`. Set `resolved_at` when done (App Store: act within 24 h).

## Tests
Local, without Docker (see CLAUDE.md for the Postgres cluster):
`PGHOST=/tmp PGPORT=54329 PGUSER=postgres bash supabase/tests/run.sh` → `test_voice.sql`.
