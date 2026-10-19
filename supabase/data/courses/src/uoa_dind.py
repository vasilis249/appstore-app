# Τεχνολογιών Ψηφιακής Βιομηχανίας ΕΚΠΑ: Πρόγραμμα Προπτυχιακών Σπουδών (Ιούλ. 2022), sections 3.2–3.7.
import re
from lib import save, norm
SRC = "https://www.dind.uoa.gr/fileadmin/depts/dind.uoa.gr/www/uploads/Programma_Spoydon_TTPSB_praktiko_29.pdf"
SECT = {"3.2": ("core", None), "3.3": ("core", "Σεμινάρια"), "3.4": ("track_core", "Κατεύθυνση Συστημάτων Ψηφιακής Βιομηχανίας"),
        "3.5": ("track_core", "Κατεύθυνση Διοίκησης Ψηφιακής Βιομηχανίας"), "3.6": ("elective", None), "3.7": ("elective", "Ελεύθερα")}
TAG = {"ΕΑ": "Κατεύθυνση Συστημάτων Ψηφιακής Βιομηχανίας", "ΕΒ": "Κατεύθυνση Διοίκησης Ψηφιακής Βιομηχανίας"}
L = [norm(l) for l in open("raw/dind22.txt")]
a = L.index("3.2 Μαθήματα Κορμού"); b = L.index("3.8 Κανόνες επιλογής")
NUM = r"(?:\d+\s+)*\d+\s+(\d)[οo](?:\s+(ΕΑΒ|ΕΑB|ΕΑ|ΕΒ))?(?:\s+(?:ΓΥ|ΕΥ|ΕΙΔ|ΓΓ|ΑΔ))?"
CODE = re.compile(rf"^(17\.\d{{3}})\s*(.*?)\s*(?:{NUM})?$")
ONLYNUM = re.compile(rf"^{NUM}$")
skip = lambda l: not l or re.match(r"^(Τύπος|Κωδ|μαθήματος|ΣΥΝΟΛΟ|Σύνολο|Τμήμα Τεχνολογιών|=== |\d+$|\*|Οι φοιτητές|Συνέλευσης|του εκάστοτε|δύο από|8ου εξαμ|κατάλογο)", l)
lines = [l for l in L[a:b] if not skip(l) or l.startswith(tuple(f"{k} " for k in SECT))]
rows, kg, used, carry = [], None, set(), None
for i, l in enumerate(lines):
    if (k := l.split(" ")[0]) in SECT and not CODE.match(l): kg = SECT[k]; continue
    if m := ONLYNUM.match(l): carry = (m[1], m[2]); used.add(i); continue
    if not (m := CODE.match(l)) or kg is None: continue
    used.add(i); sem, tag = (m[3], m[4]) if m[3] else (carry or (None, None)); carry = None
    pre = lines[i - 1] if i > 0 and i - 1 not in used and not CODE.match(lines[i - 1]) and lines[i - 1].split(" ")[0] not in SECT else ""
    if pre: used.add(i - 1)
    nxt, nxt2 = (lines[i + 1] if i + 1 < len(lines) else ""), (lines[i + 2] if i + 2 < len(lines) else "")
    post = ""
    if nxt and not CODE.match(nxt) and not ONLYNUM.match(nxt) and nxt.split(" ")[0] not in SECT:
        m2 = CODE.match(nxt2)
        if not (m2 and not m2[2]): post = nxt; used.add(i + 1)  # a line before an empty code line is that one's first half
    name = norm(" ".join([re.sub(r"\s+(ΓΥ|ΕΥ|ΕΙΔ|ΓΓ|ΑΔ)$", "", pre), m[2], post]))
    kind, group = kg
    if kind == "elective" and group is None:
        tag = (tag or "").replace("B", "Β"); group = "Επιλογής (και οι δύο κατευθύνσεις)" if tag == "ΕΑΒ" else TAG.get(tag, "Επιλογής")
    rows.append({"code": m[1], "name": name.rstrip("*"), "semester": int(sem) if sem else None, "kind": kind, "group": group})
rows += [{"name": "Πρακτική Άσκηση", "semester": 8, "kind": "elective", "group": "Πτυχιακή εργασία ή/και πρακτική άσκηση"},
         {"name": "Πτυχιακή Εργασία Ι", "semester": 7, "kind": "elective", "group": "Πτυχιακή εργασία ή/και πρακτική άσκηση"},
         {"name": "Πτυχιακή Εργασία ΙΙ", "semester": 8, "kind": "elective", "group": "Πτυχιακή εργασία ή/και πρακτική άσκηση"}]
FIX = {"17.110": "Φυσική Ι (Μηχανική)", "17.362": "Συστήματα Υποστήριξης Αποφάσεων",  # pdf line wraps the parser cannot tell apart
       "17.231": "Διοικητική Πληροφοριακών και Τηλεπικοινωνιακών Συστημάτων", "17.330": "Πληροφοριακά Συστήματα Διοίκησης και Επιχειρησιακών Πόρων"}
for r in rows: r["name"] = FIX.get(r.get("code"), r["name"])
save("uoa", "uoa-dind", SRC, rows)
