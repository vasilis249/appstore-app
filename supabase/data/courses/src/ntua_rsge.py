# ΣΑΤΜ: Οδηγός Σπουδών 2026-27 (PDF), Πίνακας 2 "Προσφερόμενα μαθήματα ανά εξάμηνο".
import re
from lib import save, norm
SRC = "https://www.survey.ntua.gr/files/secr_announcements/proptyxiakes/odigos-spoudwn-akad-imer/2026-2027/Οδηγός_Σπουδών_ΣΑΤΜ-ΜΓ_2026-2027.pdf"
FLOWS = {"1": "Χωρομετρία", "2": "Διαχείριση και Επεξεργασία Χωρικής Πληροφορίας", "3": "Χωρικός Σχεδιασμός και Διαχείριση Περιβάλλοντος",
         "4": "Σχεδιασμός Συγκοινωνιακών Συστημάτων και Υποδομών", "5": "Υδατικοί Πόροι"}
lines = [norm(l) for l in open("raw/rsge-2627.txt")]
a = next(i for i, l in enumerate(lines) if l.startswith("Πίνακας 2: ΠΡΟΣΦΕΡΟΜΕΝΑ"))
b = next(i for i, l in enumerate(lines) if l.startswith("Για την απόκτηση διπλώματος"))
rows, sem, kind, group, pending = [], None, "core", None, ""
ROW = re.compile(r"^\d+\.\s+(\d{4})\s*(.*?)\s*(?:-|\d+)\s+[\d,]+$")
def clean(n): return norm(re.sub(r"\(Νέος Τίτλος\)\s*\**", "", n)).replace("ΠΡΑΚΤΙΚΗ ΑΣΚΗΣΗ", "Πρακτική Άσκηση")
i = a
while i < b:
    l = lines[i]; i += 1
    if m := re.match(r"^(\d)ο ΕΞΑΜΗΝΟ$", l): sem, kind, group, pending = int(m[1]), "core", None, ""; continue
    if "Υποχρεωτική η επιλογή ενός" in l: kind, group = "elective", ("Ξένη γλώσσα" if sem in (1, 2, 3, 4) else "Ανθρωπιστικό"); continue
    if l.startswith("Προσφερόμενο Διασχολικό"): kind, group = "elective", "Διασχολικό (δεν προσμετράται στο δίπλωμα)"; continue
    if m := re.search(r"ΡΟΗ (\d) - ΥΠΟΧΡΕΩΤΙΚΑ", l): kind, group = "track_core", f"Ροή {m[1]}: {FLOWS[m[1]]}"; continue
    if m := re.search(r"ΡΟΗ (\d) – Κ(\d) ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ", l): kind, group = "elective", f"Ροή {m[1]}: {FLOWS[m[1]]} · Κατεύθυνση {m[2]}"; continue
    if m := ROW.match(l):
        name = m[2] or norm(pending + " " + lines[i]); i += 0 if m[2] else 1
        rows.append({"code": m[1], "name": clean(name), "semester": sem, "kind": kind, "group": group}); pending = ""; continue
    if m := re.match(r"^(\d{4}) (\D.+)$", l):  # language list without a row number (4th semester)
        rows.append({"code": m[1], "name": clean(m[2]), "semester": sem, "kind": "elective", "group": "Ξένη γλώσσα (ορολογία)"}); continue
    if sem is None or re.match(r"^(A/A|Α/Α|ΚΩΔ|Σύνολο|===|Οδηγός Σπουδών|\d+$|\*|Ροή \d|ΞΕΝΗ ΓΛΩΣΣΑ|δεν προσμετράται|\d+\. \d)", l): pending = ""; continue
    pending = l
rows.append({"name": "Διπλωματική Εργασία", "semester": 10, "kind": "core"})
save("ntua", "ntua-rsge", SRC, rows, note="Ροές/κατευθύνσεις από το 8ο εξάμηνο: «track_core» = υποχρεωτικό της ροής, «elective» = επιλογής κατεύθυνσης (groups).")
