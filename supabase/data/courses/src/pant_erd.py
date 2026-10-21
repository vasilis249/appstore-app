# Πάντειο, Οικονομικής και Περιφερειακής Ανάπτυξης: «Προπτυχιακές Σπουδές» page, per semester "800001 - Τίτλος" under
# «ΥΠΟΧΡΕΩΤΙΚΑ» (core) or «ΠΡΟΑΙΡΕΤΙΚΑ (Επιλογή …)» (elective).
import re
from lib import save, norm
SRC = "https://topa.panteion.gr/προπτυχιακεσ-σπουδεσ/"
SEM = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
L = [norm(l) for l in open("raw/pant-erd.txt")]
start = next(i for i in range(len(L)) if re.match(r"^Α΄ ΕΞΑΜΗΝΟ$", L[i]) and L[i + 1].startswith("ΥΠΟΧΡΕΩΤΙΚΑ"))
rows, sem, kind = [], None, None
for l in L[start:]:
    if m := re.match(r"^(ΣΤ|[Α-Η])['΄] ΕΞΑΜΗΝΟ$", l): sem, kind = SEM[m[1]], None; continue
    if l.startswith("ΥΠΟΧΡΕΩΤΙΚΑ"): kind = "core"; continue
    if l.startswith("ΠΡΟΑΙΡΕΤΙΚΑ") or l.startswith("ΕΠΙΛΟΓΗΣ"): kind = "elective"; continue
    if l.startswith("Η εκπόνηση Πτυχιακής"): break
    m = re.match(r"^(\d{6})\s*-\s*(.+)$", l)
    if m and kind:
        name = re.sub(r"^Erasmus\+\s*", "", m[2]).strip()
        rows.append({"code": m[1], "name": name, "semester": sem, "kind": "elective" if "Πρακτική" in name else kind})
save("panteion", "panteion-erd", SRC, rows)
