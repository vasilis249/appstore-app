# Οδοντιατρική ΕΚΠΑ: Curriculum 2025-26 §3.9 «Πίνακας μαθημάτων». Rows with * (and the "για εισαχθέντες" part) are
# non-examined first halves of a course listed again in a later semester → kept once, where it is examined.
import re
from lib import save, norm
SRC = "https://www.dent.uoa.gr/fileadmin/depts/dent.uoa.gr/www/uploads/Documents/Studies/UnderGraduate/Curriculum_2025-26_v2.pdf"
L = [norm(l) for l in open("raw/dent.txt")]
L = L[next(i for i, l in enumerate(L) if l == "3.9 Πίνακας μαθημάτων"):next(i for i, l in enumerate(L) if l.startswith("4. Πίνακες και περιγράμματα"))]
ROW = re.compile(r"^\d+\. (\d{5}[Α-Ω]{0,2}) (.+?) [IOΟ] [\d,]+ [\d,]+$")
EL = re.compile(r"^\d+\. (\d+)ο(?: & \d+ο)? (\d{5}) (.+?) [\d,]+$")
rows, sem, cur, elect = [], None, None, False
def flush():
    global cur
    if cur and not cur["name"].endswith("*") and "για εισαχθέντες" not in cur["name"]:
        cur["name"] = re.sub(r"\s*\(μάθημα επιλογής\)", "", cur["name"], flags=re.I); rows.append(cur)
    cur = None
for l in L:
    if m := re.match(r"^Μαθήματα (\d+)ου εξαμήνου$", l): flush(); sem = int(m[1]); continue
    if l == "Μαθήματα επιλογής": flush(); elect = True; continue
    m = (EL if elect else ROW).match(l)
    if m:
        flush()
        cur = {"code": m[2], "name": m[3], "semester": int(m[1]), "kind": "elective"} if elect else {"code": m[1], "name": m[2], "semester": sem, "kind": "core"}
    elif cur and not re.match(r"^(\d+|Α/Α|\(ECTS\)|=== page|Σύνολα|Οι φοιτητές)", l): cur["name"] += " " + l.replace("επιλογής)", "").strip()
    else: flush()
flush()
for r in rows: r["name"] = re.sub(r"\s*\(μάθημα\s*$", "", r["name"]).strip()
save("uoa", "uoa-dent", SRC, rows, note="Non-examined first parts (* in the table) are merged into the semester the course is examined.")
