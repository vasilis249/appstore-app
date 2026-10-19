# Νομική ΕΚΠΑ: Οδηγός Σπουδών 2026-27 — «Αποτελέσματα ανά εξάμηνο»: "Τίτλος – κωδ. ΧΧΧΧ" under semester / kind headings.
import re
from lib import save, norm
SRC = "https://www.law.uoa.gr/fileadmin/depts/law.uoa.gr/www/uploads/Sxoli/Odigos_spoudon/ODIGOS_SPOYDON_2026-2027.pdf"
SEMS = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
L = [norm(l) for l in open("raw/law.txt")]
L = L[next(i for i, l in enumerate(L) if l == "ΑΠΟΤΕΛΕΣΜΑΤΑ ΑΝΑ ΕΞΑΜΗΝΟ" and i > 1000):]
CODE = re.compile(r"^(.*?)\s*[–-]?\s*κωδ\.?\s*(\d{2}[Α-Ω]{2,3}\d+|[Α-Ω]{2,3}\s?\d+|\d{4})?\s*(\(.*)?$")
rows, sem, kind, group = [], None, "core", None
for i, l in enumerate(L):
    if m := re.match(r"^(ΣΤ|[Α-Η]) ?΄ ?ΕΞΑΜΗΝΟ$", l): sem, kind, group = SEMS[m[1]], "core", None; continue
    if l.startswith("Υποχρεωτικά Μαθήματα"): kind, group = "core", None; continue
    if re.match(r"^Μαθήματα Υποχρεωτικής Επιλογής", l, re.I): kind, group = "elective", "Υποχρεωτικής επιλογής"; continue
    if re.match(r"^Μαθήματα Ελεύθερης Επιλογής", l, re.I): kind, group = "elective", "Ελεύθερης επιλογής"; continue
    if not sem or "κωδ" not in l or len(l) > 170 or l.startswith("Τομέας"): continue
    m = CODE.match(l)
    if not m: continue
    title, code = m[1].strip(" –-"), (m[2] or "").replace(" ", "")
    if not code and i + 1 < len(L) and (mm := re.match(r"^(\d{4}|[Α-Ω]{2}\s?\d+)\b", L[i + 1])): code = mm[1].replace(" ", "")
    if not title: title = L[i - 1]
    if not code or (title and title[0].islower()): continue
    rows.append({"code": code, "name": title.rstrip(" –-").replace("Συγκριτκό", "Συγκριτικό"), "semester": sem, "kind": kind, "group": group})
save("uoa", "uoa-law", SRC, rows)
