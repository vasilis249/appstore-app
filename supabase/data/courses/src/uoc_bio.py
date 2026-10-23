# Κρήτη Βιολογίας: Οδηγός Προπτυχιακών Σπουδών 2026-27 (raw/uoc/bio-guide.pdf) §6 tables:
# "ΒΙΟΛ-101 Κ-Title" with Κ = core of both tracks, Μ / Π = core of one track (semester from the "Χ’ Εξάμηνο" header);
# §6.2 electives ΚΕ (both tracks) / ΜΕ / ΠΕ (one track), offered in the 7th or 8th semester (no fixed one).
import re
from lib import save, norm
from up_tables import rows
SRC = "https://biology.uoc.gr/index.php/el/component/content/article/561-odegoi-spoudon"
TRACK = {"Μ": "Βιομοριακές Επιστήμες και Βιοτεχνολογία", "Π": "Περιβαλλοντική Βιολογία και Διαχείριση Βιολογικών Πόρων"}
SEM = {"A": 1, "Α": 1, "B": 2, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
ROW = re.compile(r"(ΒΙΟΛ-\d{3}(?:ΔΕΜ)?) (?:([ΚΜΠKM]Ε?|KE)- ?)?(.+)")
out, sem, last = [], None, None
for text, c in rows("raw/uoc/bio-guide.pdf", 11, 20):
    if text and re.match(r"7\. ", text): break
    if not c: continue
    cells = [x for x in c if x]
    if not cells: continue
    if m := re.match(r"(\S+)’ Εξάμηνο", cells[0]): sem = SEM[m[1]]; continue
    if m := ROW.fullmatch(cells[0]):
        tag = (m[2] or "ΚΕ").translate(str.maketrans("KM", "ΚΜ"))
        name = re.sub(r"\s*\((?:Για |Προαπαιτ|Συνιστ|υποχρεωτικ|Το μάθημα).*$|\s*Κάθε (?:ζυγό|μονό) .*$", "", m[3])
        core = len(tag) == 1
        last = {"code": m[1], "name": name, "semester": sem if core else None,
                "kind": "core" if tag == "Κ" else "track_core" if core else "elective",
                "group": TRACK.get(tag[0]) if tag[0] != "Κ" else None}
        out.append(last)
    elif last and len(cells) == 1 and len(cells[0]) < 60 and not re.match(r"[α-γ]\. |Μάθημα|ΔΕΠ", cells[0]):
        last["name"] += " " + cells[0]; last = None  # title wrapped into the next row
    else: last = None
save("uoc", "uoc-bio", SRC, out)
