# Courtsie (voice-only social network) → iOS — project notes

Persistent findings for Claude sessions. Reply to the user in Greek; code, comments and file names in English.
Work in phases; after each phase STOP, summarize in ≤10 lines, update this file, wait for the user's "OK".
Don't read `bun.lock`, `node_modules`, `src/assets`, `src/components/ui` (stock shadcn), `src/routeTree.gen.ts`,
`src/integrations/supabase/types.ts` (generated). Use Glob/Grep, read only what's needed.

## Product (pivot 2026-09-29; the court-booking + Instagram-style app was deleted)
Friends by username + requests (DMs and feed friends-only); recorded voice DMs, listen-once enforced
server-side (sender sees "opened"; unheard expire after 10 days); one daily voice post (≤ 90 s) — posting
unlocks friends' posts, otherwise they are locked/blurred; posts visible to friends 24 h; one daily prompt at
the same time for everyone; calendar of own past posts; report/block/EULA/account deletion/mic string.
- **FREE stack, push-to-talk POSTPONED** (no Apple Developer Program → no APNs/PushToTalk/LiveKit). Daily prompt
  = local notifications scheduled from `prompt_schedule()` (~30 days ahead). No push for new DMs while closed.
  Supabase free tier (project pauses after 1 week idle).
- Clips: web `MediaRecorder` (prefer `audio/mp4`, 64 kbps requested); DM ≤ 60 s / 2 MB, daily post ≤ 90 s / 2 MB.
- Phases: 0 proposal ✔ → 1 cleanup & theme ✔ → 2 Supabase backend ✔ → 3 features one by one (friends →
  voice DMs → daily post + feed lock → 24 h feed → calendar → notifications → report/block; each with a 2–3 line
  test plan, then stop) → 4 hardening/release.
- Open questions: final app name (still "Courtsie"; icon/splash/offline page are still orange → redo with it).

## Architecture
- **Capacitor 8.5.2** (SPM) iOS shell loading the hosted web app (`server.url` = `CAP_SERVER_URL` from `.env`,
  `CAP_APP_ID` default `gr.innera.courtsie`). Plugins: `@capacitor/app`, `@capacitor/splash-screen`, `@capacitor/local-notifications`.
  `ios/` committed; `ios/App/App/capacitor.config.json` and `public/` git-ignored. `bun run ios:sync` / `ios:open`.
  Info.plist: mic string, camera/photo strings, `courtsie` URL scheme, `UIUserInterfaceStyle=Dark`,
  `ITSAppUsesNonExemptEncryption=false`. Web view background `#000`. Offline page `capacitor/www/offline.html`.
