# Πάτρα Θεατρικών Σπουδών: «Οδηγός ECTS 2026-2027» docx (raw/up-theatre.docx): the course-outline tables (ΚΩΔΙΚΟΣ /
# ΕΞΑΜΗΝΟ / ΤΙΤΛΟΣ / ΤΥΠΟΣ ΜΑΘΗΜΑΤΟΣ: Υποχρεωτικό | Επιλογής …) give every course; titles there are in capitals, so the
# per-semester tables of compulsory courses (proper case) are preferred when they name the same code.
import re, zipfile
from lib import save, norm
from up_tables import case
SRC = "https://www.theaterst.upatras.gr/wp-content/uploads/2026/09/Οδηγός-ECTS-προπτυχιακών-σπουδών-ΤΘΣ-2026-2027-.docx"
x = zipfile.ZipFile("raw/up-theatre.docx").read("word/document.xml").decode()
cell = lambda c: norm(" ".join("".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p)) for p in re.findall(r"(?s)<w:p[ >].*?</w:p>", c)))
tables = [[[cell(c) for c in re.findall(r"(?s)<w:tc>.*?</w:tc>", r)] for r in re.findall(r"(?s)<w:tr[ >].*?</w:tr>", t)]
          for t in re.findall(r"(?s)<w:tbl>.*?</w:tbl>", x)]
key = lambda code: code.replace(" ", "").translate(str.maketrans("ABEHIKMNOPTXYZ", "ΑΒΕΗΙΚΜΝΟΡΤΧΥΖ"))
proper = {key(r[2]): r[1] for t in tables if t and t[0][1:3] == ["Τίτλος μαθήματος", "ΚΩΔ."] for r in t[1:] if len(r) > 2}
rows = []
for t in tables:
    f = {r[i]: r[i + 1] for r in t for i in range(0, len(r) - 1, 2)}
    if not (code := f.get("ΚΩΔΙΚΟΣ ΜΑΘΗΜΑΤΟΣ")) or not (title := f.get("ΤΙΤΛΟΣ ΜΑΘΗΜΑΤΟΣ")): continue
    sem = re.match(r"\d+", f.get("ΕΞΑΜΗΝΟ ΣΠΟΥΔΩΝ", ""))
    rows.append({"code": code, "name": proper.get(key(code)) or (case(title) if title.isupper() else title),
                 "semester": int(sem[0]) if sem else None,
                 "kind": "elective" if re.search(r"(?i)επιλογ|επιλεγ", f.get("ΤΥΠΟΣ ΜΑΘΗΜΑΤΟΣ", "")) and not re.search(r"(?i)υποχρεωτικό\s*,?\s*προαπ", f.get("ΤΥΠΟΣ ΜΑΘΗΜΑΤΟΣ", "")) else "core"})
save("upatras", "upatras-theatre", SRC, rows)
