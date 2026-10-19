# Γεωλογίας & Γεωπεριβάλλοντος ΕΚΠΑ: Οδηγός Σπουδών 2026-27, «Κατάλογος μαθημάτων» (Υ = υποχρεωτικό, Ε = επιλογής, ΣΜ = σεμιναριακό).
import re
from lib import save, norm, code_table
SRC = "https://www.geol.uoa.gr/fileadmin/depts/geol.uoa.gr/www/uploads/docs/2026/2026-2027_ODIGOS_SPOYDON.pdf"
SEMS = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
L = [norm(l) for l in open("raw/geol.txt")]
a = L.index("ΚΑΤΑΛΟΓΟΣ ΜΑΘΗΜΑΤΩΝ"); b = L.index("ΜΑΘΗΣΙΑΚΑ ΑΠΟΤΕΛΕΣΜΑΤΑ/ΕΙΔΙΚΕΣ ΙΚΑΝΟΤΗΤΕΣ")
sem_of = lambda l: SEMS[m[1]] if (m := re.match(r"^(ΣΤ|[Α-Η]) ΕΞΑΜΗΝΟ$", l)) else None
kind_of = lambda l: {"ΥΠΟΧΡΕΩΤΙΚΑ ΜΑΘΗΜΑΤΑ": ("core", None), "ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ": ("elective", "Επιλογής"), "ΣΕΜΙΝΑΡΙΑΚΑ ΜΑΘΗΜΑΤΑ": ("elective", "Σεμιναριακό")}.get(l)
rows = code_table(L[a:b], sem_of, kind_of, r"[ΥΕ]\d{4}|ΣΜ\d{3}|ΠΑ\d{3}", r"(?:[\d,\-]+\s+){1,3}[\d,\-]+", r"^(Κωδ\.|=== |\d+$|\*|https)")
rows = [{**r, "kind": "elective", "group": "Πρακτική άσκηση"} if r["code"].startswith("ΠΑ") else r for r in rows]
rows.append({"name": "Διδακτική των Γεωλογικών και Περιβαλλοντικών Επιστημών", "semester": 8, "kind": "core"})  # code lost in the pdf ("Error! Reference source not found.")
save("uoa", "uoa-geol", SRC, rows)
