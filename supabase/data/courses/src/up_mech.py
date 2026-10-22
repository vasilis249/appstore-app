# Πάτρα Μηχανολόγων & Αεροναυπηγών: «Πρόγραμμα Σπουδών 2026-27» PDF (raw/up-mech.pdf). Semesters 1-7 core (with
# «ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ» / foreign-language choices = electives), then «ΜΑΘΗΜΑΤΑ ΕΙΔΙΚΕΥΣΗΣ» per Τομέας (mechanical) and
# for the aeronautical engineer: the note says capitals = compulsory for that package (track_core), lower case = electives.
import re
from lib import save, norm
from up_tables import rows as table_rows, case
SRC = "https://mead.upatras.gr/undergraduate/odigoi-spoudwn/"
out, sem, kind, track, special = [], None, "core", None, False
for text, cells in table_rows("raw/up-mech.pdf"):
    line = text or " | ".join(c for c in cells if c)
    if m := re.search(r"(\d+)ο ΕΞΑΜΗΝΟ", line): sem, kind = int(m[1]), "core"
    if re.search(r"ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ|ΕΠΙΛΟΓΗ ΞΕΝΗΣ", line): kind = "elective"
    if "ΜΑΘΗΜΑΤΑ ΕΙΔΙΚΕΥΣΗΣ" in line:
        special = True; track = "Αεροναυπηγός μηχανικός" if "ΑΕΡΟΝΑΥΠ" in line.replace(" ", "") else "Μηχανολόγος μηχανικός"
    if text and (m := re.match(r"Τομέας (.+)", text)) and special: track = norm(m[1])
    if not cells: continue
    cs = [c for c in cells if c]
    if not cs or not re.match(r"[MΜ][EΕ][AΑ]_|Κ500", cs[0]) or len(cs) < 2: continue
    code, title = re.sub(r"^[MΜ][EΕ][AΑ]_", "MEA_", cs[0]), cs[1]
    if special:
        k, g = ("track_core", track) if title.isupper() else ("elective", track)
    else:
        k, g = ("elective" if kind == "elective" else "core"), None
    out.append({"code": code, "name": case(title) if title.isupper() else title, "semester": sem, "kind": k, "group": g})
save("upatras", "upatras-mech", SRC, out)
