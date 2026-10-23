"""Check the course catalogs: python3 supabase/data/courses/check.py — one JSON per university, every department of
that university present (with courses, or source null + tried + note when no programme could be found)."""
import json, glob, os, re, sys

KINDS = {"core", "track_core", "elective"}
MIG = os.path.join(os.path.dirname(__file__), "../../migrations")
depts = {}
for f in glob.glob(f"{MIG}/*.sql"):
    for d, u in re.findall(r"\('([a-z0-9-]+)', *'([a-z0-9-]+)', *'", open(f).read()):
        if d.startswith(u + "-"): depts.setdefault(u, set()).add(d)
bad = []
for path in sorted(glob.glob(os.path.join(os.path.dirname(__file__), "*.json"))):
    data = json.load(open(path)); uni = data["university"]
    if os.path.basename(path) != f"{uni}.json": bad.append(f"{path}: university {uni}")
    missing = depts.get(uni, set()) - set(data["departments"])
    if missing: bad.append(f"{uni}: departments not listed {sorted(missing)}")
    for d, v in data["departments"].items():
        if d not in depts.get(uni, set()): bad.append(f"{uni}/{d}: unknown department")
        if not v["courses"] and not (v["source"] is None and v.get("tried") and v.get("note")): bad.append(f"{uni}/{d}: empty without a note")
        seen = set()
        for c in v["courses"]:
            key = (c["name"].lower(), c["semester"])
            if key in seen or c["kind"] not in KINDS or not 1 <= len(c["name"].strip()) <= 300 or not (c["semester"] is None or 1 <= c["semester"] <= 12):
                bad.append(f"{uni}/{d}: bad course {c}")
            seen.add(key)
    n = sum(len(v["courses"]) for v in data["departments"].values())
    print(f"{uni}: {len(data['departments'])} departments, {n} courses, "
          f"{sum(1 for v in data['departments'].values() if not v['courses'])} without a programme")
print("\n".join(bad) or "ok"); sys.exit(1 if bad else 0)
