# ΣΝΜΜ: Οδηγός Σπουδών Σεπτ. 2026 (PDF): 6.5 tables give semester/kind/code, 6.6 descriptions give the titles.
import re
from lib import save, norm
SRC = "http://www.naval.ntua.gr/wp-content/uploads/2026/10/SNMM_Odigos_Spoudon_Septemvrios_2026.pdf"
L = [norm(l) for l in open("raw/naval.txt")]
last = lambda p: max(i for i, l in enumerate(L) if l.startswith(p))
a, b, d = last("6.5.1 Μαθήματα 1ου"), last("6.5.10 Ξένες Γλώσσες"), last("6.6.1 Περιγραφή")
titles = {}
for i in range(d, len(L)):
    if (m := re.match(r"^(\d{4}) (\D.*)$", L[i])) and m[1] not in titles:
        j = next((k for k in range(i + 1, i + 4) if L[k].startswith("Διδάσκ")), None)
        if j: titles[m[1]] = norm(" ".join([m[2], *L[i + 1:j]]))
titles.update({"8016": "Αγγλικά", "8082": "Αγγλικά", "8028": "Αγγλικά", "8302": "Εισαγωγή στην Τεχνητή Νοημοσύνη (διασχολικό)", "8216": titles.get("8216", "Επαγγελματική Ηθική Μηχανικών")})
rows, sem, kind, group, misses = [], None, None, None, []
for l in L[a:b]:
    if m := re.match(r"^6\.5\.\d+ Μαθήματα (\d)ου", l): sem, kind, group = int(m[1]), "core", None; continue
    if l == "Υποχρεωτικά Μαθήματα": kind, group = "core", None; continue
    if m := re.match(r"^Κατ’ Επιλογή Υποχρεωτικά Μαθήματα \((Ομάδα .)\)", l): kind, group = "elective", m[1]; continue
    if m := re.match(r"^ΘΕ-([IΙ]+): (.+)", l): kind, group = "elective", f"Θεματική ενότητα {m[1].replace('Ι', 'I')}: {m[2].rstrip('.')}"; continue
    if m := re.match(r"^(Ομάδα .)$", l): kind, group = "elective", m[1]; continue
    if m := re.match(r"^(\d{4}) ", l):
        code = m[1]; name = titles.get(code)
        if not name: misses.append((sem, l)); continue
        lang = code in ("8016", "8082", "8028")
        rows.append({"code": code, "name": "Αγγλικά" if lang else re.sub(r"\s*\(δεν θα διδαχθεί.*", "", name), "semester": sem,
                     "kind": "core" if lang else kind, "group": "Ξένη γλώσσα (απαλλαγή με πτυχίο)" if lang else group})
print("codes without a title:", misses)
rows.append({"name": "Διπλωματική Εργασία", "semester": 10, "kind": "core"})
save("ntua", "ntua-naval", SRC, rows, note="Κατ' επιλογήν υποχρεωτικά: Ομάδες Α (ΣΕΜΦΕ), Β (Μηχανολόγοι), Γ (Σχολή) και θεματικές ενότητες 8ου–9ου = elective με group.")
