# ΠΑΔΑ, Ναυπηγών Μηχανικών: «Μαθήματα ΠΠΣ» — per «Nο ΕΞΑΜΗΝΟ» tables, one cell per line (a/a, code, TITLE, ECTS, …)
# under "ΥΠΟΧΡΕΩΤΙΚΑ" / "ΚΑΤ’ ΕΠΙΛΟΓΗΝ ΥΠΟΧΡΕΩΤΙΚΑ ΜΑΘΗΜΑΤΑ ΘΕΜΑΤΙΚΗΣ ΕΝΟΤΗΤΑΣ Α΄" / "ΚΑΤ’ ΕΠΙΛΟΓΗΝ" (internship).
# A title may wrap onto the next cell line; titles are re-cased.
import re
from lib import save, norm, recaser
SRC = "https://na.uniwa.gr/courses/"
case = recaser([], hand={"ατμοστροβιλοι": "ατμοστρόβιλοι", "πηδαλιουχιασ": "πηδαλιουχίας",
                         "νηογνωμονων": "νηογνωμόνων", "ναυτικημηχανολογια": "ναυτική μηχανολογία"})
L = [norm(l) for l in open("raw/uniwa-naval.txt") if norm(l)]
rows, sem, head = [], None, None
for i, l in enumerate(L):
    if m := re.fullmatch(r"(\d+)ο ΕΞΑΜΗΝΟ", l): sem = int(m[1]); continue
    if l.startswith("ΥΠΟΧΡΕΩΤΙΚΑ") or l.startswith("ΚΑΤ’ ΕΠΙΛΟΓΗΝ"): head = l; continue
    if not re.fullmatch(r"N?Ν?[AΑ][OΟ][ΜM][EΕ]\d+", l) or not sem: continue
    j = i + 1
    while not re.fullmatch(r"\d+", L[j]): j += 1
    elective = head.startswith("ΚΑΤ’")
    m = re.search(r"ΕΝΟΤΗΤΑΣ (\S+)", head)
    rows.append({"code": l.replace("Ν", "N").replace("Α", "A").replace("Ο", "O").replace("Μ", "M").replace("Ε", "E"),
                 "name": case(" ".join(L[i + 1:j])), "semester": sem, "kind": "elective" if elective else "core",
                 "group": f"Θεματική ενότητα {m[1]}" if m else None})
save("uniwa", "uniwa-naval", SRC, rows)
