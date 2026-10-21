# ΑΣΠΑΙΤΕ, Εκπαιδευτικών Ηλεκτρολόγων & Εκπαιδευτικών Ηλεκτρονικών Μηχανικών: course outlines of the current programme
# ("ΚΩΔΙΚΟΣ ΜΑΘΗΜΑΤΟΣ ΗΜ101 ΕΞΑΜΗΝΟ ΣΠΟΥΔΩΝ 1ο", "ΤΙΤΛΟΣ ΜΑΘΗΜΑΤΟΣ …", "ΤΥΠΟΣ ΜΑΘΗΜΑΤΟΣ … (Υποχρεωτικό)").
# Codes ending in Α / Β belong to the Ηλεκτρολόγων / Ηλεκτρονικών path; the semester is the code's first digit.
import re
from lib import save, norm
SRC = "https://elecengedu.aspete.gr/wp-content/uploads/2025/02/ΠΕΡΙΓΡΑΜΜΑΤΑ_ΜΑΘΗΜΑΤΩΝ-τρέχον.pdf"
PATH = {"Α": "Ηλεκτρολόγων Μηχανικών", "A": "Ηλεκτρολόγων Μηχανικών", "Β": "Ηλεκτρονικών Μηχανικών"}
FIX = {"ΗΜ506": "Κοινωνιολογία της Εκπαίδευσης"}  # its title is split around the label in the PDF
L = [norm(l) for l in open("raw/aspete-eee.txt")]
idx = [i for i, l in enumerate(L) if l.startswith("ΚΩΔΙΚΟΣ ΜΑΘΗΜΑΤΟΣ")]
rows = []
for n, i in enumerate(idx):
    code = re.match(r"ΚΩΔΙΚΟΣ ΜΑΘΗΜΑΤΟΣ (\S+)", L[i])[1]
    name = FIX.get(code) or L[i + 1].removeprefix("ΤΙΤΛΟΣ ΜΑΘΗΜΑΤΟΣ").strip()
    if not L[i + 2].startswith("ΑΥΤΟΤΕΛΕΙΣ") and code not in FIX: name += " " + L[i + 2]
    end = idx[n + 1] if n + 1 < len(idx) else len(L)
    t = next(j for j in range(i, end) if "ΤΥΠΟΣ ΜΑΘΗΜΑΤΟΣ" in L[j])
    ty = " ".join(L[t:t + 4]).lower()
    suf = re.match(r"ΗΜ\d+([ΑAΒ])", code)
    group = PATH[suf[1]] if suf else None
    kind = "elective" if "επιλογ" in ty else ("track_core" if group else "core")
    rows.append({"code": code, "name": name, "semester": int(code[2]), "kind": kind, "group": group})
save("aspete", "aspete-eee", SRC, rows)
