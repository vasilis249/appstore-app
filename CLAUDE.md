# Speak (voice-first social network, ex-Courtsie) → iOS — project notes

Persistent findings for Claude sessions. Reply to the user in Greek; code, comments and file names in English.
Work in phases; after each phase STOP, summarize in ≤10 lines, update this file, wait for the user's "OK".
Don't read `bun.lock`, `node_modules`, `src/assets`, `src/components/ui` (stock shadcn), `src/routeTree.gen.ts`,
`src/integrations/supabase/types.ts` (generated). Use Glob/Grep, read only what's needed.

## Product: **Speak** — "X/Twitter, but with voice" (decided 2026-09-29, replaces the BeReal-style plan)
Voice is the main medium. Public posts = a voice clip (≤ 2 min) + optional short title (≤ 100 chars), filed in a
**section** (News/Επικαιρότητα, Tech, Sports, Economy, Politics, Entertainment, Lifestyle, Humor …) and optionally
under a **topic** inside it (a news item / question, e.g. "iPhone 18 launched"; each topic lists everyone's takes).
Home: "For you | Following" + section chips + trending topics; likes, voice replies (threads), repost/quote,
share, listen counts; play a whole section/topic back-to-back like a podcast (also in the background).
User decisions:
- **Follow like X** (public, asymmetric; no approval). Replaces friends (migrate accepted friendships → mutual follows).
- **Topics = admin-created + automatic news** (RSS headlines + link from Greek sources into sections).
- **Keep**: listen-once voice DMs; daily topic ("Θέμα της ημέρας") + the same-time local notification (no feed
  lock any more); calendar/Memories of your own posts (becomes part of the profile).
- **Drop**: BeReal feed lock / one-post-per-day rule.
- Name **Speak** (logo from the user later). Privacy policy / controller: at the very end.
- **Auth email (2026-09-29)**: no custom SMTP yet (built-in mailer reaches only org members, 2/h) → a 2nd account
  never got its link (also typo `@ail.com`, fixed to gmail + confirmed via admin API). Stopgap: `mailer_autoconfirm:
  true` (sign-up logs in directly). `/auth` now hints typos (`lib/email-typos.ts`, "Μήπως εννοείς …;") and offers
  "Resend" for unconfirmed emails. TODO: custom SMTP (Gmail app password / Brevo / Resend) → autoconfirm false.
- Still FREE stack (no Apple Developer Program → local notifications only, no APNs). Storage: Supabase 1 GB fills
  with public voice (2 min ≈ 0.5–1 MB) → keep bitrate low; move audio to Cloudflare R2 (10 GB free) when needed.
- Speak plan (stop for "OK" after each): **S1** rebrand + data model (follows, sections, topics, posts with
  title/section/topic/reply/repost, likes, listens; migrate friendships/daily posts; RLS, RPCs, tests) → **S2** feed UI
  (For you/Following, sections, topic page, post card, composer up to 2:00, continuous playback + iOS background
  audio) → **S3** profiles/follow/search, DMs between mutual follows, notifications (follows, likes, replies) →
  **S4** news ingestion (RSS → topics, admin topic screen, daily topic + notification) → **S5** replies threads,
  reposts/quotes, trending ranking → **S6** hardening/release (moderation, legal, logo/icon/splash, checklist).
- **S1 ✔ (rebrand + data model)** — name Speak everywhere users see it (wordmark, titles, locales, Info.plist
  display name + usage strings, capacitor `appName`, offline page); kept internal ids (`courtsie://` scheme, bundle
  id `gr.innera.courtsie`, Worker URL, localStorage keys, Xcode `ios.scheme`). Migration
  `20261005100000_speak_social.sql` (additive): `private.admins` + `am_i_admin`, `follows` (friendships migrated),
  `sections` (news, tech, sports, economy, politics, entertainment, lifestyle, humor; name_el/name_en/lucide icon),
  `topics` (topic/news/daily, source link, external_id for RSS dedupe, daily_date, pinned/hidden, counters),
  `posts` (+ `post_likes`, `post_listens`; trigger counters; plain repost = repost_of without audio, quote = with
  audio; replies inherit section/topic), public `voices` bucket, RPCs (`create_post`, `feed_posts(scope: all |
  following | section | topic | author | replies, cursor p_before)`, `trending_topics`, follow/like/listen,
  admin topic RPCs, `profile_stats`), `block_user` also drops follows, reports accept kind `post`. Tests
  `test_speak.sql` (48). Live: applied, admin granted to the user's account, types regenerated, live smoke 12/12.
  Old `friendships`/`daily_posts` + their UI stay until S2/S3 replace them.
- **S2 ✔ (feed UI)** — `src/lib/posts.ts` (FeedRow → `toView()` = PostView; plain repost shows the original with
  its counters, credited "X reposted"; quote = own voice + original block; `createPost` uploads to
  `voices/<uid>/<uuid>.<ext>` then `create_post`, removing the file on failure; like/repost/listen/delete),
  `src/lib/queue.ts` (continuous playback: one `<audio>`, auto-advance, Media Session lock-screen controls, one
  listen per post per session via `record_listen`; DM/memory clips pause it via `setExclusiveHandler`), iOS
  `UIBackgroundModes audio`. Components `components/posts/*`: `PostCard` (X-style: author · time · ⋯, section ›
  topic, title, player + waveform progress, reply/repost/like/listens/share), `FeedList` (infinite, cursor,
  "Play all", queue without duplicate voices), `SectionChips`, `TopicStrip` (trending), `RepostSheet`, `PostMenu`
  (delete own / report+block others via `PersonActionsSheet` kind `post`), `MiniPlayer` (above the nav; hidden in
  a conversation and the composer). `useSections()` (names el/en + lucide icons). Routes: `/` (For you | Following
  `?tab=following`), `/s/$sectionId`, `/t/$topicId` (source link + "Give your take"), `/p/$postId` (post, replies
  oldest first, "Reply with your voice"), `/record?section|topic|reply|quote` (`VoiceRecorder` ring ≤ 2:00, title ≤ 100
  except replies, section required for plain posts). Memories now = your own posts by day (several per day).
  Migration `20261006100000_feed_one_post.sql`: scope `one` + orig counters/author on reposts. BeReal daily-post UI
  removed (`lib/daily.ts` only keeps `today()` for the prompt timer). Local proxy serves `/object/public/…`.
- **S3 ✔ (people)** — migration `20261007100000_speak_people.sql`: `private.are_friends` = mutual follows (DMs),
  dropped `friendships`, `daily_posts` (+ their RPCs/policies; `daily-posts` bucket deleted via Storage API), new
  `today()` (moment, prompt times, the day's topic), notifications = follow / like / reply / repost (+ `post_id`,
  trigger-made, deduped, not to self or blocked), `search_users` (username or Greek/Latin name, surname),
  `follow_list(user, followers|following)`, `suggested_people`, reports kinds user/voice_message/post.
  `src/lib/friends.ts` now = people API (follow, lists, stats, profile by username, block, report). UI:
  `/search` (bottom-nav tab, replaces Friends; suggestions + share your @username), `/u/$username` and `/profile`
  via `ProfileView` (counts Φωνές / Ακόλουθοι / Ακολουθεί → `FollowListSheet`; `FollowButton` Follow / Following /
  Follow back; Message only when mutual; ⋯ report/block), post authors link to profiles, `/notifications` with
  icons + follow back, DM picker = mutual follows. Tests: `test_voice.sql` rewritten for follows (40),
  `test_speak.sql` (54). Local seed: `seed_voice.sql` + `seed-speak.sh` in the scratchpad.
- **S4 ✔ (news + daily topic + admin)** — migration `20261008100000_speak_news.sql`: `private.news_feeds` (8 Greek RSS:
  ΕΡΤ News + Καθημερινή → news, Techblog → tech, Gazzetta → sports, Ναυτεμπορική finance/politics → economy/politics,
  Cinemagazine → entertainment, LiFO → lifestyle; humor = admin only; Unboxholics dropped: invalid XML). pg_net +
  pg_cron: `fetch-news` (`17 */3`) → `private.fetch_news()` (net.http_get), `ingest-news` (`22 */3`) →
  `private.ingest_news()` → `private.ingest_feed_xml(feed, xml, max 2)` (xpath, CDATA unwrapped by
  `private.clean_text`, ≤ 36 h old, dedupe on `external_id` = guid/link, headline + link only; news topics with 0
  voices deleted after 7 days). `today()` = admin's daily topic, else today's most-discussed fresh topic
  (`topic_is_pick`). Admin RPCs: `admin_topics`, `admin_feeds`, `admin_set_feed`, `admin_refresh_news` (ingest +
  fetch). `20261008100100`: posts don't show hidden topics. UI: `DailyTopicCard` (white card on For you → topic /
  "Give your take"), `/admin/topics` (new topic or topic of the day — default today if not picked yet, else next;
  news sources with status + switch + Refresh; topics with pin / hide), Settings row "Manage topics" for admins,
  prompt notice → Home. Live: first fetch added 16 headlines (2 per feed). Tests: `test_speak.sql` 66.
