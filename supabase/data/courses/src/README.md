# Course catalog scrapers

One script per department (`<uni>_<dept>.py`) turns that department's official programme (URL in its `SRC`)
into rows of `../<uni>.json` via `lib.save()` (`lib.missing()` records a department whose programme could not be
read). Download the source into `raw/` first (file name as read by the script; `get.sh <url> <name>` saves pages
as `raw/<name>.html`), run the script from this folder (`python3 uoa_dent.py`), then `python3 ../check.py`.
Needs `pdfplumber`. `raw/` is not committed (copyrighted sources, re-downloadable).
mech.ntua.gr serves an incomplete TLS chain: fetch the HARICA intermediate (AIA URL in the server certificate) and
pass a bundle with `--cacert` instead of disabling verification.
Upper-case titles are re-cased with `lib.recaser()` (word forms from the other texts in `raw/`, then a general Greek
word list `raw/el_words.txt` = https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/el/el_full.txt,
then the "-ικός" ending rule; unknown words stay upper case and are printed). ΠΑΔΑ: `uniwa_fetch.py <site> <path>`
downloads a department's course pages for `uniwa_theme.py`.
ΑΠΘ: most departments come from the university's public course catalogue API (`auth_api.py --fetch`, then
`auth_api.py`: courses.auth.gr Universis `SpecializationCourses/<program>/<year>/`, with semester, type and track);
departments with a readable official guide keep their own script (`auth_<dept>.py`, `auth_cpt.py`).
Πάτρα: no catalogue API; `up_fetch.py` downloads course pages via the sites' sitemaps. Tables in the programme PDFs
are read with `up_tables.rows()` (pdfplumber `find_tables()` + the heading text above each table); `up_generic.py
[dept…]` parses the 13 departments whose tables share one layout (settings in its `DEPTS`); the rest keep their own
`up_<dept>.py`. `up_missing.py` records ece, ecedu and sustagri (sites refuse this container) and env / culture.
Κρήτη: guides.uoc.gr links every department's own programme; `html_tables.tables()` reads HTML course tables (csd,
math), `pdftext.pages()` gives page texts to the guide parsers, `up_tables.rows()` the ruled PDF tables. physics.uoc.gr
refuses this container (`uoc_missing.py`).
Πολυτεχνείο Κρήτης: courses.tuc.gr is Universis like ΑΠΘ (API host `universis-api.tuc.gr`, from the app's
`assets/config/app.production.json`); `tuc_api.py --fetch` then `tuc_api.py` (2026-27 programmes, years 2025 + 2026).
Ιωάννινα: the university's official «Ιδρυματικός κατάλογος μαθημάτων» 2025-26 (uoi.gr, one xlsx sheet per department)
→ `uoi_catalog.py` for 22 departments; Μηχανικών Επιστήμης Υλικών from its own detailed programme page (the catalogue
gives that department course types only). The uoi.gr hosts answer 403 to curl's user agent: fetch with a browser one.
