# Πάτρα Γεωπονίας: «Πρόγραμμα Σπουδών 2026-2027» PDF (raw/up-agri.pdf): per «Νο Εξάμηνο» the core courses, then
# «ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ 7 ΚΑΙ 9 / 8 ΕΞΑΜΗΝΟΥ» (pages 2-8; later pages repeat old programmes).
import re
from lib import save
from up_tables import rows as table_rows, case
SRC = "https://agriculture.upatras.gr/wp-content/uploads/2026/09/Prog_spoudon_2026_2027_30062026.pdf"
out, sem, kind = [], None, "core"
for text, cells in table_rows("raw/up-agri.pdf", 1, 8):
    head = text or (cells[0] if cells else "")
    if m := re.match(r"(\d+)ο Εξάμηνο", head): sem, kind = int(m[1]), "core"
    elif m := re.match(r"ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ (\d)", head): sem, kind = int(m[1]), "elective"
    elif cells and re.match(r"[AΑ]GR[IΙ]_", cells[0]) and cells[1]:
        out.append({"code": re.sub(r"^[AΑ]GR[IΙ]_", "AGRI_", cells[0]), "name": case(cells[1]), "semester": sem, "kind": kind})
save("upatras", "upatras-agri", SRC, out)
