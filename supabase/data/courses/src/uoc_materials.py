# Κρήτη Επιστήμης και Μηχανικής Υλικών: Οδηγός Σπουδών 2025 (raw/uoc/materials-guide.pdf) Πίνακας Ι (pp. 10-13): per
# semester header "Χ’ Εξάμηνο", rows "code | title | hours | Y/E | ECTS"; then «Μαθήματα Επιλογής» under area rows
# ("Χημεία Υλικών – Βιοϋλικά", "Εκτός κατεύθυνσης"). Codes are the guide's numbers with the department's ΕΜΥ prefix.
import re
from lib import save
from up_tables import rows
SRC = "https://www.materials.uoc.gr/proptychiaka/organosi-spoudon/"
SEM = {"Α": 1, "B": 2, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
out, sem, group = [], None, None
for _, c in rows("raw/uoc/materials-guide.pdf", 9, 13):
    if not c: continue
    cells = [x for x in c if x]
    if any("Πίνακας ΙΙ" in x for x in cells): break
    if h := next((m for x in cells if (m := re.fullmatch(r"(\S+)’ Εξάμηνο", x))), None): sem, group = SEM[h[1]], None; continue
    if "Μαθήματα Επιλογής" in cells and len(cells) > 3: sem = None; continue
    if len(cells) == 1 and not re.match(r"Κωδικός|Μαθήματος", cells[0]): group = None if cells[0].startswith("Εκτός") else cells[0]; continue
    if not re.fullmatch(r"\d{3}|ΠΡΑ – \d{3}|9Ι\d", cells[0]) or len(cells) < 3: continue
    kind = next(x for x in cells if x in ("Y", "Υ", "E", "Ε"))
    code = cells[0] if not cells[0][0].isdigit() or cells[0].startswith("9") else "ΕΜΥ-" + cells[0]
    out.append({"code": code.replace(" – ", "-"), "name": cells[1].replace("ï", "ϊ"), "semester": sem,
                "kind": "core" if kind in "YΥ" else "elective", "group": group})
save("uoc", "uoc-materials", SRC, out)
