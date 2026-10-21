# Πάντειο, Κοινωνικής Ανθρωπολογίας: «Πρόγραμμα Σπουδών ακαδημαϊκού έτους 2026-27» (web page, one table per
# semester; text cells come as lines: "N." / code / title / teacher / ECTS / hours). Semesters 1–4 required; years 3–4
# are electives offered every winter (5th/7th) or spring (6th/8th) → no fixed semester, grouped by term.
import re
from lib import save, norm
SRC = "https://anthropology.panteion.gr/index.php/el/2013-11-08-11-53-34/proptyxiakes-spoudes/programma-spoudon"
TERM = {"ΧΕΙΜΕΡΙΝΟ": "Χειμερινό", "ΕΑΡΙΝΟ": "Εαρινό"}
SEM = {"A": 1, "Α": 1, "B": 2, "Β": 2, "Γ": 3, "Δ": 4}
L = [norm(l) for l in open("raw/pant-anthro.txt")]
rows, sem, kind, group = [], None, None, None
for i, l in enumerate(L):
    if m := re.match(r"^([ABΑΒΓΔ]) ΕΞΑΜΗΝΟ", l): sem, kind, group = SEM[m[1]], "core", None; continue
    if m := re.match(r"^(Ε & Ζ|ΣΤ & Η) ΕΞΑΜΗΝΟ \((\w+)\)", l):
        sem, kind, group = None, "elective", f"{TERM[m[2]]} εξάμηνο ({m[1].replace(' & ', '΄/')}΄)"; continue
    if l.startswith("------"): break
    if kind and re.fullmatch(r"\d{6}", l) and re.fullmatch(r"\d+\.", L[i - 1]):
        rows.append({"code": l, "name": re.sub(r"\s*\(ERASMUS\+\)|\*+$", "", L[i + 1]).strip(), "semester": sem, "kind": kind, "group": group})
save("panteion", "panteion-anthro", SRC, rows, note="Years 3–4: electives offered every winter (5th/7th) or spring (6th/8th) semester.")
