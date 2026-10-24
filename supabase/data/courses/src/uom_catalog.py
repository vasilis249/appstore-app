# Πανεπιστήμιο Μακεδονίας (uom.gr): dai / ies = the «Πρόγραμμα Σπουδών» pages, one per entry track and semester
# (…?semester=N: «ΥΠΟΧΡΕΩΤΙΚΑ ΜΑΘΗΜΑΤΑ» / «ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ» / «ΜΑΘΗΜΑΤΑ ΞΕΝΗΣ ΓΛΩΣΣΑΣ», then «TITLE», «(CODE)»);
# eco / ba / bso / msa = the 2026-27 programme PDFs linked from those pages. esp and fin answer every request with a
# JavaScript firewall page → missing (not bypassed).
# Fetch: scratchpad uom_fetch.py → raw/uom/s-<dept>-NN.html + index.tsv; PDFs raw/uom/g-<dept>.pdf (browser user agent).
import re, bisect
import html as h
import pdfplumber
import html_programme as hp
from lib import save, missing, recaser, norm

_case = recaser([], hand={"ρυτηον": "Python", "logistics": "Logistics", "spc": "SPC", "ρωσιασ": "Ρωσίας",
                              "θουκυδιδησ": "Θουκυδίδης", "γεεθα": "ΓΕΕΘΑ"})
LOOK = str.maketrans("ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ", "ABEZHIKMNOPTYX")
def tidy(s):
    s = re.sub(r"\s+-\s*[A-Z][A-Z0-9 ,:&'-]{6,}(?=$| \()", "", s)  # « - FOREIGN POLICY ANALYSIS»: the English title again
    s = re.sub(r"\bKAI\b", "ΚΑΙ", s)
    s = re.sub(r"^(ΑΓΓΛΙΚΑ|ΓΑΛΛΙΚΑ|ΓΕΡΜΑΝΙΚΑ|ΙΤΑΛΙΚΑ)\b", lambda m: m[1].capitalize(), s)
    # English words typed with Greek look-alike capitals («DΑΤΑ», «ΡΟLΙΤΙCΑL»), roman numerals «IΙ»
    s = re.sub(r"[^\s()-]*[A-Z][^\s()-]*", lambda m: m[0].translate(LOOK), s)
    return re.sub(r"(?<= )[ΙIVX]+(?=$|[\s:,)])", lambda m: m[0].translate(LOOK), s)
def case(s): return tidy(_case(tidy(s)))
def fixed(rows):
    for r in rows: r["name"] = tidy(r["name"])
    return rows
ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]

def tokens(f):
    s = re.sub(r"(?is)<script.*?</script>|<style.*?</style>", "", open(f"raw/uom/{f}", encoding="utf-8").read())
    return [x for x in (norm(h.unescape(y)) for y in re.split(r"<[^>]+>", s)) if x]

# rows seen per track: a compulsory course in every track of its semester is core, else track_core of its tracks;
# an elective keeps its tracks only when not offered in all of them
def across(rows):
    tracks = {}
    for r in rows: tracks.setdefault(r["semester"], set()).add(r["group"])
    seen = {}
    for r in rows: seen.setdefault((r["name"].lower(), r["semester"], r["kind"]), []).append(r)
    out = []
    for (_, sem, kind), rs in seen.items():
        gs = {r["group"] for r in rs}
        everywhere = gs >= tracks[sem]
        for g in sorted(gs, key=str) if not everywhere else [None]:
            out.append({**rs[0], "kind": "track_core" if kind == "core" and g else kind, "group": g})
    return out

