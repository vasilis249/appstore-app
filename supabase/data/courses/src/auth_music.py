# ΑΠΘ Μουσικών Σπουδών (5 years): «Οδηγός Σπουδών 2026-27» PDF (raw/auth-music-guide.pdf, pdftext.py → .txt) §4.2 core
# courses of years 1-2 ("CODE Title ECTS"; the semester labels are rotated text, so each semester starts at a known code),
# Πίνακας 9.2 for the Σύνθεση track; every other course of «Μαθήματα ακαδημαϊκού έτους 2026-27» (CourseClasses PDF,
# raw/auth-music-classes.txt: "CODE Title Χειμερινό|Εαρινό Teacher", a long title wraps around the code line) = elective.
# The Παιδαγωγική Επάρκεια courses only bind students admitted up to 2023-24 → electives here.
import re
from lib import save, norm
SRC = "https://mus.auth.gr/wp-content/uploads/2026/10/odigos-spoudon-2026-27_v.2.pdf"
FIRST = {"ΘΑ1001": 1, "ΘΑ1002": 2, "ΘΑ1003": 3, "ΜΠ1004": 4}
COMPOSITION = ["Εισαγωγή στη σύνθεση", "Σύνθεση Ι", "Σύνθεση ΙΙ", "Σύνθεση ΙΙΙ", "Σύνθεση ΙV", "Σύνθεση V", "Σύνθεση VΙ",
               "Σύνθεση VΙΙ", "Τεχνικές σύνθεσης της μουσικής του 20ού αιώνα Ι", "Τεχνικές σύνθεσης της μουσικής του 20ού αιώνα ΙΙ",
               "Ενορχήστρωση Ι", "Ενορχήστρωση ΙΙ", "Τονική αντίστιξη – Στοιχεία φούγκας", "Στυλιστική σύνθεση"]
roman = lambda s: re.sub(r"\b[IΙVX]+\b", lambda m: m[0].replace("Ι", "I"), s)  # the guide mixes Greek Ι and Latin I
fold = lambda s: re.sub(r"[^\w]", "", roman(s).lower().translate(str.maketrans("άέήίόύώ", "αεηιουω")))
G = [norm(l) for l in open("raw/auth-music-guide.txt")]
start = G.index("ΥΠΟΧΡΕΩΤΙΚΑ ΜΑΘΗΜΑΤΑ ΚΟΡΜΟΥ (1ο και 2ο έτος) – σύνολο ECTS: 98")
rows, seen, sem = [], set(), None
for l in G[start:start + 60]:
    if m := re.search(r"([Α-Ω]{2}1\d{3}) (.+?) \d$", l):
        sem = FIRST.get(m[1], sem)
        name = norm(re.sub(r"\s*\((προαπ|Φ\.)[^)]*\)|\d$", "", m[2]))
        rows.append({"code": m[1], "name": name, "semester": sem, "kind": "core"}); seen.add(m[1])
C = [norm(l) for l in open("raw/auth-music-classes.txt")]
comp = {fold(n): n for n in COMPOSITION}
for i, l in enumerate(C):
    if not (m := re.match(r"([Α-Ω]{2}\d{4}) ?(.*?) ?(Χειμερινό|Εαρινό)\b", l)) or m[1] in seen: continue
    title = m[2] or C[i - 1]
    if not m[2] and C[i + 1][:1].islower(): title += " " + C[i + 1]
    seen.add(m[1]); title = norm(title)
    track = fold(title) in comp
    rows.append({"code": m[1], "name": title, "semester": None, "kind": "track_core" if track else "elective",
                 "group": "Σύνθεση" if track else None})
missing = set(comp) - {fold(r["name"]) for r in rows}
for k in missing: rows.append({"name": comp[k], "semester": None, "kind": "track_core", "group": "Σύνθεση"})
rows.append({"name": "Διπλωματική εργασία", "semester": 10, "kind": "core"})
for r in rows: r["name"] = roman(r["name"])
save("auth", "auth-music", SRC, rows)
