# Πάτρα Πολιτικών Μηχανικών: one page per semester and per track (raw/up-civil/NN.html in the order of urls.txt, from the
# «Όλα τα μαθήματα» menu): "Title / CIV_code / ECTS" (or one "Title | CODE | ECTS" line). Pages 0-7 = semesters 1-8 core,
# 8 = the 8th-semester compulsory course of each Κατεύθυνση Εμβάθυνσης, then per semester 8 / 9 / 10 the electives of
# tracks 1-4 (page 13 / 18 = the 9th / 10th semester overview: diploma thesis, practice).
import re
from lib import save, norm
from auth_cpt import text
SRC = "https://www.civil.upatras.gr/index.php/all_courses/"
TRACKS = {1: "Κατασκευές", 2: "Γεωτεχνική Μηχανική – Έργα Υποδομής", 3: "Υδραυλική Μηχανική – Τεχνολογία Περιβάλλοντος",
          4: "Συστήματα Βιώσιμων Μεταφορών και Διαχείρισης Έργων"}
PAGES = {**{i: (i + 1, "core", None) for i in range(8)}, 8: (8, "track_core", None),
         **{9 + t: (8, "elective", t + 1) for t in range(4)}, 13: (9, "core", None),
         **{14 + t: (9, "elective", t + 1) for t in range(4)}, 18: (10, "core", None),
         **{19 + t: (10, "elective", t + 1) for t in range(4)}}
CODE = r"CIV_\w+"
rows = []
for page, (sem, kind, track) in PAGES.items():
    L = text(f"raw/up-civil/{page:02d}.html")
    L = L[next(i for i, l in enumerate(L) if re.search(r"\+0[23]:00", l)):]
    L = L[:next((i for i, l in enumerate(L) if l == "ΤΜΗΜΑ ΠΟΛΙΤΙΚΩΝ ΜΗΧΑΝΙΚΩΝ"), len(L))]
    group = TRACKS.get(track)
    for i, l in enumerate(L):
        if m := re.search(r"Κατεύθυνση Εμβάθυνσης: «(.+?)»", l): group = m[1]
        if m := re.fullmatch(rf"(.+?) \| ({CODE}) \| .*", l): name, code = m[1], m[2]
        elif re.fullmatch(CODE, l) and i > 0: name, code = next(x for x in reversed(L[:i]) if re.search(r"[^\W\d]{3}", x)), l
        else: continue
        rows.append({"code": code, "name": norm(re.sub(r"\*+$|\s\(\d.*\)$", "", name)), "semester": sem, "kind": kind,
                     "group": group})
save("upatras", "upatras-civil", SRC, rows)
