# Κοινωνιολογίας ΕΚΠΑ: «Διάρθρωση Προγράμματος Σπουδών» — ανά εξάμηνο, (Υ) υποχρεωτικό / (ΥΕ) κατ' επιλογήν υποχρεωτικό.
import re
from lib import save, norm, lines_of
SRC = "https://www.soc.uoa.gr/proptychiakes-spoudes/kanonismos-kai-odigos-spoudon/diarthrosi-programmatos-spoudon/"
rows, sem = [], None
for l in (norm(x) for x in lines_of("raw/soc-d.html")):
    if m := re.match(r"^(\d)ο Εξάμηνο$", l): sem = int(m[1]); continue
    if sem and l.startswith("Οι ώρες διδασκαλίας"): break
    if sem and (m := re.match(r"^(.+?) \((Υ|ΥΕ)\)$", l)) and not l.startswith("Επιλογή "):
        rows.append({"name": m[1], "semester": sem, "kind": "core" if m[2] == "Υ" else "elective",
                     "group": None if m[2] == "Υ" else "Κατ' επιλογήν υποχρεωτικό"})
save("uoa", "uoa-soc", SRC, rows)
