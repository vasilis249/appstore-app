# Speak — test plan and App Store release checklist

Prerequisites: `docs/supabase-setup.md` and `docs/ios-setup.md` done (migrations applied, web app deployed
with secrets, `courtsie://**` in Supabase redirect URLs, app running from Xcode after `bun run ios:sync`).
Use two accounts (A and B) on two devices or one device + the website.

## Part A — Feature tests inside the iOS app

| # | Feature | How to test | Expected |
|---|---|---|---|
| 1 | Launch | Cold start | Splash with the Speak mark, then Home; no white flash; header below the notch, nav above the home indicator |
| 2 | Sign up | Create account → name → email (`name@gmial.com` first) → password → username | One question per screen, Continue above the keyboard; "Μήπως εννοείς …@gmail.com;" hint; ends on Home (with SMTP: after the email link) |
| 2b | Google / Apple | Welcome → Continue with Google (once enabled in Supabase) | Safari sheet opens, then closes back in the app signed in; a new account gets the username step |
| 3 | Sign in / out | Sign in, kill the app, reopen; then sign out | Still signed in; sign out returns to /auth |
| 4 | Reset password | "Forgot password" (needs SMTP) → link on the iPhone | App opens on the reset page, new password works |
| 5 | Post a voice | Mic tab → record ≤ 2:00 (mic prompt with our text) → title → section → Post | Appears on For you / section / profile; plays with the silent switch on |
| 6 | Continuous playback | "Play all" on a section or topic, lock the phone | Next voice starts by itself; lock-screen controls work; keeps playing in the background |
| 7 | Like / reply / repost / quote | B likes, replies with voice, reposts and quotes A's voice | Counters update; A gets 4 notifications; thread view shows the reply chain |
| 8 | Topics + news | Home → trending topic → "Give your take"; admin: Settings → Manage topics → Refresh | Topic page lists takes; news headlines link to the source in Safari |
| 9 | Daily topic reminder | Settings → Daily reminder ON (permission prompt) | Local notification at the day's time opens the topic |
| 10 | Follow + search | Search B by name/@username → Follow; B follows back | Counts update; "Message" appears only when mutual |
| 11 | Voice DM (listen once) | A sends B a voice message; B plays it; B tries again | Plays once, then "Listened"; A sees "Opened" |
| 12 | Report + block | B → ⋯ on A's voice → Report (reason) → Block | Thanks sheet ("within 24 h"); A's content disappears for B; A can't message B |
| 13 | Moderation | Admin: bell shows "New reports to review" → Settings → Reports → play → Hide voice / Ban / Dismiss; History → Restore | Hidden voice disappears for everyone; banned account can't use the app; undo works |
| 14 | Profile | Profile → Edit → Change photo (camera + library prompts), name, @username | Saved; new photo shows on posts |
| 15 | Memories | Profile → Memories / Calendar | Own voices grouped by day |
| 16 | Offline | Airplane mode → cold start | Offline page; "Try again" reloads once online |
| 17 | Delete account | Profile → ⚙︎ → Delete account → confirm | Signed out; the user, their voices and files are gone (Supabase → Auth users, Storage → voices) |
| 18 | Legal | Settings → Terms / Privacy | Speak texts (voice data, zero tolerance, Apple terms) in el and en |
| 19 | Groups | Create a private group → invite B (mutual follow) → B accepts → both post; C asks to join → approve | Only members hear the voices; roles and requests work |
| 20 | Student verification | Profile → "Επιβεβαίωσε ότι είσαι φοιτητής" → your academic email (e.g. …@mail.ntua.gr, …@uoa.gr) → code from the email → department → year | The university is recognised while typing; code arrives within a minute (check spam); profile shows "ΕΚΠΑ · τμήμα" |
| 21 | Campus | Verified student → Home opens on your university tab → "Πες κάτι στο campus…" | Only students of that university hear it; school/year groups appear under Groups |
| 22 | Invite link | Search → "Κάλεσε φίλους" → open the link signed out on another device → sign up | The new account and you follow each other; you get a notification |
| 23 | Walkie live | A and B follow each other. A: Messages → 📡 → B → hold the big button and talk; B has the same screen open | B hears A **while A is still talking**; one speaker at a time; both see it under "Τελευταίες 24 ώρες" |
| 24 | Walkie anywhere | B: 📡 list → B's switch "Κανάλι" for A ON → go to Home. A talks | On B's Home an orange banner "A σου μιλάει" + live voice; tap → A's walkie. Try with the silent switch on and with headphones |
| 25 | Walkie missed | B closes the app, A talks | B gets a notification "σου μίλησε στο walkie-talkie" (bell); the 📡 button shows 1; replay works |
| 26 | Walkie background (experimental) | B: 📡 list → "Και με κλειστή οθόνη" ON → lock the phone, A talks | Report what happens: voice heard / local notification / nothing (iOS may suspend the app) |

If something fails, note the step number and what you saw (a screenshot helps).

## Part B — Before the first TestFlight build

- [x] Moderation in the app (reports queue, auto-hide after 3 reporters, ban, undo), Terms/EULA with zero
  tolerance + Apple clauses, Privacy Policy for voice data (el + en), unused texts pruned.
