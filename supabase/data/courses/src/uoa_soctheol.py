# Κοινωνικής Θεολογίας και Θρησκειολογίας ΕΚΠΑ: Πρόγραμμα Σπουδών 2026-27, Άρθρο 9 «Ενδεικτικό πρόγραμμα» (per semester:
# Υποχρεωτικά / Επιλογής, "Title 39 ECTS"; wrapped titles continue on the next line). (Τ.Δ.Ε.Ο.) = taught by the
# Department of Business Administration, part of this programme's electives.
import re
from lib import save, norm
SRC = "https://www.soctheol.uoa.gr/fileadmin/depts/soctheol.uoa.gr/www/uploads/PPS/Programma_Proptychiakon_Spoydon_Tmimatos_Koinonikis_THeologias_kai_THriskeiologias_akad.etoys_2026-2027.pdf"
SEMS = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
L = [norm(l) for l in open("raw/soct.txt")]
L = L[next(i for i, l in enumerate(L) if l.startswith("Άρθρο 9:")):next(i for i, l in enumerate(L) if l.startswith("Άρθρο 10:"))]
rows, sem, kind, cur = [], None, None, None
for l in L:
    if m := re.match(r"^(ΣΤ|[Α-Η])' Εξάμηνο$", l): sem, cur = SEMS[m[1]], None; continue
    if l.startswith("Μαθήματα Υποχρεωτικά"): kind, cur = "core", None; continue
    if l.startswith("Μαθήματα Επιλογής"): kind, cur = "elective", None; continue
    if not kind or l.startswith(("Σελίδα", "===", "Σπουδών")): continue
    if m := re.match(r"^(.+?) 39 \d+$", l):
        cur = {"name": m[1], "semester": sem, "kind": kind, "group": "Επιλογής" if kind == "elective" else None}; rows.append(cur)
    elif cur: cur["name"] += " " + l; cur = None
save("uoa", "uoa-soctheol", SRC, rows, note="2026-27 programme (27 compulsory + 20 electives, up to 4 of them from the Department of Business Administration, marked Τ.Δ.Ε.Ο.).")