- **S5 ✔ (ranking + threads)** — migration `20261009100000_speak_threads_ranking.sql`: `feed_posts` (+ `p_offset`,
  `p_ids`, column `reply_to_username`) scopes `foryou` (score = (1 + 3·likes + 4·replies + 5·reposts + listens) ×1.5 if
  you follow the author ×0.5 own ÷ (age h + 2)^1.5; last 30 days; no plain reposts / replies; offset paging),
  `author_replies`, `ids` (keeps p_ids order); `post_ancestors(post)` (reply chain, root first, visible only);
  `trending_topics` ranks by 24 h voices ×10 + engagement. UI: For you = `foryou` (`nextCursor(scope, page, pages)` →
  offset), post page = ancestors joined by a thread line (`PostCard threadLine`) + the post + replies; header
  "Συζήτηση" for replies; playing in a thread queues the conversation; "Replying to @x" on reply cards (hidden right
  under the parent); profile tabs Φωνές | Απαντήσεις. Tests `test_speak.sql` 74.
- **S6 ✔ (hardening/release)** — migrations `20261010100000_speak_moderation.sql` (+ `…100100` fix): `reports.action/
  resolved_by`; trigger `private.on_report` → one `report` notification per admin (not to the reporting admin's
  loss) + auto-hide a post at 3 distinct open reporters; RPCs `admin_reports(p_open)`, `admin_resolve_report(id,
  dismiss|hide_post|disable_user)` (closes all open reports on the same post/person), `admin_set_post_hidden`,
  `admin_set_user_disabled` (never admins), `admin_open_reports`. UI `/admin/reports` (queue grouped per target,
  play the voice, Hide / Ban (tap twice) / Dismiss; History with Restore), Settings row with open count, bell row
  "Νέες αναφορές για έλεγχο". Profile photo picker in `EditProfileSheet` (`uploadAvatar`, old file removed).
  Legal rewritten for Speak (el + en): Terms/EULA (zero tolerance, 24 h reports, one-listen DMs, RSS, Apple clauses,
  Greek law) + Privacy (voice data, listens, public-by-URL files, retention 10/90 days, no AI/biometrics).
  i18n pruned 1104 → 240 keys (scratchpad `i18n-usage.py` finds unused keys incl. dynamic prefixes).
  `resources/render-assets.mjs [logo.svg|png] [--full] [--bg #hex]` writes icon + splash into Xcode (placeholder:
  voice bars; favicon same). `deploy-all.sh`: SMTP_* env → custom SMTP + confirm email ON, else autoconfirm.
  Docs rewritten: `release-checklist.md` (Speak test plan, TestFlight, review notes, privacy labels),
  `security.md`, `supabase-setup.md`, `ios-setup.md`. Tests `test_speak.sql` 87. Live smoke 12/12.
