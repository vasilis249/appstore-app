# Ιστορίας και Αρχαιολογίας ΕΚΠΑ: Οδηγός Σπουδών 2026-27 pp. 26-30 (course lists: βάσης, κορμού, κατευθύνσεις) +
# semesters of compulsory courses from the «Ενδεικτικό πρόγραμμα» for students admitted 2026-27. Directed electives
# and seminars have no fixed semester; their titles repeat (topics change) → the code is kept in the name.
import re
from lib import save, norm
SRC = "https://www.arch.uoa.gr/fileadmin/depts/arch.uoa.gr/www/uploads/Tmima/odhgos_spoudwn_2026_2027.pdf"
L = [norm(l) for l in open("raw/arch.txt")]
a = next(i for i, l in enumerate(L) if l.startswith("Ι. ΥΠΟΧΡΕΩΤΙΚΑ ΚΑΙ ΓΙΑ ΤΙΣ ΔΥΟ"))
b = next(i for i, l in enumerate(L) if l.startswith("ΙΙΙ. ΜΑΘΗΜΑΤΑ ΕΛΕΥΘΕΡΗΣ"))
key = lambda c: re.sub(r"\s", "", c).translate(str.maketrans("IAB", "ΙΑΒ"))
ROW = re.compile(r"^(?:ή )?(ΙΙ|ΙΑ|ΣΙ|ΣΑ|Φ[ΑLΒΝΓ]|ΤΕΚ|61) ?(\d+|ΠρΑσκ) (.+?)(?: \d+)*$")
rows, kind, group, track, cur = [], None, None, None, None
for l in L[a:b]:
    if l.startswith("α) Μαθήματα Βάσης"): kind, group = "core", "Μαθήματα βάσης"; continue
    if l.startswith("β) Μαθήματα Κορμού"): kind, group = "core", "Μαθήματα κορμού"; continue
    if "Koρμού Εσωτερικής Επιλογής" in l or "Κορμού Εσωτερικής Επιλογής" in l: kind, group = "elective", "Κορμού εσωτερικής επιλογής (ένα από)"; continue
    if l == "Κατεύθυνση Ιστορίας": track, cur = "Ιστορίας", None; continue
    if l == "Κατεύθυνση Αρχαιολογίας": cur, track = None, "Αρχαιολογίας και Ιστορίας της Τέχνης"; continue
    if track and l.startswith("Α) Υποχρεωτικά"): kind, group = "track_core", f"Κατεύθυνση {track}"; continue
    if track and "σεμιναριακά" in l and l[1] == ")":
        kind, group = "elective", f"Κατεύθυνση {track}: " + ("μη σεμιναριακά" if "μη σεμιναριακά" in l else "σεμιναριακά"); continue
    if not kind: continue
    if m := ROW.match(l):
        code = (m[1] if m[1] != "61" else "61") + m[2]
        cur = {"code": code, "name": m[3], "kind": kind, "group": group}; rows.append(cur)
        if l.startswith("ή ") and rows[-2:-1]: rows[-2]["kind"] = cur["kind"] = "elective"; rows[-2]["group"] = cur["group"] = "Βάσης: ένα από τα δύο"
    elif cur and re.match(r"^[α-ωά-ώA-Za-zΑ-Ω(]", l) and not re.match(r"^(Σύνολο|Χ =|ή$|Μαθήματα|Τα μαθήματα|\d|ii\.|i\.)", l) and len(l) < 60: cur["name"] += " " + l
    else: cur = None
FIX = {"ΤΕΚ300": "Παιδαγωγική Ψυχολογία (Παιδαγωγικά ΙΙΙ)", "ΙΑ103": "Ανασκαφική και Επεξεργασία Αρχαιολογικού Υλικού – Μουσειολογία"}
for r in rows:
    r["name"] = FIX.get(r["code"]) or re.sub(r"\s*\(διδάσκεται.*$|(?: \d)+$|-? Ασκήσεις.*$", "", r["name"]).strip(" -")
# semesters (students admitted 2026-27)
sem = {}
s = next(i for i, l in enumerate(L) if l.startswith("ΚΟΙΝΟ ΓΙΑ ΤΟΥΣ/ΤΙΣ ΦΟΙΤΗΤΕΣ"))
skip = False
for l in L[s:s + 300]:
    if "ΓΙΑ ΤΑ ΕΤΗ ΕΙΣΑΓΩΓΗΣ ΑΠΟ 2019-20 ΩΣ 2025-26" in l: skip = True
    if "2026-27 Κ.Ε." in l: skip = False
    if l.startswith("Μαθήματα Παιδαγωγικής και Διδακτικής"): break
    if m := re.search(r"ΕΞΑΜΗΝΟ \((\d)ο\)", l): n = int(m[1]); continue
    if skip: continue
    for c in re.findall(r"(?:^|\s)((?:ΙΙ|II|ΙΑ|IA|Φ[ΑLΒΝΓ]|ΤΕΚ)\s?\d+)", l): sem.setdefault(key(c), n)
seen = {}
for r in rows:
    r["semester"] = sem.get(key(r["code"])) if r["kind"] != "elective" or r["group"].startswith("Βάσης") else None
    seen.setdefault(r["name"], []).append(r)
for name, rs in seen.items():
    if len({r["code"] for r in rs}) > 1:
        for r in rs:
            if r["kind"] == "elective": r["name"] = f"{name} ({r['code']})"
save("uoa", "uoa-hist-arch", SRC, rows, note="Directed electives and seminars: no fixed semester; titles repeat across codes (topics change yearly), so the code is part of the name.")
