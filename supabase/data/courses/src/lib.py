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

def recaser(prefer, others=("raw/*.txt",), hand=None):
    """Upper-case course titles → sentence case, word by word, with the accents of the forms seen in the `prefer` files
    (else in any other text). Unknown words stay upper case (printed)."""
    import glob, collections
    WORD = r"[A-Za-zΑ-Ωα-ωΆ-Ώά-ώϊϋΐΰΪΫ]+"
    best, rest = collections.defaultdict(collections.Counter), collections.defaultdict(collections.Counter)
    for f in sorted(f for g in others for f in glob.glob(g)):
        for w in re.findall(WORD, open(f, errors="replace").read()):
            if not w.isupper(): (best if f in prefer else rest)[fold(w).strip()][w] += 1
    lexicon = {}  # last resort: a general word-frequency list (raw/el_words.txt, "word count", most frequent first)
    if os.path.exists("raw/el_words.txt"):
        for line in open("raw/el_words.txt", errors="replace"):
            w = line.split(" ")[0]
            if w and w[0].islower(): lexicon.setdefault(fold(w).strip(), w)
    ACCENT = dict(zip("αεηιουω", "άέήίόύώ"))
    def adjective(key):  # "-ικός/-ακή/-ικών/-ακές…": the accent sits on the ending
        if m := re.fullmatch(r"(.+[ια]κ)([αεηουω])(σ|ι|ν|υ|υσ)?", key):
            end = m[3] or ""
            return m[1] + ACCENT[m[2]] + (end[:-1] + "ς" if end.endswith("σ") else end)
        if m := re.fullmatch(r"(.+(?:λογ|τεχν|τροφ|μετρ|πον|δοντ|γραφ|παθ|νομ|σοφ|σκοπ|γεν|φον))ι(α|ασ|εσ)", key):
            return m[1] + "ί" + (m[2][:-1] + "ς" if m[2].endswith("σ") else m[2])  # "-λογία/-τεχνίας/-τροφίες"
    def written(key):
        if hand and key in hand: return hand[key]
        # sentence case: a lower-case form from the preferred texts, then from any, else the one seen lower-cased
        for forms in (best.get(key), rest.get(key)):
            if lows := [k for k, _ in (forms or {}).items() and forms.most_common() if k[0].islower()]: return lows[0]
        forms = best.get(key) or rest.get(key)
        if not forms: return lexicon.get(key) or adjective(key)
        w = forms.most_common(1)[0][0]
        return w if re.match(r"(ελλα|ελλη|ευρωπ|μεσογει|αττικ|αθην|βαλκαν)", key) else w.lower()
    def sentence(caps):
        out = []
        for i, w in enumerate(caps.split()):
            if re.search("[Α-Ω]", w) or re.fullmatch(r"[ABEHIKMNOPTXYZ]{4,}", w):  # Latin look-alikes typed in Greek
                w = w.translate(str.maketrans("ABEHIKMNOPTXYZ", "ΑΒΕΗΙΚΜΝΟΡΤΧΥΖ"))
            for n, core in enumerate(re.findall(r"[^\W\d_]+", w)):  # each piece of "ΓΕΩΛΟΓΙΑ-ΟΡΥΚΤΟΛΟΓΙΑ"
                word = None if re.fullmatch(r"[IVXΙ]+|[A-ZΑ-Ω]|[A-Z]+", core) else written(fold(core).strip())
                if word: w = w.replace(core, word[0].upper() + word[1:] if i == n == 0 else word, 1)
                elif core.isupper() and len(core) > 3 and re.search("[Α-Ω]", core): print("  unknown word:", core)
            out.append(w)
        return " ".join(out)
    sentence.known = lambda w: bool(written(fold(w).strip()))
    return sentence
