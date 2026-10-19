# Ψυχολογία ΕΚΠΑ: Οδηγός Σπουδών 2025-26 pp. 17-21 (right margin cropped: it carries vertical text). A1 = 21 compulsory,
# A2 = 4 elective groups (no fixed semester: offered winter or spring); semesters of compulsory courses from the
# «Ενδεικτικό πρόγραμμα σπουδών».
import re
from lib import save, norm, fold
SRC = "https://www.psych.uoa.gr/fileadmin/depts/psych.uoa.gr/www/uploads/study/undergraduate/student_handbook/StudyGuide_2025_2026.pdf"
SEMS = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
L = [norm(l) for l in open("raw/psych-crop.txt")]
rows, kind, group, cur, sem_of = [], None, None, None, {}
for l in L:
    if l.startswith("Α1."): kind, group = "core", None; continue
    if m := re.match(r"^ΟΜΑΔΑ (Ι|ΙΙ|ΙΙΙ|ΙV) \((.+?)\)", l): kind, group = "elective", f"Ομάδα {m[1]}: {m[2]}"; continue
    if l.startswith(("Β. Μαθήματα άλλων", "Α2.")): kind = None if l.startswith("Β.") else kind; cur = None; continue
    if not kind: continue
    l = re.sub(r"^(?:[Α-Ω]{1,2}|\d) (?=(\d+\. ΨΧ|Κουλτούρα))", "", l)
    if m := re.match(r"^\d+\. (ΨΧ\d+): (.+)$", l):
        cur = {"code": m[1], "name": m[2], "semester": None, "kind": kind, "group": group}; rows.append(cur)
    elif cur and len(l) > 3 and not l.startswith("=== page") and not re.match(r"^\d", l): cur["name"] += " " + l
    else: cur = None
# indicative programme: "<left> e d <right> e d" rows under "Α΄ … Β΄ …" headings
pair = None
for l in L[next(i for i, l in enumerate(L) if l.startswith("ΕΝΔΕΙΚΤΙΚΟ")):]:
    if m := re.match(r"^(ΣΤ|[Α-Η])΄ \d+ \d+ (ΣΤ|[Α-Η])΄ \d+ \d+$", l): pair = (SEMS[m[1]], SEMS[m[2]]); continue
    if pair and (m := re.match(r"^(.+?) \d \d (.+?) \d \d$", l)):
        for s, n in zip(pair, (m[1], m[2])): sem_of.setdefault(fold(n.replace("&", "και")), s)
for r in rows:
    if r["kind"] == "core":
        r["semester"] = sem_of.get(fold(r["name"]))
        assert r["semester"], r["name"]
rows += [{"code": "ΨΧ117", "name": "Πρακτική Άσκηση Ι", "semester": 7, "kind": "core"},
         {"code": "ΨΧ118", "name": "Πρακτική Άσκηση ΙΙ", "semester": 8, "kind": "core"},
         {"code": "ΨΧ119", "name": "Πτυχιακή Εργασία Ι", "semester": 7, "kind": "elective", "group": "Πτυχιακή ή 4 μαθήματα επιλογής"},
         {"code": "ΨΧ120", "name": "Πτυχιακή Εργασία ΙΙ", "semester": 8, "kind": "elective", "group": "Πτυχιακή ή 4 μαθήματα επιλογής"}]
for r in rows:
    if r["code"] == "ΨΧ135" and not r["name"].endswith("Κουλτούρα"): r["name"] += " Κουλτούρα"
save("uoa", "uoa-psych", SRC, rows, note="Psychology electives have no fixed semester (semester null); 9 free courses from other departments are not listed.")
