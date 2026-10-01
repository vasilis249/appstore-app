# Plan: Speak for students only (see SPEC.md)

1. `university-network` — data first, no UI risk.
   - Source institutions + departments from el.wikipedia lists (one page per institution group), email domains
     from each institution's IT/webmail page, RSS from each news page; verify every domain/feed on real data.
   - One additive migration (`…_greek_cyprus_universities.sql`): universities (+ `country`), departments, feeds.
   - Tests: counts per institution, domain → institution resolution (incl. sub-domains), feeds parse.
   - UI: university picker copes with ≈ 40 (search, grouped by city), email step shows the detected institution.
2. `student-news` — hide general sections, stop their feeds, add student-topic sources with keyword routing,
   News = your institution's announcements + student topics; student topic of the day.
3. `student-gate` — `private.is_student()` (verified, or admin / demo); every content RPC/policy checks it; client:
   sign-up → verify → in; tests prove an unverified user gets nothing.
4. `student-design` — mockups → approval → rebuild screens with less code.
Checkpoints: tests + flows green, live smoke, deploy, report, "OK" after each module.
