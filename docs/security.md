# Security model (Speak)

Tests for the rules below: `supabase/tests/test_voice.sql` (local), plus an end-to-end smoke test run
against the live project with two temporary users (friends, listen-once, storage unlock).

## Keys
- The app only ever gets the **anon/publishable** key (`VITE_*`, baked in at build).
- `SUPABASE_SERVICE_ROLE_KEY` is a Cloudflare Worker secret, used only in `*.server.ts` / server
  functions (account deletion). Check the client bundle for it before every release.

## Database
- RLS on every table. Clients can only **read** (their own rows or what the policies allow), update
  their own `profiles.username/full_name/avatar_path` and `notifications.read_at`, and delete their
  own daily posts. Every other write goes through a `SECURITY DEFINER` RPC that checks `auth.uid()`
  and that the caller is not disabled (`private.me()`).
- `anon` has no table or function access at all.
- Helpers used by policies live in the `private` schema, which the Data API does not expose.
- **Friends**: requests only via RPCs; DMs and the feed require an accepted friendship.
- **Voice DMs (listen once)**: audio bytes are stored in `private.voice_message_audio` (no client
  access). `consume_voice_message` marks the message opened and deletes the bytes in the same
  transaction, so a second play is impossible even with concurrent calls. The sender only sees
  `opened_at`. Unheard messages expire after 10 days (pg_cron). Max 60 s / 2 MB, audio types only.
- **Daily posts**: files in the private `daily-posts` bucket under `<uid>/`. A friend's file can be
  read (signed URL) only while the post is < 24 h old **and** the reader has posted in the current
  moment (the unlock rule is enforced in the storage policy, not only in the UI). Max 90 s / 2 MB,
  one post per moment.
- **Public posts (Speak)**: `posts` (voice ≤ 2 min + title ≤ 100, section, optional topic, replies,
  reposts/quotes) are created only through `create_post` (file must exist in your own `voices/<uid>/`
  folder; replies inherit section/topic; hidden topics refused; 30/h). Visible to every signed-in user
  except hidden posts, disabled authors and anyone blocked either way (`private.can_see_post`).
  Counters (likes, replies, reposts, listens, topic posts) are trigger-maintained; one listen per
  person, the author's own plays don't count. Likes 300/h, follows 200/h. `voices` bucket: public by
  URL (unguessable paths), not listable, 3 MB, audio types only. Topics are created/hidden/pinned
  only by admins (`private.admins`, granted by SQL).
- **Blocks**: end the friendship and follows in both directions, drop the blocked person's unheard messages, hide both profiles
  from each other and from search; the blocked person can't send requests.
- **Rate limits** (per user): friend requests 50/h, voice messages 30/min and 500/day, daily posts
  10/day, reports 20/h.
- **Reports**: insert-only through `report_content`; not readable by clients (reviewed in the dashboard).
- **Account deletion** (`deleteMyAccount`): removes the user's files in `avatars` and `daily-posts`,
  then deletes the auth user (also `voices/<uid>/`), which cascades to every table.

## Web server (Cloudflare Worker)
- Server functions that need a user use `requireSupabaseAuth` (bearer token, no cookie CSRF).
- Headers on every response: CSP (incl. `media-src` for audio), HSTS, X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy (`microphone=(self)` only), COOP; server functions `no-store`.

## Auth
- Email + password, email confirmation, min 8 characters (the app also requires a lowercase letter
  and a digit), secure email change, refresh-token rotation.

## Known limits
- Daily-post files uploaded but never published stay in the uploader's own folder (only they can
  read them); they are removed with the account.
- A listened message can't be re-reported with its audio (it no longer exists); reports keep the
  sender and time, and the recipient can block.
