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
