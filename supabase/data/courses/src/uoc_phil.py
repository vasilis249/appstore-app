# Κρήτη Φιλολογίας: Οδηγός Προπτυχιακών Σπουδών 2025-26 (raw/uoc/phil-guide.pdf) Μέρος Β (pp. 35-64), per sector
# "N. ΤΟΜΕΑΣ …": N.1 κορμός (α ΥΚΟ = core, β ΕΚΟ = electives of the sector), N.2 κατεύθυνση (α ΥΚΑ = core of the track,
# β ΕΚΑ / δ seminars = electives of the track; γ = other departments' courses, left out), N.3 indicative plan (skipped).
# Course lines "ΑΕΦΦ 030 (*) Title 5 ECTS" followed by a description; a title may wrap before "N ECTS".
import re
from lib import save, norm
from pdftext import pages
SRC = "https://www.philology.uoc.gr/spoudes/undergraduate-studies/odhgos-spoudon"
TRACK = {"1": "Κλασικές Σπουδές", "2": "Βυζαντινή και Νεοελληνική Φιλολογία", "3": "Γλωσσολογία",
         "4": "Θεατρικές, Κινηματογραφικές και Μουσικές Σπουδές"}
CODE = re.compile(r"((?:ΑΕΦΦ|ΛΑΦΦ|ΒΥΦΦ|ΝΕΦΦ|ΓΛΩΦ|ΚΠΑΦ|ΘΝΕΦ|ΚΕΛΦ|ΘΠΑΦ|ΜΠΑΦ|ΜΝΕΦ|ΘΕΑΦ) ?\d{3})(?: ?\(\*+\))? (?![-–\d])(.+)")  # not "ΝΕΦΦ 113-139" ranges
out = [{"code": m[1], "name": m[2], "semester": None, "kind": "core"}  # §6.1 «Μαθήματα κορμού» list (p. 12)
       for l in pages("raw/uoc/phil-guide.pdf", 12, 12)[0].splitlines() if (m := re.fullmatch(r"\d\. ([Α-Ω]{4} \d{3}) (.+?)(?: \(Άσκηση\))?", norm(l)))]
sector, part, kind, pend = None, None, None, None
for l in (norm(l) for t in pages("raw/uoc/phil-guide.pdf", 35, 64) for l in t.splitlines()):
    if m := re.match(r"(\d)\. ΤΟΜΕΑΣ", l): sector = m[1]; continue
    if m := re.match(r"\d\.(\d)\. ", l): part = m[1]; kind = None; continue
    if (m := re.match(r"([α-δ])\) ", l)) and re.search(r"[Μμ]αθήματα|Σεμινάρια", l):  # not "γ) Να γνωρίζουν …" in a description
        kind = {("1", "α"): "core", ("2", "α"): "track_core"}.get((part, m[1]), None if m[1] == "γ" else "elective"); continue
    if part not in ("1", "2") or not kind: continue
    if pend and not CODE.fullmatch(l):  # a title without "N ECTS" may continue on the next line
        if m := re.fullmatch(r"([^(].*?) \d+ ECTS", l): pend["name"] += " " + m[1]
        elif re.match(r"[a-zα-ωά-ώ]", l) or pend["name"].endswith("-"): pend["name"] = re.sub(r"(?<=\d)- ", "-", norm(pend["name"] + " " + l))
        pend = None; continue
    pend = None
    if m := CODE.fullmatch(l):
        row = {"code": re.sub(r"(?<=[Α-Ω])(?=\d)", " ", m[1]), "semester": None, "kind": kind,
               "group": None if kind == "core" else TRACK[sector] if part == "2" else f"Κορμός · {TRACK[sector]}"}
        t = re.fullmatch(r"(.+?) \d+ ECTS", m[2])
        out.append({**row, "name": t[1] if t else m[2]})
        if not t: pend = out[-1]
save("uoc", "uoc-phil", SRC, out)
