# ΠΑΠΕΙ, Χρηματοοικονομικής και Τραπεζικής Διοικητικής: «Προπτυχιακά Μαθήματα» — after the tabs, per «Nο Εξάμηνο» the
# core courses as code / title / code, then «Επιλογής Χειμερινού» and «Επιλογής Εαρινού» (chosen from the 5th semester).
import re
from lib import save, norm
SRC = "https://bankfin.unipi.gr/graduate-courses"
L = [norm(l) for l in open("raw/unipi-bankfin-c.txt")]
start = next(i for i, l in enumerate(L) if l.startswith("Ο διδάσκων κάθε μαθήματος"))
rows, sem, group = [], None, None
for i in range(start, len(L) - 2):
    l = L[i]
    if l == "Το Τμήμα": break
    if m := re.fullmatch(r"(\d+)ο Εξάμηνο", l): sem, group = int(m[1]), None; continue
    if l.startswith("Επιλογής "): sem, group = None, {"Επιλογής Χειμερινού": "Χειμερινό εξάμηνο", "Επιλογής Εαρινού": "Εαρινό εξάμηνο"}[l]; continue
    if re.fullmatch(r"ΧΡ[Α-Ω0-9 -]+", l) and L[i + 2] == l:
        rows.append({"code": l.replace(" ", ""), "name": L[i + 1], "semester": sem, "group": group,
                     "kind": "elective" if group else "core"})
save("unipi", "unipi-bankfin", SRC, rows)
