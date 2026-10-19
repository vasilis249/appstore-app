# Νοσηλευτική ΕΚΠΑ: «Νέο Πρόγραμμα Σπουδών» (εισαγωγή 2021-22 και εξής), «Μαθήματα ανά εξάμηνο» pp. 26-27, read as two
# columns (left = υποχρεωτικά, right = κατ' επιλογήν υποχρεωτικά), four semesters per page.
import re
from lib import save, norm
SRC = "https://www.nurs.uoa.gr/fileadmin/depts/nurs.uoa.gr/www/uploads/Proptychiaka/odhgos_spoudwn/NEO_PROGR.SPOYDON__neoys_foit._eisagogi_2021-22_kai_exis_.pdf"
FIX = {"ΝΕΥΡΟΧΕΙΡΟΥΡΙΚΗ": "ΝΕΥΡΟΧΕΙΡΟΥΡΓΙΚΗ", "ΚΑΡΔΕΙΑΓΓΕΙΑΚΩΝ": "ΚΑΡΔΙΑΓΓΕΙΑΚΩΝ"}
rows, cur = [], None
for l in map(norm, open("raw/nurs-cols.txt")):
    if m := re.match(r"^=== page (\d+) ([LR])$", l): base, n = (int(m[1]) - 26) * 4, 0; continue
    if l.startswith("◼"):
        n += 1; kind = "core" if "Επιλογήν" not in l else "elective"; cur = None; continue
    if l.startswith("*ΠΡΑΚΤΙΚΗ"):
        rows.append({"name": "ΠΡΑΚΤΙΚΗ ΑΣΚΗΣΗ", "semester": 6, "kind": "elective", "group": "Ελεύθερης επιλογής (θέρος 6ου ή 8ου)"}); cur = None; continue
    if not n: continue
    if m := re.match(r"^(?:\d+ )?\d+\. (.+)$", l):
        cur = {"name": m[1], "semester": base + n, "kind": kind, "group": "Κατ' επιλογήν υποχρεωτικά" if kind == "elective" else None}; rows.append(cur)
    elif cur and re.match(r"^[Α-ΩΪ(]", l) and "Εξάμηνο" not in l and not re.match(r"^(ΣΤ|[Α-Η])΄?$", l): cur["name"] += " " + l
    else: cur = None
seen = set(); out = []
for r in rows:
    for a, b in FIX.items(): r["name"] = r["name"].replace(a, b)
    r["name"] = re.sub(r"\s*-\s*", " - ", r["name"]).replace(" - ΚΛΙΝΙΚΗ", " - ΚΛΙΝΙΚΗ")
    if r["name"] == "ΠΡΑΚΤΙΚΗ ΑΣΚΗΣΗ" and r["name"] in seen: continue
    seen.add(r["name"]); out.append(r)
save("uoa", "uoa-nurs", SRC, out, note="Programme for students admitted 2021-22 onwards; the 2025-26 guide keeps it. Names in capitals as published.")