# dai: entry tracks ΕΤΥ / ΠΣ, semesters 1-8; ies: general semesters 1-5, two tracks in 6-8
def pages(dept, track_of):
    rows = []
    for l in open("raw/uom/index.tsv", encoding="utf-8"):
        d, url, f = l.rstrip("\n").split("\t")
        if d != dept: continue
        sem, group = int(url.rsplit("=", 1)[1]), track_of(url)
        t = tokens(f)
        i = next(i for i, x in enumerate(t) if re.fullmatch(r"\(.+\)", x)) - 1
        while i > 0 and "ΜΑΘΗΜΑΤΑ" not in t[i]: i -= 1
        kind, lang = "core", False
        for j in range(i, len(t) - 1):
            x = t[j]
            if x == "Περιγραφή": break
            if x == "ΥΠΟΧΡΕΩΤΙΚΑ ΜΑΘΗΜΑΤΑ": kind, lang = "core", False
            elif x == "ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ": kind, lang = "elective", False
            elif x == "ΜΑΘΗΜΑΤΑ ΞΕΝΗΣ ΓΛΩΣΣΑΣ": kind, lang = "elective", True
            elif (m := re.fullmatch(r"\((.+)\)", t[j + 1])):
                rows.append({"code": m[1], "name": x, "semester": sem, "kind": kind,
                             "group": "Ξένη γλώσσα" if lang else group})
    lang = [r for r in rows if r["group"] == "Ξένη γλώσσα"]
    return hp.finish(fixed(across([r for r in rows if r not in lang]) + lang), case)

def dai():
    track = lambda u: "Κατεύθυνση Επιστήμη και Τεχνολογία Υπολογιστών" if "/ety-" in u else "Κατεύθυνση Πληροφοριακά Συστήματα"
    save("uom", "uom-dai", "https://www.uom.gr/dai/programma-spoydon-prosferomena-mathhmata", pages("dai", track))

def ies():
    def track(u):
        if "genikh" in u: return None
        return "Κατεύθυνση Διεθνών και Ευρωπαϊκών Οικονομικών Σπουδών" if "oikonomikon" in u else \
            "Κατεύθυνση Πολιτικών Σπουδών και Διπλωματίας"
    save("uom", "uom-ies", "https://www.uom.gr/ies/programma-spoydon", pages("ies", track))

# PDF tables drawn with thin rectangles: for each key word (a code / «N.»), the words of the next column in its row
# (cell borders spanning that column); returns (page, top, key, text) in reading order
def cells(path, key, a=0, b=None):
    out = []
    pdf = pdfplumber.open(path)
    for i, pg in enumerate(pdf.pages[a:b], a):
        ws = pg.extract_words()
        thin = [r for r in pg.rects if r["width"] < 2 or r["height"] < 2] + pg.lines
        V = [r for r in thin if r["x1"] - r["x0"] < 2]; H = [r for r in thin if r["bottom"] - r["top"] < 2]
        for w in ws:
            if not re.fullmatch(key, w["text"]): continue
            y = (w["top"] + w["bottom"]) / 2
            vs = sorted({round(e["x0"]) for e in V if e["top"] - 1 <= y <= e["bottom"] + 1})
            k = bisect.bisect_right(vs, w["x0"])
            if k + 1 >= len(vs): continue
            x0, x1 = vs[k], vs[k + 1]
            hs = sorted({round(e["top"]) for e in H if e["x0"] <= x0 + 2 and e["x1"] >= x1 - 2})
            j = bisect.bisect_right(hs, y)
            top, bot = (hs[j - 1] if j else 0), (hs[j] if j < len(hs) else 1e9)
            t = " ".join(x["text"] for x in sorted(ws, key=lambda x: (round(x["top"]), x["x0"]))
                         if top <= x["top"] < bot and x0 <= x["x0"] < x1)
            out.append((i, w["top"], w["text"], t))
    return sorted(out)

def heads(path, a=0, b=None):  # text lines (page, top, text)
    pdf = pdfplumber.open(path)
    return [(i, l["top"], norm(l["text"])) for i, pg in enumerate(pdf.pages[a:b], a) for l in pg.extract_text_lines()]

NOTE = r"\s*\((?:αλλαγή τίτλου|πρώην|Διατίθεται)[^)]*\)?\)?|\s*\([^()]*(?:αγγλικά|Αγγλικά|English)\)"

