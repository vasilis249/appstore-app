# Ισπανικής Γλώσσας και Φιλολογίας ΕΚΠΑ: Οδηγός Σπουδών ΠΠΣ 2026-27, «Πίνακας μαθημάτων ΠΠΣ» (I κορμού, II υποχρεωτικά,
# III υποχρεωτικά επιλογής in 3 categories *1 *2 *3, IV ελεύθερης επιλογής) + semesters from the «Ενδεικτικό πρόγραμμα»
# 2026-27 (courses not taught that year: semester null).
import re
from lib import save, norm
SRC = "https://www.spanll.uoa.gr/fileadmin/depts/spanll.uoa.gr/www/uploads/Programma_Spoydon/PROGRAMMA_SPOYDON_2026-2027/ODIGOS_SPOYDON_PPS_2026-2027.pdf"
CAT = {"1": "Ισπανική Λογοτεχνία και Πολιτισμός", "2": "Ισπανοαμερικανική Λογοτεχνία και Πολιτισμός", "3": "Ισπανική Γλώσσα, Μετάφραση και Γλωσσολογία"}
SEMS = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
CODE = re.compile(r"72(?:ΙΣΠ|ΚΟΙ)\d{3}")
L = [norm(l) for l in open("raw/spa.txt")]
a = next(i for i, l in enumerate(L) if l == "ΠΙΝΑΚΑΣ ΜΑΘΗΜΑΤΩΝ ΠΠΣ"); b = next(i for i, l in enumerate(L) if l == "ΕΝΔΕΙΚΤΙΚΟ ΠΡΟΓΡΑΜΜΑ ΣΠΟΥΔΩΝ")
items, sect, pending, cur, foot = [], None, [], None, False
for l in L[a:b]:
    if l.startswith("=== page"): foot = False; continue
    if foot or re.match(r"^\d+ [Α-Ω]", l): foot = True; continue  # footnotes
    if m := re.match(r"^(Ι|ΙΙ|ΙΙΙ|ΙV)\. ", l): sect, pending, cur = m[1], [], None; continue
    if re.match(r"^(Μαθήματα|Επιλέγονται|ECTS|Τα μαθήματα|Μαθήματα που|\d\. )", l) or not sect: pending, cur = [], None; continue
    m = CODE.search(l)
    if m:
        text = (l[:m.start()] + " " + l[m.end():]).strip()
        cur = {"code": m[0], "text": " ".join(pending + [text]), "sect": sect}; items.append(cur); pending = []
    elif cur and sect in ("ΙΙΙ",) and ("*" not in cur["text"] or l.startswith("(") or l.startswith("*")): cur["text"] += " " + l
    else: pending.append(l); cur = None
sem, n = {}, None
for l in L[b:]:
    if l.startswith("ΠΡΑΚΤΙΚΗ ΑΣΚΗΣΗ ΜΕΣΩ"): break
    if m := re.match(r"^(ΣΤ|[Α-Η])΄ ΕΞΑΜΗΝΟ$", l): n = SEMS[m[1]]; continue
    for c in CODE.findall(l): sem.setdefault(c, n)
rows = []
for it in items:
    t = it["text"]
    cats = sorted(set("".join(re.findall(r"\*\s*([123 ]+)", t)).replace(" ", "")))
    name = re.sub(r"\s*\*\s*[123 ]+|\s*\d ECTS.*?(\(3ωρο\))?(?=\s|$)|\(Παιδαγωγικής και Διδακτικής Επάρκειας\)", "", t)
    name = re.sub(r"\s+", " ", re.sub(r"\(3ωρο\)|^Φιλολογίας ", "", name)).strip(" :")
    kind = "core" if it["sect"] in ("Ι", "ΙΙ") else "elective"
    groups = [f"Υποχρεωτικά επιλογής: {CAT[c]}" for c in cats] if it["sect"] == "ΙΙΙ" else (["Ελεύθερης επιλογής"] if it["sect"] == "ΙV" else [None])
    for g in groups: rows.append({"code": it["code"], "name": name, "semester": sem.get(it["code"]), "kind": kind, "group": g})
save("uoa", "uoa-spanish", SRC, rows, note="2026-27 programme; semester null = not in the 2026-27 indicative programme. Free electives from other departments are not listed.")
