import sys; sys.path.insert(0, "."); from lib import *
L = lines_of("raw/civil-c.html")
t = lambda m: "Κατεύθυνση " + m.group(1).capitalize()
rows = parse_headings(L, r"^Εξάμηνο: 1\b", r"^Πρακτική Άσκηση$", r"^Εξάμηνο: (\d+)", [
    (r"^ΚΑΤ' ΈΚΛΟΓΗΝ ΥΠΟΧΡΕΩΤΙΚΑ", "elective", "Κατ' επιλογήν υποχρεωτικά (ένα από την ομάδα)"),
    (r"^ΕΡΓΑΣΤΗΡΙΑΚΑ", "core", None),
    (r"^ΞΕΝΕΣ ΓΛΩΣΣΕΣ", "elective", "Ξένη γλώσσα"),
    (r"^ΥΠΟΧΡΕΩΤΙΚΑ ΚΑΤΕΥΘΥΝΣΗΣ (\S+)", "track_core", t),
    (r"^ΥΠΟΧΡΕΩΤΙΚΑ$", "core", None),
    (r"^Ομάδα (\d+) - (\S+)", "elective", lambda m: f"Κατεύθυνση {m.group(2)} · Ομάδα {m.group(1)}"),
])
rows.append({"name": "Πρακτική Άσκηση", "semester": None, "kind": "elective"})
rows.append({"name": "Διπλωματική Εργασία", "semester": 10, "kind": "core"})
save("ntua", "ntua-civil", "https://www.civil.ntua.gr/courses/", rows)
