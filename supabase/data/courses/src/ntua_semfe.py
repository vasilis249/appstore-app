# ΣΕΜΦΕ: Πρόγραμμα Σπουδών 2025-26 (PDF): κορμός 1ο–4ο, κατευθύνσεις Μαθηματικού / Φυσικού 5ο–9ο (● = υποχρεωτικό ροής).
import re
from lib import save, norm
SRC = "https://semfe.ntua.gr/files/pdf/ΠΡΟΓΡΑΜΜΑ_ΣΠΟΥΔΩΝ_ΣΕΜΦΕ_2025-26.pdf"
L = [norm(l) for l in open("raw/semfe-pps.txt")]
a = L.index("ΤΑ ΜΑΘΗΜΑΤΑ ΤΗΣ ΣΧΟΛΗΣ ΕΜΦΕ"); b = next(i for i, l in enumerate(L) if l.startswith("ΑΛΛΑΓΕΣ ΤΟΥ ΠΡΟΓΡΑΜΜΑΤΟΣ"))
ROW = re.compile(r"^(\d{4}) (.+?)\s*((?:\d+(?: \(\d\+\d\))? ?/ ?\d+|⁻/ \d+|\d))?$")
NOISE = re.compile(r"^(ΚΩΔΙΚΟΣ|ΟΜΑΔΕΣ|Ε\.Α\.|Υ\.Π\.|Η\.\+Λ\.|Υ\.\+Θ|Φ\. Η\.|=== |\*|\d+ (Τα|Κατά)|δυνατότητα|αναγνωρισμένο|εγκριθεί|ξένης|ΜΑΘΗΜΑ$|μάθημα$|\(Τ\)$)")
rows, sem, kind, group, dirn, inside, cur = [], None, None, None, None, False, None
def flush():
    global cur
    if cur:
        name = norm(re.sub(r"(?<!\S)(ο|ή|Υποχρ\.)(?!\S)", " ", re.sub(r"●|\*\d", " ", cur["name"]))).replace("Διηλεκτρικές,Οπτικές ΜαγνητικέςΙδιότητες", "Διηλεκτρικές, Οπτικές, Μαγνητικές Ιδιότητες")
        k, g = cur["kind"], cur["group"]
        if dirn and k == "elective" and "●" in cur["name"]: k, g = "track_core", f"{dirn} · υποχρεωτικό ροής"
        rows.append({**cur, "name": name.replace("ΠΡΑΚΤΙΚΗ ΑΣΚΗΣΗ", "Πρακτική Άσκηση").replace("ΘΕΜΑ", "Θέμα"), "kind": k, "group": g}); cur = None
for l in L[a:b]:
    if l.startswith("ΟΙ ΡΟΕΣ ΚΑΙ ΤΑ ΜΑΘΗΜΑΤΑ"): flush(); inside = False; continue
    if l.startswith("ΤΑ ΜΑΘΗΜΑΤΑ ΤΗΣ ΚΑΤΕΥΘΥΝΣΗΣ"):
        flush(); inside = True; dirn = "Κατεύθυνση " + ("Μαθηματικού Εφαρμογών" if "ΜΑΘΗΜΑΤΙΚΟΥ" in l else "Φυσικού Εφαρμογών"); continue
    if l == "ΤΑ ΜΑΘΗΜΑΤΑ ΤΗΣ ΣΧΟΛΗΣ ΕΜΦΕ": inside = True; continue
    if not inside: continue
    if m := re.match(r"^(\d+)Ο ΕΞΑΜΗΝΟ$", l):
        flush(); sem = int(m[1]); kind, group = ("core", None) if not dirn else ("track_core", dirn); continue
    if l.startswith("ΥΠΟΧΡΕΩΤΙΚΑ"): flush(); kind, group = "track_core", dirn; continue
    if l.startswith("Κατ’ Επιλογήν Υποχρεωτικά"):
        flush(); kind, group = "elective", (f"{dirn} · κατ' επιλογήν" if dirn else "Ανθρωπιστικά (1 μάθημα)"); continue
    if l == "Ελεύθερης Επιλογής": flush(); kind, group = "elective", "Ελεύθερης επιλογής"; continue
    if l.startswith("Ξένη Γλώσσα"):
        flush(); kind, group = ("core" if "Ορολογία" in l else "elective"), "Ξένη γλώσσα"; continue
    if l in ("ΜΑΘΗΜΑΤΑ ΚΟΡΜΟΥ",) or NOISE.match(l): continue
    if l in ("Εκπόνηση Διπλωματικής Εργασίας",): flush(); continue
    if m := ROW.match(l):
        flush(); cur = {"code": m[1], "name": m[2], "semester": sem, "kind": kind, "group": group}; continue
    if cur and not re.search(r"\d ?/ ?\d", l): cur["name"] += " " + l
    elif cur: cur["name"] += " " + re.sub(r"\s*\d+ ?/ ?\d+$", "", l)
flush()
rows.append({"name": "Διπλωματική Εργασία", "semester": 10, "kind": "core"})
save("ntua", "ntua-semfe", SRC, rows, note="Από το 5ο: κατεύθυνση Μαθηματικού ή Φυσικού Εφαρμογών· «υποχρεωτικό ροής» (●) = track_core, τα άλλα κατ' επιλογήν = elective.")