- **Login redesign ✔ (X-style steps, from the user's screenshot)** — `/auth`: Welcome (wordmark + tagline, Google /
  Apple buttons only if enabled in Supabase via `/auth/v1/settings`, Create account, Terms line, "Sign in") → sign in
  = email → password (Forgot link, inline errors, resend if unconfirmed); sign up = name → email (typo hint) →
  password (rules, Terms above the button) → `@username` (prefilled, Skip) → Home. `components/auth/step-shell.tsx`
  (`StepShell`: back + right link, big title, `BigInput` 30px borderless, Continue pinned above the keyboard via
  `useKeyboardInset` / visualViewport; form submits from the keyboard), `/forgot-password` same layout (`?email=`).
  i18n `auth.*`. Bottom nav hidden on auth pages (`AUTH_PATHS`). `src/lib/oauth.ts`: web = redirect; iOS = Safari
  sheet (`@capacitor/browser` 8.0.4, added to CapApp-SPM) → `courtsie://app/auth?welcome=1&code=…` → `initNativeShell`
  closes Safari and loads the page (PKCE exchange). New accounts (< 10 min old) arriving with `welcome=1` get the
  username step. Google/Apple NOT enabled yet: Google needs the user's OAuth client (free); Apple needs the paid
  Developer Program (and is required by 4.8 once Google is on).
- **Home redesign ✔ (minimal)** — one sticky category row "Για σένα · Ακολουθώ · <every section>" filters the feed
  in place (`/?tab=following|<section id>`, scope `section`; active tab scrolled into view, fade at the edge) + a round
  white ▶ "play all" (`FeedList playAllRef`). For you: compact `DailyTopicCard` (grey row, coral label, white mic) +
  `TopicStrip variant="pills"` (one line of trending topics; per section on section tabs). `PostCard`: name · short
  time (`timeAgoShort`: τώρα/5λ/2ω/3η/date), coral section → `/?tab=<section>` · topic, 16px title, pill player with
  "duration · 🎧 listens", actions reply/repost/like + share at the right (no @username, no listens icon). `FeedList`
  shows each voice once (plain repost next to its original). `/s/$sectionId` still exists for old links.
- **Groups (user request 2026-09-29)** — "public/private groups on topics, invite friends, request to join" (like FB).
  Plan: **G1** data model ✔ → **G2** UI ✔.
  **G1 ✔** migration `20261011100000_speak_groups.sql`: `groups` (name 3–60, description ≤ 300, section, privacy
  public|private, members/posts counters, last_post_at), `group_members` (owner|admin|member, one owner),
  `group_requests` (request | invite + invited_by), `posts.group_id`, `notifications.group_id` + kinds
  group_invite/group_request/group_accepted, reports kind `group` + action `delete_group`. Rules: public = anyone
  reads/joins at once; private = name/description/counts discoverable, voices + members for members only
  (`private.can_see_group`, used by `can_see_post` and `feed_posts`); only members post (replies inherit the group);
  group voices never in For you/all/following/section/topic/profile and can't be reposted/quoted; invites only by
  members and only to friends (mutual follow), an invite is pre-approved; admins approve requests; owner sets roles or
  hands over; owner leaving/deleted → oldest admin else oldest member becomes owner, nobody left → group deleted;
  making a group public admits pending requests. RPCs: `create_group`, `update_group`, `delete_group`, `join_group`
  ('joined'|'requested'), `leave_group` (also cancels request / declines invite), `invite_to_group`,
  `respond_group_request`, `set_group_role`, `remove_group_member`, `group_detail` (my_role, my_pending,
  invited_by_name, pending_requests), `my_groups`, `my_group_invites`, `discover_groups(query, section)` (slugify,
  Greek/Latin), `group_members_list`, `group_requests_list`; `feed_posts` + `p_group`, scopes `group` / `groups`,
  columns `group_id, group_name`; `create_post` + `p_group`; trending/profile counts skip group voices;
  `admin_reports` + `group_name, group_exists`. Tests `test_groups.sql` 33. Live applied, types regenerated,
  smoke 10/10. Known limit: audio files of deleted groups stay in `voices` (orphans, unguessable URLs).
  **G2 ✔ (UI)** — migration `20261011100100_group_joined_notice.sql` (inviter gets `group_joined`, not
  `group_accepted`). `src/lib/groups.ts` (types, `groupKeys`, RPC wrappers); posts: `FeedRow.group_id/group_name`,
  `PostView.groupId/groupName`, `FeedParams.group`, `createPost({ group })`. Components `components/groups/*`:
  `GroupTile` (section icon on a tile = the group's picture), `GroupMeta`, `GroupRow`, `GroupActions` (Join · Ask to
  join · Request sent (tap twice cancels) · Accept/Decline invite · members: Πες κάτι + Πρόσκληση), `InviteSheet`
  (mutual follows not in the group), `RequestsSheet` (admins), `MembersList` (roles; ⋯ make admin / remove admin /
  hand over / remove), `GroupMenuSheet` (edit, leave, delete, report with reasons), `GroupForm`, `MyGroupsStrip`.
  Routes: `/groups` (search, invites, my groups with pending badges, suggested), `/groups/new`, `/g/$groupId`
  (tile + name + meta + description, actions, pending-requests row, tabs Φωνές | Μέλη; private non-member → lock
  wall), `/g/$groupId/edit`, `/record?group=`. Home: tab "Ομάδες" (strip + invites line + scope `groups`). PostCard:
  group name (👥, coral → group) instead of the section; no repost button on group voices. Notifications for the 4
  group kinds open the group; RealtimeSync also invalidates `groupKeys`. Admin reports: kind group → link + "Διαγραφή
  ομάδας". `hooks/use-debounced.ts` shared. Browser flow 15/15 (create → invite friend → accept → speak → private wall
  → request → approve → roles → home tab → isolation).
