# ΑΣΠΑΙΤΕ, Εκπαιδευτικών Μηχανολόγων Μηχανικών: the per-semester tables of the programme (NEO-ΠΡΟΓΡΑΜΜΑ-ΣΠΟΥΔΩΝ, pages 5–7),
# updated with the department's current course list (winter semesters), where five 5th / 9th-semester courses became
# "choose one of two" (ΥΕ) with a new alternative (code + Π), transcribed below.
import re
from lib import save, norm
SRC = "https://mechanical.aspete.gr/σπουδές/προπτυχιακές-σπουδές"
ALT = {  # current list: code → alternative ("Π") course
    "Μ0505": "Σχεδίαση με Η/Υ", "Μ0901": "Σύγχρονες Τεχνολογίες Αυτοκίνησης",
    "Μ0903": "Σχεδιασμός και Βελτιστοποίηση Ενεργειακών Συστημάτων", "Μ0904": "Ενεργειακοί Έλεγχοι και Επιθεωρήσεις",
    "Μ0905": "Προστασία Περιβάλλοντος και Τεχνολογίες Αντιρύπανσης"}
L = [norm(l) for l in open("raw/aspete-mech.txt")]
L = L[next(i for i, l in enumerate(L) if l == "1o ΕΞΑΜΗΝΟ"):next(i for i, l in enumerate(L) if l == "=== page 8")]
rows, sem = [], None
for i, l in enumerate(L):
    if m := re.fullmatch(r"(\d+)o ΕΞΑΜΗΝΟ", l): sem = int(m[1]); continue
    m = re.match(r"(Μ\d{4}) (.+?) (?:Υ [ΤTΠ]|\(\*\))", l)
    if not m: continue
    name, nxt = m[2], L[i + 1]
    if not re.match(r"Μ\d{4}|Σύνολα|http|===|\d+o ΕΞΑΜΗΝΟ", nxt):
        name = name[:-1] + nxt if name.endswith("-") else f"{name} {nxt}"
    code = m[1]
    if code in ALT:
        rows += [{"code": code, "name": name, "semester": sem, "kind": "elective", "group": f"Ένα από {code} / {code}Π"},
                 {"code": code + "Π", "name": ALT[code], "semester": sem, "kind": "elective", "group": f"Ένα από {code} / {code}Π"}]
    else:
        rows.append({"code": code, "name": name, "semester": sem, "kind": "elective" if "(*)" in l else "core"})
save("aspete", "aspete-mech", SRC, rows)
