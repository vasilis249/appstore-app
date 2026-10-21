# ΠΑΔΑ, Μηχανικών Πληροφορικής και Υπολογιστών: «Μαθήματα (5ετούς ΠΣ)» — per «Nο Εξάμηνο» rows title / kind (Υ =
# required, ΒΡ = basic course of a «Ροή», "(Μάθημα Επιλογής N)" = an elective slot), then «Μαθήματα Επιλογής
# Υποχρεωτικά»: the flows' electives (ΕΥ), first the three flows of the winter semesters then of the spring ones, and
# «Μαθήματα Γενικής Παιδείας».
import re
from lib import save, norm
SRC = "https://ice.uniwa.gr/education/undergraduate/courses/"
L = [norm(l) for l in open("raw/uniwa-ice-all.txt") if norm(l)]
start = next(i for i, l in enumerate(L) if l == "1ο Εξάμηνο")
cat = L.index("Μαθήματα Επιλογής Υποχρεωτικά")
rows, sem, flow, flows_seen = [], None, None, 0
for i in range(start, len(L) - 1):
    l, kind = L[i], L[i + 1]
    if m := re.fullmatch(r"(\d+)ο Εξάμηνο", l): sem, flow = int(m[1]), None; continue
    if l.startswith("Ροή "):
        flow = l
        if i > cat: flows_seen += 1
        continue
    if l == "Μαθήματα Γενικής Παιδείας": flow, flows_seen = "Μαθήματα Γενικής Παιδείας", 99; continue
    if l.startswith("Θ: Θεωρία") and i > L.index("Μαθήματα Γενικής Παιδείας"): break
    if not re.fullmatch(r"Υ|ΒΡ|ΕΥ|ΒΡ, ΕΥ", kind) or l.startswith("(Μάθημα Επιλογής") or l in ("Σύνολο", "Είδος"): continue
    if i < cat:
        rows.append({"name": l, "semester": sem, "kind": "track_core" if kind == "ΒΡ" else "core", "group": flow if kind == "ΒΡ" else None})
    elif "ΕΥ" in kind:
        season = None if flows_seen == 99 else "Χειμερινό εξάμηνο" if flows_seen <= 3 else "Εαρινό εξάμηνο"
        rows += [{"name": l, "semester": None, "kind": "elective", "group": g} for g in (flow, season) if g]
save("uniwa", "uniwa-ice", SRC, rows)
