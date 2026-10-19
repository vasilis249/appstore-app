# Course catalog scrapers

One script per department (`<uni>_<dept>.py`) turns that department's official programme (URL in its `SRC`)
into rows of `../<uni>.json` via `lib.save()` (`lib.missing()` records a department whose programme could not be
read). Download the source into `raw/` first (file name as read by the script; `get.sh <url> <name>` saves pages
as `raw/<name>.html`), run the script from this folder (`python3 uoa_dent.py`), then `python3 ../check.py`.
Needs `pdfplumber`. `raw/` is not committed (copyrighted sources, re-downloadable).
mech.ntua.gr serves an incomplete TLS chain: fetch the HARICA intermediate (AIA URL in the server certificate) and
pass a bundle with `--cacert` instead of disabling verification.
