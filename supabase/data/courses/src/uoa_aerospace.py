# Αεροδιαστημική ΕΚΠΑ: Οδηγός Σπουδών 2025-26 pp. 24-26 («Κωδικός Τίτλος ECTS» per semester; the guide labels the
# 5th and 6th semesters "4ο" and "5ο" by mistake → semesters counted in order). Wrapped titles: "start" / "CODE ECTS" / "end".
import re
from lib import save, norm
SRC = "https://www.aerospace.uoa.gr/bcmAdmin/uploads/_-2025-2026_001.pdf"
L = [norm(l) for l in open("raw/aero-guide.txt")]
L = L[next(i for i, l in enumerate(L) if l == "Α’ Έτος"):next(i for i, l in enumerate(L) if l == "ΣΥΝΟΠΤΙΚΗ ΠΑΡΟΥΣΙΑΣΗ ΜΑΘΗΜΑΤΩΝ")]
CHOICE = {2: ("201", "Υποχρεωτικής επιλογής: 5 από 6"), 7: ("701", "Επιλογής: 4 μαθήματα"), 8: ("801", "Επιλογής: 3 μαθήματα")}
rows, sem, pre, wrap, in_table = [], 0, None, False, False
for l in L:
    if re.match(r"^\d+ο εξάμηνο σπουδών$", l): sem += 1; in_table = False; continue
    if l.startswith("Κωδικός Τίτλος"): in_table, pre, wrap = True, None, False; continue
    if not in_table or re.match(r"^(=== page|\d+$|[Α-Δ]’ Έτος)", l): continue
    if m := re.match(r"^(\d{3}) (.+) (\d+)$", l): rows.append({"code": m[1], "name": m[2], "semester": sem}); pre, wrap = None, False
    elif m := re.match(r"^(\d{3}) (\d+)$", l): rows.append({"code": m[1], "name": pre, "semester": sem}); pre, wrap = None, True
    elif wrap: rows[-1]["name"] += " " + l; wrap = False
    else: pre = l if pre is None else pre + " " + l
for r in rows:
    keep, group = CHOICE.get(r["semester"], (None, None))
    r["kind"], r["group"] = ("elective", group) if keep and r["code"] != keep else ("core", None)
    if r["code"] == "711": r["group"] = "Αντί δύο μαθημάτων επιλογής (7ο ή 8ο)"
save("uoa", "uoa-aerospace", SRC, rows, note="4th year: two directions (space upstream / downstream) served by the same elective lists.")
