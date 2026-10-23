# Κρήτη Χημείας: Οδηγός Σπουδών 2026-27 (raw/uoc/chem-guide.pdf): «Ενδεικτικό πρόγραμμα σπουδών» (pp. 19-20, one cell
# per semester holding "ΧΗΜ-043 Title DM ECTS …") = core with semesters 1-6; «Ενδεικτικός Κατάλογος Προσφερόμενων
# Μαθημάτων Επιλογής» (p. 21, "ΧΗΜ-056 Title") = electives (7th-8th semester, no fixed one).
import re
from lib import save, norm
from pdftext import pages
from up_tables import rows
SRC = "https://www.chemistry.uoc.gr/wordpress/σπουδές/προπτυχιακές-σπουδές/οδηγός-σπουδών/"
code = lambda s: s.replace("XHM", "ΧΗΜ")
out, sem = [], None
for _, c in rows("raw/uoc/chem-guide.pdf", 18, 20):
    if not c: continue
    cell = " ".join(x for x in c if x)
    if m := re.fullmatch(r"(\d)ο εξάμηνο", cell): sem = int(m[1]); continue
    for m in re.finditer(r"([XΧ]HM-\d{3}|ΧΗΜ-\d{3}) (.+?) \d+ \d+(?= [XΧ]|$)", cell):
        out.append({"code": code(m[1]), "name": m[2], "semester": sem, "kind": "core"})
L = [norm(l) for l in pages("raw/uoc/chem-guide.pdf", 21, 21)[0].splitlines()]
for l in L[L.index("Ενδεικτικός Κατάλογος Προσφερόμενων Μαθημάτων Επιλογής") + 1:]:
    if not (m := re.fullmatch(r"([XΧ][HΗ]M-\d{3}|ΧΗΜ-\d{3}) (.+)", l)): break
    out.append({"code": code(m[1]).replace("H", "Η").replace("M", "Μ"), "name": m[2], "semester": None, "kind": "elective"})
save("uoc", "uoc-chem", SRC, out)
