# Φαρμακευτικής ΕΚΠΑ: Οδηγός Σπουδών 2025-26, Άρθρο 12 «Πρόγραμμα σπουδών» (10 εξάμηνα, integrated master).
import re
from lib import save, norm
SRC = "https://www.pharm.uoa.gr/fileadmin/depts/pharm.uoa.gr/www/uploads/ODIGOI_SPOUDWN/Odigos_Spoudon_2025_2026.pdf"
SEMS = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "Στ": 6, "Ζ": 7, "Η": 8, "Θ": 9, "Ι": 10}
L = [norm(l) for l in open("raw/pharm.txt")]
a = max(i for i, l in enumerate(L) if l.startswith("5.12. Άρθρο 12"))  # the first match is the table of contents
b = next(i for i in range(a, len(L)) if L[i].startswith("Επισημαίνεται ότι"))
rows, sem, kind, cur = [], None, "core", None
for l in L[a:b]:
    if m := re.match(r"^(Στ|[Α-Ι]). ΕΞΑΜΗΝΟ$", l): sem, kind, cur = SEMS[m[1]], "core", None; continue
    if l.startswith("ΥΠΟΧΡΕΩΤΙΚΑ"): kind, cur = "core", None; continue
    if re.match(r"^ΜΑΘΗΜ\w* ΕΠΙΛΟΓΗΣ", l): kind, cur = "elective", None; continue
    if not sem or re.match(r"^(ΣΥΝΟΛΟ|\(|κατανέμεται|=== |\d+$)", l): cur = None; continue
    if m := re.match(r"^((?:ΠΡΑ|ΔΕ)\d|[Α-ΩA-Z]\d{3,4}[ΕE]?) (.+?) (\d+|-)$", l):
        cur = {"code": m[1].replace("E", "Ε").replace("H", "Η"), "name": m[2], "semester": sem, "kind": kind}; rows.append(cur); continue
    if cur: cur["name"] += " " + l
for r in rows: r["name"] = norm(r["name"].replace("Μarketing", "Marketing"))
save("uoa", "uoa-pharm", SRC, rows)
