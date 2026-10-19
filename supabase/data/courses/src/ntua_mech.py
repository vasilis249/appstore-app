# ΣΜΜ: Ωριαίο πρόγραμμα 2026-27 (PDF tables): page 1 = semesters 1–6, pages 2–5 = κύκλοι (7ο–9ο).
import re, pdfplumber
from lib import save, norm
SRC = "https://www.mech.ntua.gr/files/documents/oriaio-programma-2026-2027.pdf"
LOW = "a-zα-ωάέήίόύώϊϋΐΰς"
def clean(s):
    s = norm((s or "").replace("\n", " "))
    while (t := re.sub(rf"(?<!\S)(\w) (?=[{LOW}])", r"\1", s)) != s: s = t  # "Θ ε ρ μ ι κ ο ί" → "Θερμικοί"
    return norm(re.sub(r"^Eφαρμοσμένη", "Εφαρμοσμένη", s))
CYCLES = {"ΕΝΕΡΓΕΙΑΚΟΥ ΜΗΧΑΝΟΛΟΓΟΥ ΜΗΧΑΝΙΚΟΥ": "Ενεργειακού Μηχανολόγου Μηχανικού", "ΚΑΤΑΣΚΕΥΑΣΤΟΥ ΜΗΧΑΝΟΛΟΓΟΥ ΜΗΧΑΝΙΚΟΥ": "Κατασκευαστή Μηχανολόγου Μηχανικού",
          "ΜΗΧΑΝΟΛΟΓΟΥ ΜΗΧΑΝΙΚΟΥ ΠΑΡΑΓΩΓΗΣ": "Μηχανολόγου Μηχανικού Παραγωγής", "ΜΗΧΑΝΟΛΟΓΟΥ ΜΗΧΑΝΙΚΟΥ ΕΝΑΕΡΙΩΝ & ΕΠΙΓΕΙΩΝ ΜΕΤΑΦΟΡΙΚΩΝ ΜΕΣΩΝ": "Μηχανολόγου Μηχανικού Εναέριων & Επίγειων Μεταφορικών Μέσων"}
rows, pdf = [], pdfplumber.open("raw/mech-or.pdf")
for r in pdf.pages[0].extract_tables()[0][2:]:
    for col, cell in enumerate(r):
        c, sem = clean(cell), col + 1
        if not c: continue
        if "Ξένες Γλώσσες" in c:
            rows.append({"name": "Ξένη Γλώσσα", "semester": sem, "kind": "core" if sem == 4 else "elective", "group": "Ξένη γλώσσα"}); continue
        kind, group = ("elective", "Επιλογής") if "(επιλογής)" in c else ("elective", "Προαιρετικό") if "(προαιρετικό)" in c else ("core", None)
        name = norm(re.sub(r"\s*\d?\((επιλογής|προαιρετικό)\)|\s+\d$", "", c))
        rows.append({"name": name, "semester": sem, "kind": kind, "group": group})
cycles = []
for page in pdf.pages[1:]:
    for t in page.extract_tables():
        cycle = CYCLES[clean(t[0][0]).replace("ΚΥΚΛΟΣ ", "")]
        cycles.append(cycle)
        state = ["track_core", "track_core", "track_core"]
        for r in t[2:]:
            for col, cell in enumerate(r[1:4]):
                c, sem = clean(cell), col + 7
                if not c or c.startswith("Επιλέγονται"): continue
                if m := re.match(r"^ΟΜΑΔΑ (.)", c): state[col] = f"Ομάδα {m[1]} (τουλάχιστον 1)"; continue
                items = [clean(x) for x in (cell or "").split("")] if "" in (cell or "") else [c]
                for it in filter(None, items):
                    if "" in (cell or ""): k, g = "elective", f"Κύκλος {cycle} · επιλογής"
                    elif state[col] == "track_core": k, g = "track_core", f"Κύκλος {cycle}"
                    else: k, g = "elective", f"Κύκλος {cycle} · {state[col]}"
                    rows.append({"name": it, "semester": sem, "kind": k, "group": g})
print(cycles)
rows.append({"name": "Διπλωματική Εργασία", "semester": 10, "kind": "core"})
save("ntua", "ntua-mech", SRC, rows, note="Από το 7ο: κύκλοι σπουδών· «track_core» = υποχρεωτικό του κύκλου, «elective» = ομάδες / επιλογής του κύκλου.")
