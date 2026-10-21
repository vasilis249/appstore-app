# Πάντειο, Ψυχολογίας: Οδηγός Σπουδών 2025-26 (PDF), course descriptions "6002 - «Τίτλος» - “English”" followed by
# "Υποχρεωτικό Α΄ εξαμήνου" (core, that semester) or "Επιλογής Χειμερινού/Εαρινού Εξαμήνου" (elective, no fixed
# semester) and "Θεματική: …" (the elective's thematic group).
import re
from lib import save, norm
SRC = "https://psychology.panteion.gr/odigos225-26.pdf"
SEM = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
L = [norm(l) for l in open("raw/pant-psych.txt")]
rows = []
for i, l in enumerate(L):
    m = re.match(r"^(\d{4})\s*[-–]\s*«(.*)$", l)
    if not m: continue
    title, j = m[2], i
    while "»" not in title and j + 1 < len(L): j += 1; title += " " + L[j]
    title = norm(title.split("»")[0])
    info = " | ".join(L[j + 1:j + 6])
    if k := re.search(r"Υποχρεωτικό (ΣΤ|[Α-Η])[΄’'] ?[εΕ]ξαμήνου", info):
        rows.append({"code": m[1], "name": title, "semester": SEM[k[1]], "kind": "core"})
    elif re.search(r"Επιλογής (?:Χειμερινού|Εαρινού) [εΕ]ξαμήνου", info, re.I):
        g = re.search(r"Θεματική:\s*([^|]+)", info)
        rows.append({"code": m[1], "name": title, "semester": None, "kind": "elective", "group": norm(g[1]) if g else None})
    else:
        print("?", m[1], title, info[:80])
save("panteion", "panteion-psych", SRC, rows, note="Electives are offered in the winter or spring semester of any year (no fixed semester).")
