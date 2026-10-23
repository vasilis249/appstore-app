# Κρήτη Ιατρικής: «Πρόγραμμα Σπουδών 2026-2027» (raw/uoc/med-prog.pdf). Core: cells "ΙΣ 3.4 Title ΩΔΕ ECTS" (semester =
# the number before the dot) and the clinical rotations "ΙΣ ΚΛ. Α … weeks ECTS" (9th–12th semester, no fixed one).
# «Μαθήματα κατ' επιλογήν υποχρεωτικά»: rows "ΙΣ 2.6 | Title | ΩΔΕ | ECTS" under "ΔΕΥΤΕΡΟ ΕΞΑΜΗΝΟ"-style headings.
import re
from lib import save, norm
from up_tables import rows
SRC = "https://med.uoc.gr/ekpaideysh/proptixiaka/organosi-spoudes/"
ORD = {"ΔΕΥΤΕΡΟ": 2, "TΡΙΤΟ": 3, "ΤΡΙΤΟ": 3, "TΕΤΑΡΤΟ": 4, "ΤΕΤΑΡΤΟ": 4, "ΠΕΜΠΤΟ": 5, "EΚΤΟ": 6, "ΕΚΤΟ": 6, "ΕΒΔΟΜΟ": 7,
       "ΟΓΔΟΟ": 8, "ΕΝΑΤΟ": 9, "ΔΕΚΑΤΟ": 10, "ΕΝΔΕΚΑΤΟ": 11, "ΔΩΔΕΚΑΤΟ": 12}
fix = lambda s: s.replace("B", "Β").replace("X", "Χ").replace("I", "Ι") if s[:1] in "BXI" else s  # Latin first letters
out, elective, sem, last = [], False, None, None
for text, c in rows("raw/uoc/med-prog.pdf"):
    if text and "ΚΑΤ’ ΕΠΙΛΟΓΗΝ" in text: elective = True
    if not c: continue
    cells = [x for x in c if x]
    if not cells: continue
    if m := re.fullmatch(r"(\S+) ΕΞΑΜΗΝΟ", cells[0]): sem = ORD.get(m[1]); continue
    if not elective:
        for x in cells:
            if m := re.fullmatch(r"(ΙΣ (\d+)\.\d+) (.+?) \d+ \d+", x):
                out.append({"code": m[1], "name": fix(m[3]), "semester": int(m[2]), "kind": "core"})
            elif m := re.fullmatch(r"(ΙΣ ΚΛ\. \S+) (.+?) \d+ \d+", x):
                out.append({"code": m[1], "name": m[2].replace("Κλιν. Άσκηση", "Κλινική Άσκηση"), "semester": None, "kind": "core"})
        continue
    if re.fullmatch(r"ΙΣ \d+\.\d+|ΠΚ\d+", cells[0]) and len(cells) > 1:
        last = {"code": cells[0], "name": fix(cells[1]), "semester": sem, "kind": "elective"}; out.append(last)
        col = c.index(cells[1])
    elif last and not re.match(r"[(\d]|Mαθήματα|Μαθήματα", cells[0]) and len(cells) == 1 and c.index(cells[0]) == col:
        last["name"] = norm(last["name"] + " " + cells[0])  # title wrapped into the next rows (same column)
    else: last = None
save("uoc", "uoc-med", SRC, out)
