# Πάτρα CEID (Μηχανικών Η/Υ και Πληροφορικής): «Κατάλογος Μαθημάτων 2026-2027» PDF (raw/up-ceid-cat.pdf): «Εξάμηνο
# σπουδών Νο» tables of core courses, then Πίνακες 1-4 (υποχρεωτικά κατ' επιλογήν / γενικής παιδείας, winter / spring)
# = electives without a fixed semester. The track lists (separate PDF) are not used.
import re
from lib import save
from up_tables import rows as table_rows
SRC = "https://www.ceid.upatras.gr/assets/2026/09/katalogos_mathimatwn_2026_2027.pdf"
out, sem, kind = [], None, "core"
for text, cells in table_rows("raw/up-ceid-cat.pdf"):
    if text and (m := re.match(r"Εξάμηνο σπουδών (\d+)", text)): sem, kind = int(m[1]), "core"
    elif text and text.startswith("Πίνακας"): sem, kind = None, "elective"
    elif cells and cells[0].startswith("CEID_") and cells[1]:
        out.append({"code": cells[0], "name": cells[1], "semester": sem, "kind": kind})
out.append({"code": "CEID_ΝΔΕ", "name": "Διπλωματική Εργασία", "semester": 9, "kind": "elective"})  # instead of 2-3 courses
save("upatras", "upatras-ceid", SRC, out)
