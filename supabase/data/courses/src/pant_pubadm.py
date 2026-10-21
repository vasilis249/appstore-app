# Πάντειο, Δημόσιας Διοίκησης: Οδηγός Σπουδών 2025-26 (PDF) §5 «Διδασκόμενα Μαθήματα» — bullet lists per semester:
# «Υποχρεωτικά» (core), «Επιλογής» / «Ελεύθερης Επιλογής» (elective); from the 5th, per «Κατεύθυνση» four of the listed
# «Υποχρεωτικά» are chosen (track_core) plus «Επιλογής Κοινά» (elective). "Greek title / English title (Erasmus)" →
# the Greek title.
import re
from lib import save, norm
SRC = "https://pubadmin.panteion.gr/wp-content/uploads/2026/06/Οδηγός-Σπουδών.pdf"
SEM = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
L = [norm(l) for l in open("raw/pant-pubadm.txt")]
start = max(i for i, l in enumerate(L) if l.startswith("5. Διδασκόμενα Μαθήματα"))  # not the table of contents
rows, sem, kind, group, direction, cur = [], None, None, None, None, None
def flush():
    global cur
    if cur:
        n = re.sub(r"\s*/\s*[A-Z][^/]*\(Erasmus\)$|\s*\(Erasmus\)$|\s*\(με προϋποθέσεις\)$|(?<=[α-ωά-ώ])\.$", "", norm(cur["name"].replace("- ", "-")))
        rows.append({**cur, "name": n})
    cur = None
for l in L[start + 1:]:
    if l.startswith("Τα υποχρεωτικά μαθήματα των εξαμήνων") or l.startswith("6. Περιεχόμενο"): break
    if l.startswith("=== page") or l.startswith("ΟΔΗΓΟΣ ΣΠΟΥΔΩΝ ΤΜΗΜΑΤΟΣ"): continue
    if m := re.fullmatch(r"(ΣΤ|[Α-Η])΄ ΕΞΑΜΗΝΟ", l): flush(); sem, kind, group, direction = SEM[m[1]], None, None, None; continue
    if m := re.match(r"^[IΙ]+\. Κατεύθυνση (.+)$", l): flush(); direction = m[1]; continue
    if re.match(r"^[IΙ]+\. Επιλογής Κοινά", l): flush(); direction, kind, group = None, "elective", None; continue
    if l.startswith("Υποχρεωτικά"): flush(); kind, group = ("track_core", direction) if direction else ("core", None); continue
    if l.startswith("Επιλογής") or l.startswith("Ελεύθερης Επιλογής"): flush(); kind, group = "elective", None; continue
    if l.startswith("•"): flush(); cur = {"name": l[1:].strip(), "semester": sem, "kind": kind, "group": group}; continue
    if cur and not l.startswith("μαθήματα"): cur["name"] += " " + l
flush()
for r in rows:
    if r["name"].startswith("Πρακτική Άσκηση"): r["kind"] = "elective"
save("panteion", "panteion-pubadm", SRC, rows)
