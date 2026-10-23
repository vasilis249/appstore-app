# Κρήτη Ψυχολογίας: «Προσφερόμενα μαθήματα» tables (raw/uoc/psych-win.pdf = χειμερινό 2026-27, psych-spr.pdf = εαρινό
# 2024-25, the newest spring list published): code, type, title, semester. Type Υ = core; ΥΕΣ / ΣΕΜ (seminars) and
# ΥΕΕ / ΕΡΓ (labs) = required-choice electives, grouped; Ε = free elective. Other departments' (ΣΚΕ, ΠΚ) courses left out.
import re
from lib import save
from up_tables import rows
SRC = "https://www.psychology.uoc.gr/spoydes/proptychiakes-spoydes/"
GROUP = {"ΥΕΣ": "Σεμινάρια", "ΣΕΜ": "Σεμινάρια", "ΥΕΕ": "Εργαστήρια", "ΕΡΓ": "Εργαστήρια"}
out = []
for f in ("raw/uoc/psych-win.pdf", "raw/uoc/psych-spr.pdf"):
    col = None
    for _, c in rows(f):
        if not c: continue
        if "ΤΙΤΛΟΣ" in c: col = {k: next(i for i, h in enumerate(c) if h.startswith(k)) for k in ("ΚΩΔΙΚΟΣ", "ΤΥΠΟΣ", "ΤΙΤΛΟΣ", "ΕΞΑ")}; continue
        code = re.sub(r"\s", "", c[col["ΚΩΔΙΚΟΣ"]]).replace("ΨΧ", "ΨΧ-").replace("--", "-")
        if not re.fullmatch(r"ΨΧ-\d{4}", code): continue
        t = c[col["ΤΥΠΟΣ"]].replace("Y", "Υ").replace("E", "Ε").split()[0]
        out.append({"code": code, "name": re.sub(r"\s*\(Ε\)$", "", c[col["ΤΙΤΛΟΣ"]]), "semester": int(c[col["ΕΞΑ"]]),
                    "kind": "core" if t == "Υ" else "elective", "group": GROUP.get(t)})
save("uoc", "uoc-psych", SRC, out)