# eco: Α' κύκλος semesters 1-4 (compulsory + one foreign language); its Ομάδα Γ electives and the Β' κύκλος groups Α/Β/Γ
# (all elective) are listed by winter / spring («Α' & Γ'», «Ε' & Ζ'», «ΣΤ΄ & Η΄») → filed under the earlier semester
def eco():
    p = "raw/uom/g-eco.pdf"
    ev = [(i, t, "h", x) for i, t, x in heads(p, 4, 19)] + [(i, t, "c", (k, x)) for i, t, k, x in cells(p, r"[Α-Ω]{2}\d{4}(?:-1)?", 4, 19)]
    rows, sem, kind, group = [], None, "core", None
    for _, _, typ, x in sorted(ev, key=lambda e: (e[0], e[1], e[2] == "c")):
        if typ == "h":
            if (m := re.match(r"(Α|Β)' ΚΥΚΛΟΣ ΣΠΟΥΔΩΝ(?: - ΟΜΑΔΑ (Α|Β|Γ))?", x)):
                kind = "core" if m[1] == "Α" and not m[2] else "elective"
                group = f"Ομάδα {m[2]} ({m[1]}΄ κύκλος)" if m[2] else None
            elif re.match(r"(ΣΤ|[Α-Η])['΄] ΕΞΑΜΗΝΟ", x) or x.startswith("ΜΑΘΗΜΑΤΑ ") and "ΕΞΑΜΗΝ" in x:
                sem = hp.semester_of(re.sub(r"ΜΑΘΗΜΑΤΑ (?:ΧΕΙΜΕΡΙΝ|ΕΑΡΙΝ)\S+ ΕΞΑΜΗΝ\S+ \(([^ &)]+).*", r"\1 ΕΞΑΜΗΝΟ", x))
            continue
        code, name = x
        name = re.sub(NOTE, "", name)
        foreign = code.startswith("ΞΓ") and kind == "core" or hp.up(name).startswith(("ΑΓΓΛΙΚΑ", "ΓΑΛΛΙΚΑ", "ΓΕΡΜΑΝΙΚΑ", "ΙΤΑΛΙΚΑ"))
        rows.append({"code": code, "name": name, "semester": sem, "kind": "elective" if foreign else kind,
                     "group": "Ξένη γλώσσα" if foreign else group})
    save("uom", "uom-econ", "https://www.uom.gr/eco/programma-spoydon", hp.finish(fixed(rows), case))

# ba: «ΥΠΟΧΡΕΩΤΙΚΑ ΜΑΘΗΜΑΤΑ ΚΟΡΜΟΥ» semesters 1-4, then per semester the compulsory lists of the two tracks
# (Ο.Δ.Ε. / Μ.Δ.Λ.) and «ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ … ΚΟΙΝΑ ΚΑΙ ΣΤΙΣ ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ»; rows «N. | title | …»
def ba():
    p = "raw/uom/g-ba.pdf"
    TR = {"Ο.Δ.Ε.": "Κατεύθυνση Οργάνωσης και Διοίκησης Επιχειρήσεων", "Μ.Δ.Λ.": "Κατεύθυνση Μάρκετινγκ και Διοίκησης Λειτουργιών"}
    ev = [(i, t, "h", x) for i, t, x in heads(p)] + [(i, t, "c", x) for i, t, _, x in cells(p, r"\d+\.")]
    rows, sem, kind, group = [], None, "core", None
    for _, _, typ, x in sorted(ev, key=lambda e: (e[0], e[1], e[2] == "c")):
        if typ == "h":
            if (m := re.match(r"(ΣΤ|[Α-ΗB])[΄’'] ?Εξάμηνο", x)): sem = hp.GREEK[m[1].replace("B", "Β")]
            elif x.startswith("ΥΠΟΧΡΕΩΤΙΚΑ ΜΑΘΗΜΑΤΑ ΚΟΡΜΟΥ"): kind, group = "core", None
            elif (m := re.match(r"ΥΠΟΧΡΕΩΤΙΚΑ ΜΑΘΗΜΑΤΑ ΚΑΤΕΥΘΥΝΣΗΣ (\S+)", x)): kind, group = "core", TR[m[1]]
            elif (m := re.match(r"ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ (ΣΤ|[Α-Η])΄ ?ΕΞΑΜΗΝΟΥ", x)): kind, group, sem = "elective", None, hp.GREEK[m[1]]
            continue
        name = re.sub(NOTE, "", x)
        if not name: continue
        greek = name.startswith("Ελληνική ως Ξένη Γλώσσα")
        k = "elective" if greek or name == "Πρακτική Άσκηση" or kind == "elective" else kind
        rows.append({"code": None, "name": name, "semester": sem, "kind": k, "group": group if k == "core" else None})
    save("uom", "uom-ba", "https://www.uom.gr/ba/programma-spoydon-akad-etoys-2026-2027", hp.finish(fixed(across(rows)), case))

