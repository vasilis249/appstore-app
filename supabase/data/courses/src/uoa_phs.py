# Ιστορία και Φιλοσοφία της Επιστήμης ΕΚΠΑ: the course lists on the site (Υ = compulsory, ΥΕΙ / ΥΕΦ = compulsory
# electives of History / Philosophy of Science, Ε = electives, Ερ = workshops) + semesters from the 2026-27 programme
# (courses not taught in 2026-27 keep semester null).
import re, subprocess
from lib import save, norm
SRC = "https://www.phs.uoa.gr/spoydes/proptychiakes/mathimata"
PROG = "https://www.phs.uoa.gr/fileadmin/depts/phs.uoa.gr/www/uploads/pdf/IFE_PROGRAMMA_MATHIMATON_AKAD._ETOYS_2026-2027.pdf"
SEMS = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
CODE = r"86(?:Υ|ΥΕΙ|ΥΕΦ|Ε|Ερ|ΠΑ)\d\d"
def kind(code):
    if re.match(r"86Υ\d", code): return "core", None
    if code.startswith("86ΥΕΙ"): return "elective", "Κατ' επιλογή υποχρεωτικά: Ιστορία της Επιστήμης"
    if code.startswith("86ΥΕΦ"): return "elective", "Κατ' επιλογή υποχρεωτικά: Φιλοσοφία της Επιστήμης"
    if code.startswith("86Ερ"): return "elective", "Εργαστήρια"
    if code.startswith("86ΠΑ"): return "elective", "Πρακτική άσκηση"
    return "elective", "Μαθήματα επιλογής"
names, sem = {}, {}
for page in ("ypochreotika_mathimata", "kat_epilogi_ypochreotika_mathimata", "mathimata_epilogis", "ergastiria"):
    for l in subprocess.run(["python3", "text.py", f"raw/phs-{page}.html"], capture_output=True, text=True).stdout.split("\n"):
        for code, name in re.findall(rf"({CODE}) \|? ?([^|]+?)(?: \||$)", norm(l)): names.setdefault(code, name.strip())
cur, pending = None, None
for l in map(norm, open("raw/phs.txt")):
    if m := re.match(r"^(ΣΤ|[Α-Η])΄ ΕΞΑΜΗΝΟ$", l): cur = SEMS[m[1]]; continue
    if not cur: continue
    if m := re.match(rf"^(.+?) ({CODE}) ", l + " "): sem.setdefault(m[2], cur); names.setdefault(m[2], m[1]); pending = None
    elif m := re.match(rf"^({CODE})\b", l): sem.setdefault(m[1], cur); names.setdefault(m[1], pending); pending = None
    elif not l.startswith(("ΜΑΘΗΜΑ", "===")): pending = re.sub(r" [Α-Ω][α-ωά-ώ]+(/[Α-Ω][α-ωά-ώ]+)*$", "", l)
names["86ΠΑ01"] = "Πρακτική Άσκηση"
names["86Ερ01"] = "Εργαστήριο Ψηφιακών Σπουδών στις Ανθρωπιστικές Επιστήμες"
rows = [{"code": c, "name": n, "semester": sem.get(c), "kind": kind(c)[0], "group": kind(c)[1]} for c, n in names.items()]
save("uoa", "uoa-phs", SRC, rows, note="Semesters from the 2026-27 programme; courses not offered that year have semester null.")
