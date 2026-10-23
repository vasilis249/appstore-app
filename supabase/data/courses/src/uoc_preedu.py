# Κρήτη Παιδαγωγικό Προσχολικής Εκπαίδευσης: Οδηγός Σπουδών 2026-27 (raw/uoc/preedu-guide.pdf) tables: Πίνακας 2 = core
# (ΥΚΟ, incl. the four teaching-practice levels ΔΑΣ Ι–IV = semesters 5–8), Πίνακας 3 = electives by unit (ΕΠΑ x00),
# Πίνακες 4–9 = seminars by unit; Πίνακας 10 (thesis topics) left out. No fixed semester for the rest.
import re
from lib import save, norm
from up_tables import rows
SRC = "https://ptpe.edc.uoc.gr/index.php/el/odigos-proptyhiakon-spoydon"
UNIT = {1: "Παιδαγωγική", 2: "Διδακτική Μαθησιακών Αντικειμένων και Αναλυτικού Προγράμματος", 3: "Κοινωνικές Επιστήμες και Εκπαίδευση",
        4: "Θετικές Επιστήμες και Εκπαίδευση", 5: "Ανθρωπιστικές Επιστήμες και Εκπαίδευση", 6: "Ψυχοπαιδαγωγική Έρευνα",
        7: "Εφαρμοσμένες Τέχνες και Φυσική Αγωγή"}
CODE = re.compile(r"(?:ΕΠΑ|ΣΕΜ|ΔΑΣ|ΔΠΑ) \d{3}")
out, table, sub = [], None, None
for text, c in rows("raw/uoc/preedu-guide.pdf", 22):
    if text:
        if m := re.match(r"Πίνακας (\d+)\.", text): table, sub = int(m[1]), None
        continue
    if table is None or table > 9: continue
    cells = [x for x in c if x]
    if len(cells) == 1 and cells[0].startswith("Σεμινάρια"): sub = re.sub(r"\s*\(.*", "", cells[0]); continue
    codes = [x for x in cells if CODE.match(x)]
    if not cells or not codes and (table != 2 or cells[-1].isupper()) or CODE.match(cells[-1]): continue  # header rows
    code = CODE.match(codes[-1])[0] if codes else None
    name = re.sub(r"(?<=\w)‐ (?=\w)", "", cells[-1])
    if code and code.startswith("ΔΑΣ"):
        level = re.search(r"Επίπεδο (IV|ΙV|ΙΙΙ|ΙΙI|ΙΙ|Ι)\b", name)[1].replace("I", "Ι")
        out.append({"code": code, "name": re.sub(r" – ΠΡΟ.*", "", name), "kind": "core", "group": None,
                    "semester": 4 + {"Ι": 1, "ΙΙ": 2, "ΙΙΙ": 3, "ΙV": 4}[level]})
    elif table == 2:
        out.append({"code": code, "name": name, "semester": None, "kind": "core", "group": None})
    else:
        group = sub or (UNIT.get(int(code[4])) if code.startswith("ΕΠΑ") else None)
        out.append({"code": code, "name": re.sub(r"\s*[–-]\s*ΠΡΟ .*", "", name), "semester": None, "kind": "elective", "group": group})
save("uoc", "uoc-preedu", SRC, out)
