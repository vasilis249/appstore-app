# ΠΑΠΕΙ, Τουριστικών Σπουδών: one page per semester + two pages of electives (winter: chosen in the 5th/7th semester,
# spring: 6th/8th); each course "ΤΣΚ101. Τίτλος" (English "ΤΣΑΓΓ101.") … "Κατηγορία Μαθήματος: Υποχρεωτικό | Επιλογής".
import re
from lib import save, norm
SRC = "https://tourism.unipi.gr/curriculum/"
PAGES = [(p, n) for n, p in enumerate(["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"], 1)]
PAGES = [(f"courses{p}sem", n, None) for p, n in PAGES] + [
    ("courseselectivefallsem", None, "Χειμερινό εξάμηνο (5ο, 7ο)"), ("courseselectivespringsem", None, "Εαρινό εξάμηνο (6ο, 8ο)")]
rows = []
for page, sem, group in PAGES:
    L = [norm(l) for l in open(f"raw/unipi-tour-{page}.txt")]
    for i, l in enumerate(L):
        if not (m := re.fullmatch(r"(ΤΣ[Α-Ω]*\d+)\. (.+)", l)): continue
        cat = next(x for x in L[i + 1:i + 12] if x.startswith("Κατηγορία Μαθήματος:"))
        rows.append({"code": m[1], "name": m[2], "semester": sem, "group": group,
                     "kind": "core" if "Υποχρεωτικό" in cat else "elective"})
save("unipi", "unipi-tour", SRC, rows)
