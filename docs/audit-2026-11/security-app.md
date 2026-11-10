# Speak — application-layer security audit

Date 2026-11-10 · scope: everything except the SQL schema (Worker server functions, API route, SSR pages, client,
Edge Function, scripts, iOS shell, secrets, dependencies, privacy texts) · repo state: commit 4610a10.
Read-only: nothing in the repo was changed, nothing was sent to production. All reproductions ran against the local
stack (app :8899, emulator :54321, Postgres :54329). Scripts: `/tmp/claude-0/-home-user-appstore-app/70bd35f3-3128-521c-9aab-1890275baab1/scratchpad/audit/secapp/` (`lib.mjs` = helpers).

## Summary

| Severity | Count | IDs |
|---|---|---|
| Critical | 2 | SA-1 (fixed in the repo, NOT live yet), SA-2 |
| High | 1 | SA-3 |
| Medium | 4 | SA-4, SA-5, SA-6, SA-7 |
| Low | 8 | SA-8 … SA-15 |

Limits of the local evidence
- The emulator is not GoTrue: password sign-up, real OTP mail, captcha, rate limits and live Auth settings could not be
  exercised. Where a step depends on GoTrue behaviour it is marked UNVERIFIED.
- The local database did not contain migration `20261120100000_audit_fixes_2.sql` when I tested (old `private.me_any`,
  upload policies without `is_student`). The migration itself applies cleanly (`t1c.sql`, inside a rolled-back
  transaction). Re-seed before relying on local results for that migration.

---

## Critical

### SA-1 Pre-account hijack: a stranger's password survives the victim's first code sign-in — FIXED in the repo, not live
- **Location:** `supabase/migrations/20261107100100_student_otp_signup.sql` (`claim_student_email`), Auth setting
  `mailer_autoconfirm: true` (`scripts/deploy-all.sh:70`), fixes in `20261119100000_audit_fixes.sql` and
  `20261120100000_audit_fixes_2.sql`.
- **Attacker / impact:** anyone with the public anon key. `POST /auth/v1/signup` with a victim's academic address and a
  password of the attacker's choice (no mailbox needed while autoconfirm is on). When the real student later signs in
  with the mailed code, the SAME account becomes a verified student and the attacker's password and older session still
  open it: DMs, location settings, posting as the victim, account deletion. Addresses are guessable (`el21xxx@mail.ntua.gr`).
- **Reproduction:** `t1-prehijack.mjs` (before the fix: the pre-existing password session is a student session after the
  victim's claim). After both migrations (`t1c.sql`, rolled back): password cleared, other sessions deleted, RPCs through
  `private.me()` answer `not_allowed`. GoTrue's side (password kept after an OTP sign-in) is UNVERIFIED locally; it is
  documented GoTrue behaviour.
- **Status:** CLAUDE.md says the first migration is "NOT applied live". Until both are applied, production is exploitable.
- **Residual after the fix (Low, verified in `t1c.sql`):** the attacker's access token stays cryptographically valid until
  it expires (default 1 h). It is refused by RPCs that go through `me()` / `me_any()`, but still accepted by
  (a) RLS reads of own rows (`profiles`, `voice_messages`, `notifications`), (b) RPCs that use `auth.uid()` directly
  (`am_i_student` returned `true`), (c) the Worker's `requireSupabaseAuth` (`getClaims` verifies the signature only when
  the project uses asymmetric keys), so `deleteMyAccount` can still delete the victim's new account in that window.
- **Smallest fixes:**
  1. Apply `20261119100000` and `20261120100000` live before any public sign-up.
  2. `src/lib/api/account.functions.ts:12`, first lines of the handler:
     ```ts
     const { error: stale } = await context.supabase.auth.getUser(); // asks Auth: a revoked session is refused
     if (stale) throw new Error("Unauthorized");
     ```
  3. `scripts/deploy-all.sh:70`: delete the `else … "mailer_autoconfirm":true` branch (every run without `SMTP_*`
     switches confirmation off again).

