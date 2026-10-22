# ΑΠΘ departments from the university's public course catalogue (courses.auth.gr, Universis API):
# SpecializationCourses/<study program>/<year>/ = every course with a class that year, with its semester, type and
# specialization (track). Fetch: auth_api.py --fetch (→ raw/auth-api/<program>.json), then auth_api.py.
# Kind: obligatory type and no "ΕΠΙΛΟΓ" in the type name = core; core in some tracks only = track_core of those.
# A course listed in several semesters gets the earliest; ΧΕΙΜ / ΕΑΡ / ΧΕΙΜ-ΕΑΡ (ids > 100) = no fixed semester.
import json, re, subprocess, sys
from lib import save, norm, recaser, fold
API = "https://courses.auth.gr/services/course-catalogue/v1p1/SpecializationCourses/{}/2026/?$top=5000"
SRC = "https://courses.auth.gr/#/studyPrograms/{}?year=2026&lang=el"
PROGRAMS = {"auth-agri": 1233, "auth-arch": 1341, "auth-arts": 826, "auth-civil": 1420, "auth-csd": 1272, "auth-dent": 287,
            "auth-ece": 762, "auth-ecedu": 1519, "auth-econ": 783, "auth-film": 496, "auth-french": 1278, "auth-geo": 1290,
            "auth-german": 1288, "auth-hist-arch": 1299, "auth-italian": 774, "auth-law": 1559, "auth-math": 630,
            "auth-mech": 694, "auth-pastoral": 1479, "auth-pe": 1891, "auth-pe-serres": 102, "auth-pharm": 1074,
            "auth-philosophy": 486, "auth-plandev": 1331, "auth-primedu": 1516, "auth-rsge": 1524, "auth-theatre": 1277,
            "auth-theol": 1304, "auth-vet": 1321}
GENERIC = re.compile(r"ΚΟΡΜΟΣ|ΓΕΝΙΚΗ ΚΑΤΕΥΘΥΝΣΗ|ΕΝΙΑΙΑ ΚΑΤΕΥΘΥΝΣΗ|Βασικός κύκλος|παιδαγωγική επάρκεια", re.I)
if "--fetch" in sys.argv:
    for p in PROGRAMS.values():
        subprocess.run(["curl", "-sS", "-m", "120", "--retry", "3", "-o", f"raw/auth-api/{p}.json", API.format(p)], check=True)
    sys.exit()
HAND = "αγγλοκρατία αντιρρύπανσης γεωχρονολογήσεις γραμματισμοί γραμματισμών διαβίου διασκόπησης διαφορίσιμες δίγλωσσης " \
    "δικαιοπραξίας δικαιοπραξιών εγγραμματισμό εκκρίσεως Θεσσαλονίκεια ινδόρνιθας Κολλυβάδες κρυσταλλοδομή μαρκοβιανά " \
    "μεταμορφωμένων νανοδίκτυα ορατότητες παραμορφώσιμων περιδιαβάσεις περιοδόντιο περιοδοντίου πετρογένεση πυριγενών " \
    "συνεργατισμός σχεδιοκίνηση χωροκατασκευές χώρων"
case = recaser([], hand={fold(w).strip(): w for w in HAND.split()})
LATIN = str.maketrans("ΑΒΕΗΙΚΜΝΟΡΤΧΥΖ", "ABEHIKMNOPTXYZ")
def latin(w):  # English words typed with Greek look-alike capitals ("CΗΕΕRLΕΑDΙΝG")
    if not re.search("[CDFGJLQRSUVW]", w): return w
    w = w.translate(LATIN)
    return w.capitalize() if re.fullmatch(r"[A-Z]{5,}", w) else w
def title(s):  # re-case titles typed in capitals ("ΤΟ ΘΕΑΤΡΟ ΣΤΟΝ 20ο ΑΙΩΝΑ" counts too)
    letters = [ch for ch in s if ch.isalpha()]
    return case(" ".join(map(latin, s.split()))) if sum(map(str.isupper, letters)) > 0.5 * len(letters) else s
track_name = lambda s: title(norm(re.sub(r'^"|"$|^Έμφαση-', "", s)))
for dept, pid in PROGRAMS.items():
    v = json.load(open(f"raw/auth-api/{pid}.json"))["value"]
    tracks = {x["specialization"]["name"] for x in v if not GENERIC.search(x["specialization"]["name"])}
    by = {}
    for x in v:
        c, spec, ct = x["studyProgramCourse"]["course"], x["specialization"]["name"], x["courseType"]
        e = by.setdefault(c["id"], {"code": c["displayCode"], "name": norm(c["name"]), "sems": set(), "in": set(), "core": set(), "base": False})
        core = ct["obligatoryType"] == -1 and "ΕΠΙΛΟΓ" not in ct["name"]
        if x["semester"]["id"] < 100: e["sems"].add(x["semester"]["id"])
        if GENERIC.search(spec): e["base"] |= core
        else: e["in"].add(spec); core and e["core"].add(spec)
    rows = []
    for e in by.values():
        if e["base"] or (tracks and e["core"] == tracks): kind, groups = "core", []
        elif e["core"]: kind, groups = "track_core", e["core"]
        else: kind, groups = "elective", e["in"] if e["in"] != tracks else []
        for g in sorted(groups) or [None]:
            rows.append({"code": e["code"], "name": title(e["name"]), "semester": min(e["sems"], default=None), "kind": kind,
                         "group": g and track_name(g)})
    save("auth", dept, SRC.format(pid), rows)
