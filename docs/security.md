# Security model (Courtsie)

Short reference for whoever maintains the app. Tests for every rule below live in the
local SQL suites (`test_bookings`, `test_social`, `test_dm`, `test_security`; 87 checks).

## Keys
- The browser/app only ever gets the **anon/publishable** key (`VITE_*`, baked in at build).
- `SUPABASE_SERVICE_ROLE_KEY`, `DEEPL_API_KEY`, `GOOGLE_MAPS_API_KEY` are Cloudflare Worker
  secrets (`wrangler secret put`), read only in `*.server.ts` / server functions. The build is
  checked for leaks (grep the client bundle for the service key before a release).

## Database (Supabase)
- RLS is enabled on every table. Clients write directly only where a policy allows it, and
  sensitive columns are protected by triggers that run for end-user requests
  (JWT role `authenticated`); the web server (service role) is trusted.
- **Bookings**: exclusion constraint (no overlaps) + advisory locks in the RPCs; a player can
  only book an approved venue, an existing slot of that court/weekday with its duration,
  outside closures, at most 180 days ahead (`bookings_validate_player`); players can only
  cancel their own booking (`bookings_guard_player_writes`).
- **Venues**: only owners create them; `approved`, `rating`, `reviews_count`, `owner_id`
  change only by admins (`venues_guard`).
- **Open games**: joining only via `join_open_game()` (capacity, not started, not cancelled,
  not blocked); a game must belong to a real booking of the host; size capped per sport.
- **Reviews**: only between two players of the same finished game, one per game.
- **Profiles**: rating / games played / disabled are system-managed.
- **Social**: visibility via `can_view_profile` / `can_view_post` (private accounts, blocks);
  follows only through RPCs; DMs: membership managed only by the server, message guard
  (blocks, 30/min, visibility of shared posts/stories), requests for strangers.
- **Helper functions** (`has_role`, `can_view_*`, `is_blocked_between`, `is_conversation_*`)
  answer only about the caller when called by an end user; the real logic lives in the
  `private` schema, which PostgREST doesn't expose.
- **Rate limits** (per user): posts 20/h, comments 15/min, stories 30/h, follows 200/h,
  reports 30/h, reviews 30/h, messages 30/min; social notifications are de-duplicated.
- **Notifications**: clients can only set `read_at`.
- **Storage**: `avatars`, `venue-photos` public by URL but not listable; `social-media`
  private (signed URLs, readable only by people who can view the profile); uploads only into
  your own folder; size and MIME limits per bucket. Photos are re-encoded on the device
  (strips EXIF/GPS).

## Web server (Cloudflare Worker)
- Every server function that needs a user uses `requireSupabaseAuth` (bearer token, so no
  CSRF via cookies) and validates input with zod; admin functions check `has_role(admin)`.
- Security headers on every response: CSP, HSTS, X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy, COOP; server-function responses are `no-store`.

## Auth (set by `scripts/deploy-all.sh`)
- Email + password, email confirmation on, min 8 characters (the app also requires a
  lowercase letter and a digit), secure email change, re-authentication to change password,
  refresh-token rotation. Signup can't self-assign `admin`.

## Before release
- `bun audit`: runtime packages clean; remaining advisories are build/dev tools only.
- Grant yourself admin with SQL after signing up (see `docs/supabase-setup.md`).
