# Γερμανικής Γλώσσας και Φιλολογίας ΕΚΠΑ: Οδηγός Σπουδών 2026-27 (draft; the 2025-26 PDF has a broken font encoding).
# Τύπος Α (semesters 1-4, compulsory; semesters from the «Ενδεικτικό πρόγραμμα»; DAY 01 = Γλώσσα Ι-IV), Τύπος Β
# (5-8: compulsory electives by branch and unit, no fixed semester).
import re
from lib import save, norm, fold
SRC = "https://www.gs.uoa.gr/fileadmin/depts/gs.uoa.gr/www/uploads/odigoi_spoudon/ODIGOS_SPOYDON_2026-2027_draft_ev_diorthoseis_nk_choris_scholia.pdf"
L = [norm(l) for l in open("raw/gs26.txt")]
a = next(i for i, l in enumerate(L) if l.startswith("ΜΑΘΗΜΑΤΑ ΤΥΠΟΥ Α (1ο-4ο ΕΞΑΜΗΝΟ)") and i > 100)
b = next(i for i, l in enumerate(L) if l.startswith("Μαθήματα Ελεύθερης Επιλογής") and i > a + 300)
rows, kind, group, branch, cur = [], "core", None, None, None
for l in L[a:b]:
    if m := re.match(r"^Ι{1,2}\. Κλάδος (Γλωσσολογίας|Λογοτεχνίας)", l): branch = m[1]; cur = None; continue
    if l.startswith("ΜΑΘΗΜΑΤΑ ΤΥΠΟΥ Β"): kind = "elective"; continue
    if kind == "elective" and (m := re.match(r"^Ενότητα ([ΑΒΓ]):", l)): group = f"Υποχρεωτικής επιλογής: {branch}, Ενότητα {m[1]}"; cur = None; continue
    if m := re.match(r"^(?:\d+\. |[IVΙ]+\. )?(D[A-Z]{2} \d\d): (.+)$", l):
        if kind == "elective" and not group: continue  # prose before the unit lists
        cur = {"code": m[1].replace(" ", ""), "name": m[2], "kind": kind, "group": group, "semester": None}; rows.append(cur)
    elif cur and l and not re.match(r"^(\d|=== page|\(|Ενότητα|Στα |Τα |ΙΙ?\.|Συγκεκριμένα)", l):
        cur["name"] = cur["name"][:-1] + l if cur["name"].endswith("-") and l[0].islower() else cur["name"] + " " + l
    else: cur = None
# the 2026-27 draft names the 9 literature Τύπος Α courses only in prose; codes as in the 2024-25 guide
LIT = [("DLY20", "Εισαγωγή στην Επιστήμη της Λογοτεχνίας", 1), ("DLY25", "Σύγχρονη Λογοτεχνία", 1),
       ("DLY24", "Λογοτεχνία του 20ού αιώνα", 2), ("DLY29", "Γερμανικός Πολιτισμός", 2), ("DLY23", "Λογοτεχνία του 19ου αιώνα", 3),
       ("DLY27", "Συγκριτική Φιλολογία", 3), ("DLY22", "Λογοτεχνία του 18ου αιώνα", 4), ("DLY26", "Θεωρία της Λογοτεχνίας", 4),
       ("DLY28", "Εισαγωγή στη Θεωρία και Πρακτική της Μετάφρασης", 4)]
rows += [{"code": c, "name": n, "kind": "core", "semester": s} for c, n, s in LIT]
for r in rows:
    if r["code"] == "DAY02": r["name"] = "Εισαγωγή στον επιστημονικό τρόπο εργασίας"
rows = [r for r in rows if r["code"] != "DAY01"] + [{"code": "DAY01", "name": f"Γλώσσα {n}", "kind": "core", "semester": s} for s, n in enumerate(["Ι", "ΙΙ", "ΙΙΙ", "IV"], 1)]
sem, n = {}, None  # the indicative table wraps the two Διδακτική titles → set by hand below
for l in L[a:b]:
    if m := re.match(r"^(\d)o ΕΞΑΜΗΝΟ ECTS$", l): n = int(m[1]); continue
    if n and (m := re.match(r"^\d\. (.+?) \d+$", l)): sem.setdefault(fold(m[1].replace("/", " / ")), n)
for r in rows:
    if r["kind"] == "core" and not r["semester"]:
        f = fold(r["name"])
        r["semester"] = {"DGY18": 2, "DGY19": 3}.get(r["code"]) or sem.get(f) or next((v for k, v in sem.items() if f.startswith(k) or k.startswith(f)), None)
save("uoa", "uoa-german", SRC, rows, note="2026-27 draft guide. Τύπος Β courses (semesters 5-8) have no fixed semester; 7 more Τύπος Β courses are free electives.")
