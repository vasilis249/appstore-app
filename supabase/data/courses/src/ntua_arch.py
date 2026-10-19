# ΣΑΜ: one page per semester (arch.ntua.gr/index.php/eksamino/<n>o-examino/), course titles under kind headings.
import re
from lib import save, norm, lines_of
SRC = "https://www.arch.ntua.gr/index.php/eksamino/1o-examino/"
rows, heads = [], set()
for n in range(1, 11):
    L = [norm(l) for l in lines_of(f"raw/arch-s{n}.html")]
    start = max(i for i, l in enumerate(L) if re.match(rf"^{n}[οo] Εξάμηνο$", l)) + 1
    kind = group = None
    for l in L[start:]:
        if l.startswith("© 20"): break
        if not l: continue
        if re.match(r"^Υποχρεωτικά Μαθήματα", l): kind, group = "core", None
        elif re.match(r"^Υποχρεωτικά κατ' [Εε]πιλογή", l): kind, group = "elective", "Ξένη γλώσσα" if "Γλώσ" in l else "Κατ' επιλογήν υποχρεωτικά"
        elif l.startswith("Προαιρετικά"): kind, group = "elective", "Προαιρετικά σεμινάρια"
        elif re.match(r"^(Μαθήματα Επιλογής|Επιλογής)", l): kind, group = "elective", "Επιλογής"
        elif kind is None: heads.add(l)
        else: rows.append({"name": l.replace("Σεμινάριo", "Σεμινάριο"), "semester": n, "kind": kind, "group": group})
        if kind and l.startswith(("Υποχρεωτικά", "Προαιρετικά", "Μαθήματα Επιλογής")): heads.add(l)
print(sorted(heads)[:40])
save("ntua", "ntua-arch", SRC, rows, note="«Ε. Θ.» = Ειδικά Θέματα· σεμινάρια (Χ/Ε = χειμερινό/εαρινό) προαιρετικά.")
