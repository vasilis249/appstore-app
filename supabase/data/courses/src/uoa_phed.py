# Επιστήμης Φυσικής Αγωγής & Αθλητισμού ΕΚΠΑ: Οδηγός/Πρόγραμμα Σπουδών 2025 — κατάλογος υποχρεωτικών (εξάμηνο Α–Η),
# κατ' επιλογήν ανά τομέα, και τα μαθήματα κάθε ειδίκευσης (7ο–8ο εξάμηνο, «Μαθήματα ειδίκευσης»).
import re
from lib import save, norm
SRC = "https://www.phed.uoa.gr/fileadmin/depts/phed.uoa.gr/www/uploads/Anakoinwseis_Protpyxiakwn/Anakoinnwseis_Proptychiakwn_2025/PSESS46PSZ2N-R7B_Programma_spoydon_.pdf"
SEMS = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
L = [norm(l) for l in open("raw/phed.txt")]
a = L.index("ΚΑΤΑΛΟΓΟΣ ΥΠΟΧΡΕΩΤΙΚΩΝ ΜΑΘΗΜΑΤΩΝ")
b = next(i for i in range(a, len(L)) if re.match(r"^(ΠΕΡΙΓΡΑΜΜΑ|ΠΕΡΙΓΡΑΜΜΑΤΑ|ΠΕΡΙΕΧΟΜΕΝΟ ΜΑΘΗΜΑΤΩΝ|ΠΕΡΙΓΡΑΦΕΣ)", L[i]) and i > a + 300)
CODE = re.compile(r"^([Α-Ω]{2}-\d{3}(?:Υπ|Επ|[Α-Ω]{2,3}))\d?\b\s*(.*)$")
TAIL = re.compile(r"\s*(?:(?:\d+(?:,\d)?|-)\s+)*(?:\d+(?:,\d)?|-)?\s*(Εαρινό|Χειμερινό|Ετήσιο|ΣΤ|[Α-Η])?\s*$")
NUMS = re.compile(r"\s+(?:(?:\d+|-)\s*)+(Εαρινό|Χειμερινό|Ετήσιο)?$")
rows, sector, spec, spec_open, i = [], None, None, False, a
lines = L[a:b]
SPEC = {"ΑΒ": "Άρση Βαρών", "ΑΔ": "Αθλητική Διοίκηση", "ΑΛ": "Κλασικός Αθλητισμός: Άλματα", "ΑΝ": "Αντισφαίριση", "ΒΑ": "Πετοσφαίριση επί Άμμου",
        "ΔΡ": "Κλασικός Αθλητισμός: Δρόμοι", "ΕΓ": "Ενόργανη Γυμναστική", "ΕΥ": "Άσκηση - Ευρωστία - Υγεία", "ΕΧ": "Χορολογία / Ορχηστική",
        "ΘΣ": "Θαλάσσιο Σκι", "ΙΣ": "Ιστιοπλοΐα", "ΚΑ": "Καλαθοσφαίριση", "ΚΛ": "Κλασικός Αθλητισμός (κοινά)", "ΚΟ": "Κολύμβηση", "ΚΩ": "Κωπηλασία",
        "ΜΔ": "Μαχητικά & Δυναμικά Αθλήματα (κοινά)", "ΞΙ": "Ξιφασκία", "ΠΑ": "Πάλη", "ΠΕ": "Πετοσφαίριση", "ΠΚΑ": "Προσαρμοσμένη Κινητική Αγωγή",
        "ΠΟ": "Ποδοσφαίριση", "ΠΥ": "Πυγμαχία", "ΡΓ": "Ρυθμική Γυμναστική", "ΡΙ": "Κλασικός Αθλητισμός: Ρίψεις", "ΣΚ": "Καλλιτεχνική Κολύμβηση",
        "ΤΖ": "Τζούντο", "ΤΚ": "Ταε Κβο Ντο", "ΥΔ": "Υδατοσφαίριση", "ΥΣ": "Υγρός Στίβος (κοινά)", "ΧΕ": "Χειροσφαίριση", "ΧΙ": "Χιονοδρομία"}
def kindgroup(code):
    if code.endswith("Υπ"): return "core", None
    if code.endswith("Επ"): return "elective", f"Τομέας {sector} · επιλογής" if sector else "Επιλογής"
    return "track_core", "Ειδίκευση: " + SPEC[re.sub(r"^.*?\d{3}", "", code)]
used = set()
for i, l in enumerate(lines):
    if m := re.match(r"^Τομέας (.+?)(?: \([Α-Ω]{2}\))?$", l): sector = m[1]; continue
    if "Ειδίκευση" in l:
        t = l.split("Ειδίκευση", 1)[1]
        t = re.sub(r"\b(Θ|Ε|ΠΜ|ΕΦ|ΕΞΑΜΗΝΟ?|ΕΞΑΜΗΝ)\b", "", t)
        spec = norm(t.replace("«", "").split("»")[0]).rstrip("*"); spec_open = "»" not in t and "«" in t; continue
    if spec_open and not CODE.match(l):
        t = re.sub(r"^Κωδικός\s*|\b(Θ|Ε|ΠΜ|ΕΦ|ΕΞΑΜΗΝΟ?)\b", "", l)
        spec = norm(spec + " " + t.replace("«", "").split("»")[0]); spec_open = "»" not in t
        if "»" in t or not t.strip(): spec_open = False
        continue
    m = CODE.match(l)
    if not m: continue
    code, rest = m[1], m[2]
    tm = TAIL.search(rest); semtok = tm[1] if tm else None
    name = norm(rest[:tm.start()] if tm else rest)
    # a wrapped title: the line before ends with the hours ("… 2 2 Εαρινό"), the line after has no digits
    pre = lines[i - 1] if i - 1 not in used and not CODE.match(lines[i - 1]) and NUMS.search(lines[i - 1]) else ""
    nxt = lines[i + 1] if i + 1 < len(lines) else ""
    post = nxt if nxt and not re.search(r"\d", nxt) and not CODE.match(nxt) and not re.match(r"^(\*|Κωδικός|Μαθήματα|Τομέας|Ειδίκευση|Θ:|Ε:|ΠΜ:|ΕΦ:|=== |Σελίδα|ΕΞΑΜΗΝΟ)", nxt) else ""
    if pre and not re.fullmatch(r"[\d\s,\-]*", name) and not re.search(r"\d", rest[:3]) and False: pre = ""
    if pre: semtok = semtok or (NUMS.search(pre)[1] if NUMS.search(pre) else None)
    name = norm(" ".join([NUMS.sub("", pre) if pre else "", "" if re.fullmatch(r"[\d\s,\-]*", name) else name, post]))
    used.update({i - 1} if pre else set()); used.update({i + 1} if post else set())
    k, g = kindgroup(code)
    sem = SEMS.get(semtok) if semtok in SEMS else (7 if k == "track_core" else None)
    rows.append({"code": code, "name": re.sub(r"\*+$|\s*Π\.Δ\.Ε\.$", "", name).strip(), "semester": sem, "kind": k, "group": g})
rows = [r for r in rows if r["name"]]
save("uoa", "uoa-phed", SRC, rows, note="Ειδικεύσεις (7ο–8ο): track_core με group «Ειδίκευση …»· κατ' επιλογήν χωρίς σταθερό εξάμηνο (χειμερινό / εαρινό / ετήσιο).")
