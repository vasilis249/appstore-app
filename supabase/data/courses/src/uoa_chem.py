# Χημείας ΕΚΠΑ: Οδηγός Σπουδών 2025-26, 5.1 «Νέο Πρόγραμμα» (pages 45–48, two columns: left = odd, right = even semesters).
import re
from lib import save, norm
SRC = "https://www.chem.uoa.gr/fileadmin/depts/chem.uoa.gr/www/uploads/Files/Books/department/odhgos_2025_26.pdf"
pages = re.split(r"^=== page \d+ ([LR])$", open("raw/chem-cols.txt").read(), flags=re.M)[1:]
streams = {"L": [], "R": []}
for side, text in zip(pages[::2], pages[1::2]): streams[side] += [norm(l) for l in text.split("\n")]
HOURS = re.compile(r"\s*\b\d+-\d+\b.*$|\s+\d+(,\d)?(\(β\))?$")
rows = []
for side, L in streams.items():
    on, sem, kind, cur, seen = False, None, None, None, set()
    for l in L:
        if not on:
            on = l.startswith("Νέο Πρόγραμμα") or (side == "R" and l == "2ο ΕΞΑΜΗΝΟ")
            if l != "2ο ΕΞΑΜΗΝΟ": continue
        if l.startswith(("(α)", "5.2")): break
        if m := re.match(r"^(\d)ο ΕΞΑΜΗΝΟ$", l): sem, cur = int(m[1]), None; continue
        if re.match(r"^(Υποχρεωτικ|Επιλεγόμεν|Μόνο επιλεγόμενα)", l): kind, cur = ("elective" if "πιλεγ" in l else "core"), None; continue
        if not sem or not l or re.fullmatch(r"[\d\s,\-()β]+", l): continue
        if m := re.match(r"^(\d{3,5}[ΘΠ]?|ΠΡΚ\d+) (.+)$", l):
            if m[1] in seen: cur = None; continue
            seen.add(m[1]); cur = {"code": m[1], "name": HOURS.sub("", m[2]), "semester": sem, "kind": "elective" if m[1].startswith("ΠΡΚ") else kind}
            rows.append(cur); continue
        if l.startswith("Πτυχιακή εργασία"):
            rows.append({"name": "Πτυχιακή εργασία", "semester": sem, "kind": "elective"}); cur = None; continue
        if cur and not re.match(r"^[A-Za-z]", l):
            cur["name"] = (cur["name"][:-1] if cur["name"].endswith("-") else cur["name"] + " ") + HOURS.sub("", l)
rows = [r for r in rows if re.search(r"[α-ωΑ-Ω]", r["name"])]
for r in rows: r["name"] = norm(re.sub(r"\((α|γ)\)", "", r["name"]).replace("Eφαρμογές", "Εφαρμογές"))
save("uoa", "uoa-chem", SRC, rows, note="Θ = θεωρία, Π = πρακτικά (εργαστήριο) καταγράφονται ως ξεχωριστά μαθήματα, όπως στο πρόγραμμα.")
