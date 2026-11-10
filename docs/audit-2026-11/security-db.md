# Speak — database security audit (2026-11-10)

Scope: the FINAL catalog state of all 81 migrations (incl. `20261119100000_audit_fixes.sql`) built in a throwaway
database `audit_secdb` (stubs + every migration, no failures). Nothing in the repo was edited; production was never
contacted. Every finding below was reproduced there unless it says UNVERIFIED.

Files (all under `/tmp/claude-0/-home-user-appstore-app/70bd35f3-3128-521c-9aab-1890275baab1/scratchpad/audit/secdb/`):
- `lib.sql` — seed used by every PoC (Anna/Bob/Mod = NTUA students, Carl = ΕΚΠΑ student, Mallory = unverified,
  Eve = admin). Each PoC runs inside `BEGIN … ROLLBACK`.
- `p1.sql` … `p10.sql` — the PoCs. Run: `PGHOST=/tmp PGPORT=54329 PGUSER=postgres psql -d audit_secdb -f pN.sql`
- `fix_draft.sql` — ALL fixes below as one draft for a NEW migration. `psql -v fix=1 -f pN.sql` re-runs a PoC with
  the draft applied (inside the same rolled-back transaction); results of those runs are quoted per finding.
- `fn/*.sql`, `policies.txt`, `funcs.txt` — dumps of every function, policy and function ACL in the final state.

Summary: Critical 0 · High 2 (one already fixed) · Medium 5 · Low 4.

---

## SD-1 [High — FIXED, fix verified] Every student could read every profile's invite code → forced "friendship"
- Object: table-level `SELECT` on `public.profiles` (policy `profiles_select`, 20261027100000_student_gate.sql:55)
  + `public.claim_invite` (20261016100300_campus_growth.sql:58).
- Attack (any verified student, any campus, account < 7 days): read the victim's `invite_code`, call
  `claim_invite(code)` → follows both ways = "friends" → DMs, the pair's walkie channel, the victim's
  friends-only live position.
- Repro before the fix (`p1.sql`): `anna.victim | xy984kzc` read by Carl; `claim_invite → ok`; `are_friends = t`;
  `send_dm → t`; `map_people` returned Anna's `37.9793 | 23.7836` to a "friend" 272 km away; `walkie_topic_ok = t`.
- After `20261119100000_audit_fixes.sql`: `p1.sql` stops at `ERROR: permission denied for table profiles`.
  I also checked the other paths to a code: filters / ordering / `RETURNING` on the column (denied by the column
  grant), `profiles` is not in the Realtime publication, no function returns a `profiles` row, `invite_preview` and
  `claim_invite` only answer for a code you already hold (31^8 codes, not guessable online). Holds.
- Remaining way to an unconsented mutual follow: SD-2.

