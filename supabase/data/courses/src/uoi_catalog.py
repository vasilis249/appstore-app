# Πανεπιστήμιο Ιωαννίνων: the university's official course catalogue 2025-26 («Ιδρυματικός κατάλογος μαθημάτων», one
# sheet per department: semester, code, title, category) for 22 departments; Μηχανικών Επιστήμης Υλικών from its own
# detailed programme page (the catalogue gives that department course *types*, not compulsory / elective).
# Fetch (browser user agent: the uoi.gr hosts refuse curl's):
#   raw/uoi/katalogos-2025-26.xlsx ← CATALOGUE, raw/uoi/materials-pps.html ← MATERIALS
# Semesters: 1–12, Greek numerals (Α … Λ), "7ο", "Ε, Ζ" / "6-8" / "6.8" (offered in several → the earliest),
# "≥5" → no fixed semester. Kind: compulsory categories = core; any «επιλογ…», ΕΥ / ΥΕ / ΕΠ, optional = elective;
# a foreign language (one of several, even when "compulsory") = elective, group «Ξένη γλώσσα».
import html, re, unicodedata, openpyxl
from lib import save, norm, recaser, fold
CATALOGUE = "https://uoi.gr/wp-content/uploads/2023/07/idrymatikos-katalogos-pi-2025-20261.xlsx"
MATERIALS = "http://materials.uoi.gr/ppsdetailed.php"
SHEETS = {"Τμήμα Φιλολογίας": "uoi-phil", "Τμήμα Ιστορίας &Αρχαιολογίας": "uoi-hist-arch", "Τμήμα Φιλοσοφίας": "uoi-philosophy",
          "Τμήμα Μαθηματικών": "uoi-math", "Τμήμα Φυσικής": "uoi-physics", "Τμήμα Χημείας": "uoi-chem", "Τμήμα Ιατρικής": "uoi-med",
          "Τμήμα ΒΕΤ": "uoi-bat", "Τμήμα Νοσηλευτικής": "uoi-nurs", "Τμήμα Λογοθεραπείας": "uoi-speech", "ΠΤΔΕ": "uoi-primedu",
          "ΠΤΝ": "uoi-preedu", "Τμήμα Οικονομικών Επιστημών": "uoi-econ", "Τμήμα Λογ&Χρημ": "uoi-acc",
          "Τμήμα Εικ.Τεχνών&Επιστ. της Τέχ": "uoi-arts", "Τμήμα Μηχ.Ηλεκτρ.Υπολ.&Πληρ.": "uoi-cse",
          "Τμήμα Αρχιτεκτόνων Μηχανικών": "uoi-arch", "Τμήμα Πληροφορικής και Τηλεπικ.": "uoi-it", "Τμήμα Γεωπονίας": "uoi-agri",
          "ΤΑΦΠΠΗ": "uoi-ecec", "Τμήμα Ψυχολογίας": "uoi-psych", "Τμήμα Μουσικών Σπουδών": "uoi-music"}
GREEK = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8, "Θ": 9, "Ι": 10, "Κ": 11, "Λ": 12}
HAND = "Αγαθία Καρχηδονίας νευροαποκατάσταση νευρογενείς παιχνιδοποίηση συμποσιασμού τεχνοπολιτισμός"
case = recaser([], hand={**{fold(w).strip(): w for w in HAND.split()}, fold("ΦΟΡΝΤΙΔΑΣ").strip(): "φροντίδας"})  # typo in the source

def semester(v):
    if v is None: return None
    s = str(v).upper().replace("Z", "Ζ").replace("O", "Ο")  # Latin look-alikes ("z", "7o")
    if "≥" in s or ">" in s: return None
    nums = [int(n) for n in re.findall(r"\d+", s)]
    nums += [GREEK[w] for w in re.findall(r"ΣΤ|[ΑΒΓΔΕΖΗΘΙΚΛ](?![Α-Ω])", re.sub(r"\d+Ο", "", s))]
    nums = [n for n in nums if 1 <= n <= 12]
    return min(nums) if nums else None

