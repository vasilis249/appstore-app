# Αγροτικής Ανάπτυξης, Αγροδιατροφής και Διαχείρισης Φυσικών Πόρων ΕΚΠΑ: Οδηγός Σπουδών 2022-23 (the newest the
# department publishes), «Πρόγραμμα σπουδών» pp. 25-28. A TimesNewRoman watermark is drawn over the text → those chars
# are dropped before reading "code title ECTS" rows under semester / kind headings.
import re, pdfplumber
from lib import save, norm
SRC = "https://agro.uoa.gr/wp-content/uploads/2023/06/Β11.-Οδηγός-Σπουδών-Ακ.-Ετους-2022-2023.pdf"
text = []
for p in pdfplumber.open("raw/agro.pdf").pages[24:28]:
    text += p.filter(lambda o: o.get("object_type") != "char" or "TimesNewRoman" not in o.get("fontname", "")).extract_text().split("\n")
rows, sem, kind, pending = [], None, None, None
for l in map(norm, text):
    if m := re.match(r"^(\d)ο ΕΞΑΜΗΝΟ", l): sem = int(m[1]); continue
    if l.startswith("Υποχρεωτικά μαθήματα"): kind = ("core", None); continue
    if l.startswith("Κατ’ επιλογή υποχρεωτικά"): kind = ("elective", "Κατ' επιλογή υποχρεωτικά"); continue
    if l.startswith("Επιλεγόμενα"): kind = ("elective", "Επιλεγόμενα"); continue
    if not (sem and kind): continue
    if m := re.match(r"^([1-8]\d\d) (.+?) \d+$", l):
        rows.append({"code": m[1], "name": re.sub(r"\s*\([α-δ]\)|\s*\*", "", m[2]), "semester": sem, "kind": kind[0], "group": kind[1]}); pending = None
    elif m := re.match(r"^([1-8]\d\d) \d+$", l):
        rows.append({"code": m[1], "name": pending, "semester": sem, "kind": kind[0], "group": kind[1]}); pending = None
    elif not re.match(r"^(\(|Πιστωτικές|Τμήμα|και Διαχείρισης|\d+$|=)", l): pending = l
save("uoa", "uoa-agri", SRC, rows, note="2022-23 guide (newest published); the indicative programme may have changed since.")