## SD-2 [High] The pre-registered-account fix can be walked around (planted follow, stale token, planted push token)
- Objects: `public.claim_student_email` (20261119100000_audit_fixes.sql:22), `public.claim_invite` (uses
  `private.me_any()` → works for UNVERIFIED accounts), `private.me_any` (20261027100000_student_gate.sql:22: no check
  that the token's session still exists).
- Precondition (Auth, UNVERIFIED here — GoTrue cannot run in the container; it is the premise the fix migration itself
  states): anyone can create a password account for an academic address they do not own (sign-up auto-confirms).
- Attack (a verified student against classmates whose addresses he can guess, e.g. registry numbers):
  1. Pre-register `victim@mail.ntua.gr` with a password. Inside that unverified account call
     `claim_invite(<attacker's own code>)` — allowed for unverified accounts — which inserts the follows both ways.
  2. The owner later signs up with the e-mailed code. `claim_student_email` clears the password and the other
     sessions, but the follows, `invited_by` and anything else planted stay: the victim starts life as the
     attacker's "friend" (DMs, walkie channel, friends-only position), never having accepted anyone.
  3. The attacker's access token for the old session is a signed JWT: deleting the `auth.sessions` row does not
     invalidate it for PostgREST (up to its expiry, 1 h by default). Every RPC still accepts it as the now-verified
     victim: `my_invite()` returns the victim's code, `register_push_token` adds the attacker's device (it then
     receives the victim's DM texts as pushes for good), `follow_user`, `set_location_sharing('everyone')`, …
- Repro (`p3.sql`), output:
  ```
  attacker_cannot_verify: not_otp        claim_invite status: ok          (unverified account, password session)
  victim_verified: ok                    password_cleared | sessions_left:  t | 1
  friends | invited_by_attacker:  t | t  attacker_can_dm: t   map_people(attacker): 37.9793 | 23.7836 | is_friend t
  stale_token_is_student | reads_victims_invite_code:  t | t  attacker_device_registered_for_victim: 1
  ```
- Fix (in `fix_draft.sql`, verified: with it `friends | invited_by` = `f | (null)`, `send_dm → not_friends`,
  a token whose session row is gone → `not_allowed`, a live session → fine):
  ```sql
  -- (a) every RPC refuses a token whose session was revoked (also makes sign-out / "other sessions" immediate)
  CREATE OR REPLACE FUNCTION private.me_any() RETURNS uuid
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
  DECLARE uid uuid := auth.uid();
  BEGIN
    IF uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND NOT disabled)
       OR (auth.jwt() ? 'session_id'
           AND NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id::text = auth.jwt() ->> 'session_id')) THEN
      RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
    END IF;
    RETURN uid;
  END $$;
  -- (b) in claim_student_email, just before "UPDATE auth.users SET encrypted_password = NULL …":
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = uid AND coalesce(encrypted_password, '') <> '')
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND student_verified_at IS NULL) THEN
    DELETE FROM public.follows WHERE uid IN (follower_id, followee_id);
    DELETE FROM public.notifications WHERE uid IN (user_id, actor_id);
    DELETE FROM private.push_tokens WHERE user_id = uid;
    UPDATE public.profiles SET invited_by = NULL, invite_code = NULL WHERE id = uid;
  END IF;
  ```
  Notes: (a) needs `SELECT` on `auth.sessions` for the function owner — add the same `has_table_privilege` guard the
  fix migration already uses; local tests carry no `session_id` claim, so they are unaffected. (b) only touches an
  account that had a password AND was never verified, so real code-born accounts keep a legitimately claimed invite.
  Table reads that go through RLS only (`auth.uid()` in policies) still accept the stale token until it expires;
  a brand-new account has nothing there yet. The durable cure is Auth-side: Confirm email ON.

## SD-3 [Medium] Unverified and banned accounts can upload to every bucket (two of them public) and edit their profile
- Objects: storage policies `voices_upload_own` (20261005100000_speak_social.sql:520), `avatars_upload_own`
  (20261003100000_voice_baseline.sql:689), `dm_photos_upload_own` (20261106100000_dm_text_photos.sql:19),
  `course_files_upload_own` (20261109100000_courses.sql:75); `profiles_update_own`. None checks `is_student` /
  `disabled` — the student gate covers RPCs and reads, not Storage writes.
- Attack (anyone with any e-mail — sign-up auto-confirms — or a banned student): fill the project's 1 GB (50 PDFs of
  20 MB in `course-files`, or 3 MB images in the public `voices` bucket), host arbitrary images under the project's
  public URL, keep doing so after a ban; squat usernames / impersonate (`ntua.official`) from an unverified account.
  Orphans are swept only after someone deletes something, and only when older than 1 h.
- Repro (`p4.sql`): Mallory (`am_i_student = f`) inserts into `voices`, `avatars`, `course-files`, `dm-photos`
  (4 rows returned) and renames herself `ntua.official | ΕΜΠ Γραμματεία`; banned Bob: RPC → `not_allowed`, but
  `voices/…/still-here.jpg` inserted and `full_name` updated.
- Fix (verified: first upload → `new row violates row-level security policy for table "objects"`): recreate the four
  INSERT policies with `AND private.is_student(auth.uid())`, and `profiles_update_own USING (id = auth.uid() AND NOT
  disabled)` — full text in `fix_draft.sql` (section SD-3).

## SD-4 [Medium] "People within 500 m" can be swept over the whole city by teleporting your own position
- Objects: `public.update_my_location` (20261021100000_live_location.sql:72), `public.map_people`
  (20261024100000_map_last_seen.sql). The radius is measured from the caller's self-reported position; the only
  throttle is one write per 3 s; turning sharing off/on erases the previous fix.
- Attack (any verified student, from anywhere): share with `everyone`, hop a grid of fake positions, read
  `map_people` after each hop → exact coordinates, accuracy, name and photo of every student sharing with
  "everyone" (≈ 0.8 km² per hop, 20 hops/min per account; a campus in seconds, Athens in well under an hour). After a
  hop the attacker also passes `are_nearby`, so he can knock / talk to them.
- Repro (`p5.sql`): from "Paris" `seen_from_paris = 0`; one hop later
  `anna.victim | Anna Victim | 37.9793 | 23.7836 | 5 | 387`.
- Fix (verified with `p9.sql`: jumps 1–6 ok, 7 and 8 → `rate_limited`, a normal small move still `ok`): count a
  first fix or an impossible move (> 2 km and > 250 km/h) as a "jump" and allow 6 per hour:
  ```sql
  SELECT * INTO prev FROM private.user_locations WHERE user_id = uid;
  IF FOUND AND prev.updated_at >= now() - interval '3 seconds' THEN RETURN true; END IF;
  IF NOT FOUND OR private.distance_m(prev.lat, prev.lng, p_lat, p_lng)
                  > greatest(2000, 70 * extract(epoch FROM now() - prev.updated_at)) THEN
    PERFORM private.rate_limit('location_jump', 6, interval '1 hour');
  END IF;
  ```
  (full function in `fix_draft.sql`). It limits sweeping to 6 spots/hour per account; it cannot stop someone from
  checking one chosen spot — that is inherent in the "everyone" mode and worth saying on the consent card.

## SD-5 [Medium] Three accounts can hide any post or course file, staff's "dismiss" does not bring a post back, and the same three can hide it again
- Objects: `private.on_report` (20261109100000_courses.sql:189), `public.admin_resolve_report` (…:274),
  `public.report_content` (…:162).
- Attack (three accounts of any campus — see SD-6 for how cheap they are): three reports hide the target at once.
  For a post, `dismiss` closes the reports but leaves `hidden = true` (files are un-hidden, posts are not). After a
  manual restore the same reporters report again and it is hidden again: nothing remembers that staff judged it fine.
  Reports also work on posts the reporter cannot see if a block exists either way.
- Repro (`p6.sql`): `hidden_after_3_reports t` → admin dismiss, `reports_closed 3`, `hidden_after_dismiss t` →
  restore by hand, same three report → `hidden_again t`.
- Fix (verified: `hidden_after_dismiss f`, `hidden_again f`): in `on_report` skip the automatic hiding once a report
  on that target was dismissed; in `admin_resolve_report` un-hide a post on dismiss:
  ```sql
  -- on_report: add to the auto-hide condition
  AND NOT EXISTS (SELECT 1 FROM public.reports d
                  WHERE d.kind = NEW.kind AND d.target_id = NEW.target_id AND d.action = 'dismiss')
  -- admin_resolve_report: new branch before the course_file one
  ELSIF p_action = 'dismiss' AND r.kind = 'post' THEN
    UPDATE public.posts SET hidden = false WHERE id = r.target_id;
  ```
  (`fix_draft.sql` carries the full `on_report` and an in-place patch of `admin_resolve_report`.)

## SD-6 [Medium] One mailbox = unlimited accounts (+tags), and a banned student is back after deleting the account
- Objects: `public.claim_student_email` (20261119100000_audit_fixes.sql:22), `private.student_code_issue`
  (20261016100000_campus_identity.sql), `private.student_emails` (cascade on profile delete).
- (a) The one-account-per-address rule hashes the raw address, so `user+1@uni`, `user+2@uni` … count as different
  people. Reproduced in the DB (`p6.sql`: `plus_tags_are_distinct t`, `still_academic uoa`); that the universities'
  mail servers deliver `+tag` mail is UNVERIFIED (Google-hosted and most Postfix set-ups do). It makes SD-5's three
  reporters, ban evasion, follower / points / "n joined" inflation one-person jobs.
- (b) A ban lives on the profile row. The banned user deletes the account (the Worker's `deleteMyAccount` only needs
  a valid token) → `student_emails` cascades away → sign up again with the same address.
  Repro (`p7.sql` c): `same_address_verified_again ok`, `back_in t`.
- Fix (verified: (b) → `email_taken`, `back_in f`; `student_code_issue('x+1@mail.ntua.gr')` stores the hash of
  `x@mail.ntua.gr`): `private.email_key()` (strip `+tag`) used wherever the address is hashed, and
  `private.banned_emails` filled by a `BEFORE DELETE` trigger on `profiles` when the row is disabled, checked in
  `claim_student_email` and `student_code_issue` — all in `fix_draft.sql`. Existing hashes of untagged addresses stay
  valid. (GDPR: a hash kept to enforce a ban is defensible; say so in the Privacy text.)

## SD-7 [Medium] A new student's username is the local part of the academic address (often the registry number)
- Object: `private.create_profile` (20261003100000_voice_baseline.sql:119): no name in the sign-up metadata →
  username from `split_part(email, '@', 1)`. The 3-step code sign-up sends no metadata, so every new student gets it.
- Impact: the username is shown to every student of every institution (and to anyone on the public share page
  `post_preview` while the name is still empty: it falls back to the username). Username + the university on the
  profile = the student's e-mail address / registry number. The database deliberately stores only hashes of student
  addresses; this hands them out anyway.
- Repro (`p7.sql` a): `INSERT INTO auth.users … 'sdi2100123@di.uoa.gr'` → profile `sdi2100123 | uoa`, listed in
  Carl's (other campus) directory query.
- Fix (verified: `user4cd75fe0`): in `create_profile` replace the e-mail fallback with
  `'user' || substr(md5(random()::text), 1, 8)` (full function in `fix_draft.sql`). Existing accounts whose username
  equals their address's local part need a one-off rename — a visible change, so decide it with the owner.

## SD-8 [Low] Whole follow graph, other campuses' school groups and unverified accounts readable straight from the tables
- Objects: `follows_select`, `groups_select`, `profiles_select` (20261027100000_student_gate.sql:68, :73, :55).
- Any verified student of any of the 1,737 institutions can page through `public.follows` (who follows whom, with
  dates — and subscribe to it live, the table is in the Realtime publication), list every auto group with
  university / department / year / member count, and list unverified accounts' names. The app reads none of this:
  it never queries `follows`, and reads auto groups only for the user's own department.
- Repro (`p7.sql` b): Carl sees `follow_edges_of_strangers 2`, the NTUA groups `ΗΜΜΥ | ntua | ntua-ece | | 3` and
  `ΗΜΜΥ · 3ο έτος`, and `mallory.unverified`.
- Fix (verified: 0 edges, 0 groups): `follows_select USING (auth.uid() IN (follower_id, followee_id))`;
  `groups_select … AND (NOT auto OR university_id = private.my_university() OR private.is_admin(auth.uid()))`.
  (The cross-campus people directory itself — `profiles`, `search_users`, `suggested_people`, `follow_list` — is the
  product's X-style design; I did not treat it as a defect, but a full dump of names + university + department +
  year costs one paged GET.)

## SD-9 [Low] A stranger can ring someone's phone a few hundred times an hour
- Object: `private.notify` (20261007100000_speak_people.sql) deletes the old row and inserts a new one each time;
  `notifications_push` fires on every insert. Like → unlike → like (300/h), follow → unfollow (200/h), thank /
  un-thank a file (120/h) each produce a fresh notification and push until the victim blocks. `ask_course_question`
  pushes to every taker of any course of the campus (30/h), whether or not the asker takes it.
- Checked by reading the code and `p8.sql` (three likes = three inserted rows, one left).
- Fix: in `private.notify`, when the same (user, actor, kind, post) row is younger than an hour, keep it and return.

## SD-10 [Low] Student code flow: guesses reset with every resend; the shared daily cap can be drained
- Object: `private.student_code_issue` (20261016100000_campus_identity.sql): `attempts = 0` on every re-issue →
  5 sends × 5 tries = 25 guesses per hour per account against an address the caller does not own (≈ 0.06 % a day per
  account); the 300 mails/day cap is global, so three throw-away accounts stop the code flow for everyone and make
  Speak mail arbitrary academic addresses.
- Not exploited end to end (needs the Worker); the arithmetic follows from the function text.
- Fix: do not reset `attempts` inside the same hour window; add a per-address limit (count sends per `email_hash`
  per day) next to the global one.

## SD-11 [Low] Hardening that costs one statement each
- `TRUNCATE` (and INSERT / UPDATE / DELETE, held back only by the absence of policies) is granted to `anon` and
  `authenticated` on `courses, course_files, course_file_downloads, course_file_thanks, course_takers, groups,
  group_members, group_requests` — the newer migrations never revoked the default grants. Verified: `SET ROLE anon;
  TRUNCATE public.course_takers` succeeds in SQL (`p8.sql`). Not reachable through PostgREST today. Fix: the two
  `REVOKE`s at the end of `fix_draft.sql` (they re-grant the two column-level UPDATEs the app uses).
- The live-only policy "Authenticated can use realtime" lets the larger-id user of any pair read-join
  `walkie:<other>:<me>` / `nearby:<other>:<me>` without being friends (verified with the stub's copy of the policy,
  `p10.sql`: Carl may read `walkie:<anna>:<carl>`). Nobody can write there, so nothing leaks today; add
  `AND realtime.topic() !~ '^(walkie|nearby):'` to that policy so the pair topics depend on one rule only.
- 31 `private.*` helpers still carry the default `EXECUTE TO PUBLIC` (list in `funcs.txt`); `authenticated` has
  USAGE on the schema. Unreachable while the Data API does not expose `private` — keep it that way, or
  `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC` and re-grant the ones policies call.
- `private.fetch_topic_images` fetches whatever https URL an RSS item of the 110 third-party feeds carries, from the
  database host; only an `og:image` URL comes back. Semi-blind, https-only; left as is.

---

## Checked and found solid
- RLS on every table of `public`; `private.*` tables have no grants to `anon` / `authenticated`; `anon` can execute
  no function and read only `universities` / `departments`.
- All 175 SECURITY DEFINER functions pin `search_path = ''`; no dynamic SQL anywhere; the service-role-only wrappers
  (`student_code_issue`, `post_preview`, `push_job`, `drop_push_token`, `orphan_*`) refuse `authenticated`.
- Student gate: an unverified account reaches only `claim_invite`, `verify_student_code`, `claim_student_email`,
  `am_i_*`, `invite_preview`, its own rows (and Storage — SD-3). `claim_student_email` cannot be passed with a
  password session (`not_otp`). The 1,863 e-mail domains: well-formed, no wildcard characters, no domain is a
  parent of another institution's, no free-mail providers. (Whether each of the 1,571 bulk-imported domains is still
  owned by its institution was NOT checked — a lapsed domain would sell verified accounts.)
