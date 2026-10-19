# Ιταλικής Γλώσσας και Φιλολογίας ΕΚΠΑ: Πρόγραμμα Σπουδών 2026-27 pp. 15-18 — per semester one table of compulsory
# courses and one of compulsory electives (in that order, 16 tables). Πρακτική Άσκηση (offered semesters 4-8) is kept once.
import re, pdfplumber
from lib import save, norm
SRC = "https://www.ill.uoa.gr/fileadmin/depts/ill.uoa.gr/www/uploads/Grammateia_diafora/16.09.2026_PROGRAMMA_PROPTYCHIAKON_SPOYDON_toy_TIGF__akad._etoys_2026_2027.pdf"
pdf = pdfplumber.open("raw/ill.pdf")
tables = [t for i in range(14, 18) for t in pdf.pages[i].extract_tables()]
assert len(tables) == 16, len(tables)
rows, seen = [], set()
for n, t in enumerate(tables):
    sem, kind = n // 2 + 1, ("core", "elective")[n % 2]
    for _, name, code in t:
        code = re.sub(r"\s*\(πρώην.*", "", code.replace("\n", " ")).replace("ITA", "ΙΤΑ").replace("-", "")
        if code in seen: continue
        seen.add(code)
        rows.append({"code": code, "name": norm(name.replace("\n", " ").rstrip("*")), "semester": sem, "kind": kind,
                     "group": "Κατ' επιλογήν υποχρεωτικά" if kind == "elective" else None})
save("uoa", "uoa-italian", SRC, rows, note="2026-27 programme; Πρακτική Άσκηση is offered in semesters 4-8 (listed under 4).")