- **Home in 3 parts ✔ (user request)** — Ειδήσεις | Ακολουθείς | Ομάδες (big equal tabs + round ▶ play all).
  Migration `20261012100000_speak_personal_voices.sql`: `posts.section_id` nullable = a **personal voice** (no section,
  topic, group or parent; replies/reposts keep the parent's kind); `feed_posts` scopes `news` (ranked like For you,
  sections only, offset paging) and `personal` (personal voices of people you follow + yours, newest first).
  Tests `test_speak.sql` 92. Home (`/`, `?tab=following|groups`, News `?s=<section>`; unknown/old `?tab=<section>` →
  News): News = `SectionPills` (Όλα + every section, small pills in the sticky bar) + DailyTopicCard (Όλα only) +
  trending pills + feed (`news` or `section`); Following = "Πες κάτι δικό σου…" row → `/record` + `personal` feed
  (empty → "Βρες άτομα"); Groups = `MyGroupsStrip` + `groups`. Composer: "Πού ανήκει;" → Προσωπική (default) or a
  section (`?section=` preselects, `?news=1` forces a pick). PostCard: no category line on personal voices; section →
  `/?s=<id>`. i18n `home.*`, `posts.where/personal/personalHint/newsHint`. Browser 10/10.
- **Push to talk + voice mark ✔ (user request)** — `components/voice/voice-icon.tsx` `VoiceIcon` (the user's symmetric
  11-bar waveform; `live` = bars breathe, CSS `voice-live` in design-system.css) replaces every microphone icon.
  `hooks/use-push-to-talk.ts` (hold = record, let go = stop; < 700 ms → discarded + "Κράτα πατημένο και μίλα", or
  `onTap`; pointer capture, Space/Enter, no iOS callout). `useRecorder(maxMs, initial?)`: `start()` → Promise<bool>,
  `discard()` works while the mic is still starting. `VoiceRecorder` (composer): one round button — hold (coral,
  scaled, live bars, coral ring) → recorded = the same button plays back, "Ξανά" retakes. `RecordBar` (DMs): same
  PTT button + hint/timer; recorded row = delete · play · send. `NavRecordButton` (nav centre): tap → /record, hold →
  records from any screen (floating "0:05 / 2:00 · άφησε για συνέχεια"), let go → `setPendingClip` + /record placed
  where you were (group / topic / News section or `news=1` / personal). Composer is focused: nav hidden on /record,
  "Πού ανήκει" = one scrolling row, Publish sticky at the bottom. Browser 10/10.
- **News as cards ✔ (user request)** — migration `20261013100000_speak_news_cards.sql`: `topics.image_url` (https only,
  shown from the publisher, never copied) from the RSS item (`private.item_image`: media:content → enclosure image →
  media:thumbnail → <img> in the text; existing headlines get a missing photo on the next run), else `og:image` of the
  article (`private.topic_image_fetches`, `fetch_topic_images()` at the end of `ingest_news`, cron `news-images`
  `27 */3` → `ingest_topic_images()`; Cinemagazine pages have none → section tile). `news_topics(section, limit,
  offset)` (7 days or talked about in 3; pinned, then last activity; `speakers_count`, `speakers` = 3 latest {name,
  avatar_path}, blocked left out). `feed_posts` scope `loose` (section voices not about a headline). Live: 70/80 with
  photos. Tests `test_speak.sql` 98. UI: `components/posts/news-card.tsx` (`NewsCover` 16:9 photo or section tile,
  `NewsCard`: section · source · time, 21px headline, avatars + "Νίκος και 2 ακόμα μίλησαν · 5 φωνές" / "Πες πρώτος").
  Home → News = cards (topic of the day first, labelled), "Περισσότερες ειδήσεις" pages of 15, then "Άλλες φωνές"
  (`loose`); no ▶ on News. Topic page: cover, 24px title, "Διάβασε στο …", Πες τη γνώμη σου + Άκου όλες, voices.
  `DailyTopicCard` removed. CSP `img-src` + `https:`; Privacy mentions photos loaded from publishers. Browser 10/10.
- **Night review ✔ (bug hunt)** — migration `20261013100100_review_fixes.sql`: `loose` skips plain reposts of headline
  voices; `leave_group` (cancel request) deletes the admins' `group_request` notification; `news_topics` speaker name
  falls back to the username. Frontend: PTT forgets a press that ended by auto-stop/error (next hold works);
  `silenceAll()` (audio.ts) pauses the queue + clips when the mic starts; queue progress ~8/s (was 60 re-renders/s of
  the feed); daily reminder opens Home (old "/record" ones too). `20261013100200_news_daily_first.sql`: `news_topics`
  (no section) always returns the topic of the day first, even if older than 7 days / quiet; News list dedupes cards
  across pages. `useRecorder` closes the mic if the screen unmounted while it was starting; DM send failure no longer
  an unhandled rejection; `listThread` checks the URL id is a UUID (it goes into a PostgREST `or=` string); group
  RequestsSheet stays mounted for admins (it used to reopen by itself on the next request). Tests speak 100,
  groups 34. Scratchpad `seed-news.sh` (covers for `news-flow.mjs`); if `local-build.sh` serves 404 assets, a stale
  `wrangler dev` holds the port → `serve.sh <new port>`.
