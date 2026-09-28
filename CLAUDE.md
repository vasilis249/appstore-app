# Courtsie → iOS — project notes

Persistent findings for Claude sessions. Reply to the user in Greek; code, comments and file names in English.
Work in phases; stop after each phase for the user's "OK".

## Status
- Phase 0 (audit): done. Waiting for approach choice (A native SwiftUI / B Capacitor).
- Source of the web app is NOT in this repo yet — it came as an uploaded zip
  (`Courtsie__Your_Next_Game_Awaits.zip`, a Lovable export). Extract it excluding
  `node_modules`, images and `bun.lock` before working on it.

## Web app stack (source zip)
- TanStack Start (React 19, SSR, file routes in `src/routes`), Vite 8, Tailwind 4, shadcn/ui (Radix),
  TanStack Query, react-hook-form + zod, i18next (el/en), date-fns, recharts. Bun. Built by Lovable,
  deployed as a Cloudflare Worker (nitro).
- ~96 server functions (`createServerFn`) in `src/lib/api/*.functions.ts`. Many use
  `supabaseAdmin` (service_role, server-only, `src/integrations/supabase/client.server.ts`) and do
  their own authz (`assertAdmin`, `assertOwnerOfVenue`). The client never talks to these tables for
  writes directly in most flows — **the web server is part of the backend**.
- Server route: `src/routes/api/public/translate.ts` (DeepL proxy with `translations_cache`, rate-limited).

## Routes
Public: `/`, `/venues`, `/venues/$venueId`, `/open-games`, `/auth`, `/forgot-password`,
`/reset-password`, `/contact`, `/help`, `/privacy`, `/terms`.
Authenticated: `/book/$venueId`, `/booking/$bookingId`, `/bookings`, `/profile`, `/community`,
`/community/messages` (chat).
Owner: `/owner` (dashboard), `/owner/venues`, `/owner/venues/$venueId`, `/owner/hours`,
`/owner/pricing`, `/owner/bookings`, `/owner/players/$playerId`, `/owner/reports`, `/owner/settings`.
Admin: `/admin`, `/admin/users`, `/admin/venues`, `/admin/reports`.

## Supabase (old project ref `gfzopoagilepwznmorfo`)
- Keys: env vars only (`.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`; server-only
  `SUPABASE_SERVICE_ROLE_KEY`, `DEEPL_API_KEY`, `GOOGLE_MAPS_API_KEY`. No hardcoded keys found.
- Auth: email + password only (signUp, signInWithPassword, resetPasswordForEmail, updateUser,
  exchangeCodeForSession). No OAuth providers. Redirects: `${origin}/` (signup), `${origin}/reset-password`.
- Migrations: 63 files in `supabase/migrations` (~3060 lines) — schema is fully in the repo.
- Tables (24, RLS enabled on all): venues, venue_hours, venue_photos, venue_equipment, courts,
  court_slots, court_pricing, court_closures, bookings, booking_equipment, open_games,
  open_game_players, profiles, player_contact_info, user_roles, reviews, friendships, user_blocks,
  conversations, conversation_members, messages, message_reports, notifications, translations_cache.
- Enums: sport (padel, tennis, basketball, football, volleyball, beach_volley), booking_type
  (online, phone, closed), booking_status (pending, confirmed, cancelled, completed),
  app_role (admin, owner, coach, player), player_level.
- RPCs used by client: `create_slot_booking`, `create_whole_booking`, `join_open_game`, `has_role`.
  Other functions: triggers for notifications, `handle_new_user`, `recalc_player_rating`,
  `increment_games_played`, `is_conversation_member/admin`, `get_owner_player_profile`.
- Double-booking: `EXCLUDE USING gist` on bookings (court_id =, time range &&, status <> cancelled)
  + btree_gist. Server-side, good.
- Realtime: messages, notifications, court_closures, open_games, open_game_players, venue_photos, venues.
- Storage buckets: `avatars` (path `{user_id}/...`), `venue-photos`. Policies are in migrations but
  **bucket creation is not** — must be created in the new project.
- Seed in migrations: sample venues/courts + a `user_roles` insert (hardcoded user id from old project).
- No edge functions. In-app notifications only (table + triggers); no push, no transactional email
  besides Supabase Auth emails.

## External services
- Google Maps JS API (key served by `getMapsApiKey` server fn; referrer-restricted).
- DeepL (translation of user text, server-side).
- No payments.

## New Supabase project
- URL: https://gqmzxxygegmlifeewbzy.supabase.co (ref `gqmzxxygegmlifeewbzy`).
- Client must only use the anon/publishable key; service_role stays on the server/edge only.
