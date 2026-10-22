# Πάτρα Ιατρικής: one page per course (raw/up-med/<id>.html, ids from the «Προπτυχιακά Μαθήματα» list): the title is the
# line after the breadcrumb, then "Εξάμηνο <Α–ΙΒ>[ & <next>] (Υποχρεωτικό | Επιλογής)" (a two-semester rotation gets
# the first one). 12 semesters.
import glob, html, re
from lib import save, norm
from up_tables import case
SRC = "https://www.med.upatras.gr/index.php?r=undergraduate/index&lang=el"
SEM = ["Α", "Β", "Γ", "Δ", "Ε", "ΣΤ", "Ζ", "Η", "Θ", "Ι", "ΙΑ", "ΙΒ"]
rows = []
for f in sorted(glob.glob("raw/up-med/*.html")):
    flat = norm(html.unescape(re.sub(r"<[^>]+>", " ", open(f, encoding="utf-8", errors="ignore").read())))
    if not (m := re.search(r"Αρχική Προπτυχιακά Μαθήματα (.+?) Εξάμηνο (\S+)(?: & \S+)? \((.+?)\)", flat)): continue
    title, m = m[1], [None, m[2], m[3]]
    rows.append({"code": None, "name": case(title) if title.isupper() else title,
                 "semester": SEM.index(m[1]) + 1 if m[1] in SEM else None,
                 "kind": "elective" if re.match(r"(?i)επιλ|κατ", m[2]) else "core"})
save("upatras", "upatras-med", SRC, rows)
