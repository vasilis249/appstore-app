# Πάτρα Επιστημών Εκπαίδευσης και Κοινωνικής Εργασίας: «Μαθήματα (νέο ΠΠΣ)» page (raw/upp-edu-new.html, text.py → .txt):
# "▤ Χ' Εξάμηνο … ⌄ <Α' ΕΤΟΣ (κοινό) | Κατεύθυνση …> — …" headings, rows "ESW_code | Title | … | Υποχρεωτικο|Κατ' επιλογήν | …".
# Compulsory courses of a direction = track_core of it; electives keep the direction as a group.
import re
from lib import save, norm
SRC = "https://www.edu-sw.upatras.gr/courses-new/"
G = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
rows, sem, track = [], None, None
for l in map(norm, open("raw/upp-edu-new.txt")):
    if m := re.match(r"▤ (ΣΤ|[Α-Η])' Εξάμηνο .*?⌄ (.+?) —", l):
        sem = G[m[1]]; track = None if "ΚΟΙΝΟ" in m[2] else m[2].replace("Κατεύθυνση ", "")
    elif (c := l.split(" | ")) and re.fullmatch(r"ESW_\w+", c[0]) and len(c) > 6:
        core = c[6].startswith("Υποχρ")
        rows.append({"code": c[0], "name": c[1], "semester": sem, "group": track,
                     "kind": ("track_core" if track else "core") if core else "elective"})
save("upatras", "upatras-edu", SRC, rows)
