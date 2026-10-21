# ΓΠΑ, Επιστήμης Τροφίμων και Διατροφής του Ανθρώπου: «Πρόγραμμα Σπουδών 2025-2026» — per «Α' ΕΞΑΜΗΝΟ» "Υποχρεωτικά: n"
# then "Επιλογής (1 από 4)", rows "<code> <Title> <department> <hours> <ECTS>"; a long title wraps around its code line
# (both lines around it are free text). English (no ECTS) follows each semester; the last page (labelled H' again) is the 10th semester.
import re
from lib import save, norm
SRC = "https://w1.aua.gr/etda/wp-content/uploads/sites/10/2025/12/ΠΡΟΓΡΑΜΜΑ-ΣΠΟΥΔΩΝ-2025-2026.pdf"
SEM = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Z": 7, "Ζ": 7, "H": 8, "Η": 8, "Θ": 9}
ROW = re.compile(r"(\d+) ?(.*?) ?(ΕΤΔΑ|ΕΦΠ-ΕΤΔΑ|ΕΦΠ|ΕΖΠ|ΑΦΠΓΜ|BIO|ΒΙΟ|ΑΟΑ) [\d(].*")
FIXED = re.compile(r"(Υποχρεωτικά|Επιλογής|Σύνολο|Τίτλος|===|ΠΡΟΓΡΑΜΜΑ|ΤΜΗΜΑΤΟΣ)|.+ ΕΞΑΜΗΝΟ$|\d+ Αγγλικά")
L = [norm(l) for l in open("raw/aua-etda.txt")]
rows, sem, head, used = [], 0, None, set()
free = lambda k: 0 <= k < len(L) and not FIXED.match(L[k]) and not ROW.fullmatch(L[k])
for i, l in enumerate(L):
    if m := re.fullmatch(r"(\S+)' ΕΞΑΜΗΝΟ", l): sem = 10 if sem == 9 else SEM[m[1]]; continue
    if l.startswith("Υποχρεωτικά") or l.startswith("Επιλογής"): head = l; continue
    if m := re.fullmatch(r"(\d+) (Αγγλικά .+)", l):
        rows.append({"code": m[1], "name": m[2], "semester": sem, "kind": "core"}); continue
    if sem == 10 and (m := re.fullmatch(r"(?:(\d+) )?(Πτυχιακή Μελέτη|Πρακτική Άσκηση).*", l)):
        rows.append({"code": m[1], "name": m[2], "semester": 10, "kind": "core"}); continue
    if not (m := ROW.fullmatch(l)): continue
    name = m[2]
    if free(i - 1) and free(i + 1) and i - 1 not in used:  # wrapped: the free lines around its code line are its title
        name = " ".join(x for x in (L[i - 1], m[2], L[i + 1]) if x); used.add(i + 1)
    name = re.sub(r"\s*\(Επιλογής στο ίδιο εξάμηνο\)", "", name)
    elective = head.startswith("Επιλογής")
    rows.append({"code": m[1], "name": name, "semester": sem, "kind": "elective" if elective else "core",
                 "group": re.sub(r"\(\s+", "(", head) if elective else None})
save("aua", "aua-food", SRC, rows)
