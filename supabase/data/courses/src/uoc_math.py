# Κρήτη Μαθηματικών και Εφαρμοσμένων Μαθηματικών: the two track pages («Μαθήματα κατεύθυνσης Μαθηματικών»
# raw/uoc/math.html, «… Εφαρμοσμένων Μαθηματικών» raw/uoc/math-appl.html), HTML tables "ΜΕΜ-code | title | hours | ECTS".
# «Υποχρεωτικά» in both tracks = core, in one = track_core of that track; every other listed course = elective of the
# track(s) listing it. The pages give no semesters.
import re
from lib import save
from html_tables import tables
SRC = "https://math.uoc.gr/μαθήματα-κατεύθυνσης-μαθηματικών/"
TRACKS = {"Μαθηματικά": "raw/uoc/math.html", "Εφαρμοσμένα Μαθηματικά": "raw/uoc/math-appl.html"}
name, req, listed = {}, {t: set() for t in TRACKS}, {t: set() for t in TRACKS}
for track, path in TRACKS.items():
    for head, rows in tables(path):
        for r in rows:
            if len(r) >= 2 and re.fullmatch(r"ΜΕΜ-\d{3}", r[0]):
                name.setdefault(r[0], r[1]); listed[track].add(r[0])
                if head.startswith("Υποχρεωτικά"): req[track].add(r[0])
out = []
for code, n in name.items():
    inreq = [t for t in TRACKS if code in req[t]]
    if len(inreq) == len(TRACKS): out.append({"code": code, "name": n, "semester": None, "kind": "core"})
    for t in TRACKS:
        if 0 < len(inreq) < len(TRACKS) and t in inreq:
            out.append({"code": code, "name": n, "semester": None, "kind": "track_core", "group": t})
        elif not inreq and code in listed[t]:  # required in one track: listed only as that track's course
            out.append({"code": code, "name": n, "semester": None, "kind": "elective", "group": t})
save("uoc", "uoc-math", SRC, out)
