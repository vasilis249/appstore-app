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

## What it creates (baseline, later reshaped by the Speak migrations below)
- Tables (RLS on all): `profiles`, `blocks`, `notifications`, `voice_messages`, `reports`; private:
  `private.voice_message_audio`, `private.rate_events`. (`friendships` / `daily_posts` from the BeReal-style
  version were dropped in `20261007100000_speak_people.sql`.)
- Bucket `avatars` (public URL, not listable, 5 MB). pg_cron job `expire-voice-messages` (hourly): unheard
  messages expire after 10 days (audio deleted), history rows removed after 90 days, old rate-limit rows purged.

## Speak (migration `20261005100000_speak_social.sql`)
- Tables: `follows`, `sections` (8 fixed), `topics` (admin/news/daily), `posts`, `post_likes`, `post_listens`;
  private `admins`. Bucket `voices` (public URL, not listable). RPCs: `follow_user`, `unfollow_user`,
  `remove_follower`, `profile_stats`, `create_post`, `unrepost`, `like_post`, `unlike_post`, `record_listen`,
  `feed_posts(scope …)`, `trending_topics`, `am_i_admin`, `admin_create_topic`, `admin_update_topic`.
- Make someone an admin (SQL Editor): `insert into private.admins (user_id) select id from auth.users where email = '…';`
- Moderation happens in the app (migration `20261010100000_speak_moderation.sql`): Settings → Reports, see
  "Dashboard steps" below.

## News (migration `20261008100000_speak_news.sql`)
- Feeds live in `private.news_feeds` (add one: `insert into private.news_feeds (section_id, name, url) values (…)`).
  Jobs `fetch-news` / `ingest-news` run every 3 hours (pg_net + pg_cron); only headline + link are stored, at most
  2 per feed per run. Admins can refresh, switch feeds off, create topics / the topic of the day and hide or pin
  topics in the app (Settings → Manage topics).

## Dashboard steps (manual)
1. **Authentication → URL Configuration**: Site URL = the Worker URL; Redirect URLs = `<url>/**` and
   `courtsie://**` (already set by `scripts/deploy-all.sh` when SUPABASE_ACCESS_TOKEN is present).
2. **Authentication → Emails → SMTP**: set since 2026-09-30 to **Brevo** (`smtp-relay.brevo.com:587`, the Brevo
   SMTP login + SMTP key, sender name Speak, 100 emails/hour; Brevo free = 300 emails/day for everything).
   **Confirm email is still OFF** (`mailer_autoconfirm: true`) until a "Forgot password" test shows the mail
   lands in the inbox, not spam; then turn it ON (Authentication → Sign In / Providers → Email).
   Student verification codes go through the Brevo **API** from the Worker: secrets `BREVO_API_KEY`
   (`xkeysib-…`, not the SMTP key) and `MAIL_FROM_EMAIL` (a sender verified in Brevo).
3. **Moderation** (App Store: act within 24 h): admins get a bell notification for new reports and review them in
   the app → Profile → ⚙︎ → Reports (play the voice, Hide voice / Ban account / Dismiss; History has undo). A post
   reported by 3 different people is hidden automatically until reviewed. Without the app: Table Editor →
   `reports` (`resolved_at is null`), `posts.hidden = true`, `profiles.disabled = true`.

## Groups (migration `20261011100000_speak_groups.sql`)
- Tables `groups`, `group_members`, `group_requests`; posts and notifications carry `group_id`. All writes through
  RPCs (`create_group`, `join_group`, `invite_to_group`, `respond_group_request`, …). A reported group can be deleted
  from Settings → Reports ("delete group"), or by SQL: `delete from public.groups where id = '…';`.

## Social login (Google, Apple)
The sign-in screen asks Supabase (`/auth/v1/settings`) which providers are on and shows only those buttons, so
turning one on needs no new build. Both come back to `/auth?welcome=1` (new accounts then pick a username); in the
iOS app the provider page opens in Safari (`@capacitor/browser`) and returns through `courtsie://app/…`.
- **Google** (free): Google Cloud Console → APIs & Services → OAuth consent screen (External, app name Speak,
  support email) → Credentials → Create OAuth client ID → *Web application* → Authorized redirect URI
  `https://gqmzxxygegmlifeewbzy.supabase.co/auth/v1/callback`. Put the Client ID + Client secret in Supabase →
  Authentication → Sign In / Providers → Google (or send them to Claude to set via the Management API).
- **Apple**: needs the paid Apple Developer Program (Services ID, Key ID, Team ID, .p8 key) → Supabase → Providers →
  Apple. App Store rule 4.8: once Google sign-in is offered, Sign in with Apple must be offered too before release.

## Tests
Local, without Docker (see CLAUDE.md for the Postgres cluster):
`PGHOST=/tmp PGPORT=54329 PGUSER=postgres bash supabase/tests/run.sh` → `test_voice.sql` + `test_speak.sql`.
