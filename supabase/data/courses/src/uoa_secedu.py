# Παιδαγωγικό Τμήμα Δευτεροβάθμιας Εκπαίδευσης ΕΚΠΑ (eds.uoa.gr): Οδηγός Σπουδών 2026-27 «Παρουσίαση των μαθημάτων»
# (υποχρεωτικά, υποχρεωτικά κατ' επιλογήν per Πεδίο, υποχρεωτικά from other departments of the School of Philosophy)
# + semesters from «Πρόγραμμα μαθημάτων ανά εξάμηνο» 2026-27 (Πεδία electives: winter/spring only → null).
import re
from lib import save, norm
SRC = "https://www.eds.uoa.gr/fileadmin/depts/eds.uoa.gr/www/uploads/SPOYDES/Odigos_Spoydon_2026-2027.pdf"
L = [norm(l) for l in open("raw/eds.txt")]
a = next(i for i, l in enumerate(L) if l == "Παρουσίαση των μαθημάτων")
b = next(i for i, l in enumerate(L) if l.startswith("4. Προσφερόμενα Μαθήματα ως Ελεύθερης"))
items, kind, group, cur = [], "core", None, None
for l in L[a:b]:
    if l.startswith("=== page") or re.fullmatch(r"\d+", l): continue
    if l.startswith("Υποχρεωτικά μαθήματα"): kind, group = "core", None; cur = None; continue
    if m := re.match(r"^Πεδίο (\d): (.+)$", l): kind, group, cur = "elective", f"Πεδίο {m[1]}: {m[2]}", None; continue
    if l.startswith("3. Υποχρεωτικά Μαθήματα από Τμήματα"): kind, group, cur = "core", "Από άλλα Τμήματα της Φιλοσοφικής Σχολής", None; continue
    if re.match(r"^(\d-[αβ]\.|[αβ]\. |Τμήμα |2\. Υποχρεωτικά|Από τα προσφερόμενα|συγκεκριμένο|Συνολικά|Σχολής|Για το περιεχόμενο|άλλα Τμήματα)", l): cur = None; continue
    if m := re.match(r"^\d+\. (.+)$", l): cur = {"text": m[1], "kind": kind, "group": group}; items.append(cur)
    elif cur: cur["text"] += " " + l
rows = []
for it in items:
    m = re.search(r"\(\(?((?:74)?\s?[A-ZΑ-Ω]{1,4}\s?\d{2,3}[A-ZΑ-Ω]{0,2})\)", it["text"])
    if not m: continue
    name = norm(it["text"][:m.start()])
    rows.append({"code": re.sub(r"[\s-]", "", m[1]).replace("TEK", "ΤΕΚ"), "name": name, "kind": it["kind"], "group": it["group"]})
sem, n = {}, None
for l in L[next(i for i, l in enumerate(L) if l.startswith("Πρόγραμμα μαθημάτων ανά εξάμηνο φοίτησης") and i > 100):]:
    if m := re.match(r"^ΠΡΟΓΡΑΜΜΑ (\d)ου ΕΞΑΜΗΝΟΥ", l): n = int(m[1]); continue
    if n:
        for c in re.findall(r"74[-\s]?[A-ZΑ-Ω]{1,4}[\dA-ZΑ-Ω]+|741110ΑΤ", l):
            c = "74ΙΙ10ΑΤ" if c == "741110ΑΤ" else re.sub(r"[\s-]", "", c).replace("TEK", "ΤΕΚ")
            sem.setdefault(c, n)
for r in rows:
    r["semester"] = sem.get(r["code"]) or sem.get("74" + r["code"]) if r["kind"] == "core" else None
    if r["code"].startswith("ΤΕΚ"): r["code"] = "74" + r["code"]
save("uoa", "uoa-secedu", SRC, rows, note="Πεδία electives are offered in winter or spring semesters (semester null); the one free elective from other departments is not listed.")
