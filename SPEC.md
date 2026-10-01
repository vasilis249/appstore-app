# Spec: Speak for students only

Status: **approved** (2026-10-01). Decisions taken in chat:
students only (verified academic email), all Greek public universities + Cyprus + licensed private
universities/colleges, news = university announcements + student topics only, a new student-first design.

## Objective
Speak becomes a voice network **only for university students in Greece and Cyprus**. You join with your academic
email (code by email, as today), you land in your university's world (campus, your school/year, classmates, walkie,
map), and "news" means things that matter to students: your university's announcements and student topics
(housing, scholarships, exams, Erasmus, internships, food/σίτιση, transport, ΔΟΑΤΑΠ…). Nothing else.

Success looks like: a student of any supported institution can sign up, verify in < 2 minutes, and see only
student-relevant content; a non-student cannot read or post anything.

## Capability map

| Module id | Responsibility | Depends on |
|---|---|---|
| `university-network` | All institutions (≈ 40): ids, names el/en, short names, email domains, departments + years, campus feeds where an RSS exists | — |
| `student-news` | News = announcements + student topics: drop the 8 general sections/feeds, add student-topic sources with keyword routing, student-only topic of the day | `university-network` |
| `student-gate` | Only verified students use the app: server-side checks on every content RPC, client flow sign-up → verify → in; admin + demo exemptions | `university-network` |
| `student-design` | New student-first information architecture and visual design (mockups approved before building), rebuilt with less code | `student-gate`, `student-news` |

Build order: `university-network` → `student-news` + `student-gate` → `student-design`.
Each module gets its own section below; each stops for "OK" before the next (CLAUDE.md phases).

## Assumptions (correct me now)
1. Institutions: all public ΑΕΙ in Greece (incl. ΕΑΠ, ΕΛΜΕΠΑ, ΔΙΠΑΕ), Cyprus public (UCY, ΤΕΠΑΚ, ΑΠΚΥ) + Cyprus
   private universities, Greek licensed non-state universities (ACG today) and the main colleges (City/York Europe,
   Metropolitan, ΒCA, IST, NYC, Mediterranean, ALBA, AKMI, Deree is ACG). Colleges are accepted only if they give
   students their own email domain; departments from official/Wikipedia lists, "Δεν βρίσκω το τμήμα μου" stays.
2. Existing accounts that are not verified (only test/admin ones on live) keep their data but see only the
   verification flow; admins and one App Review demo account are exempt.
3. The 8 general sections (Επικαιρότητα, Tech, Αθλητικά…) are hidden, not deleted, so old voices keep working;
   their RSS feeds are switched off. Their voices became personal voices of their authors (profile + Following)
   and their headlines were removed (built in student-news; simpler than author-only visibility, nothing lost).
4. Student-topic sources = Greek education news sites (e.g. esos.gr, alfavita.gr, eduadvisor.gr, ΕΡΤ Παιδεία)
   filtered by keywords; each feed checked on the real file before it is added.
5. App Review still needs a demo account → a verified demo student is created and documented.

## Commands
- DB tests: `PGHOST=/tmp PGPORT=54329 PGUSER=postgres bash supabase/tests/run.sh`
- Types: `npx tsc --noEmit -p .` · Lint: `npx eslint --rule 'prettier/prettier: off' <files>`
- Build/serve local: scratchpad `local-build.sh <port>` · Browser flows: scratchpad `run-flows.sh <port>`
- Deploy: scratchpad `deploy-prod.sh` (never another way) · Live SQL: Management API (scratchpad `sbq.sh`)

## Project structure (unchanged)
`supabase/migrations/` (one migration per module), `supabase/tests/test_campus.sql` (+ new checks),
`src/lib/campus.ts`, `src/routes/_authenticated/*`, `src/components/*`, `docs/` (security, release checklist).

## Testing strategy
DB: pgTAP-style checks in `supabase/tests` for every new rule (gate refuses non-students, domains map to the right
institution, routing keeps/drops headlines). Browser: Playwright flows in the scratchpad (sign-up → verify → in;
non-student blocked; news only student topics). Live: rolled-back smoke per migration.

## Boundaries
- Always: tests before commits, migrations additive and idempotent, check every RSS/email domain on real data,
  Greek replies, secrets only in the scratchpad.
- Ask first: deleting user data or sections, changing auth settings (confirm email), App Store wording.
- Never: commit keys, accept a domain without a source, show a non-student any user content.

## Success criteria
- `university-network`: ≥ 35 institutions with ≥ 1 verified email domain each; every public ΑΕΙ has its departments;
  an address @<dept>.<uni>.gr resolves to the right institution.
- `student-news`: no general-news headline is ingested; ≥ 3 student-topic sources live; News shows announcements of
  your institution + student topics; topic of the day is student-relevant.
- `student-gate`: an unverified signed-in user gets no rows from any content RPC (feed, topics, profiles, DMs,
  walkie, map) and sees only the verify screen; tests prove it.
- `student-design`: mockups approved; every screen rebuilt; flows green; less UI code than today.

## Decisions (answered)
- Students of a **closed** campus (below its threshold) still use the rest of the app.
- Staff / professors with an academic address are welcome (domains can't tell them apart anyway).
