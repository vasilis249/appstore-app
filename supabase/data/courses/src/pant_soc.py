# Πάντειο, Κοινωνιολογίας: Οδηγός Προπτυχιακού Προγράμματος Σπουδών 2026-27 (PDF). Code, semester and kind come from
# the course outlines ("300012 – ΑΡΧΕΣ ΚΟΙΝΩΝΙΟΛΟΓΙΑΣ" / "Υποχρεωτικό – 6 ECTS" under "Α΄ ΕΞΑΜΗΝΟ"), whose titles are
# in capitals without accents; the properly written title is taken from the programme tables (pages 21–31), whose
# title cells wrap above and below the code row: the run of title fragments next to the code that folds to the
# outline's title is the name.
import difflib, re
import pdfplumber
from lib import save, norm, fold
SRC = "https://sociology.panteion.gr/images/2026-2027_ΟΔΗΓΟΣ_ΠΡΟΠΤΥΧΙΑΚΟΥ_ΠΡΟΓΡΑΜΜΑΤΟΣ_ΣΠΟΥΔΩΝ_new.pdf"
SEM = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}

L = [norm(l) for l in open("raw/pant-soc.txt")]
start = next(i for i, l in enumerate(L) if l.startswith("10. Περιγράμματα Μαθημάτων"))
outlines, sem = [], None
for i in range(start, len(L)):
    if m := re.fullmatch(r"(ΣΤ|[Α-Η])΄ ΕΞΑΜΗΝΟ", L[i]): sem = SEM[m[1]]; continue
    m = re.match(r"^(\d{6})\s*[–-]\s*(.+)$", L[i])
    if not m or sem is None: continue
    title, j = m[2], i + 1
    while j < len(L) and not re.match(r"^(Υποχρεωτικό|Σεμινάριο|ΣΕΜΙΝΑΡΙΟ|Επιλογής)", L[j]) and j < i + 4: title += " " + L[j]; j += 1
    k = L[j] if j < len(L) else ""
    kind = "core" if re.match(r"Υποχρεωτικό\s*[–-]", k) else "elective"
    title = re.sub(r"\s+\d+ === page.*$", "", title)
    title = re.split(r"\s(?=[Α-ΩA-Z][α-ωά-ώa-z])", title)[0]  # a lower-case table fragment leaked in
    outlines.append((m[1], norm(title), sem, kind))

# title fragments of the programme tables, in reading order, with the code of the row they sit on (if any)
frags = []
pdf = pdfplumber.open("raw/pant-soc.pdf")
for page in pdf.pages[20:40]:
    for t in page.extract_tables():
        for r in t:
            c = [norm((x or "").replace("\n", " ")) for x in r]
            if len(c) >= 3 and (c[1] or c[2]): frags.append((c[1] if re.fullmatch(r"\d{6}", c[1]) else None, c[2]))


def key(t): return fold(re.sub(r"\(.*?\)", "", t)).replace(" αιωνα ", " αι ")


def proper(code, upper):
    """The shortest run of fragments around the code row that reads like the outline's title (≥ 0.9 similar)."""
    want, best = key(upper), (0.9, None)
    for at in [i for i, (c, _) in enumerate(frags) if c == code]:
        wins = [(a, b) for a in range(max(0, at - 4), at + 1) for b in range(at + 1, min(len(frags), at + 6) + 1)]
        for a, b in sorted(wins, key=lambda w: w[1] - w[0]):
            if any(c and c != code for c, _ in frags[a:b]): continue  # not across another course's row
            text = norm(" ".join(f for _, f in frags[a:b]))
            if text.startswith("(") and not upper.startswith("("): continue  # the previous cell's "(…)" line
            r = difflib.SequenceMatcher(None, key(text), want).ratio()
            if r > best[0] + 1e-9: best = (r, text)
    return best[1]


FIX = {"300779": "Εμπειρική Εγκληματολογία ΙΙ και φροντιστήριο",
       "300177": "Οικονομική και Κοινωνική Ανάπτυξη στην Κεντροανατολική και Νοτιοανατολική Ευρώπη: Συγκριτική Προσέγγιση"}
rows = []
for code, upper, sem, kind in outlines:
    name = proper(code, upper)
    if code in FIX: name = FIX[code]
    if not name: print("caps:", code, upper); name = upper
    rows.append({"code": code, "name": name, "semester": sem, "kind": kind})
save("panteion", "panteion-soc", SRC, rows)
