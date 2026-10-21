# Πάντειο, Διεθνών και Ευρωπαϊκών Σπουδών: «Πρόγραμμα σπουδών» page. Per semester: required courses, then
# «ΕΠΙΛΟΓΗΣ» (electives); from the 7th, per «ΘΕΜΑΤΙΚΟΣ ΚΥΚΛΟΣ» required (track_core) + electives. «Ξένη Γλώσσα» is
# required; the languages listed under it (Chinese, language for special purposes) are its options (electives).
import re
from lib import save, norm
SRC = "https://deps.panteion.gr/?page_id=77759"
SEM = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
L = [norm(l) for l in open("raw/pant-ieas.txt")]
rows, sem, kind, group, cycle = [], None, None, None, None
for l in L[1:]:
    if l.startswith("Διεύθυνση"): break
    if m := re.match(r"^(ΣΤ|[Α-Η])'\s*εξάμηνο$", l): sem, kind, group, cycle = SEM[m[1]], "core", None, None; continue
    if m := re.match(r"^ΘΕΜΑΤΙΚΟΣ ΚΥΚΛΟΣ ΜΑΘΗΜΑΤΩΝ:\s*(.+)$", l): cycle, kind, group = m[1], "track_core", m[1]; continue
    if l == "ΥΠΟΧΡΕΩΤΙΚΑ ΜΑΘΗΜΑΤΑ": kind, group = ("track_core", cycle) if cycle else ("core", None); continue
    if l.startswith("ΕΠΙΛΟΓΗΣ"): kind, group = "elective", cycle; continue
    if sem is None or re.match(r"Πρόγραμμα Erasmus", l): continue
    name = re.sub(r"\s*\((?:ως οφειλόμενο|αντιστοιχεί|μάθημα Έδρας|Μάθημα Έδρας|ΣΕΜ\.)[^)]*\)", "", l).strip()
    if rows and re.match(r"^[α-ωά-ώ]", name) and rows[-1]["semester"] == sem: rows[-1]["name"] += " " + name; continue
    if name in ("Ξένη Γλώσσα", "Ξένες Γλώσσες"):
        rows.append({"name": "Ξένη Γλώσσα", "semester": sem, "kind": "core"}); kind, group = "elective", "Ξένη γλώσσα"; continue
    rows.append({"name": name, "semester": sem, "kind": kind, "group": group})
save("panteion", "panteion-ieas", SRC, rows)
