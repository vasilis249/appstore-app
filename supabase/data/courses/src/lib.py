# Shared helpers: merge course rows into supabase/data/courses/<uni>.json (one file per university).
import json, os, re, datetime
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
KINDS = ("core", "track_core", "elective")  # υποχρεωτικό | υποχρεωτικό κατεύθυνσης/ροής | επιλογής
def norm(s): return re.sub(r"\s+", " ", s or "").strip()
def save(uni, dept, source, rows, note=None):
    """rows: dicts name, semester (int|None), kind, group (str|None), code (str|None). Same name+semester merged."""
    path = f"{OUT}/{uni}.json"
    data = json.load(open(path)) if os.path.exists(path) else {"university": uni, "departments": {}}
    merged = {}
    for r in rows:
        name = norm(r["name"]); assert name and r["kind"] in KINDS, r
        key = (name.lower(), r.get("semester"))
        c = merged.setdefault(key, {"code": r.get("code") or None, "name": name, "semester": r.get("semester"), "kind": r["kind"], "groups": []})
        # strongest kind wins (core > track_core > elective); groups keep where it is offered
        if KINDS.index(r["kind"]) < KINDS.index(c["kind"]): c["kind"] = r["kind"]
        if r.get("group") and r["group"] not in c["groups"]: c["groups"].append(r["group"])
        c["code"] = c["code"] or r.get("code") or None
    courses = sorted(merged.values(), key=lambda c: (c["semester"] or 99, KINDS.index(c["kind"]), c["name"]))
    data["departments"][dept] = {"source": source, "retrieved": str(datetime.date.today()), **({"note": note} if note else {}), "courses": courses}
    data["departments"] = dict(sorted(data["departments"].items()))
    os.makedirs(OUT, exist_ok=True)
    json.dump(data, open(path, "w"), ensure_ascii=False, indent=1)
    by = {k: sum(c["kind"] == k for c in courses) for k in KINDS}
    print(f"{uni}/{dept}: {len(courses)} courses {by}, semesters {sorted({c['semester'] for c in courses if c['semester']})}")
def missing(uni, dept, tried, note):
    path = f"{OUT}/{uni}.json"
    data = json.load(open(path)) if os.path.exists(path) else {"university": uni, "departments": {}}
    data["departments"][dept] = {"source": None, "tried": tried, "note": note, "courses": []}
    data["departments"] = dict(sorted(data["departments"].items()))
    os.makedirs(OUT, exist_ok=True); json.dump(data, open(path, "w"), ensure_ascii=False, indent=1)
    print(f"{uni}/{dept}: MISSING — {note}")

def lines_of(path):
    import subprocess
    return subprocess.run(["python3", "text.py", path], capture_output=True, text=True, cwd=os.path.dirname(__file__) or ".").stdout.split("\n")

def parse_headings(lines, start, stop, sem_re, rules, skip=()):
    """Walk text lines: sem_re sets the semester (group 1, rest of line may be a heading); rules = [(regex, kind,
    group or callable(match)->group)] set the current section; any other line is a course of that section."""
    import re as _re
    sem, kind, group, out, on = None, None, None, [], False
    for raw in lines:
        l = norm(raw)
        if not l: continue
        if not on:
            on = bool(_re.search(start, l))
            if not on: continue
        if _re.search(stop, l) and sem is not None: break
        m = _re.match(sem_re, l)
        if m:
            sem = int(m.group(1)); l = norm(l[m.end():])
            if not l: continue
        hit = False
        for rx, k, g in rules:
            mm = _re.match(rx, l)
            if mm: kind, group, hit = k, (g(mm) if callable(g) else g), True; break
        if hit or kind is None or any(_re.search(s, l) for s in skip): continue
        out.append({"name": l, "semester": sem, "kind": kind, "group": group})
    return out

def fold(s):
    import unicodedata
    s = "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn").replace("ς", "σ")
    return " " + " ".join(re.findall(r"[a-zα-ω0-9]+", s)) + " "

def match_sections(sections, named):
    """sections: [(semester, kind, group, text blob)] from a schedule table whose names wrap; named: [(name, code)]
    clean titles (e.g. from the course descriptions). Each title found in a blob (longest first, consumed) → a row."""
    rows, left = [], {n for n, _ in named}
    blobs = [[sem, k, g, fold(re.sub(r"(?<![\w])(\d+|-)(?![\w])", " ", t))] for sem, k, g, t in sections]
    for name, code in sorted(named, key=lambda x: -len(x[0])):
        f = fold(name)
        for b in blobs:
            if f in b[3]:
                b[3] = b[3].replace(f, " | ", 1); left.discard(name)
                rows.append({"name": name, "code": code, "semester": b[0], "kind": b[1], "group": b[2]})
    rest = [(b[0], b[3]) for b in blobs if re.sub(r"[ |]", "", b[3])]
    return rows, sorted(left), rest

def code_table(lines, sem_of, kind_of, code_re, tail_re, skip_re=r"^$"):
    """Rows "CODE Title ... <tail>" grouped under semester / kind headings. A title that wraps around a bare
    "CODE <tail>" line takes the line before and the line after (pdf table cells). sem_of(line) → int|None,
    kind_of(line) → (kind, group)|None. Returns rows."""
    import re as _re
    rows, sem, kg, pending, i = [], None, ("core", None), "", 0
    row = _re.compile(rf"^({code_re})\s+(.*?)\s*(?:{tail_re})?$")
    while i < len(lines):
        l = norm(lines[i]); i += 1
        if (s := sem_of(l)) is not None: sem, pending = s, ""; continue
        if (k := kind_of(l)) is not None: kg, pending = k, ""; continue
        if sem is None or _re.match(skip_re, l): pending = ""; continue
        m = row.match(l)
        if m:
            name = m[2]
            if not name or _re.fullmatch(r"[\d\s,.\-–]*", name):
                nxt = norm(lines[i]) if i < len(lines) else ""
                name = norm(pending + " " + (nxt if not row.match(nxt) and sem_of(nxt) is None and kind_of(nxt) is None else ""))
                if nxt and nxt in name: i += 1
            rows.append({"code": m[1], "name": name, "semester": sem, "kind": kg[0], "group": kg[1]}); pending = ""; continue
        pending = l
    return rows
