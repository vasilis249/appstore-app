# ΠΑΔΑ departments on the shared site theme: «Πρόγραμμα Σπουδών» overview + one page per semester (uniwa_fetch.py →
# raw/uniwa-<site>-p<N>.txt). After "Home /": «Α' Εξάμηνο» headings, section headers ("Υποχρεωτικά", "Ειδικού
# Υπόβαθρου Υποχρεωτικό", "Κατ' επιλογή υποχρεωτικά", "Ειδικότητας - Επιλογής Υποχρεωτικό"…), rows of cells
# code / title / category / hours / ECTS / teachers. A row titled "Κατ’ επιλογήν Ομάδα Α’" is a slot = the group of
# the electives under it. Capitals re-cased.
import re, sys, glob
from lib import save, norm, recaser
SITES = {"uniwa-nurs": "nurs", "uniwa-ot": "ot", "uniwa-physio": "phys", "uniwa-tour": "tourism", "uniwa-ecec": "ecec",
         "uniwa-pch": "pch", "uniwa-fst": "fst", "uniwa-gd": "gd", "uniwa-ia": "ia", "uniwa-cons": "cons",
         "uniwa-bisc": "bisc", "uniwa-sge": "geo", "uniwa-mech": "mech", "uniwa-accfin": "accfin", "uniwa-bme": "bme",
         "uniwa-civil": "civ", "uniwa-alis": "alis"}  # bme: overview only (p0)
TRACKS = {"ΔΥ": "Δημόσια Υγεία", "ΚΥ": "Κοινοτική Υγεία",  # pch headings "Δ΄ Εξάμηνο ΔΥ"
          "Διπλωματική": None}  # mech "Ι’ Εξάμηνο – Διπλωματική" is no track
GREEK = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8, "H": 8, "Θ": 9, "Ι": 10}
SEM = re.compile(r"(?:(ΣΤ|[ΑΒΓΔΕΖΗHΘΙ])\s?['’΄]|(\d+)\s?(?:ο|o|ου))\s*(?:Εξάμηνο|ΕΞΑΜΗΝΟ|εξάμηνο)\s*(?:[-–:]?\s*(.+))?")
CODE = re.compile(r"(?=\S*[A-Za-zΑ-Ωα-ω])(?=\S*\d)[\w.\-/]{2,15}(?:\(ε\d\))?|\d{3,6}(?:-\d{3,6})?|[Α-ΩA-Z]\d \d{4}")  # last: cons "Π1 1070"
HEAD = re.compile(r"(?i).{0,60}(υποχρεωτικ|επιλογ|ελεύθερ|προαιρετ|κορμ|υπόβαθρ|υποβάθρ).{0,40}")
case = recaser([], hand={"νευρομυικεσδιαταραχεσ": "νευρομυϊκές διαταραχές", "ιχθυηρων": "ιχθυηρών", "ομαδαβ": "ομάδα Β"})
def parse(site):
    rows = []
    for f in sorted(glob.glob(f"raw/uniwa-{site}-p*.txt"), key=lambda f: int(re.search(r"-p(\d+)", f)[1])):
        L = [norm(l) for l in open(f)]
        if "Home /" in L: L = L[L.index("Home /") + 1:]
        elif "Κωδικός Μαθήματος" in L: L = L[L.index("Κωδικός Μαθήματος") - 3:]  # pages without the breadcrumb
        else: continue
        L = L[:next((i for i, l in enumerate(L) if l.upper() == "ΕΠΙΚΟΙΝΩΝΙΑ"), len(L))]  # the footer
        sem = track = kind = group = htrack = None
        for i, l in enumerate(L[:-1]):
            if m := re.fullmatch(r"Εξάμηνο (\d+)[οo]\s*[-–:]?\s*(.*)", l):  # civ "Εξάμηνο 1ο"
                sem, track, kind, group = int(m[1]), TRACKS.get(m[2], m[2] or None), None, None; continue
            if m := SEM.fullmatch(l):
                sem, track, kind, group = GREEK[m[1]] if m[1] else int(m[2]), TRACKS.get(m[3], m[3] and m[3].strip("()")), None, None; continue
            if m := re.fullmatch(r"Κατεύθυνσης (.+)", l):  # accfin section "Κατεύθυνσης Λογιστικής" = that track's core
                kind, group, htrack = "core", None, f"Κατεύθυνση {m[1]}"; continue
            if HEAD.fullmatch(l) and not CODE.fullmatch(l) and not (i and CODE.fullmatch(L[i - 1])):  # not a title cell
                kind = "elective" if re.search(r"(?i)επιλογ|ελεύθερ|προαιρετ", l) else "core"; group = htrack = None; continue
            if not CODE.fullmatch(l) or not (sem or kind) or CODE.fullmatch(L[i + 1]) or re.fullmatch(r"[\d.,\s]+", L[i + 1]): continue
            title = L[i + 1]
            if m := re.fullmatch(r"(?i)κατ['’΄]?\s*επιλογή?ν?\s+(ομάδα\s+.+)", title): group = m[1][0].upper() + m[1][1:]; continue
            if title.isupper(): title = case(title)
            track_now = htrack or track
            k, g = kind or "core", group or track_now  # bme has no section headers: "ΝΜΒ.904(ε1)" = elective group ε1
            if m := re.search(r"\((ε\d)\)$", l): k, g, l = "elective", f"Ομάδα επιλογής {m[1]}", l[:m.start()]
            rows.append({"code": l, "name": title, "semester": sem, "kind": "track_core" if k == "core" and track_now else k, "group": g})
    return rows
for dept in sys.argv[1:] or SITES:
    site = SITES[dept]
    save("uniwa", dept, f"https://{site}.uniwa.gr/courses/", parse(site))
