# Πάτρα Φιλοσοφίας: «Οδηγός Σπουδών 2026-2027, τεύχος Α» PDF (raw/up-philosophy.pdf, pdftext.py → .txt), pages «Νο ΕΤΟΣ:
# Χ΄ ΕΞΑΜΗΝΟ» + Πίνακες P1.x of electives. Lines "N PHS_x.y Title Teacher DM ECTS": the title ends where the teacher's
# initial ("Α. Μιχαλάκης") or the numbers start; a title continues on the next line when that starts in lower case.
import re
from lib import save, norm
SRC = "https://philosophy.upatras.gr/proptychiaka/odigos-spoudon/"
G = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
TEACHER = r"\s(?:[Α-ΩA-Z]{1,2}\.(?:\s?-\s?[Α-Ω]\.)?\s[Α-Ω][\w-]+|Παπαχριστόπουλος|\d+\s\d+\s*$)"
L = [norm(l) for l in open("raw/up-philosophy.txt")]
start = next(i for i, l in enumerate(L) if l == "1Ο ΕΤΟΣ: Α΄ ΕΞΑΜΗΝΟ")
rows, sem, kind = [], None, "core"
for i in range(start, len(L)):
    l = L[i]
    if m := re.match(r"\dΟ ΕΤΟΣ: (ΣΤ|[Α-Η])[΄’'] ΕΞΑΜΗΝΟ", l): sem, kind = G[m[1]], "core"; continue
    if "Πίνακας" in L[i - 1] and (m := re.search(r"(ΣΤ|[Α-Η])[΄’'] ΕΞΑΜΗΝΟΥ", l)): sem = G[m[1]]
    if re.match(r"Υποχρεωτικ", l): kind = "core"
    elif re.search(r"(?i)επιλογ", l) and not re.search(r"PHS_", l): kind = "elective"
    if not (m := re.search(r"(P[HΗ]S_[\d.]+)\s+(.*)", l)): continue
    title = re.split(TEACHER, " " + m[2])[0].strip()
    j = i + 1
    while j < len(L) and L[j][:1].islower():
        title += " " + re.split(TEACHER, " " + L[j])[0].strip(); j += 1
    if title and re.search(r"[^\W\d]{3}", title):
        title = re.sub(r"Εντεταλμένος/η|διδάσκων/[oο]υσα|Τμ\.\s?Φιλολογίας|ΤΕΕΑΠΗ|Εφόσον υπάρξουν|πιστώσεις ΠΔ 407/80", "", title)
        rows.append({"code": m[1].replace("Η", "H"), "name": norm(title).rstrip(".,: -"), "semester": sem, "kind": kind})
save("upatras", "upatras-philosophy", SRC, rows)
