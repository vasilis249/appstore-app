# Test plan and App Store release checklist

Prerequisites: `docs/supabase-setup.md` and `docs/ios-setup.md` done (schema pushed, web app
deployed with secrets, `courtsie://**` in Supabase redirect URLs, app running from Xcode).

## Part A — Feature tests inside the iOS app

Run on the simulator first, then on a real iPhone (camera, deep links and push behave differently).

| # | Feature | How to test | Expected |
|---|---|---|---|
| 1 | Launch / splash | Cold start the app | Petrol splash with logo, then home page; no white flash, header below the notch, bottom nav above the home indicator |
| 2 | Sign up | Sign up → the terms checkbox must be ticked → open the confirmation email **on the iPhone** (Mail app) | Link asks to open Courtsie, app opens signed in |
| 3 | Sign in / out | Sign in, kill the app, reopen | Still signed in; sign out works |
| 4 | Reset password | "Forgot password" → email on the iPhone → link | App opens on the reset page, new password works |
| 5 | Venues list + map | Venues tab, open a venue, map, photos | List loads, map renders (needs `GOOGLE_MAPS_API_KEY` + referrer = your workers.dev URL) |
| 6 | Availability | Book → pick date/court | Slots load; closed hours/closures not offered |
| 7 | Create booking | Book a slot | Success; a second phone/user cannot book the same court/time (server rejects) |
| 8 | Cancel booking | My bookings → cancel | Status "cancelled"; owner gets a notification |
| 9 | My bookings realtime | Keep "My bookings" open, cancel from the web on another device | List updates without refresh |
| 10 | Open games | Create a slot game, join from a second account | Player count updates |
| 11 | Profile photo | Profile → camera icon → Take Photo and Photo Library | Permission prompt with our text, upload works (≤ 5 MB) |
| 12 | Community / chat | Send a message, report it, block a user | Realtime delivery; report and block work |
| 13 | Owner | Make an owner account (`role` owner at sign-up) → create venue, hours, pricing, upload venue photo, phone booking | All save; admin approves the venue (`/admin/venues`) |
| 14 | Admin | Grant yourself admin (SQL in supabase-setup.md) → `/admin` | Stats, users, venues, reports load |
| 15 | Notifications bell | Book at an owner's venue | Owner's bell shows it in realtime |
| 16 | Offline | Airplane mode → cold start | Offline page; "Try again" reloads once online. Going offline inside the app shows the red banner |
| 17 | Delete account | Profile → Delete account → confirm | Signed out; the user no longer exists in Supabase → Authentication → Users; future bookings cancelled |
| 18 | External links | Venue directions / phone links | Open in Maps / Phone / Safari, not inside the app |

If something fails, note the step number and what you saw (a screenshot helps), and it can be fixed in a
follow-up session.

## Part B — Before the first TestFlight build

- [ ] **Remove demo data** (8 fake venues from the seed migration), in the Supabase SQL editor:
  ```sql
  delete from public.venues
  where owner_id is null
    and name in ('Padel Point Glyfada','Acropolis Padel Club','Athens Tennis Academy',
                 'Vouliagmeni Tennis Club','Hoops Court Kallithea','Piraeus Street Ball',
                 'Goal! 5x5 Peristeri','Marina Soccer Arena');
  ```
- [ ] **Contact details and legal pages belong to the previous operator**: `src/lib/contact.ts`
  (BookWithCourtsie@gmail.com, phone) and the Terms / Privacy texts in `src/i18n/locales/*.json`
  (`legal.*`). Replace with your own company, email, phone and data-controller details.
- [ ] Custom SMTP set up in Supabase (otherwise confirmation emails stop after a few per hour).
- [ ] Optional: custom domain for the Worker (Cloudflare → Workers → courtsie → Domains); then update
  `CAP_SERVER_URL`, Supabase Site URL/Redirect URLs and the Maps key referrer.
- [ ] `.env` `CAP_SERVER_URL` points to production (not a LAN dev URL) → `bun run ios:sync`.

## Part C — Apple Developer / App Store Connect

1. Enroll in the **Apple Developer Program** (99 USD/year) with the account that will own the app.
2. developer.apple.com → Identifiers → register the Bundle ID (`gr.innera.courtsie` or yours).
3. App Store Connect → My Apps → **+ New App**: platform iOS, name "Courtsie" (must be unique on the
   store), primary language Greek, the Bundle ID, SKU (any, e.g. `courtsie-ios`).
4. Xcode: target App → General → **Version** (e.g. 1.0.0) and **Build** (1, increase every upload).
5. Xcode: select **Any iOS Device (arm64)** → Product → **Archive** → Distribute App →
   **App Store Connect** → Upload.
6. App Store Connect → TestFlight: the build appears after processing (~10–30 min). Internal testers
   (your team) can install right away through the TestFlight app; external testers need a short beta review.

## Part D — App Store review requirements (what Apple checks for this app)

- [x] **Account deletion in the app** (5.1.1(v)) — Profile / Owner settings → Delete account.
- [x] **User-generated content** (1.2) — terms accepted at sign-up, report message/conversation,
  block user. You must act on reports (admin → reports) within 24h.
- [x] **No third-party login**, so Sign in with Apple is not required.
- [x] Permission texts for camera and photos in `Info.plist`; no location permission requested.
- [x] Export compliance: `ITSAppUsesNonExemptEncryption = NO` (HTTPS only) — no questionnaire per build.
- [ ] **Minimum functionality (4.2)** — the biggest risk for a web-wrapper app. Mitigations in place:
  native splash, offline screen, deep links, native camera/photo picker, safe-area layout, no website
  chrome. Adding **push notifications** for bookings would strengthen it further (optional next step).
- [ ] **Demo account for the reviewer**: in App Store Connect → App Review Information, give a player
  login and (ideally) an owner login with a venue that has bookable courts, plus a note:
  "Court booking app for Greek sports venues. Sign in with the demo account to book a court."
- [ ] **Privacy policy URL** (required): `https://<your-domain>/privacy`.
- [ ] **App Privacy (nutrition labels)**: data collected — Contact info (email, name, phone),
  User content (messages, photos, reviews), Identifiers (user ID), Usage data if you add analytics.
  Linked to the user, not used for tracking.
- [ ] Support URL (`https://<your-domain>/contact`), age rating questionnaire (user-generated content /
  unrestricted web access → likely 12+ or 17+ depending on answers), category Sports.
- [ ] Screenshots: 6.9" (e.g. iPhone 16 Pro Max simulator, ⌘S in Simulator saves one) — at least 1,
  ideally 3–5; 13" iPad only if you keep iPad support (Xcode → General → Supported Destinations;
  remove iPad to skip iPad screenshots).
- [ ] Description, keywords, promotional text in Greek (and English if you add the localization).
