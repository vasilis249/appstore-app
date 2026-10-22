# Πάτρα Φαρμακευτικής: «Τρέχον Πρόγραμμα Σπουδών» page (raw/upp-pharm.html, text.py → .txt): "PHA-<year A-E><half 1|2>n-NEW
# Title" under year / semester headings; the code itself gives the semester (A1 = 1st, A2 = 2nd … E2 = 10th). The page
# lists no electives.
import re
from lib import save, norm
SRC = "https://www.pharmacy.upatras.gr/index.php/el/studies/undergraduate/current-program"
rows = []
for l in map(norm, open("raw/upp-pharm.txt")):
    if m := re.fullmatch(r"(PHA-([A-E])([12])\d+)[ -]NEW (.+)", l):
        rows.append({"code": m[1], "name": m[4].replace("oxη", "οχη").replace("ΙI", "ΙΙ"), "semester": "ABCDE".index(m[2]) * 2 + int(m[3]), "kind": "core"})
save("upatras", "upatras-pharm", SRC, rows)
