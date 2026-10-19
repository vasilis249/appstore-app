# Ψηφιακών Τεχνών και Κινηματογράφου ΕΚΠΑ: «Απόφαση τροποποίησης (7ης) προγράμματος σπουδών» 2026-27, §3.9
# «Ενδεικτικό πρόγραμμα». The tables' cells wrap and split, so rows are rebuilt from word positions: a row starts at the
# line with its 5-digit code; its title is every word left of the «Τύπος» column (Υποχρεωτικό/Επιλογής) until the next row.
import re, pdfplumber
from lib import save, norm
SRC = "https://www.dcarts.uoa.gr/fileadmin/depts/dcarts.uoa.gr/www/uploads/dcarts_2026-27/APOFASI_TROPOPOIISIS__7is___PROGRAMMATOS_SPOYDON_TPSTK.pdf"
rows, sem, cur, type_x = [], 0, None, 300
for page in pdfplumber.open("raw/dc.pdf").pages[3:9]:
    words = page.extract_words()
    heads = sorted(w["top"] for w in words if w["x0"] < 250 and re.fullmatch(r"(\d[ΟοO΄]?)?ΕΞΑΜΗΝΟ", w["text"]))
    lines = {}
    for w in words:
        if w["x0"] < 250 and any(abs(w["top"] - h) < 2.5 for h in heads): continue  # the heading ("7Ο" "ΕΞΑΜΗΝΟ")
        lines.setdefault(round(w["top"]), []).append(w)
    for y in sorted(lines):
        while heads and heads[0] < y: heads.pop(0); sem += 1; cur = None
        ws = sorted(lines[y], key=lambda w: w["x0"]); txt = " ".join(w["text"] for w in ws)
        if txt.startswith("3.10"): sem = 99
        if not sem or sem > 8 or re.search(r"Τίτλος Μαθήματος|ΠΑΡΑΤΗΡΗ|^\.?ώρες|^διδακτ", txt): continue
        typ = next((w for w in ws if re.match(r"^(Υποχρεωτικό|[ΕEe]πιλογής)$", w["text"])), None)
        if typ: type_x = typ["x0"]
        code = next((w["text"] for w in ws if re.fullmatch(r"46\d{3}", w["text"]) and w["x0"] > type_x), None)
        title = [w["text"] for w in ws if w["x0"] < type_x - 3]
        if code and typ:
            cur = {"code": code, "name": " ".join(title), "semester": sem, "kind": "core" if typ["text"].startswith("Υ") else "elective"}
            cur["group"] = None if cur["kind"] == "core" else "Επιλογής"; rows.append(cur)
        elif cur and title: cur["name"] += " " + " ".join(title)
for r in rows: r["name"] = re.sub(r"^\d+ ", "", norm(r["name"].replace("Κινηματογράχος", "Κινηματογράφος")))
save("uoa", "uoa-dac", SRC, rows, note="2026-27 indicative programme.")