### SA-2 TanStack Start 1.168.59: unauthenticated reflected XSS in server-function responses (GHSA-qx66-fv34-fjm8)
- **Location:** `package.json:61` (`@tanstack/react-start ^1.168.59`, installed 1.168.59; `@tanstack/start-server-core`
  1.169.38). Patched in 1.168.60 / 1.169.39. Endpoints: `/_serverFn/*` (two of the five functions are public GETs).
- **Attacker / impact:** per the vendor advisory (CVSS 9.3), a crafted link to a server function makes the app return
  attacker HTML from its own origin. Here that means: the Supabase session (access + refresh token) sits in
  `localStorage` → full account takeover from one link; CSP has `script-src 'unsafe-inline'` so it does not stop it; in
  the iOS app `courtsie://app/_serverFn/…` is turned into the same URL inside the web view (`src/lib/native.ts:28-36`),
  where the script also reaches the Capacitor bridge (location, push token) and the origin's microphone permission.
- **Reproduction:** `t7-ghsa.mjs` confirms the vulnerable primitive on the running build: extra payload fields are copied
  into the function's state — `?payload={data, result: X}` makes the server answer with the attacker's `result`
  (even next to an "Unauthorized" error, `t8-ctx.mjs`). The last step (response-shaped object returned as `text/html`)
  was NOT reproduced: the advisory publishes no PoC and my seven shapes returned JSON or the static 500 page →
  exploitability UNVERIFIED, vulnerable code path verified. `t8-ctx.mjs` also shows the injected `context.userId` does
  NOT override the auth middleware's (no authorization bypass through this bug).
