# Security model (Speak)

Tests for the rules below: `supabase/tests/test_voice.sql` and `test_speak.sql` (local, see CLAUDE.md), plus
live smoke tests with temporary users after each schema change.

## Keys
- The app only ever gets the **anon/publishable** key (`VITE_*`, baked in at build).
- `SUPABASE_SERVICE_ROLE_KEY` is a Cloudflare Worker secret, used only in `*.server.ts` / server
  functions (account deletion). Check the client bundle for it before every release.

## Database
- RLS on every table. Clients can only **read** (their own rows or what the policies allow), update
  their own `profiles.username/full_name/avatar_path` and `notifications.read_at`, and delete their
  own posts. Every other write goes through a `SECURITY DEFINER` RPC (`SET search_path = ''`) that checks
  `auth.uid()` and that the caller is not disabled (`private.me()`).
- `anon` has no table or function access at all.
- Helpers used by policies live in the `private` schema, which the Data API does not expose.
- **Follows**: only via RPCs; voice DMs require mutual follows. Notifications (follow, like, reply, repost)
  are created by triggers, never for yourself or across a block.
- **Voice DMs (listen once)**: audio bytes are stored in `private.voice_message_audio` (no client
  access). `consume_voice_message` marks the message opened and deletes the bytes in the same
  transaction, so a second play is impossible even with concurrent calls. The sender only sees
  `opened_at`. Unheard messages expire after 10 days, message rows after 90 days (pg_cron). Max 2 MB,
  audio types only.
- **Public posts**: `posts` (voice ≤ 2 min + title ≤ 100, section, optional topic, replies,
  reposts/quotes) are created only through `create_post` (file must exist in your own `voices/<uid>/`
  folder; replies inherit section/topic; hidden topics refused). Visible to every signed-in user
  except hidden posts, disabled authors and anyone blocked either way (`private.can_see_post`).
  Counters (likes, replies, reposts, listens, topic posts) are trigger-maintained; one listen per
  person, the author's own plays don't count. Who liked / listened is never exposed. `voices` bucket:
  public by URL (unguessable paths), not listable, 3 MB, audio types only.
- **Admins** (`private.admins`, granted by SQL): topics, news sources and moderation RPCs (`admin_*`) check
  `private.is_admin`; an admin can't be disabled through them.
- **Blocks**: remove follows in both directions, drop the blocked person's unheard messages, hide both
  profiles and all posts from each other and from search; no DMs, likes, replies or follows across a block.
- **Rate limits** (per user): posts 30/h, likes 300/h, follows 200/h, voice messages 30/min and 500/day,
  reports 20/h, admin news refresh 20/h.
- **Reports / moderation** (App Store 1.2): insert-only through `report_content` (post, user, voice
  message); not readable by clients. Each new report puts one "reports to review" notification on every
  admin's bell; a post with 3 distinct open reporters is hidden automatically. Admins review in the app
  (Settings → Reports): hide the post, ban the account (`profiles.disabled` → `private.me()` rejects every
  RPC, profile and posts disappear) or dismiss; history with undo.
- **Account deletion** (`deleteMyAccount`): removes the user's files in `avatars` and `voices`, then
  deletes the auth user, which cascades to every table (posts and their replies/reposts, likes, follows,
  DMs, notifications, blocks; reports they made keep `reporter_id = null`).

## Web server (Cloudflare Worker)
- Server functions that need a user use `requireSupabaseAuth` (bearer token, no cookie CSRF).
- Headers on every response: CSP (incl. `media-src` for audio), HSTS, X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy (`microphone=(self)` only), COOP; server functions `no-store`.

## Auth
- Email + password, min 8 characters (the app also requires a lowercase letter and a digit), secure email
  change, refresh-token rotation.
- **Email confirmation is OFF for now** (`mailer_autoconfirm: true`) because the project has no custom SMTP
  (the built-in mailer only reaches organisation members). Turn it back on once SMTP is set; the sign-up form
  already handles "check your email" and "resend".

## Known limits
- Voice files uploaded but never posted (e.g. the app closed between upload and `create_post`) stay in the
  uploader's own folder; they are removed with the account.
- A played DM can't be reviewed with its audio (it no longer exists); reports keep the sender and time, and
  the recipient can block.
- Public voice files are reachable by anyone who has the exact file URL (disclosed in the Privacy Policy).