- **Deleted voices like X + audio cleanup ✔ (user OK 2026-09-30)** — migration `20261014100000_speak_deleted_voices.sql`:
  `posts.deleted_at`, `author_id` nullable (NULL ⇔ tombstone). `private.remove_post` = delete, or — if it has replies
  or quotes — tombstone (no author/audio/title; likes, listens, plain reposts, notifications removed; topic/group
  counts given back, counter triggers skip tombstones). `delete_post(p_post)` RPC replaces the direct DELETE policy.
  Trigger `posts_tombstone_gc`: a tombstone goes when its last reply/quote goes (up the thread). `profile_deleting`
  (BEFORE DELETE on profiles, bottom-up loop): an account's answered voices stay as tombstones. `feed_posts` + columns
  `deleted`, `orig_deleted` (tombstones only in replies/one/ids; quotes of a deleted voice stay); `post_ancestors`
  keeps tombstones (`private.can_see_tombstone`); `admin_reports.post_exists` false for tombstones.
  `orphan_voice_files(limit)` (service role only): `voices` objects > 1 h old that no post points at;
  `src/lib/api/voice-files.functions.ts` `sweepVoiceFiles` (Worker, service key → Storage API remove) fired by
  `sweepVoiceFilesLater()` after deletePost / deleteGroup / leaveGroup / admin delete_group.
  `20261014100100_storage_select_own.sql`: SELECT policies on own `voices/avatars` folder — the Storage API needs
  SELECT to delete, so removing your own file (deleted voice, old avatar, failed post) silently did nothing before.
  UI: `PostView.deleted` → PostCard placeholder "Αυτή η φωνή διαγράφηκε από τον δημιουργό της." (MicOff, links to
  its thread), no "Απάντησε" under it, not queued; quote block "Η αρχική φωνή δεν είναι πλέον διαθέσιμη."
  Tests speak 111; browser `delete-flow.mjs` 5/5 (+ `seed-delete.sh`); live smoke (rolled back) 4/4; the one live
  orphan (17 KB) removed.
- **Deploy incident (2026-09-29 night → 09-30)**: the night-review deploys built with `$SUPABASE_URL`/
  `$SUPABASE_PUBLISHABLE_KEY`, which `deploy.env` doesn't define → client bundle without Supabase config (live app
  couldn't reach the backend). Fixed + redeployed. ALWAYS deploy with scratchpad `deploy-prod.sh` (builds with the
  URL literal + `SUPABASE_ANON_KEY`, refuses a bundle without URL/anon key or with the service key / local URL).
- **Walkie-talkie (user request 2026-09-30, "like Zello, free")** — decisions: 1-to-1 between friends only (mutual
  follows), LIVE audio while holding, transmissions kept 24 h. Free stack limits: Supabase Realtime free = 200
  connections, 100 msg/s, 2 M messages/month (each 0.25 s piece = 1 sent + 1 received → ~70 h of talk/month);
  no APNs (free Apple ID) → you hear live only while the app is open (background = W2, best effort).
  Plan: **W1** live 1-to-1 ✔ → **W2** receive anywhere in the app + "channel on" in the background (silent audio
  keep-alive, lock-screen), walkie list/entry points, local notice → **W3** polish/limits/docs.
  **W1 ✔** migration `20261015100000_speak_walkie.sql`: `walkie_messages` (sender, recipient, 300–60000 ms, RLS: the
  two only, no client writes) + `private.walkie_audio` (bytea, like DMs), `send_walkie(to, b64 ≤ 1.5 MB, mime, ms)`
  (friends only, rate limits), `walkie_audio(id)` (replay, 24 h), `walkie_history(other)`, cron `expire-walkie`
  `37 * * * *`, block wipes the pair's history. Realtime authorization: `private.walkie_topic_ok(topic)` +
  policies `walkie_read` (SELECT) / `walkie_write` (INSERT) on `realtime.messages` for private topics
  `walkie:<smaller id>:<larger id>` (live project also has "Authenticated can use realtime": SELECT on topics not
  ending in a uuid or ending in your own id — never grants a pair channel to a third person). Also fixed there:
  `orphan_voice_files` is now an invoker wrapper that raises unless `current_user = service_role` (every migration's
  blanket `GRANT … ALL FUNCTIONS` had given it back to `authenticated`). Client: `src/lib/walkie/codec.ts` (16 kHz
  μ-law, 0.25 s pieces, header version + seq, `Downsampler`), `engine.ts` `WalkieSession` (private channel, presence
  key = user id, binary broadcast `audio` framed by `start`/`end` + `saved`; ScriptProcessor capture, MediaRecorder
  copy at 32 kbps → `send_walkie`; receive = Web Audio schedule with 0.3 s jitter cushion; floor: can't press while the
  friend talks, simultaneous press → earlier `at` wins, loser gets `onYield`; watchdog ends a silent peer after
  1.5 s; beeps 880/660 Hz; `navigator.audioSession` playback / play-and-record so it plays with the silent switch;
  60 s max), `hooks/use-walkie.ts`, `lib/walkie/history.ts`. UI `/talk/$userId` (avatar with green ring = here,
  coral pulse = talking, status line, "Πάτα για να ακούς ζωντανά" when iOS audio is locked, 176 px PTT button
  with a 60 s ring, shake if refused, "Τελευταίες 24 ώρες" replay list); entry: RadioTower in the conversation
  header and on a friend's profile; nav/mini player hidden on /talk. CSP connect-src now derives ws: from http:
  (local stack). Privacy (el/en) updated for walkie + for deleted voices staying as placeholders. Tests
  `test_walkie.sql` 19; browser `walkie-flow.mjs` 11/11 (two browsers, fake mic 440 Hz: presence, live pieces while
  holding with the tone's level, no echo, saved on both sides, one at a time, replay, outsider refused incl. a
  hand-made join); live policy check (rolled back): friends rw, outsider --, after unfollow --. NOT verified: the
  real Realtime server (the container's proxy can't do WebSockets) and a real iPhone (WKWebView ScriptProcessor,
  audio route/earpiece with play-and-record, background) → user test with two accounts.
