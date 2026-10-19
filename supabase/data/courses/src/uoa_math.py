# Μαθηματικών ΕΚΠΑ: Οδηγός Σπουδών 2026-27, 3.1 Ενδεικτικό Πρόγραμμα ("NNN. Τίτλος, Υ | κατευθύνσεις/δέσμες").
import re
from lib import save, norm
SRC = "http://users.uoa.gr/~sedthilk/OS/Οδηγός Σπουδών Τμήματος Μαθηματικών ΕΚΠΑ_2026_27.pdf"
TAGS = {"ΚΘΜ": "Κατεύθυνση Θεωρητικών Μαθηματικών", "ΚΕΜ": "Κατεύθυνση Εφαρμοσμένων και Υπολογιστικών Μαθηματικών", "ΚΕΥΜ": "Κατεύθυνση Εφαρμοσμένων και Υπολογιστικών Μαθηματικών",
        "ΚΣΕΕ": "Κατεύθυνση Στατιστικής και Επιχειρησιακής Έρευνας", "ΚΜΕ": "Κατεύθυνση Μαθηματικής Εκπαίδευσης", "ΔΦ": "Δέσμη Φυσικής",
        "ΔΠΤ": "Δέσμη Πληροφορικής και Τηλεπικοινωνιών", "ΔΤΠ": "Δέσμη Πληροφορικής και Τηλεπικοινωνιών", "ΔΟΕ": "Δέσμη Οικονομικών Επιστημών"}
L = [norm(l) for l in open("raw/math.txt")]
a = L.index("3.1 Ενδεικτικό Πρόγραμμα Προπτυχιακών Σπουδών"); b = L.index("3.2 Κανόνες δήλωσης μαθημάτων")
rows, sem, prev = [], None, None
for l in L[a:b]:
    if m := re.match(r"^(\d)ο ΕΞΑΜΗΝΟ$", l): sem = int(m[1]); continue
    if sem is None: continue
    if m := re.match(r"^(\d{3})\. (.+)$", l):
        prev = {"code": m[1], "text": m[2], "semester": sem}; rows.append(prev); continue
    if prev and not re.match(r"^(Υποχρεωτικά|Κατ’|=== |\d+$)", l): prev["text"] += " " + l
    else: prev = None
out = []
for r in rows:
    parts = [p.strip() for p in r.pop("text").split(",")]
    tags = []
    while parts and all(t in TAGS or t == "Υ" for t in parts[-1].split()): tags = parts.pop().split() + tags
    name = ", ".join(parts)
    if m := re.match(r"^(.*?) (ΚΘΜ)$", name): name, tags = m[1], [m[2]] + tags  # "Εισαγωγή στη Συναρτησιακή Ανάλυση ΚΘΜ"
    name = name.replace("Γραμμικός και Μη Γραμμικός, Προγραμματισμός", "Γραμμικός και Μη Γραμμικός Προγραμματισμός").replace("Μαθηματίκών", "Μαθηματικών")
    if "Υ" in tags: out.append({**r, "name": name, "kind": "core"})
    else: out += [{**r, "name": name, "kind": "elective", "group": TAGS[t]} for t in dict.fromkeys(tags)] or [{**r, "name": name, "kind": "elective"}]
save("uoa", "uoa-math", SRC, out, note="Ενδεικτικό πρόγραμμα: εξάμηνο = προτεινόμενο· groups = κατευθύνσεις / δέσμες όπου μετράει το μάθημα.")
