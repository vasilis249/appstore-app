# ΑΠΘ Δημοσιογραφίας και ΜΜΕ: «Β3. Οδηγός Σπουδών» PDF (raw/auth-jour-b3.pdf, pdftext.py → .txt), «Παράρτημα Α»: table
# Α = υποχρεωτικά κοινά, Β = υποχρεωτικά κατεύθυνσης (Δημοσιογραφία | Μέσα Επικοινωνίας), Γ = επιλογής κατεύθυνσης,
# Δ = ελεύθερης επιλογής. Rows "N Title ECTS", titles wrap onto the next line(s); electives have no fixed semester.
import re
from lib import save, norm
SRC = "https://jour.auth.gr/wp-content/uploads/sites/332/2024/11/Β3-ΟΔΗΓΟΣ-ΣΠΟΥΔΩΝ_merged.pdf"
SEM = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
TRACK = {"ΔΗΜΟΣΙΟΓΡΑΦΙΑΣ": "Δημοσιογραφία", "ΜΕΣΩΝ ΕΠΙΚΟΙΝΩΝΙΑΣ": "Μέσα Επικοινωνίας"}
L = [norm(l) for l in open("raw/auth-jour-b3.txt")]
start = L.index("Πίνακας Α. Μαθήματα Κατηγορίας Α – «Υποχρεωτικά» (Υ)")
stop = next(i for i in range(start, len(L)) if L[i].startswith("ΠΑΡΑΡΤΗΜΑ Β."))
rows, kind, group, sem, last = [], "core", None, None, None
for l in L[start:stop]:
    if m := re.match(r"Πίνακας ([ΑΒΓΔ])\.", l):
        kind = {"Α": "core", "Β": "track_core"}.get(m[1], "elective"); group = sem = last = None; continue
    if m := re.match(r"(?:ΥΠΟΧΡΕΩΤΙΚΑ|ΕΠΙΛΟΓΕΣ) ΚΑΤΕΥΘΥΝΣΗΣ (ΔΗΜΟΣΙΟΓΡΑΦΙΑΣ|ΜΕΣΩΝ ΕΠΙΚΟΙΝΩΝΙΑΣ)", l):
        group = TRACK[m[1]]; sem = last = None; continue
    if m := re.fullmatch(r"(ΣΤ|[ΑΒΓΔΕΖΗ]) εξάμηνο", l): sem = SEM[m[1]]; last = None; continue
    if m := re.fullmatch(r"\d+ (.+?) [56]", l):
        last = {"name": m[1], "semester": sem, "kind": kind, "group": group}; rows.append(last); continue
    if last and not re.match(r"(=== page|Β3\. Οδηγός|\d+$|ΕΛΕΥΘΕΡΕΣ|Α/|Α Σ|και για)", l): last["name"] += " " + l
    else: last = None
for r in rows:  # drop "(Συνιστάται για …)" advice and the Θ/Α (theory / lab) mark
    r["name"] = norm(re.sub(r"\((Συν[ιί]|Θ/)[^)]*\)?\.?|\bΘ/[AΑ]\b", "", r["name"])).rstrip(" .")
save("auth", "auth-jour", SRC, rows)