- [ ] **Logo**: run `node resources/render-assets.mjs path/to/logo.svg` (or `logo.png --full` for a ready icon,
  `--bg "#hex"` for the background) → writes the icon + splash into Xcode; update the favicon in
  `src/routes/__root.tsx`. Until then a placeholder mark (voice bars) is used.
- [x] **Custom SMTP**: Brevo (2026-09-30) for auth emails + the Brevo API for student codes.
- [ ] Check deliverability ("Forgot password" to a Gmail and an academic address; not in spam), then turn **Confirm
  email ON**. Better: a sender on your own domain authenticated in Brevo (SPF/DKIM) instead of the Gmail
  address. Optionally translate the email templates (Supabase → Authentication → Emails) and put "Speak" in them.
- [ ] `CONTACT_CONTROLLER` in `src/lib/contact.ts` = your full name, or company name + ΑΦΜ (GDPR needs the
  controller's identity; it appears in the Terms and the Privacy Policy). Have both texts reviewed.
- [ ] Supabase project region (Settings → General): an EU region keeps the data in the EEA; otherwise the
  "Transfers outside the EEA" section already covers it.
- [ ] Rotate the Supabase keys, DB password, access token and Cloudflare token that were shared during
  development; update the Worker secrets and `.env`.
- [ ] Optional: custom domain for the Worker; then update `CAP_SERVER_URL`, Supabase Site URL/Redirect URLs.
- [ ] `.env` `CAP_SERVER_URL` points to production (not a LAN dev URL) → `bun run ios:sync`.
- [ ] Storage: 1 GB free on Supabase ≈ 1,000–2,000 two-minute voices. Watch Settings → Usage; move audio to
  Cloudflare R2 before it fills.

## Part C — Apple Developer / App Store Connect

1. Enroll in the **Apple Developer Program** (99 USD/year) — required for TestFlight and the App Store.
2. developer.apple.com → Identifiers → register the Bundle ID (`gr.innera.courtsie` or a new one such as
   `gr.innera.speak`; if you change it, update `CAP_APP_ID`, `ios:sync` and Xcode).
3. App Store Connect → My Apps → **+ New App**: iOS, name "Speak" (must be unique on the store — have a
   fallback like "Speak — Φωνή"), primary language Greek, the Bundle ID, SKU (e.g. `speak-ios`).
4. Xcode: target App → General → **Version** (1.0.0) and **Build** (1, increase every upload).
5. Xcode: **Any iOS Device (arm64)** → Product → **Archive** → Distribute App → **App Store Connect** → Upload.
6. TestFlight: the build appears after processing (~10–30 min); internal testers install via TestFlight.

## Part D — App Store review requirements (what Apple checks for this app)

- [x] **Account deletion in the app** (5.1.1(v)) — Profile → ⚙︎ → Delete account (removes voices and files).
- [x] **User-generated content** (1.2): Terms accepted at sign-up with zero tolerance for objectionable
  content; report on every voice, profile and conversation; block; admins act on reports within 24 h in the
  app; offending users can be banned. Mention this in the review notes.
- [ ] **Sign in with Apple (4.8)**: required as soon as Google sign-in is offered. Needs the Developer Program →
  create the Services ID/key and enable Apple in Supabase (see `supabase-setup.md` → Social login).
- [x] Permission texts: microphone (recording and walkie-talkie), camera + photo library (profile photo). Local
  notifications ask at runtime. `UIBackgroundModes audio` is used for continuous playback and for hearing
  walkie-talkie friends — say so in the review notes. The experimental "screen off" walkie option plays a silent
  loop to stay awake; Apple may object (2.5.4) — if review complains, remove that switch (it is opt-in and off by
  default) or move walkie to Apple's PushToTalk framework.
- [x] Export compliance: `ITSAppUsesNonExemptEncryption = NO` (HTTPS only).
- [ ] **Minimum functionality (4.2)** — the main risk for an app that loads a website. In place: native
  splash, offline page, deep links, microphone recording, background audio with lock-screen controls, local
  notifications, safe-area layout, no browser chrome. Describe these in the review notes.
- [ ] **Demo account for the reviewer**: App Store Connect → App Review Information → an account that follows a
  few people, with some voices, a topic and one mutual follow (for DMs). Note: "Speak is a voice social
  network: post short voice takes on news topics, listen back-to-back, reply with your voice. Microphone is
  used only when you tap record or hold the walkie-talkie button; background audio plays the queue when the
  screen is locked and lets you hear a friend's walkie-talkie. Student features need a university email: use the
  demo account, already verified."
- [ ] **Age rating**: user-generated content with unrestricted communication → answer the questionnaire
  honestly (expect 16+/18+ with the new ratings); the Terms say 15+ for GDPR, the store rating may be higher.
- [ ] **Privacy policy URL**: `https://<your-domain>/privacy`; **Support URL**: `https://<your-domain>/contact`.
- [ ] **App Privacy (nutrition labels)** — all "Linked to you", none "Used to track you":
  Contact info (email, name) · User content (audio data — voices and voice messages, photos, other user
  content such as titles) · Identifiers (user ID) · Usage data (product interaction: likes, listens, follows)
  · Other data (optional: university, department, year of study) · Diagnostics: none. No location, contacts,
  payments or analytics. The academic email is not stored (only a hash, to allow one account per address).
- [ ] Screenshots (6.9" iPhone): For you, a topic page, the recorder, a thread, a profile.
