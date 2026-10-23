# Κρήτη Επιστήμης Υπολογιστών: «Κατάλογος μαθημάτων» (raw/uoc/csd.html: core table, elective areas Ε1–Ε9, free
# electives) + «Πρότυπο πρόγραμμα» (raw/uoc/csd-model.html) for the semesters of core courses; electives have none.
import re
from lib import save
from html_tables import tables
SRC = "https://www.csd.uoc.gr/index.jsp?content=courses_catalog&openmenu=demoAcc3&lang=gr"
code = lambda s: re.sub(r"\s", "", s.upper().translate(str.maketrans("ΗΥΕΜΦΣ", "HYEMFS")))  # Greek look-alike capitals
sem = {}
for head, rows in tables("raw/uoc/csd-model.html"):
    if m := re.match(r"(\d+)ο εξάμηνο", head):
        for r in rows: sem.setdefault(code(r[0]), int(m[1]))
out = []
for _, rows in tables("raw/uoc/csd.html")[2:]:
    area = rows[0][0]
    kind = "core" if area == "Μαθήματα κορμού" else "elective"
    group = None if kind == "core" or "Ελεύθερης" in area else re.sub(r"^Μαθήματα Επιλογής |\s*\(\w\d\)$", "", area)
    for r in rows[2:]:
        if len(r) >= 2 and re.match(r"[A-ZΑ-Ω]{2,3}-?\d", code(r[0])):
            out.append({"code": code(r[0]), "name": r[1], "semester": sem.get(code(r[0])) if kind == "core" else None,
                        "kind": kind, "group": group})
save("uoc", "uoc-csd", SRC, out)
