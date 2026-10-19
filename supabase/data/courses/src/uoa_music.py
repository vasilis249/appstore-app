# Μουσικών Σπουδών ΕΚΠΑ: Οδηγός Σπουδών 2026-27 (v.8.10) — each course "Τίτλος / Κωδικός: X | Τύπος: T | Χειμερινό|Εαρινό".
# Τύπος: ΥΚ = υποχρεωτικό κορμού, ΚnΥΠΟ = υποχρεωτικό κατεύθυνσης n, ΚnΕΠΙ / ΚnΣΕΜ = επιλογής / σεμινάριο κατεύθυνσης n, ΕΕ = ελεύθερης επιλογής.
import re
from lib import save, norm
SRC = "https://www.music.uoa.gr/fileadmin/depts/music.uoa.gr/www/uploads/ODIGOS_SPOUDON/Odigos_Spoydon_2026-2027_v.8.10.pdf"
DIR = {"1": "Ιστορική και Συστηματική Μουσικολογία", "2": "Εθνομουσικολογία", "3": "Μουσική Τεχνολογία", "4": "Βυζαντινή Μουσικολογία", "5": "Μουσική Παιδαγωγική"}
L = [norm(l) for l in open("raw/music.txt") if not re.match(r"^(=== page \d+|\[\d+\])$", l.strip())]
rows = []
for i, l in enumerate(L):
    if not (m := re.match(r"^Κωδικός: (\S+?)_? \| Τύπος: ([^|]+) \| (Χειμερινό|Εαρινό)", l)): continue
    title = L[i - 1]
    if i > 1 and not re.search(r"(Περισσότερα\.|\.|:|\])$", L[i - 2]) and not re.match(r"^\d", L[i - 2]) and len(L[i - 2]) < 90 and "Περισσότερα" not in L[i - 2]: title = L[i - 2] + " " + title
    for t in (x.strip() for x in m[2].split(",")):
        if t == "ΥΚ": kind, group = "core", None
        elif mm := re.match(r"^Κ(\d)(ΥΠΟ|ΕΠΙ|ΣΕΜ)$", t):
            kind = "track_core" if mm[2] == "ΥΠΟ" else "elective"
            group = f"Κατεύθυνση {DIR[mm[1]]}" + ("" if mm[2] == "ΥΠΟ" else " · επιλογής" if mm[2] == "ΕΠΙ" else " · σεμινάριο")
        else: kind, group = "elective", "Ελεύθερης επιλογής" if t == "ΕΕ" else t
        rows.append({"code": m[1], "name": re.sub(r"(\w)- (?=[α-ωά-ώ])", r"\1", norm(title)), "semester": None, "kind": kind, "group": group})
save("uoa", "uoa-music", SRC, rows, note="Ο οδηγός δίνει χειμερινό / εαρινό, όχι αριθμό εξαμήνου → semester null. 5 κατευθύνσεις.")
