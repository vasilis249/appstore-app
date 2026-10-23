# Πολυτεχνείο Κρήτης: every department from the university's public course catalogue (courses.tuc.gr, Universis API,
# same data as auth_api.py). Each 2026-27 study program, year 2025 (both semesters) + year 2026 (winter, newest names).
# Fetch: tuc_api.py --fetch (→ raw/tuc-api/<program>-<year>.json), then tuc_api.py.
# Kind: obligatory type and no "ΕΠΙΛΟΓ" in the type name = core; core in some tracks only = track_core of those;
# type ΞΕΝΗ ΓΛΩΣΣΑ (English / German / French / Chinese, one to pick) = elective, group "Ξένη γλώσσα".
import json, re, subprocess, sys
from lib import save, norm, recaser, fold
API = "https://universis-api.tuc.gr/services/course-catalogue/v1p1/SpecializationCourses/{}/{}/?$top=5000"
SRC = "https://courses.tuc.gr/#/studyPrograms/{}?year=2026&lang=el"
PROGRAMS = {"tuc-mre": 1931, "tuc-ece": 1933, "tuc-chenveng": 1938, "tuc-pem": 1941, "tuc-arch": 1942}
YEARS = (2025, 2026)
if "--fetch" in sys.argv:
    for p in PROGRAMS.values():
        for y in YEARS:
            subprocess.run(["curl", "-sS", "-m", "120", "--retry", "3", "-o", f"raw/tuc-api/{p}-{y}.json", API.format(p, y)], check=True)
    sys.exit()
case = recaser([], hand={fold(w).strip(): w for w in "πολυγραμματισμούς ματιέρες επεξεργ".split()})
def title(s):  # titles are typed in capitals; English ones too ("NUMBER THEORY AND CRYPTOGRAPHY")
    letters = [ch for ch in s if ch.isalpha()]
    if sum(map(str.isupper, letters)) <= 0.5 * len(letters): return s
    if not re.search("[Α-Ωα-ω]", s): return s.capitalize()
    return re.sub(r"(?<= )[ΗΟ](?= )", lambda m: m[0].lower(), case(s))  # the article "Η/Ο" mid-title
for dept, pid in PROGRAMS.items():
    by = {}
    for y in YEARS:  # later year wins the name
        for x in json.load(open(f"raw/tuc-api/{pid}-{y}.json"))["value"]:
            c, spec, ct = x["studyProgramCourse"]["course"], x["specialization"]["name"], x["courseType"]
            e = by.setdefault(c["id"], {"sems": set(), "in": set(), "core": set(), "base": False})
            e["code"], e["name"] = norm(c["displayCode"]), norm(c["name"])
            core = ct["obligatoryType"] == -1 and "ΕΠΙΛΟΓ" not in ct["name"] and ct["name"] != "ΞΕΝΗ ΓΛΩΣΣΑ"
            if ct["name"] == "ΞΕΝΗ ΓΛΩΣΣΑ": spec = "Ξένη γλώσσα"  # one language of several: elective of that group
            if x["semester"]["id"] < 100: e["sems"].add(x["semester"]["id"])
            if spec == "ΚΟΡΜΟΣ": e["base"] |= core
            else: e["in"].add(spec); core and e["core"].add(spec)
    tracks = set().union(*(e["in"] for e in by.values())) - {"Ξένη γλώσσα"}
    rows = []
    for e in by.values():
        if e["base"] or (tracks and e["core"] == tracks): kind, groups = "core", []
        elif e["core"]: kind, groups = "track_core", e["core"]
        else: kind, groups = "elective", e["in"] if e["in"] != tracks else []
        for g in sorted(groups) or [None]:
            rows.append({"code": e["code"], "name": title(e["name"]), "semester": min(e["sems"], default=None), "kind": kind,
                         "group": g and title(norm(g))})
    save("tuc", dept, SRC.format(pid), rows)
