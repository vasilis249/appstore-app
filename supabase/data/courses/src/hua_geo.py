# Χαροκόπειο, Γεωγραφίας: «Πρόγραμμα Σπουδών (ΠΠΣ)», one page per year (?academic-year=1…4) — per «Nο Εξάμηνο» each
# course line ("Τίτλος (ΚΩΔΙΚΟΣ)") is followed by its kind; electives are grouped («Ομάδα Ι - Φυσική Γεωγραφία» …).
import re
from lib import save, norm
SRC = "https://geo.hua.gr/courses/?academic-year=1"
L = [norm(l) for l in open("raw/hua-geo.txt")]
rows, sem, group = [], None, None
for i, l in enumerate(L):
    if m := re.fullmatch(r"(\d+)ο Εξάμηνο", l): sem, group = int(m[1]), None; continue
    if re.match(r"^Ομάδα [IVXΙ]+ - |^Ανεξάρτητα Ομάδων$", l): group = l if l.startswith("Ομάδα") else None; continue
    if sem and i + 1 < len(L) and L[i + 1] in ("Υποχρεωτικό", "Επιλογής"):
        m = re.match(r"^(.*?)\s*\(([A-ZΑ-Ω]{2,4}\d{3,4})\)$", l)
        core = L[i + 1] == "Υποχρεωτικό"
        rows.append({"name": m[1] if m else l, "code": m[2] if m else None, "semester": sem,
                     "kind": "core" if core else "elective", "group": None if core else group})
save("hua", "hua-geo", "https://geo.hua.gr/courses/?academic-year=1 (…4)", rows)
