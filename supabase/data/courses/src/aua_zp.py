# ΓΠΑ, Επιστήμης Ζωικής Παραγωγής: «Πρόγραμμα Σπουδών» 2025-26 — per «ΕΞΑΜΗΝΟ Nο» a header ("Υποχρεωτικά",
# "Υποχρεωτικά Επιλογής (1 από τα 3)", "Ελεύθερης Επιλογής (2 από τα 5)") then rows code / title / ECTS.
import re
from lib import save, norm
SRC = "https://zp.aua.gr/studies-program/"
L = [norm(l) for l in open("raw/aua-zp-prog.txt")]
L = L[next(i for i, l in enumerate(L) if l == "ΕΞΑΜΗΝΟ 1ο"):next(i for i, l in enumerate(L) if l == "ΠΠΣ 2025 - 2026")]
rows, sem, head = [], None, None
for i, l in enumerate(L):
    if m := re.fullmatch(r"ΕΞΑΜΗΝΟ (\d+)ο", l): sem = int(m[1]); continue
    if re.match(r"(Υποχρεωτικά|Ελεύθερης)", l): head = l; continue
    if re.fullmatch(r"\d{4}|ΝΕΟ|–", l) and head and (l != "–" or re.fullmatch(r"\d+", L[i + 2]) and not re.match("Υποχρεωτικά|Ελεύθερης|Σύνολο", L[i + 1])):
        rows.append({"code": None if l in ("ΝΕΟ", "–") else l, "name": L[i + 1], "semester": sem,
                     "kind": "core" if head == "Υποχρεωτικά" else "elective", "group": None if head == "Υποχρεωτικά" else head})
save("aua", "aua-animal", SRC, rows)
