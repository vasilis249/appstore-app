# Campus readiness (O4) — proposal, not active

Status: **study only** (user decision 2026-10-23). Production still opens a campus feed at `min_students` verified
students (ΕΜΠ and ΕΚΠΑ: 0 → open; every other university: 100). Nothing below changes behaviour until approved.
The numbers it needs are already computed, read-only, in Admin → Μετρήσεις (`admin_metrics`, "Ετοιμότητα").

## Why change the 100-registration rule
- **Registrations are not a community.** ΑΠΘ has 41 departments: 100 students can mean 2–3 per department — every
  department feed is still empty on the day the campus "opens".
- **Small institutions may never reach 100.** ΑΣΚΤ (2 departments), ΑΣΠΑΙΤΕ (3), private colleges without
  departments: a fixed 100 keeps them closed even when their students are active.
- **What students actually need first is academic** (courses, notes, past papers, course questions) — and that
  already works on a closed campus (O1/O2): the campus *feed* is the only thing that waits.

Live today (2026-10-23, read-only): 13 verified students in 6 institutions (ΕΜΠ 6, ΕΚΠΑ 3, ACG / ΔΠΘ / LSE / USC 1).
With the proposal below no other campus would open yet; ΕΜΠ and ΕΚΠΑ stay open.

## Proposed rule
A department is **ready** when, measured with data we already store:

| Signal | Threshold | Source |
|---|---|---|
| Verified students (not disabled) | ≥ 8 | `profiles.student_verified_at` |
| Active in the last 7 days (anything recorded) | ≥ 3 | posts, likes, listens, downloads, files, thanks, «Το δίνω», groups, messages, follows |
| Resources in the last 30 days | ≥ 3 | course files + course questions of the department's courses |

A university's campus feed **opens** when any of these holds:
1. the existing rule: verified students ≥ `min_students` (kept, so nothing that is open today closes);
2. **density**: ≥ 2 ready departments — or 1 when the university has ≤ 3 departments;
3. **no departments** (colleges): the whole institution counts as one department with doubled thresholds
   (≥ 15 students, ≥ 5 active in 7 days, ≥ 5 resources in 30 days).

**Once open, always open.** A new column `universities.opened_at` is set the first time the rule holds and never
cleared by the job (only an admin can close a campus, as today with the threshold). Quiet weeks don't close a campus.

### Small universities and small departments
- Thresholds are absolute, small numbers (8 / 3 / 3): a 40-student department can reach them; a percentage of
  enrolment would need data we don't have.
- ≤ 3 departments → one ready department is enough (rule 2); no departments → rule 3.
- A department below 8 students still has everything academic (courses, files, Q&A, year group) — only the shared
  campus feed waits, and the waiting screen shows the department board and invites.

### Before a campus opens (first students)
Already in place: this-semester course pick («Το δίνω»), course pages with notes / past papers / questions, the
department-year group, classmates suggestions, invites with a progress board. Proposed addition with the rule: the
waiting screen shows *readiness per department* ("Πληροφορική: 6/8 φοιτητές · 2/3 ενεργοί · 1/3 υλικό") instead of
"x / 100", so students see exactly what unlocks their campus — honest numbers, nothing invented.

## Implementation sketch (after approval)
1. Migration: `universities.opened_at timestamptz`; backfill `now()` for universities open today (ΕΜΠ, ΕΚΠΑ).
2. `private.department_readiness(university)` = the same SQL as `admin_metrics` departments (one source of truth).
3. Cron `campus-readiness` hourly → sets `opened_at` where rule 2 or 3 holds.
4. `campus_status()` → `is_open = students ≥ min_students OR opened_at IS NOT NULL` (+ readiness rows for the
   waiting screen). No client change is needed for the opening itself; the waiting screen gets the readiness rows.
5. Tests: open stays open, density opens, small-university and no-department paths, nobody is told anything private.

## Impact
- **Students**: campuses with an active core open earlier; big campuses don't open "empty".
- **Moderation**: earlier openings mean feeds need moderators sooner — appoint a campus moderator when a campus
  approaches readiness (Admin → Campus).
- **Risk**: gaming by a few accounts is limited by verification (one account per academic address) and by requiring
  activity + resources, not registrations alone.
- **Rollback**: set `opened_at` back to NULL for a campus (admin SQL) and the existing rule applies again.

## Needs your decision
- Approve the thresholds (8 students / 3 active / 3 resources; 2 ready departments, 1 for ≤ 3 departments).
- Approve "once open, always open".
