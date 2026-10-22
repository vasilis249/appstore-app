# Πάτρα Γεωλογίας: «Μαθήματα» page (raw/upp-geo-mathimata.html, text.py → .txt) holds every course outline of the
# programme (2018-): blocks "Κατηγορία μαθήματος | Υποχρεωτικό|Επιλογής…", "Κωδικός μαθήματος | GEO…",
# "Εξάμηνο σπουδών | 1 ο", "Τίτλος μαθήματος | …".
import re
from lib import save, norm
from up_tables import case
SRC = "https://geology.upatras.gr/mathimata/"
rows, cur = [], {}
for l in map(norm, open("raw/upp-geo-mathimata.txt")):
    if m := re.match(r"(Κατηγορία μαθήματος|Κωδικός μαθήματος|Εξάμηνο σπουδών|Τίτλος μαθήματος) \| (.+)", l):
        cur[m[1]] = m[2]
        if m[1] == "Τίτλος μαθήματος":
            sem = re.match(r"\d+", cur.get("Εξάμηνο σπουδών", ""))
            rows.append({"code": cur.get("Κωδικός μαθήματος"), "name": case(m[2]) if m[2].isupper() else m[2], "semester": int(sem[0]) if sem else None,
                         "kind": "core" if cur.get("Κατηγορία μαθήματος", "").startswith("Υποχρ") else "elective"})
            cur = {}
save("upatras", "upatras-geo", SRC, rows)
