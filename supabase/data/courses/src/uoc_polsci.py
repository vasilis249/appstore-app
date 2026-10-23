# Κρήτη Πολιτικής Επιστήμης: «Προσφερόμενα μαθήματα 2026-2027» (raw/uoc/polsci-list.pdf), tables per heading
# (Υποχρεωτικά / Ξένης Γλώσσας = core with their semester; ΥΕΠ lectures and ΥΕΣ seminars = electives, offered
# from the 5th semester on, so no fixed semester). Rows "Εξάμηνο | Κωδικός | Τίτλος | Διδάσκων".
import re
from lib import save
from up_tables import rows
SRC = "https://political.soc.uoc.gr/spoudes-2/ptychio-stin-politiki-epistimi-2/ptychio-stin-politiki-epistimi/prosferomena-mathimata/"
out, kind, group = [], None, None
for _, c in rows("raw/uoc/polsci-list.pdf"):
    if not c: continue
    if c[0] and not any(c[1:]):
        kind = "elective" if "Επιλεγόμεν" in c[0] else "core"
        group = "Σεμινάρια" if "Σεμινάρια" in c[0] else "Παραδόσεις" if kind == "elective" else None
        continue
    if re.fullmatch(r"\d", c[0]) and re.fullmatch(r"[Α-Ω]{3}Π\d{3}", c[1]):
        out.append({"code": c[1], "name": c[2], "semester": int(c[0]) if kind == "core" else None, "kind": kind, "group": group})
save("uoc", "uoc-polsci", SRC, out)
