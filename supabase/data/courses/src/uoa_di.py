# Πληροφορικής & Τηλεπικοινωνιών ΕΚΠΑ: /studies/undergraduate/courses (list per semester: title, code, ECTS, S1–S6 marks, type).
import re
from lib import save, norm, lines_of
SRC = "https://www.di.uoa.gr/studies/undergraduate/courses"
TYPES = {"Υποχρεωτικό (ΥΜ)": ("core", None), "Κατ’ Επιλογή Υποχρεωτικό (ΕΥΜ)": ("elective", "Κατ' επιλογήν υποχρεωτικό"),
         "Γενικής Παιδείας (ΓΠ)": ("elective", "Γενικής παιδείας"), "Αυτοτελές Προαιρετικό Εργαστήριο (ΕΡ)": ("elective", "Αυτοτελές προαιρετικό εργαστήριο"),
         "Προαιρετικό (ΠΜ)": ("elective", "Προαιρετικό"), "Ελεύθερο (ΕΛ)": ("elective", "Ελεύθερο"), "Project": ("elective", "Project"),
         "Πτυχιακή Εργασία (ΠΕ)": ("elective", "Πτυχιακή εργασία"), "Πρακτική Άσκηση (ΠΑ)": ("elective", "Πρακτική άσκηση")}
L = [norm(l) for l in lines_of("raw/di-c.html")]
rows, sem, buf = [], None, []
for l in L[next(i for i, l in enumerate(L) if l == "Εξάμηνο: 1ο"):]:
    if m := re.match(r"^Εξάμηνο: (\d)ο$", l):
        if sem == 8 and m[1] == "1": break  # the grid view repeats the list
        sem, buf = int(m[1]), []; continue
    if l in ("Κωδ.", "ECTS", "B", "Υ") or re.match(r"^S\d$", l) or not l: continue
    if l in TYPES:
        if len(buf) >= 2 and re.fullmatch(r"\d+", buf[-1]):
            k, g = TYPES[l]; rows.append({"name": " ".join(buf[:-2]), "code": buf[-2], "semester": sem, "kind": k, "group": g})
        buf = []; continue
    buf.append(l)
save("uoa", "uoa-di", SRC, rows, note="Κατευθύνσεις S1–S6 (Θεμελιώσεις, Δεδομένα & Γνώση, Λογισμικό, Υλικό, Δίκτυα, Σήμα) δεν καταγράφονται ανά μάθημα.")
