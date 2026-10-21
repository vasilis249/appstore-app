# Χαροκόπειο, Επιστήμης Διαιτολογίας-Διατροφής: Οδηγός Σπουδών (PDF, Oct 2026) — the programme table per «Χ Εξάμηνο»
# ("ΓΕ0500 Βιολογία Κυττάρου 2 2 6"; a long title wraps around a row with no title: line before + line after) and the
# «Κατάλογος μαθημάτων επιλογής» (ΧΕΙΜ / ΕΑΡ, no fixed semester; a title wraps onto the line after).
import re
from lib import save, norm
SRC = "https://dnd.hua.gr/wp-content/uploads/2026/10/ΟΔΗΓΟΣ-ΣΠΟΥΔΩΝ-2.pdf"
SEM = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
ROW = re.compile(r"^([Α-ΩA-Z]{2}\d{4})\s*(.*?)\s*((?:\s*(?:\d+(?:[.,]\d+)?|-))+)\s*(ΧΕΙΜ|ΕΑΡ)?$")
L = [norm(l) for l in open("raw/hua-diet.txt")]
start = next(i for i, l in enumerate(L) if l == "Α Εξάμηνο")
rows, sem, kind, prev, i = [], None, "core", "", start
SKIP = re.compile(r"^(ΣΥΝΟΛΟ|Σύνολο|Μάθημα Επιλογής|οι φοιτ|επιλογής$|=== page|Χ Α Ρ Ο|ΣΧΟΛΗ|ΤΜΗΜΑ|ΕΛ\. ΒΕΝ|\d+$|ΚΩΔΙΚΟΣ|\(ώρες\)|ΠΑΡΑΔΟΣΕΙΣ)")
while i < len(L):
    l = L[i]; i += 1
    if l.startswith("Σύνολο ECTS για το Πρόγραμμα"): break
    if m := re.fullmatch(r"(ΣΤ|[Α-Η]) Εξάμηνο", l): sem, prev = SEM[m[1]], ""; continue
    if l.startswith("ΚΑΤΑΛΟΓΟΣ ΜΑΘΗΜΑΤΩΝ ΕΠΙΛΟΓΗΣ"): sem, kind, prev = None, "elective", ""; continue
    m = ROW.match(l)
    if not m:
        prev = "" if SKIP.match(l) else l; continue
    name, nxt = m[2], (L[i] if i < len(L) else "")
    follow = nxt and not ROW.match(nxt) and not SKIP.match(nxt) and not re.fullmatch(r"(ΣΤ|[Α-Η]) Εξάμηνο", nxt)
    if not name: name = prev + " " + (nxt if follow else ""); i += bool(follow)
    elif kind == "elective" and follow: name += " " + nxt; i += 1
    name = re.sub(r"\s*\(Ε\)$", "", norm(name))
    k = "elective" if kind == "elective" or re.match(r"Πρακτική|Πτυχιακή", name) else "core"  # thesis or placement
    rows.append({"code": m[1], "name": name, "semester": sem, "kind": k, "group": (m[4] and {"ΧΕΙΜ": "Χειμερινό", "ΕΑΡ": "Εαρινό"}[m[4]])})
    prev = ""
save("hua", "hua-diet", SRC, rows, note="Electives (7 of them, from the 5th semester) are offered in the winter or spring term.")
