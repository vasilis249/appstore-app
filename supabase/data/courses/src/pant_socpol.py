# Πάντειο, Κοινωνικής Πολιτικής: «Προπτυχιακά μαθήματα» page — per «Επίπεδο Συνθετότητας ΕΣn» (= year n) rows
# "code | title | Χειμερινό/Εαρινό | category | ECTS"; semester = 2(n−1) + 1 (winter) / 2 (spring). Υποχρεωτικό = core,
# every other category (Υποχρεωτικό Επιλογής, Ελεύθερης Επιλογής, Σεμινάριο) = elective with the category as group.
import re
from lib import save, norm
SRC = "https://socialpolicy.panteion.gr/studies/undergraduate/courses"
rows, year = [], None
for l in map(norm, open("raw/pant-socpol.txt")):
    if m := re.search(r"Επίπεδο Συνθετότητας: ΕΣ(\d)", l): year = int(m[1]); continue
    c = [x.strip() for x in l.split("|")]
    if year and len(c) == 5 and re.fullmatch(r"\d{6}", c[0]):
        sem = 2 * (year - 1) + (1 if c[2].startswith("Χειμ") else 2)
        core = c[3] == "Υποχρεωτικό"
        rows.append({"code": c[0], "name": c[1], "semester": sem, "kind": "core" if core else "elective",
                     "group": None if core else c[3]})
save("panteion", "panteion-socpol", SRC, rows)
