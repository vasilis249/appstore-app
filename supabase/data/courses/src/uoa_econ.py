# Οικονομικών Επιστημών ΕΚΠΑ: Οδηγός Σπουδών 2023-24 (the latest with text; the 2025 programme decision is a scan) —
# Πίνακας 1 υποχρεωτικά, 2 βασικά επιλογής, 3 θεματικές ενότητες (5-column grid), 4 ελεύθερης επιλογής, εργαστήρια, πρακτική.
import re, pdfplumber
from lib import save, norm
SRC = "https://www.econ.uoa.gr/wp-content/uploads/2025/02/1-12-2023_ODIGOS_SPOYDON_TOE_2023-24_ver3.pdf"
pdf = pdfplumber.open("raw/econ.pdf")
CODE = re.compile(r"^([A-ZΑ-Ω]{3}\d{3}|\d{2}\d{3}[A-ZΒ]?|44G\d{3})$")
fixcode = lambda c: re.sub(r"\s+", "", c or "").replace("Η", "H").replace("Μ", "M").replace("Τ", "T")
rows = []
def table_rows(page, kind, group):
    for t in pdf.pages[page].extract_tables():
        for r in t:
            cells = [norm((c or "").replace("\n", " ")) for c in r]
            codes = [i for i, c in enumerate(cells) if CODE.match(fixcode(c))]
            if not codes: continue
            i = codes[0]; name = cells[i + 1] if i + 1 < len(cells) else ""
            sem = next((c for c in cells[i + 2:] if re.fullmatch(r"\d(-\d)?|\*", c)), None)
            if name: rows.append({"code": fixcode(cells[i]), "name": name, "semester": int(sem[0]) if sem and sem[0].isdigit() else None, "kind": kind, "group": group})
table_rows(48, "core", None)
table_rows(51, "elective", "Βασικά μαθήματα επιλογής (τουλάχιστον 4)")
for pg in (53, 54, 55): table_rows(pg, "elective", "Ελεύθερης επιλογής")
for pg in (55, 56):  # labs and internship are in the same pages: relabel below by code
    pass
for r in rows:
    if r["code"].startswith("LAB"): r["group"] = "Εργαστήριο (συνοδεύει μάθημα)"
    if r["code"].startswith("PRC"): r["group"] = "Πρακτική άσκηση"
    if re.match(r"^(42|44)", r["code"]): r["group"] = "Από άλλα τμήματα του ΕΚΠΑ (έως 3)"
table_rows(56, "elective", "Ελεύθερης επιλογής")  # page 57: labs, internship, other departments
for r in rows[-12:]:
    if r["code"].startswith("LAB"): r["group"] = "Εργαστήριο (συνοδεύει μάθημα)"
    elif r["code"].startswith("PRC"): r["group"] = "Πρακτική άσκηση"
    elif re.match(r"^(42|44)", r["code"]): r["group"] = "Από άλλα τμήματα του ΕΚΠΑ (έως 3)"
# Πίνακας 3: 5 columns (ενότητες), each cell = title lines, code, "ΕΞΑΜΗΝΟ N"
UNITS = ["Οικονομική Θεωρία και Ιστορία", "Ανάπτυξη και Οικονομική Πολιτική", "Οικονομική και Διοίκηση των Επιχειρήσεων – Χρηματοοικονομική",
         "Ποσοτικές Μέθοδοι και Πληροφορική", "Εφαρμοσμένη Οικονομική"]
grid = pdf.pages[52].extract_tables()[0]
state = {c: {"name": [], "code": None, "sem": None} for c in (1, 3, 5, 7, 9)}
for r in grid[9:]:
    for col in state:
        cell = norm((r[col] if col < len(r) else "") or "")
        if not cell: continue
        st = state[col]
        if m := re.match(r"^ΕΞΑΜΗΝΟ (\d)$", cell): st["sem"] = int(m[1])
        elif CODE.match(fixcode(cell)): st["code"] = fixcode(cell)
        else: st["name"].append(cell)
        if st["code"] and st["sem"] and st["name"]:
            rows.append({"code": st["code"], "name": norm(" ".join(st["name"])), "semester": st["sem"], "kind": "elective", "group": f"Ενότητα: {UNITS[(col - 1) // 2]}"})
            state[col] = {"name": [], "code": None, "sem": None}
rows.append({"code": "MGT473", "name": "Θεωρίες Επιχειρησιακής Οργάνωσης", "semester": 8, "kind": "elective", "group": f"Ενότητα: {UNITS[0]}"})  # first column cut off in the grid
for r in rows: r["name"] = r["name"].replace("Χρηματοοικονομικ ών", "Χρηματοοικονομικών").replace("Ελληνικη ", "Ελληνική ")
save("uoa", "uoa-econ", SRC, rows, note="Οδηγός 2023-24 (η αναθεώρηση ΠΠΣ 2025 είναι σκαναρισμένη). Θεματικές ενότητες: 4 μαθήματα σε μία ενότητα.")
