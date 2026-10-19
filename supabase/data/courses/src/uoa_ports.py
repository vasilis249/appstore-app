# Διαχείρισης Λιμένων και Ναυτιλίας ΕΚΠΑ (pms.uoa.gr): «Πρόγραμμα Σπουδών» page, «Μαθήματα ανά εξάμηνο» — each course
# is a title line (capitals, as published) followed by "Υ" (compulsory) or "Ε" (elective).
import re
from lib import save, norm
SRC = "https://www.pms.uoa.gr/programma-spoudon/"
L = [norm(l) for l in open("raw/pms.txt")]
rows, sem = [], None
for i, l in enumerate(L):
    if m := re.match(r"^(\d)ο \(.+\) ΕΞΑΜΗΝΟ$", l): sem = int(m[1]); continue
    if sem and l in ("Υ", "Ε"):
        rows.append({"name": L[i - 1], "semester": sem, "kind": "core" if l == "Υ" else "elective", "group": None if l == "Υ" else "Επιλογής"})
save("uoa", "uoa-ports", SRC, rows, note="Names in capitals as published.")