- **Campus-first, NTUA first (user request 2026-09-30: target college students, start with ΕΜΠ)** — playbook: verified
  students only, each university its own world, one campus at a time. Plan (stop for "OK" after each): **N1** student
  identity ✔ → **N2** campus-first Home (Campus tab = your university's voices, student sections, badges on cards,
  campus topic of the day, NTUA announcements RSS) → **N3** auto groups per school/year + classmates in suggestions →
  **N4** growth (waitlist/unlock, invite links, ambassadors, campus moderators) + Terms. Blockers outside code: Apple
  Developer Program (99 $/yr) for TestFlight — else students use the web app; Brevo (or other) for the code emails.
  **N1 ✔** migration `20261016100000_campus_identity.sql`: `universities` (id, names/shorts el+en, `email_domains`
  — an address @d or @<sub>.d, `open`) + `departments` (NTUA's 9 schools: ntua-ece ΗΜΜΥ, mech, civil, chem, arch, rsge
  ΑΤΜ, naval, mining ΜΜΜ, semfe ΣΕΜΦΕ; 5 years), read-only for signed-in users. `profiles.university_id,
  department_id, study_year (1–5, 6 master's, 7 PhD), student_verified_at` (not client-writable: the column grant
  covers only username/full_name/avatar_path). `private.student_emails` (sha256 of the address, one account each),
  `private.student_codes` (hash, 15 min, 5 tries, 5 sends/hour/user, 300/day overall). `public.student_code_issue`
  (guard: service role only → `private.student_code_issue`), `verify_student_code(code)` → 'ok' | 'bad_code' |
  'expired' | 'too_many' | 'no_code' | 'email_taken' (a status, so wrong tries count), `set_student_info(dept,
  year)`, `clear_student_identity()`. Server fn `src/lib/api/student.functions.ts` `sendStudentCode({email, lang})`:
  crypto 6-digit code → RPC → Brevo `POST /v3/smtp/email` (Worker secrets `BREVO_API_KEY`, `MAIL_FROM_EMAIL` =
  a Brevo-verified sender; NOT SET YET → "mail unavailable"); `EMAIL_DEV_LOG=1` (local serve.sh only) logs the code.
  `src/lib/campus.ts` (`useCampus()` names/`label()` "ΕΜΠ · ΗΜΜΥ", `StudentFields`, `STUDENT_COLUMNS`, RPC wrappers).
  UI `/student` (StepShell steps: academic email → code (one-time-code, resend) → school list → year pills → back to
  profile; from Settings: manage card + change / remove (tap twice); `?welcome=1` right after the sign-up username step
  with Skip; nav hidden), ProfileView badge (GraduationCap pill) or, on your own profile, "Επιβεβαίωσε ότι σπουδάζεις στο
  ΕΜΠ" link, Settings row "Φοιτητική ταυτότητα". i18n `student.*`, `rpcErrors.notAcademic/emailTaken/tooManyCodes/
  mailUnavailable`; Privacy (el/en) + student identity. Tests `test_campus.sql` 23; browser `student-flow.mjs` 10/10
  (code read from the wrangler log), `auth-shots.mjs` 15/15 (+ scratchpad `seed-auth.sh`).
  **N2 ✔ (campus-first Home)** migration `20261016100100_campus_home.sql`: `sections.kind` news|campus + 8 student
  sections (courses Μαθήματα, exams Εξεταστική, campuslife Φοιτητική ζωή, housing Στέγαση, events, market Αγγελίες,
  questions Ερωτήσεις, announcements Ανακοινώσεις). `posts.university_id` = campus voice: only verified students of that
  university see / like / reply (`private.my_university()`, in `can_see_post`, `can_see_tombstone`, `feed_posts`),
  student section or none, replies inherit, no repost/quote out, out of every other scope. `create_post(+ p_campus)`
  (`not_verified`, `bad_section` if the section kind doesn't match). `feed_posts` scope `campus` (+ p_section, newest
  first) + columns `university_id, author_university_id, author_department_id`. `topics.university_id` (topics_select
  hides other campuses; one topic of the day per day globally and per campus — unique index replaces
  `topics_daily_date_key`); `today`, `news_topics`, `trending_topics` global only; `campus_topics(section, limit,
  offset)` (+ `is_daily`: admin's campus pick, else the most talked-about campus topic of 48 h);
  `admin_create_topic(+ p_university)`, `admin_topics(+ university_id)`; `profile_stats` counts only what you can
  hear. `private.news_feeds.university_id` + NTUA feeds (Νέα with photos, Ανακοινώσεις → section announcements; live
  first run added 4). UI: Home tabs ΕΜΠ (label = your university's short name, "Campus" for others) · Ακολουθείς ·
  Ομάδες · Ειδήσεις; no tab → Campus for verified students else News (`?s` alone = News, old links kept);
  `CampusView` (campus topic of the day = NewsCard, up to 3 campus headlines as rows, "Πες κάτι στο campus…" →
  `/record?campus=1[&section]`, feed `campus`), non-students get a lock screen → `/student`; `SectionPills tab`.
  `useSections()` → `sections` (news only, unchanged consumers) + `campusSections`. PostCard: "· ΗΜΜΥ" (or "ΕΜΠ ·
  ΗΜΜΥ" off campus) after the name, "🎓 ΕΜΠ · Εξεταστική" line → `/?tab=campus&s=`, no repost on campus voices.
  Composer `?campus=1`: "Στο ΕΜΠ" card + Γενικά/student-section chips. NavRecordButton hold on the ΕΜΠ tab → campus.
  Admin topics: "Μόνο για το ΕΜΠ" switch (student sections), ΕΜΠ tag in the list. Tests `test_campus.sql` 38,
  `test_speak.sql` 111; browser `campus-flow.mjs` 15/15 (+ `seed-campus.sh`).
  **N3 ✔ (school groups + classmates)** migration `20261016100200_campus_groups.sql`: `groups.auto, university_id,
  department_id, study_year` (unique per school / school-year; name "ΕΜΠ · ΗΜΜΥ" / "ΕΜΠ · ΗΜΜΥ · 3ο έτος", private,
  section courses, no owner). `private.auto_group` (made on first use) + `private.sync_student_groups` fired by the
  trigger `profile_campus_changed` (AFTER UPDATE of university/department/year/disabled): in the groups that fit, out of
  the rest; clearing the identity → out of all. `join_group`: auto groups only for students they fit (straight in);
  `invite_to_group` refuses auto groups; `discover_groups` hides them; `group_detail` + `auto, can_join`.
  `suggested_people` + campus columns + `reason` classmate (same school+year) › school › campus › friends of friends.
  UI: GroupActions for auto groups (Speak, no Invite; "Γίνε μέλος" again if you fit; nothing otherwise — the lock wall
  says "Μόνο για φοιτητές αυτής της σχολής…"), "🎓 Ομάδα σχολής · αυτόματη" under the name; /search suggestions show
  "Συμφοιτητής / Ίδια σχολή · ΕΜΠ · ΗΜΜΥ"; ΕΜΠ tab "Συμφοιτητές σου" strip (same school, avatar, "ΗΜΜΥ · 3ο",
  Follow). Tests `test_campus.sql` 46; browser `campus-groups-flow.mjs` 7/7 (seed-campus.sh adds classmates),
  campus-flow 15/15, groups-flow 15/15.
  **N4 ✔ (growth + student moderators)** migration `20261016100300_campus_growth.sql`: `profiles.invite_code`
  (8 chars, no look-alikes, from `uuid_send(gen_random_uuid())`), `invited_by`; `my_invite()` (code + joined count),
  `invite_preview(code)` (invoker wrapper: anon refused, service_role/authenticated only → public page via the Worker),
  `claim_invite(code)` → ok (mutual follow + `invite_joined` notice) | already | too_old (account > 7 days) | self |
  not_found. `universities.min_students` + `campus_status()` (verified count, is_open) + `campus_leaderboard()`
  (students per school). `private.campus_moderators` (admin names verified students of that university:
  `admin_set_campus_moderator(username, uni, on)`, `admin_campus_moderators`, `admin_set_campus(uni, min)`),
  `my_staff_role()` admin | moderator | null; moderators get report notices for their campus's posts and see/resolve
  only those (dismiss / hide_post; no reporter username, no bans). UI: `/i/$code` public page (inviter avatar + name,
  school, Γράψου / Έχω λογαριασμό; `lib/api/invite.functions.ts` server fn), code kept in localStorage
  `courtsie:invite` and claimed after login (`InviteClaimer` in root), `InviteShare` (Web Share / copy + "n joined");
  ΕΜΠ tab: closed campus → `CampusWaiting` (progress to the threshold, invite, schools board) and no ▶ / pills; open →
  `SchoolsBoard` (top 3 + yours); Admin topics → Campus (threshold, moderators); `/admin/reports` for moderators.
  Terms el/en "Campus φοιτητών". Tests `test_campus.sql` 66; browser `growth-flow.mjs` 12/12.
  **N5 ✔ (all public ΑΕΙ of Attica, user request 2026-09-30)** migration `20261017100000_attica_universities.sql`: 9 more
  open universities + 111 departments (Wikipedia lists, ΑΣΠΑΙΤΕ from its site): ΕΚΠΑ `uoa` (42 incl. Ψαχνά), ΟΠΑ `aueb`
  (8), ΠΑΠΕΙ `unipi` (10), Πάντειο `panteion` (9), ΠΑΔΑ `uniwa` (27), ΓΠΑ `aua` (6, 5 years), Χαροκόπειο `hua` (4),
  ΑΣΚΤ `asfa` (2), ΑΣΠΑΙΤΕ `aspete` (3); domains = the institution's (`uoa.gr` also covers `di.uoa.gr` …); all start
  open (min_students 0). **Year codes changed**: 1–6 undergraduate (Medicine 6, Pharmacy/Dentistry/engineering 5),
  8 master's, 9 PhD (was 6/7; CHECKs on profiles/groups, `year_label`, `set_student_info` checks the department's
  years). Auto group description `private.auto_group_description` ("6ο έτος · Ιατρικής · ΕΚΠΑ."), existing ones
  rewritten. `admin_campuses()` (admin: every open campus, students, threshold, open, moderators). UI: copy says
  τμήμα / ΑΕΙ instead of σχολή / ΕΜΠ; `/student` email step shows the detected university (`useCampus().uniForEmail`)
  and "Δεκτά email από: …"; department step has an accent-insensitive search (> 12 departments) and "Δεν βρίσκω το
  τμήμα μου" (verified without a department); years from `yearOptions(dep.years)` (a year the new department lacks
  is dropped on save). Admin topics: `CampusPicker` chips for campus-only topics and for threshold / moderators.
  Tests `test_campus.sql` 77; browser `attica-flow.mjs` 13/13 (+ campus 15/15, campus-groups 7/7, growth 12/12 after
  copy updates). Seed note: `seed-campus.sh` is not idempotent → run `seed-speak.sh` (reset) first.
  **N6 ✔ (campus news for the new universities)** migration `20261017100100_attica_feeds.sql`: 7 more
  `private.news_feeds` → section `announcements` of each campus: ΕΚΠΑ `hub.uoa.gr/feed/` (uoa.gr's own feed has empty
  <link>s, 3.6 MB), ΟΠΑ `aueb.gr/el/rss.xml` (quiet since June), Πάντειο / ΠΑΔΑ / Χαροκόπειο / ΑΣΚΤ / ΑΣΠΑΙΤΕ `/feed/`
  (WordPress). ΓΠΑ (empty feed) and ΠΑΠΕΙ (site unreachable from the container, no feed found) have none. Parser checked
  on the real files (ΕΚΠΑ items carry photos). Tests campus 78, speak 111 (11e: 17 feeds).
  Live first run: ΕΚΠΑ 2 (with photos), ΑΣΚΤ 2, Χαροκόπειο 1, ΑΣΠΑΙΤΕ 1; ΟΠΑ timed out from Supabase (TLS
  handshake, retried by cron); Πάντειο / ΠΑΔΑ had nothing newer than 36 h.
- **Email (2026-09-30)**: Brevo (free, 300/day, sender `vasilis.har@gmail.com`). Worker secrets `BREVO_API_KEY` +
  `MAIL_FROM_EMAIL` set (student codes). Supabase Auth custom SMTP = `smtp-relay.brevo.com:587`, user
  `bbd8b8001@smtp-brevo.com`, the SMTP key, sender name Speak, 100 emails/h; `mailer_autoconfirm` still true
  (sign-up without confirmation) until the user decides. Keys only in scratchpad `deploy.env` (rotate later).
- Everything under "Phase 3 progress" below is the BeReal-style build; its pieces (recorder, player, storage
  policies, report/block sheet, notifications, DMs) are reused.

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
  `voices/<uid>/`, then `auth.admin.deleteUser` → cascades). Everything else talks to Supabase RPCs
  directly with the anon key + user JWT.
- Security headers: `src/lib/security-headers.server.ts` (CSP incl. `media-src`, Permissions-Policy
  `microphone=(self)`, HSTS, X-Frame DENY, COOP, no-store on server fns). Summary: `docs/security.md`.

## UI (BeReal-like, from the user's reference screenshots; dark only)
- Theme in ONE file `src/design-system.css`: black bg, white text, `bg-primary` = white (black text),
  `bg-secondary #2c2c2e` pills, grey text `#8e8e93`, `--coral #e4571c` small accent (recording), `--badge` red.
  System font (SF Pro on iPhone). `<html class="dark">` always; no theme toggle. Buttons/inputs rounded pills.
