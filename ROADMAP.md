# Speak — product audit and roadmap (2026-10-23)

Positioning: "Your university life, in one place." Academic utility brings students in; campus community keeps them.
Every change must make Speak more useful, reduce friction, help retention or the campus network — safely and simply.

## What works well
- Verified students only: one-time code to an academic address, one account per address (hashed), closed to others
  by RLS (`private.is_student`, campus isolation in every content RPC); ~400 DB tests across 10 suites.
- Course catalog: ~19,000 courses over 14 universities (core / track / elective, by semester), notes + past papers per
  course, «Το δίνω» → notices for new files, downloads / thanks / points, copyright reports (3 reports hide).
- Automatic department and department-year groups, classmates in suggestions, invite links, campus moderators.
- Moderation (reports → admins / campus moderators, auto-hide), blocking everywhere, account deletion removes files.
- Public share page shows a teaser only (first name, text, counts; never voice, photos or surname).

## Weak or missing (most important first)
1. **Closed campuses showed nothing useful.** Every university except ΕΜΠ / ΕΚΠΑ waits for 100 students and its
   Campus tab was only a progress screen, although courses, notes and the year group already work there. → fixed (O1).
2. **Course notices reached almost nobody.** «Το δίνω» was only on each course page, so new files notified few
   people. → this semester's courses offered on Campus, core ones ticked (O1).
3. **Courses are not in the main navigation** (Home · Map · Search · Profile): the academic core is a card on Campus,
   the map has a primary tab. → decision needed (O2).
4. **No course Q&A.** Questions are campus posts in «Ερωτήσεις», not linked to a course; no accepted answer.
5. **No metrics.** Nothing measures verification completion, first meaningful action, retention or campus density.
   Plan: admin-only numbers computed from data we already store (no new tracking, no third parties).
6. **Notifications are all-or-nothing** (push on for every kind); no per-kind settings.
7. **Campus opening = 100 registrations.** Registrations are not a healthy community; readiness should weigh
   departments with active students and resources. Keep the current rule until a replacement is approved.
8. **Catalog gaps:** 9 public universities + Cyprus still without courses; some departments refused this container.
9. **Test debt:** scratchpad browser flows growth / attica / campus / campus-groups fail on the current main build
   (stale since the 3-step sign-up); the repo flows (`tests/e2e`) are green.

## Plan (one phase at a time, stop for "OK" after each)
- **O1 ✔ Day-one academic value** — Campus "which courses do you have this semester?" card; closed campuses show
  courses, the pick and the year group before the waiting progress; department board without empty rows.
- **O2 Courses at the centre** — Courses tab in the bottom nav (decision: replace Map, or move Map into the header);
  course Q&A: a question tied to a course (campus post + `course_id`), «Ερωτήσεις» tab on the course page, takers
  notified, the asker marks a helpful answer.
- **O3 Measure and tune** — admin metrics RPC + screen (verified / week, activated in 7 days = picked courses,
  posted, uploaded or joined a group; weekly active contributors per campus and department; referral joins; report
  response time); per-kind notification settings.
- **O4 Campus readiness** — open per department when it has enough verified students and some resources (proposal,
  needs approval); ambassador support on top of invite links.
- **Catalogs** continue one university per phase (Ιωάννινα next), then Europe.

## Needs a human decision or legal review
- Navigation: Courses tab instead of Map (Map is a past explicit request).
- Production deploys after each phase (this phase is committed, not deployed).
- Legal wording: "listen once" voice messages can still be recorded by the recipient's device; Terms / Privacy must
  not promise more than the app enforces — have a lawyer review Terms, Privacy, DSA notice-and-action and GDPR roles.
