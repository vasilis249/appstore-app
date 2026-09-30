# Security model (Speak)

Tests for the rules below: `supabase/tests/test_voice.sql`, `test_speak.sql`, `test_groups.sql`,
`test_walkie.sql` and `test_campus.sql` (local, see CLAUDE.md), plus live checks (rolled back) after each
schema change.

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
- **Groups**: public = readable by every signed-in user, joined at once; private = name/description/counts
  discoverable, voices and member list only for members (`private.can_see_group` inside `can_see_post` and
  `feed_posts`). Only members post; group voices never leave the group (no feeds outside it, no reposts). Invites
  only from members to friends (mutual follow), 50/h; join requests 30/h; groups 5/day per user. Roles owner/admin/
  member enforced in the RPCs; tables are read-only for clients.
- **Walkie-talkie** (friends = mutual follows only): live audio goes over a private Realtime channel
  `walkie:<smaller id>:<larger id>`; RLS on `realtime.messages` (`walkie_read` / `walkie_write`, via
  `private.walkie_topic_ok`) lets only those two join, receive presence/broadcasts or send — unfollowing or a
  block cuts it (checked when a channel is joined). Each transmission (≤ 60 s) is saved in `private.walkie_audio`
  (no client access), replayable by the two for 24 h through `walkie_audio`, deleted hourly after that; a block
  wipes the pair's history. `walkie_contacts` (open channels ≤ 10, last seen) is readable only by its owner and
  written only through `walkie_set_channel` / `walkie_seen`. A saved transmission leaves one `walkie`
  notification (trigger). Limits: 60 saves/min, 2,000/day.
- **Student campus**: `profiles.university_id / department_id / study_year / student_verified_at` are not
  client-writable. A code is issued only by the Worker (`student_code_issue` refuses anyone but `service_role`),
  mailed through Brevo; the database stores a hash of the code (15 min, 5 tries, 5 sends/hour/user, 300/day) and
  a hash of the address (one account per address). Campus voices, topics and school groups are visible only to
  verified students of that university (`private.my_university()` in `can_see_post` / `feed_posts`); they never
  reach other feeds and can't be reposted. Campus moderators (named by an admin, must be students there) see and
  act only on reports about their campus's voices (hide / dismiss, no bans, no reporter names).
- **Invite links**: `invite_preview` (name, photo, school of the inviter) is served by the Worker with the service
  role — anon can't call it; `claim_invite` works once, only for accounts younger than 7 days, and makes the two
  friends.
- **Admins** (`private.admins`, granted by SQL): topics, news sources and moderation RPCs (`admin_*`) check
  `private.is_admin`; an admin can't be disabled through them.
- **Blocks**: remove follows in both directions, drop the blocked person's unheard messages, hide both
  profiles and all posts from each other and from search; no DMs, likes, replies or follows across a block.
- **Rate limits** (per user): posts 30/h, likes 300/h, follows 200/h, voice messages 30/min and 500/day,
  walkie saves 60/min and 2,000/day, student codes 5/h, reports 20/h, admin news refresh 20/h.
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
- Headers on every response: CSP (incl. `media-src` for audio; `img-src https:` for news cover photos shown from the
  publishers), HSTS, X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy (`microphone=(self)` and `geolocation=(self)` only, for the live map), COOP; server functions `no-store`.

## Auth
- Email + password, min 8 characters (the app also requires a lowercase letter and a digit), secure email
  change, refresh-token rotation.
- Auth emails go through Brevo SMTP (since 2026-09-30). **Email confirmation is still OFF**
  (`mailer_autoconfirm: true`) until deliverability is checked; the sign-up form already handles "check your
  email" and "resend". Worker secrets `BREVO_API_KEY` / `MAIL_FROM_EMAIL` send the student codes.

## Known limits
- Voice files uploaded but never posted (e.g. the app closed between upload and `create_post`) stay in the
  uploader's own folder until the next orphan sweep (after any deletion; files > 1 h old that no post uses) or
  the account is deleted.
- **Walkie live audio can't be metered by the server**: once a friend's channel is joined, Realtime doesn't
  re-check each broadcast, so the only caps are the 60 s per press (client) and Supabase's own quotas (free plan:
  200 concurrent connections, 100 messages/s, 2 M messages/month ≈ 70 hours of talk). Watch Settings → Usage.
- Walkie in the background is best effort (no APNs / PushToTalk framework without the paid Developer Program):
  iOS may suspend the app; missed transmissions stay as replays + a notification for 24 h.
- A played DM can't be reviewed with its audio (it no longer exists); reports keep the sender and time, and
  the recipient can block.
- Public voice files are reachable by anyone who has the exact file URL (disclosed in the Privacy Policy).
