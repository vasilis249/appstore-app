# ΑΣΠΑΙΤΕ, Εκπαιδευτικών Πολιτικών Μηχανικών: one page per semester ("ΠΜ101 – Τίτλος", then "Υ/ΕΥ : Υποχρεωτικό μάθημα" /
# "Επιλογής Υποχρεωτικό Μάθημα" / "Προαιρετικό μάθημα").
import re
from lib import save, norm
SRC = "https://civil.aspete.gr/proptychiako/"
PAGES = ["1o-examino-a", "2o-examino-b"] + [f"{n}o-examino" for n in range(3, 11)]
rows = []
for sem, p in enumerate(PAGES, 1):
    L = [norm(l) for l in open(f"raw/aspete-civil-{p}.txt")]
    for i, l in enumerate(L):
        m = re.fullmatch(r"(ΠΜ\d+[ΑΒ]?) – (.+)", l)
        ty = next((x for x in L[i + 1:i + 4] if x.startswith("Υ/ΕΥ")), None)
        if not m or not ty: continue
        kind = "core" if re.search(r":\s*Υποχρεωτικό", ty) else "elective"
        rows.append({"code": m[1], "name": re.sub(r"\s*\(Πρ\)$", "", m[2]), "semester": sem, "kind": kind})
save("aspete", "aspete-civil", SRC, rows)
