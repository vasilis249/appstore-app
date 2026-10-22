# Πάτρα Βιολογίας: «Πρόγραμμα κατανομής μαθημάτων ΠΠΣ 2026-2027» PDF (raw/up-bio.pdf, pdftext.py → .txt): code lines
# "ΒΙΟ_XXX <title start> Υ|Ε <hours>…" under «Χ΄ εξάμηνο» (core) and «ΟΜΑΔΑ Α (6ου–8ου) / Β (7ου) / Γ (8ου)» electives.
# Titles wrap among the teachers' names, so the full title comes from the course's own page (up_fetch.py bio); the four
# courses without a page are named by hand.
import glob, re
from lib import save
from auth_cpt import text
from up_tables import case
SRC = "https://biology.upatras.gr/program-study/"
G = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
HAND = {"ΒΙΟ_ΑΒΧ": "Βιοχημεία Ι", "ΒΙΟ_ΛΕΟ": "Λειτουργική Οικολογία", "ΒΙΟ_ΟΕΥ": "Οικολογία Εσωτερικών Υδάτων",
        "ΒΙΟ_ΥΔΔΑ": "Υδατοκαλλιέργειες"}
names = {}
for f in glob.glob("raw/up-bio/0*.html"):
    L = text(f)
    if "ΚΩΔΙΚΟΣ ΜΑΘΗΜΑΤΟΣ" in L and (code := next((l for l in L if l.startswith("ΒΙΟ_")), None)): names[code] = case(L[4])
rows, sem = [], None
for l in open("raw/up-bio.txt"):
    if m := re.match(r"(ΣΤ|[ΑΒΓΔΕΖΗ])΄ εξάμηνο", l): sem = G[m[1]]
    elif m := re.match(r"ΟΜΑΔΑ ([ΑΒΓ])", l): sem = {"Α": None, "Β": 7, "Γ": 8}[m[1]]
    elif m := re.match(r"(ΒΙΟ_\w+) .*? ([ΥYΕE]) \d", l):
        rows.append({"code": m[1], "name": names.get(m[1]) or HAND[m[1]], "semester": sem,
                     "kind": "core" if m[2] in "ΥY" else "elective"})
save("upatras", "upatras-bio", SRC, rows)