# bso: two semesters side by side (left odd, right even), each course a title row and a teacher row; sections
# «Μαθήματα Υ υποχρεωτικά» (core), «ΥΕ υποχρ. επιλογής» / «Ε επιλογής» / methodology (elective), «ΞΓ Υποχρεωτικά
# Επιλογής» (the track's language, one of five), «ΞΓ Επιλογής» (a second language); «Εκτός προγράμματος» and the
# Erasmus Greek courses are not part of the programme
TEACHER = re.compile(r"^(?:[Α-ΩA-Z][α-ωa-zά-ώ]{0,2}\.\s?){1,2}\s?[Α-ΩA-Z]|^[Α-Ω] [Α-Ω]|Καθ|καθ|Ε\.\s?Ε\.\s?Π|ΕΔΙΠ|Ε\.ΔΙ\.Π|Διδ|"
                     r"Υπο?τρ|Υπότρ|Λέκτορας|ΕΣΠΑ|Δεν θα|Προς ανάθεση|Stoyanova|Nimigean|Πουλάκης|Γαζάλε|συνταξιούχος")
def bso():
    rows, sems, sec = [], (1, 2), [None, None]
    for _, t in hp.pdf_tabs("raw/uom/g-bso.pdf"):
        for r in t:
            if len(r) < 10:
                if len(r) == 2: break  # the old → new course correspondence tables at the end
                continue
            if r[0] and not any(r[1:]):  # a heading over both halves
                if (m := re.match(r"(\d)ο ΕΤΟΣ", r[0])): y = int(m[1]); sems = (2 * y - 1, 2 * y)
                sec = [r[0], r[0]] if re.match(r"Μαθήματα|Εκτός|Courses|Ο/Η", r[0]) and "Ο/Η" not in r[0][:3] else sec
                continue
            for half, (lab, title) in enumerate(((r[0], r[1]), (r[5], r[6]))):
                x = norm(title)
                if re.search(r"εξάμηνο$", lab): continue
                for s in (lab, x):
                    if re.match(r"Μαθήματα|ΚΟΙΝΑ ΜΑΘΗΜΑΤΑ|Εκτός προγράμματος|Courses in English", s): sec[half] = s
                if not x or re.match(r"Μαθήματα|ΚΟΙΝΑ ΜΑΘΗΜΑΤΑ|Πεδίο|Εκτός|Courses", x) or TEACHER.search(x): continue
                s = sec[half] or ""
                if re.match(r"Εκτός|Courses", s) or x.startswith(("Modern Greek", "Νέα Ελληνική γλώσσα ως ξένη")): continue
                core = re.search(r"Υ υποχρεωτικά", s)
                group = "Γλώσσα κατεύθυνσης" if "ΞΓ Υποχρεωτικά" in s or "1 από 5" in s and "γλώσσα" in x else \
                    "Δεύτερη γλώσσα" if "ΞΓ Επιλογής" in s else None
                name = re.sub(r"\s*\(?\d\s?\(?τμ\.?\)?|\s*\((?:σε 2 τμ|συνδ|Αγγλόφωνο|προαιρετική)[^)]*\)?|,? σε 2 μέρη|"
                              r"\s*συνδ/λία με τμ\. \S+", "", x)
                name = re.sub(r"(?:(?<=^)|(?<= ))((?:\S ){3,}\S+)", lambda m: m[1].replace(" ", ""), name)  # «Ο ι κ ο ν ο μίες»
                name = re.sub(r"^O(?=[ι-ω])", "Ο", re.sub(r"^T(?=[έα-ω])", "Τ", name)).strip(" ,")
                rows.append({"code": None, "name": name, "semester": sems[half], "kind": "core" if core else "elective",
                             "group": group})
    save("uom", "uom-balkan", "https://www.uom.gr/bso/programma-spoydon", hp.finish(fixed(rows), case))

# msa: compulsory tables «Υποχρεωτικά Κορμού / Κατεύθυνσης / Ειδίκευσης» with ECTS per semester in the last eight
# columns; a series «Χορωδία Ι-IV» over as many semesters becomes one course per semester. The «Πίνακας 1.x–3» lists
# (compulsory-elective per track / specialisation and free electives) give a range of semesters («Γ-Η») → no semester.
KAT = {"ΕΥΡΩΠ": "Ευρωπαϊκή (Κλασική) Μουσική", "ΒΥΖΑΝΤ": "Βυζαντινή Μουσική", "ΠΑΡΑΔΟΣ": "Ελληνική Παραδοσιακή (Δημοτική) Μουσική",
       "ΣΥΓΧΡΟΝ": "Σύγχρονη Μουσική"}