- Campus isolation (`p10.sql`, Carl from another campus): 0 rows from `posts`, `courses`, `course_files`,
  `notifications`, `feed_posts` (`ids`, `author`, `course`); like / reply / repost / download of a campus item →
  `not_found`; `create_post(reply_to + repost_of)` cannot smuggle a hidden original (CHECK `posts_check1`);
  `profile_stats`, `helper_stats`, `top_helpers`, `campus_*`, `news_topics`, `trending_topics`, moderator scope in
  `admin_reports` / `admin_resolve_report` / `admin_set_post_hidden` all filter by university.
- DMs and audio: `voice_messages`, `walkie_messages`, `nearby_messages` rows and the `dm-photos` objects are
  visible only to the two parties (0 rows for Carl, for an unverified account and for a campus moderator);
  `consume_voice_message`, `walkie_audio`, `walkie_history` give an outsider nothing; listen-once deletes the bytes
  in the same transaction; a block wipes walkie / nearby history.
- Realtime: an outsider cannot read `walkie:<a>:<b>`, `nearby:<a>:<b>` or `nearby-in:<a>`; an upper-case variant of
  the topic does not match; both pair rules require `is_student` and no ban.
- Storage: no listing of other folders, no UPDATE policy (no overwrite), delete only in your own folder, size and
  MIME limits on every bucket, paths must start with your id in every RPC that attaches a file.
- Privilege escalation: `private.admins` and `campus_moderators` are written only by SQL / admin RPCs; moderators
  cannot ban or see reporters; group roles (`set_group_role`, `remove_group_member`, auto groups without owner)
  hold; direct writes on the over-granted tables fail on RLS (`p8.sql`).
- Account deletion: every user table cascades from `profiles` (FK list checked); `private.rate_events` keeps the id
  for 2 days (purged by the hourly job).

## Not covered
- Anything that needs the real Supabase services: GoTrue behaviour (auto-confirm, OTP attempt limits, e-mail
  change), whether Realtime keeps public and private channels apart, pg_net / pg_cron privileges, the Edge Function
  and `private.push_config` on the live project, live grants that differ from the stubs.
- By design, noted only: a student can change department / year freely, so "private" school groups are open to
  every student of that university; a share link (`/v/<post>`) shows a campus post's text to anyone who has it;
  files in the public `voices` bucket (campus and private-group voices and photos too) stay reachable by URL.
- The test suites in `supabase/tests/` were not re-run against `fix_draft.sql`; the `follows_select` change in
  particular may need an expectation updated.
