# ΑΣΚΤ, Θεωρίας και Ιστορίας της Τέχνης: «Πρόγραμμα Σπουδών 2026-2027» (PDF). Years 1–2: 24 required courses under
# «Χ΄ εξάμηνο» ("Α1 Τίτλος (Συνδιδασκαλία…)"); years 3–4: lectures (Δ-…) and seminars (Σ-…) chosen freely, offered in
# winter or spring → electives without a fixed semester. A title may wrap onto the next line.
import re
from lib import save, norm
SRC = "https://www.asfa.gr/wp-content/uploads/2026/09/ΠΡΟΓΡΑΜΜΑ-ΣΠΟΥΔΩΝ-2026-2027-08.09.2026.pdf"
SEM = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4}
L = [norm(l) for l in open("raw/asfa-theory.txt")]
start = next(i for i, l in enumerate(L) if l.startswith("Α΄ και Β΄ έτος"))
TEACHER = re.compile(r"υπότροφ|καθηγ|διδάσκ|μέλος|λέκτορ|επίκουρ|αναπληρ|εντεταλμ|ε\.?δι\.?π|ομότιμ", re.I)
rows, sem = [], None
for i in range(start, len(L)):
    l = L[i]
    if l.startswith("ΣΕΜΙΝΑΡΙΑ") and i > len(L) - 100: break
    if m := re.fullmatch(r"([ΑΒΓΔ])΄ εξάμηνο", l): sem = SEM[m[1]]; continue
    if l.startswith("Γ΄ και Δ΄ έτος"): sem = None; continue
    m = re.match(r"^([ΑΒΓΔ]\d{1,2})\s+(.+)$", l) if sem else None
    m2 = re.match(r"^([ΔΣ])-([Α-Ω]+(?:-[Α-Ω]+)?)[- ]?(\d{3})\s+(.+)$", l) if not sem else None
    if not (m or m2): continue
    title = m[2] if m else m2[4]
    j = i + 1  # a title runs on until the teacher's line ("Όνομα, Καθηγήτρια" / "Πανεπιστημιακός υπότροφος")
    while j < i + 3 and not TEACHER.search(L[j]) and "," not in re.sub(r"\(.*$", "", L[j]) \
            and not re.match(r"^\(|^ΤΟ ΜΑΘΗΜΑ|^[ΔΣ]-|^[ΑΒΓΔ]\d", L[j]):
        title += " " + L[j]; j += 1
    title = re.sub(r"\s*ΤΟ(?:\s+ΜΑΘΗΜΑ\b.*)?$|\s*\((?:Συνδιδασκαλία|προσφερόμενο)[^)]*\)?.*$", "", title).strip()
    if m: rows.append({"code": m[1], "name": title, "semester": sem, "kind": "core"})
    else:
        code = f"{m2[1]}-{m2[2]} {m2[3]}"
        rows.append({"code": code, "name": title, "semester": None, "kind": "elective",
                     "group": "Διαλέξεις" if m2[1] == "Δ" else "Σεμινάρια"})
save("asfa", "asfa-theory", SRC, rows, note="Years 3–4: 16 lectures and seminars chosen freely (winter or spring).")