def msa():
    def clean(s): return norm(re.sub(r"\s*ΒΛ\.?\s?ΠΙΝ.*$|[¹*]", "", s))
    def roman(s): return s.replace("Ι", "I").replace("V", "V")
    rows, kat, eid, part = [], None, None, None
    for _, t in hp.pdf_tabs("raw/uom/g-msa.pdf", 3, 33):
        for r in t:
            first = norm(r[0])
            if first.startswith("Πίνακας 4") and len(r) > 1: break
            if re.fullmatch(r"\d+", first) and len(r) > 2 and r[1]:  # Πίνακας 1.2-3: Α/Α | title | …
                rows.append({"code": None, "name": clean(r[1]), "semester": None, "kind": "elective", "group": None, "keep": True})
            elif len(r) >= 12:  # compulsory tables
                if (m := re.match(r"(?:Κατεύθυνση|ΚΑΤΕΥΘΥΝΣΗ):?", first)):
                    kat = next(v for k, v in KAT.items() if k in hp.up(first)); continue
                if "Εφαρμοσμένες Μουσικές Σπουδές" in first: eid = "Εφαρμοσμένες Μουσικές Σπουδές – Μουσική Εκπαίδευση"; continue
                if re.match(r"Ειδ[ιί]κε[υύ]σ", first):
                    m = re.search(r"«(.+?)»", first); eid = case(m[1]) if m else first.rstrip(":"); continue
                if re.match(r"Υποχρεωτικά (?:Κ|K)ορμού", first): part = "Ειδίκευση " + eid; continue
                if re.match(r"(?:Υποχρεωτικά|ΥΠΟΧΡΕΩΤΙΚΑ) (?:Κατεύθυνσης|ΚΑΤΕΥΘΥΝΣΗΣ)", first): part = "Κατεύθυνση " + kat; continue
                if re.match(r"(?:Υποχρεωτικά|ΥΠΟΧΡΕΩΤΙΚΑ) (?:Ειδ|ΕΙΔ)", first) and not re.search(r"Επιλογής", first):
                    if r[1] == "Διδάσκοντες": part = "Ειδίκευση " + eid
                    continue
                sems = [i + 1 for i, c in enumerate(r[-8:]) if re.fullmatch(r"\d+", c or "")]
                if not sems or not part or re.match(r"Σύνολο|ΣΥΝΟΛΟ|Υποχρεωτικά|Ελεύθερης|Μαθήματα", first) or r[1] == "Διδάσκοντες":
                    continue
                name = clean(first)
                if not name: continue
                m = re.search(r" ([IVΙ]+)-([IVΙ]+)$", name)
                lo, hi = (ROMAN.index(roman(m[1])), ROMAN.index(roman(m[2]))) if m and roman(m[1]) in ROMAN and roman(m[2]) in ROMAN else (0, -1)
                if m and hi - lo + 1 == len(sems):
                    for n, s in zip(ROMAN[lo:hi + 1], sems):
                        rows.append({"code": None, "name": f"{name[:m.start()]} {n}", "semester": s, "kind": "core", "group": part})
                else:
                    rows.append({"code": None, "name": name, "semester": sems[0], "kind": "core", "group": part})
            elif len(r) == 6 and r[1] and not first.startswith(("Πίνακας", "Προσφερόμενα", "Τα μαθήματα")):  # Πίνακας 1.1
                rows.append({"code": None, "name": clean(first), "semester": None, "kind": "elective",
                             "group": "Καλλιτεχνικό αντικείμενο", "keep": True})
    core = [r for r in rows if r["kind"] == "core"]
    for r in core: r["kind"] = "track_core"
    save("uom", "uom-music", "https://www.uom.gr/msa/programma-spoydon", hp.finish(fixed(rows), case))

dai(); ies(); eco(); ba(); bso(); msa()
for d, site in (("uom-esp", "esp"), ("uom-acc", "fin")):
    missing("uom", d, [f"https://www.uom.gr/{site}/programma-spoydon"],
            "the site answers with a JavaScript firewall challenge page (not bypassed)")