def kind(cat):
    c = unicodedata.normalize("NFD", norm(str(cat or "")).upper())
    c = "".join(ch for ch in c if not unicodedata.combining(ch)).replace(".", "").replace("ΥΠΟΧΡΕΤΙΚΟ", "ΥΠΟΧΡΕΩΤΙΚΟ")
    group = None
    if "ΞΕΝΗ ΓΛΩΣΣΑ" in c: return "elective", "Ξένη γλώσσα"  # one language of several (as tuc_api.py)
    if c.startswith("ΠΡΟΑΙΡΕΤΙΚ") or c.startswith("ΠΡΟ/Ε"): return "elective", "Προαιρετικά"
    if m := re.search(r"ΕΝΟΤΗΤΑ (.+)", c): group = "Ενότητα " + case(m[1]).lower()
    elif "ΕΡΓΑΣΤΗΡΙΑΚΟ" in c: group = "Εργαστηριακά"
    elif "ΕΛΕΥΘΕΡΗΣ ΕΠΙΛΟΓΗΣ" in c: group = "Ελεύθερης επιλογής"
    if "ΕΠΙΛΟΓ" in c or c in ("ΕΥ", "ΥΕ", "ΕΠ", "ΕΠ ΥΠ", "EY", "ΚΟΙΝΩΝΙΚΗ") or c.startswith("ΕΜΒΑΘΥΝΣΗΣ") \
       or c in ("ΠΡΑΚΤΙΚΗ ΑΣΚΗΣΗ", "ΑΝΑΠΤΥΞΗΣ ΔΕΞΙΟΤΗΤΩΝ", "ΓΕΝΙΚΗΣ ΟΜΑΔΑΣ ΜΑΘΗΜΑΤΩΝ ΕΠΙΛΟΓΗΣ", ""):
        return "elective", group
    return "core", None  # ΥΠ / Υ / ΥΠΟΧΡΕΩΤΙΚΟ / κορμού / θεμελίωσης / πτυχιακή / διπλωματική / compulsory language

def title(s):
    s = norm(s)
    letters = [ch for ch in s if ch.isalpha()]
    return case(s) if letters and sum(map(str.isupper, letters)) > 0.6 * len(letters) else s

wb = openpyxl.load_workbook("raw/uoi/katalogos-2025-26.xlsx", read_only=True)
assert set(wb.sheetnames) - set(SHEETS) == {"Τμήμα Μηχανικών Επιστήμης Υλικώ"}, set(wb.sheetnames) ^ set(SHEETS)  # materials: own page below
for sheet, dept in SHEETS.items():
    by = {}
    for r in wb[sheet].iter_rows(values_only=True):
        if not r or not r[4] or str(r[3] or "").startswith("ΚΩΔΙΚΟΣ") or str(r[5] or "").startswith("ΚΑΤΗΓΟΡΙΑ"): continue
        code, name = norm(str(r[3] or "")) or None, title(str(r[4]))
        k, g = kind(r[5])
        e = by.setdefault(code or name.lower(), {"code": code, "name": name, "sems": [], "kind": k, "group": g})
        if (sem := semester(r[2])) is not None: e["sems"].append(sem)
        if k == "core": e["kind"], e["group"] = k, None  # listed as compulsory anywhere = compulsory
    # an uncoded row repeating a coded course (Φιλολογία lists some twice) is dropped; distinct codes stay distinct
    coded = {e["name"].lower() for e in by.values() if e["code"]}
    rows = [{"code": e["code"], "name": e["name"], "semester": min(e["sems"], default=None), "kind": e["kind"], "group": e["group"]}
            for e in by.values() if e["code"] or e["name"].lower() not in coded]
    save("uoi", dept, CATALOGUE, rows, note=f"sheet «{sheet}»")

# Μηχανικών Επιστήμης Υλικών: "Μαθήματα N ου Εξαμήνου" → semester; ΥΠΟΧΡΕΩΤΙΚΑ → core, «…ΜΕ ΕΠΙΛΟΓΗ…» → elective
t = open("raw/uoi/materials-pps.html", errors="replace").read()
t = html.unescape(re.sub(r"<[^>]+>", "\n", re.sub(r"(?s)<script.*?</script>|<style.*?</style>", "", t)))
lines = [norm(l) for l in t.split("\n") if norm(l)]
rows, sem, k = [], None, None
for i, l in enumerate(lines):
    if m := re.fullmatch(r"Μαθήματα (\d+)", l): sem = int(m[1]); continue
    if l == "ΥΠΟΧΡΕΩΤΙΚΑ": k = "core"; continue
    if l.startswith("ΥΠΟΧΡΕΩΤΙΚΑ ΜΕ ΕΠΙΛΟΓΗ"): k = "elective"; continue
    if l.startswith("ΠΡΑΚΤΙΚΗ ΑΣΚΗΣΗ"): k = "elective"; continue
    if k and sem and re.fullmatch(r"[A-ZΑ-Ω]{3} ?\d{3}", l) and i + 1 < len(lines):
        rows.append({"code": l.replace(" ", ""), "name": title(lines[i + 1]), "semester": sem, "kind": k, "group": None})
save("uoi", "uoi-materials", MATERIALS, rows)
