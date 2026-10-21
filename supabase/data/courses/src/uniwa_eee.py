# ΠΑΔΑ, Ηλεκτρολόγων και Ηλεκτρονικών Μηχανικών: «Πρόγραμμα Σπουδών (5ετές)» — per «Nο Εξάμηνο» a cycle heading
# ("ΒΑΣΙΚΟΣ ΚΥΚΛΟΣ ΣΠΟΥΔΩΝ", 'Α ΚΥΚΛΟΣ ΣΠΟΥΔΩΝ "ΕΝΕΡΓΕΙΑΣ"' …), sections "Υποχρεωτικά Μαθήματα" / "Επιλογής
# υποχρεωτικά μαθήματα (1/5)" / "Προαιρετικά Μαθήματα", rows EEE.N.M (EEE.7-1.1 in the cycles) / title (may wrap) / type / hours… / teachers.
import re
from lib import save, norm, recaser
SRC = "https://eee.uniwa.gr/el/spoudes/pps/ps/programma-spoudon-ilektrologou-kai-ilektronikoy-mixanikoy-5etes"
case = recaser([])
L = [norm(l) for l in open("raw/uniwa-eee.txt") if norm(l)]
rows, sem, cycle, kind = [], None, None, None
for i, l in enumerate(L[:-1]):
    if m := re.fullmatch(r"(\d+) ?[οo] Εξάμηνο", l): sem, kind = int(m[1]), None; continue
    if m := re.fullmatch(r"(ΒΑΣΙΚΟΣ|[ΑΒΓ]) ΚΥΚΛΟΣ ΣΠΟΥΔΩΝ(.*)", l):
        name = (m[2].strip() or (L[i + 1] if L[i + 1].startswith('"') else "")).strip('"')  # Γ's name on the next line
        cycle = None if m[1] == "ΒΑΣΙΚΟΣ" else f"{m[1]}΄ κύκλος: {case(name)}" if name else f"{m[1]}΄ κύκλος"; continue
    if re.match(r"(?i)(υποχρεωτικά|επιλογής|προαιρετικά) μαθήματα|επιλογής υποχρεωτικά", l):
        kind = "core" if l.lower().startswith("υποχρεωτικά") else "elective"; continue
    if sem and kind and re.fullmatch(r"[EΕ]{3}\.\s?\d+\s?(?:-\s?\d+)?\.\d+\w*", l):
        j = i + 1  # the title may wrap: up to the type cell (ΜΓΥ, ΜΕΥ, ΜΕ, ΔΟΝΑ…) or a number
        while j < len(L) and not re.fullmatch(r"[Α-ΩA-Z]{2,4}|\d+", L[j]): j += 1
        if L[i + 1].startswith("Ένα από"): continue  # a slot ("one of the deepening courses of …")
        rows.append({"code": l.replace("ΕΕΕ", "EEE").replace(" ", ""), "name": " ".join(L[i + 1:j]), "semester": sem,
                     "kind": "track_core" if kind == "core" and cycle else kind, "group": cycle})
save("uniwa", "uniwa-eee", SRC, rows)
