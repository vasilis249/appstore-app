# Ρωσικής Γλώσσας και Φιλολογίας και Σλαβικών Σπουδών ΕΚΠΑ: Πρόγραμμα Σπουδών 2025-26 (εισαγωγική κατεύθυνση Ρωσικής
# Γλώσσας και Φιλολογίας; the only current programme the department publishes). One table: semester / kind header rows,
# then "code | title | hours | weight | ECTS"; rows without a code are the tutorial/lab part of the course above.
import re, pdfplumber
from lib import save, norm
SRC = "https://www.slavstud.uoa.gr/fileadmin/depts/slavstud.uoa.gr/www/uploads/Spoudes/2025-26/Programma_spoydon_25-26.pdf"
SEMS = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
rows, sem, kind = [], None, None
for page in pdfplumber.open("raw/sl.pdf").pages:
    for t in page.extract_tables():
        for r in t:
            first = norm((r[0] or "").replace("\n", " "))
            if m := re.match(r"^(ΣΤ|[Α-Η])' Εξάμηνο", first): sem = SEMS[m[1]]
            if "Υποχρεωτικά μαθήματα" in first: kind = ("core", None)
            elif "επιλογήν υποχρεωτικό Παιδαγωγικής" in first: kind = ("elective", "Κατ' επιλογήν υποχρεωτικό Παιδαγωγικής επάρκειας")
            elif "επιλογήν υποχρεωτικό" in first: kind = ("elective", "Κατ' επιλογήν υποχρεωτικό")
            code = (r[0] or "").strip()
            if re.fullmatch(r"\d{6}Α?", code) and r[1] and sem and kind:
                name = re.sub(r"\s*\(Μάθη[μµ]α Παιδαγωγικής [Εε]πάρκειας[^)]*\)?|\s*\(\s*Εργαστηριακό μάθημα.*$", "", norm(r[1].replace("\n", " ")))
                rows.append({"code": code, "name": name, "semester": sem, "kind": kind[0], "group": kind[1]})
save("uoa", "uoa-slavic", SRC, rows, note="2025-26 programme of the Russian Language and Literature entry direction.")