- **Web app**: TanStack Start (React 19, SSR, file routes), Vite 8, Tailwind 4, shadcn/Radix, vaul Drawer,
  TanStack Query, i18next (el/en), Bun. Hosted as Cloudflare Worker `courtsie` (nitro; `wrangler.jsonc` vars
  `SUPABASE_URL`, `SUPABASE_PROJECT_ID`; secrets `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
  **LIVE: https://courtsie.vasilis-har.workers.dev** (account subdomain `vasilis-har`).
- `src/lib/native.ts`: `isNativeApp()`, `authRedirectUrl()` (→ `courtsie://app/<path>` in the app),
  `initNativeShell()` (html.native-app, deep links, splash). Supabase client: PKCE in the app, implicit on web.
- Server functions: only `src/lib/api/account.functions.ts` (`deleteMyAccount`: removes `avatars/<uid>/` and
  `daily-posts/<uid>/`, then `auth.admin.deleteUser` → cascades). Everything else talks to Supabase RPCs
  directly with the anon key + user JWT.
- Security headers: `src/lib/security-headers.server.ts` (CSP incl. `media-src`, Permissions-Policy
  `microphone=(self)`, HSTS, X-Frame DENY, COOP, no-store on server fns). Summary: `docs/security.md`.

## UI (BeReal-like, from the user's reference screenshots; dark only)
- Theme in ONE file `src/design-system.css`: black bg, white text, `bg-primary` = white (black text),
  `bg-secondary #2c2c2e` pills, grey text `#8e8e93`, `--coral #e4571c` small accent (recording), `--badge` red.
  System font (SF Pro on iPhone). `<html class="dark">` always; no theme toggle. Buttons/inputs rounded pills.
- `BottomNav`: floating pill with labels — Home `/`, Friends `/friends`, white mic circle `/record`,
  Memories `/memories` (segmented pill Memories | Calendar, `?view=calendar`), Profile (avatar initial).
- `AppHeader` (`src/components/app-header.tsx`): centered `Wordmark` ("Courtsie.") or title, `back`, left/right
  slots, `HeaderPill`; Home's right pill = paper-plane → `/messages` + bell → `/notifications`.
  Profile ⚙︎ → `SettingsSheet` (language, contact/terms/privacy, sign out, delete account).
- `EmptyState`: icon or bold title + one line + optional white pill button.
- Routes: public `/auth`, `/forgot-password`, `/reset-password`, `/contact`, `/terms`, `/privacy`; everything
  else under `src/routes/_authenticated/` (ssr: false, redirects to `/auth`).
- i18n keys: `tabs.*`, `feed.*`, `friends.*`, `record.*`, `memories.*`, `messages.*`, `notificationsPage.*`
  (old locale keys still present; prune in Phase 4). Sign-up requires accepting Terms (guideline 1.2).
- UX principles: one primary action per screen; secondary actions in a sheet; no duplicated info; empty
  states = one icon/title + one short line; short neutral Greek copy.

## Phase 3 progress
- **Friends ✔** — `src/lib/friends.ts` (RPC wrappers, `friendKeys`, `rpcErrorKey` → `rpcErrors.*`),
  `useMyProfile`, `UserAvatar`, `components/friends/PersonRow + PillButton + PersonActionsSheet` (remove /
  report / block, destructive steps confirmed in the sheet). `/friends`: username search (debounced, ≥ 2 chars,
  Add / Cancel / Accept), sections Requests (Accept + ✕), My friends (n), Pending; realtime on `friendships`;
  "Your username" share row (Web Share, clipboard fallback). Profile: name + @username + Edit sheet (name,
  username with format/uniqueness errors). Toasts: dark, top-center. Usernames IG-style (`maria.papadopoulou`).
- **Voice DMs ✔** — `src/lib/audio.ts` (recorder mime pick, base64, shared `<audio>` `player` with `prime()` called
  synchronously in the tap so iOS allows playback after the async RPC; plays with the silent switch on),
  `useRecorder(maxMs)` (MediaRecorder, 64 kbps, auto-stop), `src/lib/voice.ts` (threads, thread query, send,
  consume). `RealtimeSync` in root (friendships + voice_messages → invalidate). `/messages` (threads, unheard dot,
  ✎ → `FriendPickerSheet`), `/messages/$userId` (bubbles: orange "Tap to listen · once" → plays once → "Listened";
  mine: Sent / Opened / Expired; `RecordBar`: tap record → stop → preview/delete/send; friends-only notice).
  BottomNav hidden inside a thread. Unheard badge on the Home paper-plane. Migrations `20261004100000` (DM ≤ 2 MB)
  and `20261004100100` (search ignores dots/underscores). Browser test: Chromium fake mic, two users.
- **Daily voice post + feed lock ✔** — `src/lib/daily.ts` (today, feed, `publishDaily` = upload to
  `daily-posts/<uid>/<ts>.<ext>` then RPC, file removed if the RPC fails; `deleteDaily`; `fetchPostAudio` via
  signed URL). `/record`: big mic with 90 s progress ring → review (play / Retake / Post) → back Home with toast;
  if already posted: your card + "Delete" (tap twice) so you can re-record. Home: locked banner ("Share yours to
  hear your friends") + `PostCard`s (blurred `Waveform` + lock while locked; play/pause with progress; "late"
  label); own post first. Realtime also on `daily_posts`. Local proxy now emulates Storage with RLS
  (upload/sign/delete through PostgREST on `storage.objects`, bytes in scratchpad `storage-files/`).
- **24 h feed + Memories ✔** — `ClipPlayer` (`components/voice/clip-player.tsx`: play/pause + `Waveform` +
  duration, one clip at a time, `locked` blur) used by `PostCard` (now with a "22h left" chip) and memories.
  `useNow` / `splitDuration` (`hooks/use-now.ts`) for countdowns; `/record` posted state shows "Next voice in …".
  `RealtimeSync` also sets a timer for `today.next_prompt_at` → invalidates `daily` (feed re-locks); feed
  refetches every 5 min. `/memories` (`src/lib/memories.ts`, own `daily_posts` by moment): list = month sections
  with 3-column day tiles; calendar = Monday-first month grid, filled days, prev/next limited to your range,
  "n voices" per month; `MemorySheet` = date, time, late, `ClipPlayer`, delete (tap twice). Greek month titles use
  a nominative list (Intl gives the genitive).
- **Notifications ✔** — `@capacitor/local-notifications` 8.3.1 (iOS rebuild needed). `src/lib/prompt-notifications.ts`:
  `syncDailyPrompts()` cancels our pending ids (moment as yyyymmdd) and schedules the next 30 `prompt_schedule`
  times (title/body from i18n `prompt.*`, extra.route `/record`); permission asked right after the first post
  (`record.tsx`) or from Settings → "Daily reminder" switch (`DailyPromptSwitch`, app only; localStorage
  `courtsie:dailyPrompt`). `DailyPromptScheduler` (root): sync on start / app resume / language change, cancel on
  sign-out, tap → `/record`. `RealtimeSync`: in-app notice at the prompt time (once per prompt; no notice if the
  time had already passed on load, clock skew) + realtime on `notifications`. Bell: `/notifications`
  (`src/lib/notifications.ts`; friend_request with inline Accept, friend_accepted; opening marks all read) and
  unread badge. Toasts sit below the header (`offset` + `mobileOffset`).
- **Report / block ✔** — `PersonActionsSheet` is the single UGC sheet: menu (remove friend when no `report`
  target, Report, Block) → reasons (`REPORT_REASONS`: spam, harassment, hate, sexual, violence, other → stored as
  the key in `reports.reason`) → thanks ("reviewed within 24 h") with "Block" / "Done"; block confirmed.
  `report` prop targets a post (`daily_post`) or the latest incoming voice message (`voice_message`), else the user.
  Entry points: ⋯ on friends' `PostCard`s, ⋯ in the conversation header (block → back to `/messages`), person rows
  in Friends. Settings → "Blocked accounts" (`BlockedSheet`, `my_blocked` + Unblock). `test_voice.sql` 65 checks.
- **Phase 3 complete.** Next: Phase 4 (hardening/release: privacy policy + Terms/EULA for voice data, prune old
  i18n keys, icon/splash, moderation notice, release checklist).

## Backend (Supabase `gqmzxxygegmlifeewbzy`) — Phase 2 done
- Baseline migration `supabase/migrations/20261003100000_voice_baseline.sql` (+ small follow-ups, applied live the same way) (drops the old schema if
  present; keeps auth.users and backfills profiles). Applied live via the Management API
  (`POST /v1/projects/<ref>/database/query`; raw Postgres ports are blocked from the container) and the
  migration history now holds only this version. Old buckets `venue-photos`/`social-media` deleted via the
  Storage API (SQL deletes on storage tables are blocked). Setup/moderation steps: `docs/supabase-setup.md`.
- Tables (RLS on all): `profiles` (username `^[a-z0-9._]{3,20}$`, auto-generated Greek→Latin; clients may update
  only username/full_name/avatar_path), `friendships` (user_a < user_b, pending/accepted), `blocks`,
  `notifications` (friend_request/friend_accepted; client may set read_at), `voice_messages` (tombstone
  rows: opened_at / expired_at), `daily_posts` (one per `moment`; `late` = > 2 min after the prompt),
  `reports` (no client access). Private: `private.voice_message_audio` (bytea), `private.rate_events`.
- **Moment** = date of the latest fired prompt; `private.prompt_at(d)` = 10:00 Athens + md5(date) % 660 min.
- RPCs: `search_users`, `my_friends`, `send_friend_request` (mutual → friends), `accept_friend_request`,
  `remove_friend` (decline/cancel/unfriend), `block_user`, `unblock_user`, `my_blocked`,
  `send_voice_message(p_to, p_audio_b64, p_mime, p_duration_ms)`, `consume_voice_message(p_id)` (returns
  base64 once and deletes the bytes in the same transaction), `my_threads`, `today`, `prompt_schedule`,
  `publish_daily_post(p_path, p_mime, p_duration_ms)` (after uploading to `daily-posts/<uid>/…`), `feed`
  (friends' posts < 24 h; `audio_path` null while locked), `report_content(kind, target, reason)`.
- Storage: `daily-posts` private; a friend's file is readable (signed URL) only if the post is < 24 h old and
  the reader posted in the current moment (enforced by the storage policy). `avatars` public by URL, not listable.
- Realtime: voice_messages, friendships, notifications, daily_posts. pg_cron `expire-voice-messages` hourly.
- Types: `src/integrations/supabase/types.ts` regenerated from the live schema
  (`GET /v1/projects/<ref>/types/typescript`). Regenerate after every schema change.
- Verified live with two temporary users (friends, listen-once, storage lock/unlock, signed URL) — all pass.

## Credentials / deploy
- The user pasted Supabase + Cloudflare credentials in chat; they are only in the session scratchpad
  (`deploy.env`, chmod 600) and must be rotated after testing. Never commit them.
- Deploy from the container: build with `VITE_SUPABASE_URL/PUBLISHABLE_KEY/PROJECT_ID`, check the client bundle
  has no service key, `npx wrangler deploy` (CLOUDFLARE_API_TOKEN + ACCOUNT_ID).
- On the Mac: `bun run deploy:all` (`scripts/deploy-all.sh`, bash 3.2-safe; db push, build, deploy, secrets,
  Auth settings, `.env`, `ios:sync` + `ios:open`). Auth: site_url + redirect URLs (`<url>/**`, `courtsie://**`),
  min password 8, confirm email, secure email change, token rotation. Custom SMTP needed before real users.
- Contact: vasilis.har@gmail.com / 698 751 4868 (`src/lib/contact.ts`). Privacy Policy (GDPR, el + en) in
  `legal.privacy` — must be rewritten for voice data in Phase 4. Open: `CONTACT_CONTROLLER` (name/ΑΦΜ), Terms/EULA.
- The user runs the app on an iPhone 17 Pro with Xcode 26.3 and a free Apple ID (7-day signing).

## Local testing (no Docker in the container)
- Postgres 16 cluster `/var/lib/postgresql/courtsie-test`, start it with
  `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/courtsie-test -o '-p 54329 -k /tmp' -l /tmp/pg.log start"`
  (without `-o` it comes up on 5432). Then
  `PGHOST=/tmp PGPORT=54329 PGUSER=postgres bash supabase/tests/run.sh` → `test_voice.sql` (65 checks).
  `supabase_stubs.sql` fakes auth/storage/realtime + roles; tests switch users with `request.jwt.claims`.
- UI screenshots: build with `VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<local anon
  jwt>`, run `wrangler dev` (scratchpad `serve.sh <port>`), Playwright with the pre-installed Chromium, session
  injected into localStorage `sb-127-auth-token`. Chromium can't trust the proxy CA → check the live site with curl.
