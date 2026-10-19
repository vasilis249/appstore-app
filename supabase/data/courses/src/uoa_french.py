# Γαλλικής Γλώσσας και Φιλολογίας ΕΚΠΑ: Οδηγός Σπουδών 2025-26 pp. 24-31 (tables: ΥΜ = compulsory, ΜΥΕ = compulsory
# electives, ΜΕΕ = free electives of the department). A course offered in several semesters gets the earliest one;
# none when not offered in 2025-26. Electives taken from other departments are not listed.
import re, pdfplumber
from lib import save, norm
SRC = "https://www.frl.uoa.gr/fileadmin/depts/frl.uoa.gr/www/uploads/Odigoi_Spoudwn/Odigos_spoydon_2025-2026.pdf"
SEMS = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "Στ": 6, "Ζ": 7, "Z": 7, "Η": 8, "H": 8}
SEM = re.compile(r"^((?:Στ|[ΑΒΓΔΕΖΗZH])΄?,? ?)+")
KIND = {(24, 0): "core", (25, 0): "core", (26, 0): "mye", (27, 0): "mye", (28, 0): "mye"}
pdf, rows = pdfplumber.open("raw/frl.pdf"), []
for pg in range(24, 32):
    for ti, t in enumerate(pdf.pages[pg - 1].extract_tables()):
        if (pg, ti) == (31, 1): continue  # other departments' courses
        k = KIND.get((pg, ti), "mee")
        cur = None
        for r in t:
            cells = [norm(c) for c in r if c]
            code = next((c for c in cells if re.fullmatch(r"64\d{3,5}", c)), None)
            sems = [s for c in cells if SEM.fullmatch(c.replace("\n", " ")) for s in re.findall(r"Στ|[ΑΒΓΔΕΖΗZH]", c)]
            text = [c for c in cells if c != code and not SEM.fullmatch(c) and c not in ("Κωδικός", "Τίτλος μαθήματος", "Εξάμηνο")]
            if code:
                cur = {"code": code, "name": " ".join(text), "semester": min((SEMS[s] for s in sems), default=None),
                       "kind": "core" if k == "core" else "elective",
                       "group": None if k == "core" else ("Υποχρεωτικής επιλογής" if k == "mye" else "Ελεύθερης επιλογής")}
                rows.append(cur)
            elif cur and text: cur["name"] += " " + " ".join(text)
for r in rows: r["name"] = re.sub(r"\s*\d{4}-\d{2}(, | & )?", "", r["name"]).strip(" ,&") if "Πρακτική Άσκηση Τμήματος" in r["name"] else r["name"]
save("uoa", "uoa-french", SRC, rows, note="Electives offered in several semesters carry the earliest; semester null = not offered in 2025-26.")
