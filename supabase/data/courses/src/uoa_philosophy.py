# Φιλοσοφίας ΕΚΠΑ: «Τροποποίηση προγράμματος σπουδών» (εισαγωγή 2025-26 και μετά). Course descriptions (§6) give
# code, category and semester; the lists on pp. 2-5 give the ΟΠ / ΟΣ groups of the compulsory electives (ΥΕ).
import re
from lib import save, norm, fold
SRC = "https://www.philosophy.uoa.gr/fileadmin/depts/philosophy.uoa.gr/www/uploads/EGGRAFA_ISTOSELIDAS/TMIMA/TROPOPOIISI_PROGRAMMATOS_PROPTYCHIAKON_SPOYDON_TMIMATOS_FILOSOFIAS.pdf"
SEMS = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
L = [norm(l) for l in open("raw/philo.txt")]
start = next(i for i, l in enumerate(L) if l.startswith("6.1 Περιεχόμενο"))
group_of, group, cur = {}, None, None
for l in L[:start]:
    if m := re.match(r"^(Ο[ΠΣ]) \(Ομάδα (Παραδόσεων|Σεμιναρίων)\) ([IVXΙΧ]+)$", l): group = f"{m[1]} {m[3].translate(str.maketrans('ΙΧ', 'IX'))}"; cur = None; continue
    if l.startswith(("Μαθήματα σε συνεργασία", "ΕΞΑΜΗΝΟ")): group = None
    if not group: continue
    if m := re.match(r"^\d+\.? (.+)$", l): cur = [m[1]]; group_of[id(cur)] = (cur, group)
    elif cur and not l.startswith(("[", "===", "- ")): cur.append(l)
groups = {fold(" ".join(c)): g for c, g in group_of.values()}
rows, sem, code, cat, title = [], None, None, None, None
for l in L[start:]:
    if re.match(r"^(\[\d+\]|=== page)", l): continue
    if m := re.match(r"^(?:(ΣΤ|[Α-Η])[΄’] ΕΞΑΜΗΝΟ|ΕΞΑΜΗΝΟ (ΣΤ|[Α-Η])[΄’])", l): sem = SEMS[m[1] or m[2]]; continue
    if m := re.match(r"^Κωδικός: (\S+) .*Κατηγορία: (\S+)", l): code, cat, title = m[1], m[2], None; continue
    if code and l.startswith("Τίτλος"): title = l[6:].strip(); continue
    if code and title is not None:
        if re.match(r"^(Διδάσκ|Περιγραφή)", l):
            g = groups.get(fold(title)) or next((v for k, v in groups.items() if k.endswith(fold(title))), None)
            kind, grp = {"Υ": ("core", None), "ΠΔΕ": ("core", "Παιδαγωγική και Διδακτική Επάρκεια"),
                         "Ε": ("elective", "Ελεύθερης επιλογής")}.get(cat, ("elective", g and f"Υποχρεωτικά επιλεγόμενα: {g}"))
            if "Ελεύθερ" not in title: rows.append({"code": code, "name": title, "semester": sem, "kind": kind, "group": grp}); code = None
        else: title += " " + l
save("uoa", "uoa-philosophy", SRC, rows, note="Programme for students admitted 2025-26 onwards. ΥΕ = one course from each ΟΠ group, four seminars from the ΟΣ groups.")
