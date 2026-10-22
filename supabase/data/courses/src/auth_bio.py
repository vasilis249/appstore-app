# ΑΠΘ Βιολογίας: «Εγκόλπιο / Οδηγός Σπουδών 2025-2026» PDF (raw/auth-bio-guide.pdf, pdftext.py → .txt), «Κατανομή
# μαθημάτων σε εξάμηνα»: per «Νο εξάμηνο» rows "CODE TITLE ECTS TYPE"; 5th-6th semester carry one type per track
# (ΓΚ ΜΒ ΠΒ): ΥΚ = compulsory in that track. Υ = core; Ε, ΔΕ (thesis), ΠΡΑ / ΠΡΔ (internships) = elective. A title that
# wraps around "CODE ECTS TYPE" takes the line before and after. Capitals re-cased.
import re
from lib import save, norm, recaser
SRC = "https://bio.auth.gr/odigos-spoydon/"
TRACKS = ["Γενική - Εκπαίδευσης", "Μοριακή Βιολογία, Γενετική και Βιοτεχνολογία", "Περιβαλλοντική Βιολογία"]  # ΓΚ ΜΒ ΠΒ
case = recaser(["raw/auth-bio-guide.txt"])
L = [norm(l) for l in open("raw/auth-bio-guide.txt")]
start = L.index("Κατανομή μαθημάτων σε εξάμηνα")
stop = next(i for i in range(start, len(L)) if L[i].startswith("Περιεχόμενο μαθημάτων"))
CODE = r"[A-ZΑ-Ω]{2}[.\w]*\d"
TYPE = r"(?:Υ|Ε|ΥΚ|ΔΕ|ΠΡΑ|ΠΡΔ|-)"
rows, sem = [], None
for i in range(start, stop):
    l = L[i]
    if m := re.fullmatch(r"(\d)ο εξάμηνο", l): sem = int(m[1]); continue
    m = re.fullmatch(rf"({CODE}) (.*?) ?\*?\d+ ({TYPE}(?: {TYPE})*)", l)
    if not sem or not m or "ΑΛΛΟΥ ΤΜΗΜΑΤΟΣ" in l: continue
    code, title, types = m[1], m[2], m[3].split()
    if not title: title = f"{L[i - 1]} {L[i + 1]}"  # wrapped cell
    track = [TRACKS[n] for n, t in enumerate(types) if t == "ΥΚ"] if len(types) == 3 else []
    kind = "core" if types == ["Υ"] else "track_core" if track else "elective"
    for g in track or [None]:
        rows.append({"code": code, "name": case(title), "semester": sem, "kind": kind, "group": g})
save("auth", "auth-bio", SRC, rows)
