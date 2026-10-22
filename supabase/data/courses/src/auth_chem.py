# ΑΠΘ Χημείας: «Πρόγραμμα Σπουδών» page (get.sh → raw/auth-chem-pps.html, text.py → .txt). After the filters, per
# semester ("1ο εξάμηνο") and track ("ΒΑΣΙΚΟΣ ΚΥΚΛΟΣ", the 4 κατευθύνσεις): rows of cells α/α / code / TITLE / type /
# hours / ECTS. Capitals re-cased.
import re
from lib import save, norm, recaser
SRC = "https://chem.auth.gr/programma-spoudon/"
TRACKS = {"ΒΑΣΙΚΟΣ ΚΥΚΛΟΣ": None, "ΘΕΩΡΗΤΙΚΗ ΧΗΜΕΙΑ ΚΑΙ ΧΗΜΙΚΗ ΕΚΠΑΙΔΕΥΣΗ": "Θεωρητική Χημεία και Χημική Εκπαίδευση",
          "ΧΗΜΙΚΗ ΑΝΑΛΥΣΗ-ΠΕΡΙΒΑΛΛΟΝ-ΗΛΕΚΤΡΟΧΗΜΕΙΑ": "Χημική Ανάλυση - Περιβάλλον - Ηλεκτροχημεία",
          "ΧΗΜΙΚΗ ΣΥΝΘΕΣΗ-ΒΙΟΧΗΜΕΙΑ ΚΑΙ ΒΙΟΕΦΑΡΜΟΓΕΣ": "Χημική Σύνθεση - Βιοχημεία και Βιοεφαρμογές",
          "ΧΗΜΙΚΗ ΤΕΧΝΟΛΟΓΙΑ ΚΑΙ ΒΙΟΜΗΧΑΝΙΚΗ ΧΗΜΕΙΑ": "Χημική Τεχνολογία και Βιομηχανική Χημεία"}
KIND = {"ΥΠΟΧΡΕΩΤΙΚΟ": "core", "ΥΠΟΧΡΕΩΤΙΚΟ ΚΑΤ ΕΠΙΛΟΓΗΝ": "elective", "ΕΠΙΛΟΓΗΣ": "elective", "ΞΕΝΗ ΓΛΩΣΣΑ": "elective",
        "ΕΠΙΛΟΓΗΣ ΚΑΤΕΥΘΥΝΣΗΣ": "elective", "ΠΡΟΑΙΡΕΤΙΚΟ": "elective", "ΠΡΑΚΤΙΚΗ ΑΣΚΗΣΗ": "elective"}
# the page cuts long titles at 60 characters
FULL = {"(ΣΤΑΤΙΣΤΙΚ": "(ΣΤΑΤΙΣΤΙΚΗ)", "ΠΕΡΙΒΑΛΛΟΝΤ": "ΠΕΡΙΒΑΛΛΟΝΤΟΣ", "ΧΗΜΕ": "ΧΗΜΕΙΑΣ"}
case = recaser(["raw/auth-chem-pps.txt"], hand={"μακρομοριακη": "μακρομοριακή", "τασενεργων": "τασενεργών", "νανοχημεια": "νανοχημεία",
    "ηλεκτροαναλυση": "ηλεκτροανάλυση", "βιοανοργανη": "βιοανόργανη", "αρχαιομετρια": "αρχαιομετρία", "αντιρρυπανσησ": "αντιρρύπανσης",
    "χημειομετρια": "χημειομετρία", "ραδιοχημεια": "ραδιοχημεία", "στατιστικη": "στατιστική"})
L = [norm(l) for l in open("raw/auth-chem-pps.txt")]
start = next(i for i, l in enumerate(L) if l == "μαθήματα")  # the result list starts after "292 / μαθήματα"
rows, sem, track = [], None, None
for i in range(start, len(L) - 3):
    l = L[i]
    if m := re.fullmatch(r"(\d+)ο εξάμηνο", l): sem = int(m[1]); continue
    if l in TRACKS: track = TRACKS[l]; continue
    if sem and re.fullmatch(r"\d+", l) and L[i + 3] in KIND and re.fullmatch(r"[\wΑ-Ω.]{2,10}", L[i + 1]):
        kind = KIND[L[i + 3]]
        rows.append({"code": L[i + 1], "name": case(" ".join(FULL.get(w, w) if w == L[i + 2].split()[-1] else w for w in L[i + 2].split())), "semester": sem,
                     "kind": "track_core" if kind == "core" and track else kind, "group": track})
save("auth", "auth-chem", SRC, rows)
