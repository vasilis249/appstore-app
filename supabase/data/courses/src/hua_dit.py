# Χαροκόπειο, Πληροφορικής και Τηλεματικής: «Μαθήματα» of the undergraduate programme — per «Εξάμηνο N» each course is
# a line followed by its kind ("Υποχρεωτικό" / "Επιλογής").
import re
from lib import save, norm
SRC = "https://dit.hua.gr/index.php/el/programmata-spoudon/proptyxiako/mathimata"
L = [norm(l) for l in open("raw/hua-dit.txt")]
rows, sem = [], None
for i, l in enumerate(L):
    if l == "Ηλεκτρονικές Υπηρεσίες": break
    if m := re.fullmatch(r"Εξάμηνο (\d+)", l): sem = int(m[1]); continue
    if sem and i + 1 < len(L) and L[i + 1] in ("Υποχρεωτικό", "Επιλογής"):
        rows.append({"name": l, "semester": sem, "kind": "core" if L[i + 1] == "Υποχρεωτικό" else "elective"})
save("hua", "hua-dit", SRC, rows)
