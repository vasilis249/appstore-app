# Κρήτη Ιστορίας και Αρχαιολογίας: «Προσφερόμενα προπτυχιακά μαθήματα 2026-27» (raw/uoc/hist-arch-list.pdf): per subject
# ("Αρχαία ιστορία / Ancient History", the line before a "… εξάμηνο / … semester" line) bullets
# "• CODE: Teacher(s), Greek title / Teacher, English title". The "001" introductions of the 9 subjects = core of the
# first year (winter → 1st, spring → 2nd semester); everything else = electives grouped by subject, no fixed semester.
import re
from lib import save, norm
from pdftext import pages
SRC = "https://www.history-archaeology.uoc.gr/proptychiakes-spoydes/prosferomena-mathimata/"
L = [norm(l) for t in pages("raw/uoc/hist-arch-list.pdf") for l in t.splitlines() if norm(l)]
items, area, term = [], "Παιδαγωγική και Διδακτική Επάρκεια", None
for i, l in enumerate(L):
    if re.fullmatch(r"[Α-ΩΆ-Ώ][^,•]* / [A-Z][^,]*", l) and "εξάμηνο / " not in l and not re.match(r"(Παραδόσ|Παράδοσ|Σεμινάρι)", l):
        area = {"Επάρκειας": "Παιδαγωγική και Διδακτική Επάρκεια"}.get(l.split(" / ")[0], l.split(" / ")[0])  # heading wrapped over two lines
    elif "εξάμηνο / " in l: term = 1 if l.startswith("Χειμερινό") else 2
    elif l.startswith("•"): items.append([area, term, l[1:].strip()])
    elif items and not re.match(r"(Παραδόσ|Παράδοσ|Σεμινάρι)\w* / ", l): items[-1][2] += " " + l
out = []
for area, term, t in items:
    m = re.match(r"([^:]+?): [^,]+, (.+?) ?/ ?[A-Z]", t)  # code, teachers, Greek title up to the English part
    if not m: print("??", t); continue
    code = m[1].strip()
    core = code.endswith(" 001")
    out.append({"code": code, "name": m[2].strip(" ,"), "semester": term if core else None,
                "kind": "core" if core else "elective", "group": None if core else area})
save("uoc", "uoc-hist-arch", SRC, out)