- **Smallest fix:** `bun add @tanstack/react-start@^1.168.60 @tanstack/react-router@latest` (pulls start-server-core
  ≥ 1.169.39 and a fixed `seroval`, see SA-15), rebuild, deploy. Until deployed, in `src/server.ts` at the top of `fetch`
  (the advisory's own mitigation; the client always sends this header, SSR loaders call functions in-process):
  ```ts
  const p = new URL(request.url).pathname;
  if (p.startsWith("/_serverFn/") && (request.headers.get("x-tsr-serverFn") !== "true" || request.headers.get("sec-fetch-mode") === "navigate"))
    return applySecurityHeaders(new Response("Not found", { status: 404 }), request);
  ```
  and in `src/lib/security-headers.server.ts:103` for those paths also `headers.set("Content-Security-Policy", "default-src 'none'; sandbox")`.

---

## High

### SA-3 Sign-in depends on a 300-mail/day quota that anyone can burn; code mails go to arbitrary addresses
- **Location:** `src/routes/auth.tsx:72-74,102` (academic-domain check only in the UI, then `signInWithOtp` with
  `shouldCreateUser: true`), `src/routes/api.auth-email.ts:19-37` (mails whatever Auth asks), `src/lib/api/student.functions.ts:13-54`
  (any signed-in account), Brevo free plan 300 mails/day shared by both paths (CLAUDE.md).
- **Attacker / impact:** (1) unauthenticated: `POST /auth/v1/otp {"email": "<anyone>"}` with the public key → Supabase
  creates an account and the hook mails a "Speak code" to ANY address, academic or not. A few hundred calls a day
  exhaust Brevo → nobody can sign up or sign in (codes are the only way in for new accounts), and strangers get mail
  from the project's sender (reputation with university mail servers). (2) any signed-in account, including throw-away
  non-student ones: `sendStudentCode` mails any academic address, 5/hour per account, 300/day overall; accounts are free.
- **Reproduction:** `t3-studentcode.mjs` — a non-student `@gmail.com` account sent 5 code mails to 5 different
  `@mail.ntua.gr` strangers, the 6th answered `too_many`, a second throw-away account got 5 more; signed out →
  `Unauthorized`. The `/auth/v1/otp` half is by code review (no captcha token is ever passed; no server-side domain rule);
  live rate limits / captcha settings UNVERIFIED.
- **Least-effort protections (what each does / does not stop):**

  | Measure | Effort | Stops | Does not stop |
  |---|---|---|---|
  | A. Academic-domain check inside the hook (code below) | ~12 lines, Worker only | mail to non-academic addresses (bombing arbitrary people, quota burn with random addresses) | burn / bombing with made-up academic addresses (1,737 domains); the non-academic account row may still be created |
  | B. Auth "Before User Created" hook = `private.university_for_email(email) IS NOT NULL` | ~10 lines SQL + one Auth setting | non-academic accounts altogether (also the throw-away accounts used for `sendStudentCode`, the sweeper, uploads) | abuse with academic addresses |
  | C. Per-address and daily budget in the hook (small SQL counter called with the service role: ≤ 5 mails/address/day, stop new-address mails at ~250/day) | ~20 lines SQL + 3 lines Worker | repeated mail to one victim; keeps a reserve for returning students | a patient attacker spreading over many addresses still uses the daily budget |
  | D. Turnstile captcha in Supabase Auth (Auth → Bot protection; pass `options.captchaToken` in `signInWithOtp`, `signInWithPassword`, `resetPasswordForEmail`; CSP + `https://challenges.cloudflare.com` in script-src / frame-src) | client change + test in WKWebView | scripted calls to `/otp`, `/signup`, `/recover` — the paths no Worker limit can see, because the browser talks to Supabase directly | humans / captcha farms; `sendStudentCode` unless the Worker verifies a token too |
  | E. Per-IP limits | setting | Supabase's own per-IP OTP limit (lower `rate_limit_otp`) slows one host; a Cloudflare rate-limit binding can cover `sendStudentCode` | rotating IPs; a Worker limit never sees `/auth/v1/otp`; the global `rate_limit_email_sent` is itself the lever an attacker pulls |
  | F. Paid mail tier | ~€10/month | the 300/day ceiling, which launch-day sign-ups alone can hit | abuse (only makes it more expensive) |

  Recommended minimum before launch: A + B + F now, D next.
- **Code for A** — `src/routes/api.auth-email.ts`, after `JSON.parse` (line 18):
  ```ts
  if (d.email_action_type !== "recovery" && d.email_action_type !== "email_change" && !(await academic(user.email ?? "")))
    return Response.json({ error: { http_code: 422, message: "not_academic" } }, { status: 422 });
  ```
  ```ts
  async function academic(email: string): Promise<boolean> {
    const parts = (email.split("@")[1] ?? "").toLowerCase().split(".");
    const suffixes = parts.map((_, i) => parts.slice(i).join(".")).filter((s) => s.includes(".")); // mail.ntua.gr, ntua.gr
    if (!suffixes.length) return false;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("universities").select("id").overlaps("email_domains", suffixes).limit(1);
    return !!data?.length;
  }
  ```
- **For `sendStudentCode`:** in `private.student_code_issue` add a per-address cap next to the per-user one
  (`… WHERE email_hash = h AND first_sent_at > now() - interval '1 day'` ≥ 3 → `too_many`); B removes the free accounts.

---

## Medium

### SA-4 Opening an invite link silently makes a new student "friends" with the inviter
- **Location:** `src/routes/i.$code.tsx:27-29` (stores the code on page load), `src/components/invite-claimer.tsx:13-20`
  (claims on every app start), `claim_invite` (mutual follow for accounts < 7 days — at launch, everyone).
- **Attacker / impact:** any student sends their own link (`https://…/i/<code>`, or `courtsie://app/i/<code>` from any
  web page). The victim only has to open it once; no tap. Friends = text / photo / listen-once DMs, the walkie channel
  that plays the attacker's live voice on any screen (channels of all friends are always open), and the exact position
  if the victim shares with "Μόνο φίλοι".
- **Reproduction:** `t5b.mjs` — signed-in new account opens `/i/<code>` (page shows only «Συνέχεια»), then just opens `/`:
  `claim_invite` → `ok`, `follows = 2`, `private.are_friends = t`. `t5-invite.mjs`: a signed-out visitor gets the code
  stored without a tap (claimed after sign-up).
- **Smallest fix:** remember the invite only on an explicit tap, and say what it does.
  `src/routes/i.$code.tsx`: delete the `useEffect` at 27-29; add `onClick={() => rememberInvite(code.toLowerCase())}` to
  the two `<Link>`s (66, 69) and call it first in `goOn()` (32); add one line of copy such as «Θα ακολουθείτε ο ένας τον
  άλλον και θα μπορείτε να μιλάτε.» above the button.

### SA-5 Session swap (login CSRF) through tokens in the URL, also from a deep link
- **Location:** `src/routes/reset-password.tsx:56-62` (`setSession` from `#access_token&refresh_token&type=recovery`),
  `src/integrations/supabase/client.ts:29` (`implicit` flow on the web: any page accepts `#access_token=…`),
  `src/lib/native.ts:28-36` (any `courtsie://app/<path>#<hash>` is loaded).
- **Attacker / impact:** a link signs the victim's browser / app into the ATTACKER's account, replacing their own
  session. What the victim then does lands in an account the attacker can also open: voice posts and DMs they send,
  and their precise position (`my_location_sharing()` returns the account's own coordinates). Needs the victim not to
  notice the different profile — most plausible right after install.
- **Reproduction:** `t6-logincsrf.mjs` — 3/3: `/reset-password#…` signed out, the same with a victim signed in, and
  `/#access_token=…` on the web; `localStorage` then holds the attacker's session. In the app the library refuses implicit
  hashes (PKCE), so only the hand-written `/reset-password` branch is reachable there.
- **Smallest fix:** `client.ts:29` → `flowType: 'pkce'` for web too (recovery links then carry `?code=`, which the page
  already handles and which is useless without the verifier stored in the requesting browser); delete
  `reset-password.tsx:56-62`. Side effect to accept: a reset link must be opened in the browser that asked for it.

### SA-6 Service-role work can be triggered by any account, unthrottled (sweeper), and errors are passed through verbatim
- **Location:** `src/lib/api/voice-files.functions.ts:10-38`; error pass-through `throw new Error(error.message)` in every
  `src/lib/api/*.functions.ts`, `src/components/delete-account-button.tsx:41`.
- **Attacker / impact:** a non-student throw-away account can call `sweepVoiceFiles` in a loop: each call runs three
  service-role scans (`orphan_voice_files`, `orphan_dm_photos`, `orphan_course_files`, 200 rows each) plus Storage
  deletes — free database load on the 1 GB / shared-CPU project. Raw backend messages reach users and public HTML
  (the share page rendered `new Error("JWT expired")` into the document while the local key was expired).
- **Reproduction:** `t2-serverfns.mjs` — signed out → `Unauthorized`; a `@gmail.com` account with no university →
  `{removed: 0}` (ran).
- **Smallest fix:** `voice-files.functions.ts:12` → `.handler(async ({ context }) => { const { data: ok } = await context.supabase.rpc("am_i_student"); if (!ok) return { removed: 0 };`
  and move the sweep itself to `pg_cron` + one scheduled Worker call later. Errors: `throw new Error("server_error")`
  after `console.error(error)` in the five functions; `delete-account-button.tsx:41` → `toast.error(t("account.deleteFailed"))`.

### SA-7 Privacy / Terms texts that the code does not back (legal risk — for the lawyer)
Keys are in `src/i18n/locales/el.json` (the English file mirrors them).

| # | Key | Text says | Code does |
|---|---|---|---|
| 1 | `legal.privacy.sections.1.body.10` | «Δεν συλλέγουμε τοποθεσία…» | precise position incl. background (`legal.privacy.sections.4.*`, `private.user_locations`, Info.plist `UIBackgroundModes location`). Direct contradiction inside the same policy |
| 2 | `legal.privacy.sections.1.body.2`, `student.emailPrivacy` | student identity is «προαιρετική»; «το email δεν αποθηκεύεται, κρατάμε μόνο hash» | verification is mandatory (student gate); with code sign-up the academic address IS the account email, stored in `auth.users` and sent to the mail provider (`sections.1.body.11` says the opposite of 1.2) |
| 3 | `legal.privacy.sections.3.body.2` | only «αρχεία ήχου των δημόσιων φωνών» are reachable by link | the same public-by-URL bucket `voices` also holds post PHOTOS and the voices / photos of campus-only posts and PRIVATE groups; profile photos are public by URL too. A link keeps working after leaving a group or a block |
| 4 | `legal.privacy.sections.1.body.5`, `sections.3.body.2`, `legal.terms.sections.8.body.0`, `voice.threadEmpty` | voice messages are heard «μόνο από τον παραλήπτη, μία φορά» | true on the server (bytes deleted on first fetch), but the recipient's device receives the audio and can keep or re-record it; no sentence says so (the product directive asks for it) |
| 5 | `legal.privacy.sections.1.body.9` | push token «διαγράφεται όταν αποσυνδεθείς» | only the Settings sign-out removes it (`settings-sheet.tsx:40`); the sign-out after a password reset (`reset-password.tsx:113`), an expired / revoked session or a sign-out from another device leave it → pushes with message text keep arriving (SA-10) |
| 6 | `legal.privacy.sections.5.body.2` | unnamed «Πάροχος αποστολής email» for confirmation / reset mails | Brevo receives the academic address and the one-time code (the code is in the SUBJECT line) for every sign-in; name the processor and its log retention |
| 7 | `legal.privacy.sections.3.body.4` | voice messages / walkie «δεν είναι διαθέσιμα στα εργαλεία διαχείρισης» | true for the admin screens; DM texts and photos (90 days) and saved walkie / map-talk audio (24 h, kept "for replay, reports" per `docs/security.md`) are readable by the operator in the database |
| 8 | `legal.privacy.sections.12.body.0` | local storage only for the session, language, daily reminder | also: push token, pending invite code, post to open after sign-in, hint flags, walkie background preference |
| 9 | `legal.privacy.sections.3.body.5` | what a shared link shows (accurate, verified in `t4-share.mjs`) | it also applies to campus-only posts, which `docs/security.md` calls visible "only to verified students of that university"; the author cannot opt out (SA-8) |
| 10 | `legal.privacy.sections.11.body.0` | 15+ | no age check anywhere; 15–17-year-olds can show a precise position to strangers within 500 m — legal review |
| 11 | `legal.privacy.sections.8.body.1` | everything is erased at once on deletion | not covered: mail-provider logs, backups, and (new in 4610a10) `private.banned_emails` keeps a hash of a banned address |
| 12 | `ios/App/App/Info.plist` `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` | "profile photo" only | camera / library are also used for posts, DMs and course files (App Review 5.1.1) |

---

## Low

### SA-8 A classmate's share link makes a campus-only post's text public
`src/lib/api/post.functions.ts:17-39`, `src/routes/v.$postId.tsx:14-28`. Anyone holding a post id (every student who can
see it) can show first name, department, university and full text to the world, including link-preview bots (og tags).
Group posts, tombstones, hidden posts are excluded (verified); ids are random, so no enumeration. Fix if unwanted:
exclude `university_id IS NOT NULL` posts in `post_preview`, or show only "a post from <university>" for them.

### SA-9 CSP is not a defence against script injection; tokens are in `localStorage`
`src/lib/security-headers.server.ts:55` (`script-src 'self' 'unsafe-inline'`), `:46` (`img-src https:`),
`src/integrations/supabase/client.ts:24`. Not exploitable alone — no HTML sink exists in the app (see "solid") — but it
turns any future XSS (SA-2 today) into account takeover and lets it exfiltrate through `<img>`. Fix when the framework
exposes a nonce; until then keep SA-2's `/_serverFn` CSP.

### SA-10 Push token survives sign-outs other than the Settings one
`src/lib/push.ts:66-69` is called only from `settings-sheet.tsx:40`. After `reset-password.tsx:113`, a revoked session or
a global sign-out elsewhere, the device keeps receiving that account's pushes (DM text previews). Fix: call
`forgetPushToken()` before `signOut()` in `reset-password.tsx:113`; server side, drop a user's tokens when their sessions
are deleted (same place as the SA-1 cleanup).

### SA-11 `deleteMyAccount` trusts a signature-only token and reports raw errors
`src/lib/api/account.functions.ts:10-31`. See SA-1 residual (2-line `getUser()` fix). Also: if `deleteUser` fails after
the files are removed, the account stays with broken media — acceptable, but log it.

### SA-12 `deploy-all.sh` weakens Auth on every run and puts the SMTP password on a command line
`scripts/deploy-all.sh:66-76`: without `SMTP_*` it sets `mailer_autoconfirm: true`; it never sets the send-email hook,
OTP length / expiry or `SEND_EMAIL_HOOK_SECRET`, so a fresh run leaves a different configuration from the one described
in CLAUDE.md; `smtp_pass` goes into `curl -d` (visible in `ps`). Fix: drop the autoconfirm branch, send the JSON with
`--data @-` from stdin.

### SA-13 Edge Function `push`: plain string comparison of the shared secret, JWT verification off
`supabase/functions/push/index.ts:57`. Fails closed when `PUSH_SECRET` is unset (good). A timing attack on a long random
secret over the network is not practical; fix is one line if wanted
(`crypto.subtle.timingSafeEqual` on the two encoded strings of equal length). Tokens are hex-validated in SQL
(`^[0-9a-f]{32,200}$`), the route comes from the database, the client accepts only routes starting with `/`.

### SA-14 Deep links load any in-app path
`src/lib/native.ts:28-57`: `courtsie://app/<anything>` → `location.assign(origin + path + query + hash)`. Always same
origin (no open redirect: `//evil` stays a path; the web server answers `//evil.example/x` with a same-host 308). It is
the delivery vehicle for SA-2, SA-4 and SA-5 inside the app. Fix: allow-list the first path segment
(`auth`, `reset-password`, `i`, `v`, `p`, `talk`, `map`, `messages`, `c`, `g`, `u`) and drop the hash unless the path is
`/auth` or `/reset-password`. The custom scheme can be registered by another app; PKCE makes an intercepted `?code=` useless.

### SA-15 Dependencies (`bun audit`: 60 advisories; only these are reachable at runtime)
- `@tanstack/react-start` 1.168.59 / `start-server-core` 1.169.38 — SA-2.
- `seroval` 1.6.7 (parses the unauthenticated `/_serverFn` payload): GHSA-97r2-qh9m-474h, GHSA-wp97-x4hv-qvhp (DoS by
  declared array length), GHSA-7rv5-mrxv-xcr9 (deserialization calls attacker-chosen callables). Fixed by the same upgrade.
- Not reachable in production: `undici` (wrangler / dev tooling), `vite` dev server, `launch-editor`, `uuid` (Capacitor CLI),
  `zod` (no untrusted collections validated on the server).

---

## Checked and found solid
- **Secrets:** no real key in the working tree or in the 210 commits (`git log -p -G` for `sbp_`, `xkeysib-`, `xsmtpsib-`,
  `whsec_`, private-key headers, Google / GitHub / Resend patterns, every JWT decoded: all are local `role`-only tokens).
  The client bundle (`.output/public/assets`) contains no service-role key, Brevo key, hook secret or admin client.
  `.gitignore` covers `.env*`, `.dev.vars`, `.wrangler/`. Note only: CLAUDE.md (committed) lists operational identifiers
  (Brevo SMTP login, APNs key / team ids, an old test password of deleted accounts) — keep the repository private.
- **Send-email hook** (`api.auth-email.ts`): fails closed without the secret, without headers and with a bad signature
  (401, reproduced); ±5 min window; signature covers id + timestamp + body. No replay cache (a captured request could
  be replayed within 5 minutes to resend the same mail — needs TLS interception). The reset link is built from Auth's
  `token_hash` and an Auth-validated `redirect_to`.
- **Server functions:** `requireSupabaseAuth` on account deletion, student code and sweeper (signed out → Unauthorized,
  reproduced); `userId` always from the token — an injected `context.userId` does not win (`t8-ctx.mjs`); inputs
  validated (`invitePreview` 8-char code, `postPreview` UUID, email regex + length). Responses under `/_serverFn` and
  `/api/` are `no-store`. No cookies are used, so no cookie CSRF.
- **SSR pages:** `/v/<post>` escapes user text in `<title>`, og tags and the hydration script (`t4-share.mjs`: `</script>`,
  `"><meta http-equiv=refresh>` and U+2028 all neutralised); it exposes exactly first name, school, text, duration, photo
  count, likes, replies; `noindex`. `/i/<code>` shows name, photo path, school for a valid code only.
- **XSS / content injection:** no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or HTML-string sink anywhere in `src`
  (outside the stock UI kit); map markers are built with `createElement` / text nodes; RSS titles, course-file titles
  and names are React text; RSS / admin `source_url` is CHECKed `^https?://` in the database and React 19 blocks
  `javascript:` hrefs; external links carry `rel="noopener noreferrer"`; course files and DM photos open from the
  Supabase origin through signed URLs (bucket MIME allow-lists: no HTML / SVG).
- **Redirects:** the stored "next" destination is re-validated on read (`/p/<uuid>` only, `index.tsx:60`); `?welcome`,
  `?mode`, `?tab`, `?s`, `?course` are parsed to fixed shapes; `?text=` only pre-fills the composer (≤ 280, needs
  Publish); push and local-notification routes must start with `/` and are pushed through the router (same origin).
- **PostgREST filter strings:** the only interpolated id (`voice.ts:54`) is UUID-checked first. No lazy `void supabase.rpc()`
  left: the two fire-and-forget calls end in `.then()`.
- **Client-side trust:** admin screens only call `admin_*` RPCs (checked in SQL); the only direct table write from the
  client is the own profile row; limits, roles and the student gate are enforced server-side (database agent's scope).
- **Sign-out (Settings):** cancels queries, clears the query cache, removes the push token, cancels reminders, global
  Supabase sign-out. Account deletion empties all four buckets, then deletes the auth user.
- **iOS shell:** no ATS exceptions, no `allowNavigation`, `cleartext` only for an `http://` dev URL, usage strings
  present for mic / camera / photos / location, `aps-environment` is replaced by Xcode on export.
- **Headers:** HSTS, `frame-ancestors 'none'` + `X-Frame-Options: DENY`, `nosniff`, COOP, `Referrer-Policy`,
  Permissions-Policy matches the features in use (mic + geolocation; the `capture` file input is not governed by it).

## Not done / not verifiable here
- Real GoTrue behaviour and the live Auth configuration (autoconfirm, rate limits, captcha, hook, JWT signing keys,
  token lifetime) — no requests were sent to production.
- An end-to-end exploit for SA-2 (primitive confirmed, HTML response not achieved).
- `scripts/patch-native-plugins.mjs`, `scripts/rt-probe/worker.mjs`, `AppDelegate.swift`, the Xcode project settings,
  the English legal text, the Realtime paths, and a line-by-line read of the map / walkie client code.
- Whether the local re-seed now includes `20261120100000_audit_fixes_2.sql`.