- `BottomNav`: floating pill with labels — Home `/`, Search `/search`, white mic circle `/record`,
  Memories `/memories` (segmented pill Memories | Calendar, `?view=calendar`), Profile (avatar).
- `AppHeader` (`src/components/app-header.tsx`): centered `Wordmark` ("Speak") or title, `back`, left/right
  slots, `HeaderPill`; Home's right pill = paper-plane → `/messages` + bell → `/notifications`.
  Profile ⚙︎ → `SettingsSheet` (language, daily reminder, admin: Reports + Manage topics, blocked, contact/terms/
  privacy, sign out, delete account).
- `EmptyState`: icon or bold title + one line + optional white pill button.
- Routes: public `/auth`, `/forgot-password`, `/reset-password`, `/contact`, `/terms`, `/privacy`; everything
  else under `src/routes/_authenticated/` (ssr: false, redirects to `/auth`).
- i18n: `src/i18n/locales/{el,en}.json` (same keys; unused ones pruned in S6). Sign-up requires accepting Terms (1.2).
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
- Deploy from the container: scratchpad `deploy-prod.sh` (VITE_SUPABASE_URL = the project URL literal,
  VITE_SUPABASE_PUBLISHABLE_KEY = `$SUPABASE_ANON_KEY`; checks URL/key present, no service key; `npx wrangler deploy`).
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
  `PGHOST=/tmp PGPORT=54329 PGUSER=postgres bash supabase/tests/run.sh` → `test_voice.sql` (40) + `test_speak.sql` (111) + `test_groups.sql` (34) + `test_walkie.sql` (19) + `test_campus.sql` (78).
  `supabase_stubs.sql` fakes auth/storage/realtime + roles; tests switch users with `request.jwt.claims`.
- UI screenshots: build with `VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<local anon
  jwt>`, run `wrangler dev` (scratchpad `serve.sh <port>`), Playwright with the pre-installed Chromium, session
  injected into localStorage `sb-127-auth-token`. Chromium can't trust the proxy CA → check the live site with curl.
- Local Realtime: scratchpad `realtime-mock.mjs` (Phoenix vsn 2.0.0: JSON arrays + binary user broadcasts, presence,
  private joins authorized by the real RLS policies via `public.rt_authorize`, `rt_mock.sql`, loaded by `reset-local.sh`)
  attached to `local-supabase.mjs`. Fake mic file: `--use-file-for-fake-audio-capture=<wav>` (`tone440.wav`).
