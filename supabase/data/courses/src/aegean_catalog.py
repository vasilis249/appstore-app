# Πανεπιστήμιο Αιγαίου: each department's programme from its own site (aegean.gr department pages link them; WordPress,
# Joomla, Drupal — pages a theme renders client-side are read from /wp-json/wp/v2/pages?slug=). Fetch into raw/aegean/
# (browser user agent; names below). The Universis catalogue (uni-extapi.aegean.gr) needs a login, so it is not used.
import re
import html as h
import html_programme as hp
from html_tables import tables
from pdftext import pages
from lib import save, missing, recaser, norm, fold as lfold

HAND = "διεικονικότητα προανάγνωση πολυγραμματισμοί πολύγλωσσα βιντεοπαρατήρησης ελληνόγλωσσο"
case = recaser([], hand={**{lfold(w).strip(): w for w in HAND.split()}, lfold("ΕΝΝΗΝΟΓΛΩΣΣΟ").strip(): "ελληνόγλωσσο"})  # typo in the source
MED_TRACKS = {"ΔΙΕΘΝΩΝ ΣΧΕΣΕΩΝ & ΟΡΓΑΝΙΣΜΩΝ": "Διεθνών Σχέσεων & Οργανισμών", "ΑΡΧΑΙΟΛΟΓΙΑΣ": "Αρχαιολογίας",
              "ΓΛΩΣΣΟΛΟΓΙΑΣ ΤΗΣ ΝΑ ΜΕΣΟΓΕΙΟΥ": "Γλωσσολογίας της ΝΑ Μεσογείου"}

def html(f, keep=4): return tables(f"raw/aegean/{f}.html", keep)
def lines(f, a=0, b=None): return "\n".join(pages(f"raw/aegean/{f}.pdf")[a:b]).split("\n")
def text(x): return norm(h.unescape(re.sub(r"<[^>]+>", " ", x)))
def done(dept, src, rows, note=None):
    first, out = {}, []
    for r in rows:  # a course listed again in a later semester keeps its first one
        r["name"] = norm(re.sub(r"\s*\((?:\*|προαιρετικ\w*)\)|\*+$|\s+-\s+ΔΕΝ ΠΡΟΣΦΕΡΕΤΑΙ.*$|\s*\(ΔΕΝ ΠΡΟΣΦΕΡΕΤΑΙ.*$", "", r["name"]))
        k = r["name"].lower()
        if first.setdefault(k, r["semester"]) != r["semester"] or sum(map(str.isalpha, r["name"])) < 4: continue
        if r["semester"] is None: r["keep"] = True
        out.append(r)
    save("aegean", f"aegean-{dept}", src, hp.finish(out, case), note)

def kind_of(s):
    t = hp.up(s)
    if "ΚΑΤ" in t and "ΕΠΙΛΟΓ" in t and "ΚΑΤΕΥΘΥΝΣ" in t: return "track_core" if t.startswith("ΥΠΟΧΡΕΩΤΙΚΟ ΕΠΙΛΟΓΗΣ ΚΑΤ") else "elective"
    if re.search(r"ΕΠΙΛΟΓ|ΕΠΙΛΕΓ|ΠΡΟΑΙΡΕΤ|ΚΥΚΛΟΣ", t): return "elective"
    if re.search(r"ΥΠΟΧΡΕΩΤ|ΠΡΑΚΤΙΚΗ|ΠΡΟΠΑΡΑΣΚ", t): return "core"
    return None

# icsd: one card per semester («Εξάμηνο 1»), one table per type («Υποχρεωτικό», «Επιλογής») or cycle («Κύκλος: X» = its electives)
def icsd():
    rows, sem = [], None
    for head, t in html("p-icsd"):
        for l in head.split("\n"):
            if (m := re.search(r"Εξάμηνο (\d+)$", l)): sem = int(m[1])
        last = head.split("\n")[-1]
        group = "Κύκλος " + last.split(":", 1)[1].strip() if last.startswith("Κύκλος:") else None
        kind = "elective" if group else kind_of(last) or "core"
        rows += [{"code": r[0], "name": r[1], "semester": sem, "kind": kind, "group": group} for r in t[1:] if len(r) > 1 and r[1]]
    done("icsd", "https://www.icsd.aegean.gr/upg-lessons?lang=el", rows)

# syros: one table per semester («Εξάμηνο: 07») with an «Είδος» column: Υ, ΠΡ, ΕΕ, ΥΕΚ1-3 (κατεύθυνση 1-3)
def syros():
    rows = []
    for head, t in html("p-syros"):
        sem = int(m[1]) if (m := re.search(r"Εξάμηνο: (\d+)", head)) else None
        for r in t[1:]:
            if len(r) < 3 or not r[1]: continue
            g = f"Κατεύθυνση {m[1]}" if (m := re.search(r"Κατεύθυνσης (\d)", r[2])) else None
            rows.append({"code": r[0], "name": r[1], "semester": sem, "kind": "track_core" if g else kind_of(r[2]) or "core", "group": g})
    done("syros", "https://www.syros.aegean.gr/el/spoydes/proptychiakes-spoydes/courses", rows)

# primedu: tables per semester + winter / spring electives; the fourth column says «ΥΠΟΧΡΕΩΤΙΚΟ 2ο ΕΞΑΜΗΝΟ»,
# «Κατ' Επιλογήν ΥΠΟΧΡΕΩΤΙΚΟ 5ο ΕΞΑΜΗΝΟ», «ΠΡΑΚΤΙΚΗ 7ο ΕΞΑΜΗΝΟ» or «Επιλεγόμενο Χειμερινό Τομέας Δ»
def primedu():
    rows = []
    for head, t in html("p-primedu", 1):
        for r in t[1:]:
            if len(r) < 4 or not r[1]: continue
            g = "Τομέας " + m[1] if (m := re.search(r"Τομέας (\S+)", r[3])) else None
            rows.append({"code": r[0], "name": r[1], "semester": hp.semester_of(r[3]) or (None if g else hp.semester_of(head)),
                         "kind": "elective" if g or "Επιλογήν" in r[3] else "core", "group": g})
    done("primedu", "https://www.pre.aegean.gr/courses_el/", rows)

# marine: «Α' Εξάμηνο Σπουδών» then a «Υποχρεωτικά» and an «Επιλογής» table; notes «- ΔΕΝ ΠΡΟΣΦΕΡΕΤΑΙ ΤΟ 2026-2027» dropped
def marine():
    rows, sem = [], None
    for head, t in html("p-marine"):
        for l in head.split("\n"):
            if (s := hp.semester_of(l)) is not None: sem = s
        if head.endswith("Σύνοψη"): continue
        kind = kind_of(head.split("\n")[-1]) or "core"
        rows += [{"code": r[0], "name": r[1], "semester": sem, "kind": kind} for r in t[1:] if len(r) > 1 and r[1]]
    done("marine", "https://mar.aegean.gr/studies/undergraduate-program/undergraduate-lessons/", rows)

# env: guide 2025-26 §4.2, lines «n Name CODE ΔΜ ECTS hours» under «ΕΞΑΜΗΝΟ Α»; code …Υ = compulsory, …ΚΕΥ = κατ' επιλογήν
# υποχρεωτικό; a long title wraps around its code line
def env():
    rows, sem, pend = [], None, None
    code = r"((?:ΕΥΟ?)?\d{3,4} ?(?:ΚΕΥ|Y|Υ)?)\s+\d+\s+\d+\s+(?:\S+|-)$"
    for l in lines("g-env", 29, 33):
        if re.match(r"ΕΞΑΜΗΝΟ (ΣΤ|[Α-Θ])$", l): sem, pend = hp.semester_of(l), None; continue
        if re.match(r"\*|α/α|ΧΕΙΜΕΡΙΝΟ|ΕΑΡΙΝΟ|ΜΑΘΗΜΑΤΑ|\d+$", l) or sem is None: continue
        if (m := re.match(r"(?:\d+ )?(.*?)\s*" + code, l)):
            name, c = m[1], m[2].replace(" ", "")
            if not name: name, pend = pend or "", "wrap"
            rows.append({"code": c, "name": name, "semester": sem,
                         "kind": "core" if c.endswith(("Y", "Υ")) and not c.endswith("ΚΕΥ") else "elective"})
            if pend != "wrap": pend = None
        elif pend == "wrap": rows[-1]["name"] += " " + l; pend = None
        else: pend = re.sub(r"^\d+ ", "", l)
    done("env", "https://www.env.aegean.gr/wp-content/uploads/2025/12/ΟΔΗΓΟΣ-ΣΠΟΥΔΩΝ-2025-2026.pdf", rows)

# geo: «Ενδεικτικό Πρόγραμμα Σπουδών από 2020-2021» (pps/index.php?content=15): one column per semester; a cell holds
# a compulsory course (a link) or a group heading (plain text: «ΦΥΣΙΚΗ ΓΕΩΓΡΑΦΙΑ ΚΑΙ ΠΕΡΙΒΑΛΛΟΝ», «ΠΡΟΑΙΡΕΤΙΚΑ») and the
# links under it = the group's κατ' επιλογήν courses; titles in capitals → the course list (content=3) gives them in
# lower case by code (geoNNN.pdf = ΓΕΩ NNN)
def geo():
    names = {r[2].replace(" ", ""): r[1] for _, t in html("geo-c3", 1) for r in t if len(r) > 2 and r[2].startswith("ΓΕΩ")}
    groups = {hp.up(a.split(":", 1)[1].strip()): a for a, _ in html("geo-c3", 1) if a.startswith("Ομάδα")}  # «Ομάδα 1: …»
    s = open("raw/aegean/p-geo2.html", encoding="utf-8").read()
    t = re.findall(r"(?is)<table.*?</table>", s)[1]
    rows, cols = [], {}
    for tr in re.findall(r"(?is)<tr.*?</tr>", t):
        tds = re.findall(r"(?is)<td[^>]*>(.*?)</td>", tr)
        sems = [hp.semester_of(text(td)) for td in tds]
        if any(sems): cols = dict(enumerate(sems)); continue
        for i, td in enumerate(tds):
            group = None
            for m in re.finditer(r"(?is)<a[^>]*href=\"[^\"]*?(?:geo(\d+))?\.pdf\"[^>]*>(.*?)</a>|<[^>]*>|([^<>]+)", td):
                if m[2] is None:
                    if m[3] and (x := norm(h.unescape(m[3]))): group = x
                    continue
                name = names.get(f"ΓΕΩ{m[1]}") or text(m[2])
                g = group and groups.get(hp.up(group))
                rows.append({"code": m[1] and f"ΓΕΩ {m[1]}", "name": name, "semester": cols.get(i),
                             "kind": "elective" if group else "core", "group": g or None})
    done("geo", "https://geography.aegean.gr/pps/index.php?content=15", rows)

def flat(f):  # the page's text nodes in order
    s = re.sub(r"(?is)<script.*?</script>|<style.*?</style>|<svg.*?</svg>", "", open(f"raw/aegean/{f}.html", encoding="utf-8").read())
    return [x for x in (norm(h.unescape(y)) for y in re.split(r"<[^>]+>", s)) if x]
def fold(s): return re.sub(r"[^Α-ΩA-Z0-9]", "", hp.up(s.replace("&", "και")))

# ba: «Μαθήματα Κορμού» by semester, six «Ειδικεύσεις» (heading row + their ΚΕΥ courses, winter | spring), free electives
def ba():
    rows, sem, track = [], None, None
    core, spec, free = (t for _, t in html("p-ba", 1)[:3])
    for r in core[1:]:
        if (s := hp.semester_of(r[0])) is not None: sem = s
        else: rows.append({"code": None, "name": r[0], "semester": sem, "kind": "core"})
    for r in spec[2:]:
        if len(r) == 1: track = "Ειδίκευση " + case(r[0]); continue
        rows += [{"code": None, "name": x, "semester": None, "kind": "track_core", "group": track} for x in r if x]
    for r in free[2:]:
        rows += [{"code": None, "name": x.replace("*", ""), "semester": None, "kind": "elective"} for x in r if x]
    done("ba", "https://www.ba.aegean.gr/el/spoudes/proptyxiakes-spoudes/πρόγραμμα-σπουδών", rows)

# soc: one block per course: title, code, «Εξάμηνο:Α'», «Υποχρεωτικό» | «Επιλογής»; «[Σεμινάριο]» labels dropped
def soc():
    t, rows = flat("p-soc"), []
    for i, x in enumerate(t):
        if (m := re.fullmatch(r"Εξάμηνο:(ΣΤ|[Α-Η])'", x)):
            rows.append({"code": t[i - 1], "name": re.sub(r"\s*\[[^\]]*\]$", "", t[i - 2]), "semester": hp.GREEK[m[1]],
                         "kind": kind_of(t[i + 1]) or "core"})
    done("soc", "https://soc.aegean.gr/programma-spoudon/", rows)

# anthro: two programmes (ΠΠΣ Κοινωνική Ανθρωπολογία και Ιστορία, ΠΠΣ Σπουδές Φύλου), each «ΠΡΩΤΟΣ ΚΥΚΛΟΣ» = compulsory,
# «ΔΕΥΤΕΡΟΣ ΚΥΚΛΟΣ» = the electives offered, «Α' Εξάμηνο …» headings, courses «ΚΑ-100 Title» (teacher lines between)
def anthro():
    rows = []
    for f, prog in (("p-anthro", "ΠΠΣ Κοινωνική Ανθρωπολογία και Ιστορία"), ("p-anthro2", "ΠΠΣ Σπουδές Φύλου")):
        t = flat(f)
        sem, kind = None, "track_core"
        for x in t[t.index("ΠΡΩΤΟΣ ΚΥΚΛΟΣ ΣΠΟΥΔΩΝ"):]:
            if x.startswith("ΕΠΙΚΟΙΝΩΝΙΑ ΜΕ ΓΡΑΜΜΑΤΕΙΑ"): break
            if x == "ΔΕΥΤΕΡΟΣ ΚΥΚΛΟΣ ΣΠΟΥΔΩΝ": kind = "elective"
            elif (m := re.match(r"(ΣΤ|[Α-Η])' Εξάμηνο", x)): sem = hp.GREEK[m[1]]
            elif (m := re.fullmatch(r"([A-ZΑ-Ω]{1,4}(?:/[A-ZΑ-Ω])?-\d{2,3}) (.+)", x)):
                rows.append({"code": m[1], "name": m[2], "semester": sem, "kind": kind, "group": prog})
    done("anthro", "https://www.sah.aegean.gr/proptychiakes-spoudes/", rows)

# med: indicative programme 2026-27: semesters 1-4 common, 5-8 once per «ΚΑΤΕΥΘΥΝΣΗ»; blocks «Υποχρεωτικά», «Επιλογής»,
# «Μαθήματα Ξένων Γλωσσών», «ΕΛΕΥΘΕΡΗΣ ΕΠΙΛΟΓΗΣ … ΠΑΙΔΑΓΩΓΙΚΗ …» (other departments' courses, «– ΤΕΠΑΕΣ* (ΟΜΑΔΑ Α)» dropped)
def med():
    rows, sem, track, kind = [], None, None, "core"
    for _, t in html("p-med", 1):
        for r in t:
            x = r[0]
            if len(r) == 1 and (s := hp.semester_of(x)) is not None: sem, kind = s, "core"
            elif x.startswith("ΚΑΤΕΥΘΥΝΣΗ"): track = "Κατεύθυνση " + MED_TRACKS[x.split(" ", 1)[1]]
            elif len(r) == 1 and "ΕΛΕΥΘΕΡΗΣ ΕΠΙΛΟΓΗΣ" in x: kind = "elective"
            elif r[1:2] == ["Διδακτικές Μονάδες"]: kind = ("track_core" if track else "core") if x == "Υποχρεωτικά" else "elective"
            elif len(r) > 1 and (m := re.match(r"([A-ZΑ-Ω]{1,4}-?\d{1,4}|ΠΑ[ΓΔΑΒ])\s*(.+)", x)):
                name = re.sub(r"\s*[–-]\s*(?:ΤΕΠΑΕΣ|ΠΤΔΕ|ΤΜΣ)\s*\*.*$|\s*\((?:ΠΤΔΕ|ΤΜΣ|ΤΕΠΑΕΣ)\)$|\*$", "", m[2])
                rows.append({"code": m[1], "name": name, "semester": sem, "kind": kind, "group": track if kind != "core" else None})
    done("med", "https://dms.aegean.gr/πρόγραμμα-σπουδών-2026-2027/", rows)

# ship: the course list (WordPress loop, 5 pages: title + «Γ' Εξάμηνο»); compulsory vs elective from the 2026-27 guide's
# new programme (pp. 35-36, two columns): «1. Title» = compulsory, «- Title» = one of the electives
def ship():
    items = []
    for n in ["", "-2", "-3", "-4", "-5"]:
        s = open(f"raw/aegean/p-ship{n}.html", encoding="utf-8").read()
        items += re.findall(r'elementor-heading-title elementor-size-default">([^<]+)</h2>.*?'
                            r'elementor-heading-title elementor-size-default">([^<]+)</p>', s, re.S)
    core, el = set(), set()
    for l in lines("g-ship", 34, 36):
        core |= {fold(x)[:14] for x in re.findall(r"(?:^|\s)\d+(?:,\d+)?\.\s+(.+?)(?=\s+\d+(?:,\d+)?\.\s|\s+-\s|$)", l)}
        el |= {fold(x)[:14] for x in re.findall(r"(?:^|\s)-\s+(.+?)(?=\s+-\s|\s+\d+(?:,\d+)?\.\s|$)", l)}
    rows = []
    for name, s in items:
        name, sem, k = h.unescape(name), hp.semester_of(h.unescape(s)), fold(h.unescape(name))[:14]
        kind = "core" if k in core or name.startswith("Εργαστήρι") else "elective" if k in el or (sem or 0) >= 5 else "core"
        rows.append({"code": None, "name": name, "semester": sem, "kind": kind})
    done("ship", "https://www.stt.aegean.gr/genikes-plirofories/mathimata/", rows)

# ct: the course list by semester (codes + titles in capitals); Υ / ΥΕ from the 2026-27 indicative programme PDF by code
def ct():
    cat = {}
    for _, t in hp.pdf_tabs("raw/aegean/g-ct.pdf"):
        for r in t:
            cs = [c.strip() for c in r]
            for i, c in enumerate(cs):
                if re.fullmatch(r"[Α-ΩA-Z0-9]{2,6} ?\d{3}[Α-Ω]?|ΘΠΑ", c):
                    if (k := next((x for x in cs[i + 1:] if re.fullmatch(r"Υ|ΥΕ|Ε", x)), None)): cat.setdefault(c.replace(" ", ""), k)
                    break
    t, rows, sem = flat("p-ct"), [], None
    t = t[t.index("Α Έτος – 1ο Εξάμηνο"):]
    for i, x in enumerate(t):
        if x.startswith("Στο ΠΠΣ για τους εισαχθέντες"): break
        if (m := re.search(r"– (\d+)ο Εξάμηνο", x)): sem = int(m[1])
        elif re.fullmatch(r"[Α-ΩA-Z0-9]{2,6} ?\d{3}[Α-Ω]?|ΘΠΑ|4ΕΤΔΕ", x) and i + 1 < len(t):
            rows.append({"code": x, "name": t[i + 1], "semester": sem, "kind": "core" if cat.get(x.replace(" ", "")) == "Υ" else "elective"})
    done("ct", "https://ct.aegean.gr/undergraduate-programme", rows)

# preedu: guide 2026-27 §2.2: one table per semester with blocks «Υποχρεωτικά», «Υποχρεωτικά Επιλογής», «Πρακτικής Άσκησης»,
# «Ειδικά Μαθήματα», «Προαιρετικά»; titles in capitals followed by notes («Προαπαιτούμενο …»); tables 9-10 = the
# κατ' επιλογήν υποχρεωτικά and research courses offered (several semesters → none)
def preedu():
    rows, sem, kind = [], None, "core"
    for _, t in hp.pdf_tabs("raw/aegean/g-preedu.pdf", 34, 42):
        for r in t:
            cs = [c.strip() for c in r]
            x = cs[0]
            if x and not any(cs[1:]):
                if (s := hp.semester_of(x)) is not None: sem, kind = s, "core"
                elif not x.startswith(("Σύνολα", "Προπτυχιακές")):
                    kind = "core" if x in ("Υποχρεωτικά", "Ειδικά Μαθήματα", "Πρακτικής Άσκησης") else "elective"
            elif re.fullmatch(r"\d+", x) and len(cs) > 2 and re.fullmatch(r"[Α-Ω]{2,3}\d{3}", cs[1]) and sem:
                rows.append({"code": cs[1], "name": re.sub(r"\s+\S*[a-zα-ωά-ώ].*$|\s*[–-]$", "", cs[2]), "semester": sem, "kind": kind})
            elif (i := next((i for i, c in enumerate(cs) if re.fullmatch(r"(?:ΥΕ|ΕΡΕ)[Α-Ε]\d{3}", c)), None)) is not None:
                rows.append({"code": cs[i], "name": cs[i + 1], "semester": None, "kind": "elective"})
    done("preedu", "https://www.pse.aegean.gr/wp-content/uploads/2026-2027_ΤΕΠΑΕΣ_Οδηγός_Σπουδών-1.pdf", rows)

# fme: the course list by semester (/el/courses, a table per «Εξάμηνο: N»); the kind from the 2026-27 programme PDF:
# before «Κατεύθυνση I» compulsory (except «4.1 / 4.2 …» = Υποχρεωτική Επιλογή 1 από 2), then per track «Υποχρεωτικά
# Μαθήματα Κατεύθυνσης» / «Μαθήματα Επιλογής Κατεύθυνσης», then «Μαθήματα Γενικής Επιλογής»
def fme():
    seen = []  # (folded line, state)
    state = ("core", None)
    for l in lines("g-fme"):
        if (m := re.match(r"Κατεύθυνση (I+): (.+)", l)): state = ("track_core", f"Κατεύθυνση {m[1]}: {m[2].strip()}")
        elif "Μαθήματα Επιλογής Κατεύθυνσης" in l and state[1]: state = ("elective", state[1])
        elif l.startswith("Μαθήματα Γενικής Επιλογής"): state = ("elective", None)
        seen.append((l, state))
    s = open("raw/aegean/p-fme.html", encoding="utf-8").read()
    rows = []
    for tm in re.finditer(r"(?is)<table.*?</table>", s):
        sem = int(re.search(r"Εξάμηνο: (\d+)", tm[0])[1])
        for a in re.findall(r'(?s)views-field-title">.*?<a [^>]*>(.*?)</a>', tm[0]):
            name, k, hits = text(a), fold(text(a))[:14], []
            for l, st in seen:
                if k in fold(l):
                    choice = st[0] == "core" and re.search(r"\d\.\d\s*" + re.escape(name[:8]), l)
                    hits.append(("elective", None) if choice else st)
            kind = hits[0][0] if hits else "core" if sem <= 6 else "elective"
            groups = sorted({g for kd, g in hits if g and kd == kind})
            for g in groups or [None]:
                rows.append({"code": None, "name": name, "semester": sem, "kind": kind if g or kind != "track_core" else "core", "group": g})
    done("fme", "http://www.fme.aegean.gr/el/courses", rows)

# math: guide 2026-27 §4.3: «4.3.1 Πρώτο Εξάμηνο», lines «311-0010 Title Υ|ΚΕΥ|Π hours ECTS»; a long title wraps around
# its code line (the line before + the line after)
def math():
    rows, sem, prev, wrap = [], None, "", False
    for l in lines("g-math", 23, 32):
        if l.startswith("4.4"): break
        if (m := re.match(r"4\.3\.\d+ (\S+ Εξάμηνο)", l)): sem = hp.semester_of(m[1]); continue
        if (m := re.match(r"(311-\d{4}) ?(.*?) ?(Υ|ΚΕΥ|KEY|Π)(?: [\d.,]+)+$", l)):
            wrap = not m[2]
            rows.append({"code": m[1], "name": m[2] or prev, "semester": sem, "kind": "core" if m[3] == "Υ" else "elective"})
        elif wrap: rows[-1]["name"] += " " + l; wrap = False
        else: prev = l
    done("math", "https://www.math.aegean.gr/images/articles/undergraduate_math/studyguide_math.pdf", rows)

# stat: guide 2026-27 §3.11 tables: «1ο ΕΞΑΜΗΝΟ (χειμερινό)», rows code | «Greek title - English title» | [-Υ-] / [-ΚΕΥ-] / [-Ε-]
def stat():
    rows, sem = [], None
    for _, t in hp.pdf_tabs("raw/aegean/g-stat.pdf", 19, 27):
        for r in t:
            cs = [c.strip() for c in r if c.strip()]
            if cs and (s := hp.semester_of(cs[0])) is not None and len(cs) == 1: sem = s
            elif cs and re.match(r"331-\d{4}", cs[0]) and len(cs) > 2:
                name = re.split(r"\s[-–]\s(?=[A-Z])", cs[1])[0]
                name = re.sub(r"\s+[A-Z][a-z]+(?:\s+[A-Za-z]+)+$", "", name)  # English title without a dash
                kind = "core" if re.search(r"\[-\s*Υ\s*-\]", cs[2]) else "elective"
                rows.append({"code": cs[0][:8], "name": name, "semester": sem, "kind": kind})
    done("stat", "https://www.actuar.aegean.gr/images/articles/undergraduate_saxm/studyguide_gr.pdf", rows)

# food: guide 2026-27 appendix: a table per semester (code, «Greek title (Θ+Ε)/ English title», Υ | ΚΕΥ); the semester
# headings «Β’ ΕΞΑΜΗΝΟ» are in the page text, so each code takes the heading above it there
def food():
    sem_of, sem = {}, None
    for l in lines("g-food", 43, 53):
        if "ΕΞΑΜΗΝΟ" in l and (s := hp.semester_of(l)): sem = s
        elif (m := re.match(r"(\d{4}) ", l)) and sem: sem_of.setdefault(m[1], sem)
    rows, sem = [], None
    for _, t in hp.pdf_tabs("raw/aegean/g-food.pdf", 43, 53):
        for r in t:
            cs = [c.strip() for c in r]
            if not (k := next((c for c in cs if re.fullmatch(r"Υ|ΚΕΥ", c)), None)): continue
            sem = sem_of.get(cs[0], sem)
            name = re.split(r"\s*\((?:Θ|ΠΕ)|\s*/", next(c for c in cs[1:] if c))[0]
            rows.append({"code": cs[0] if cs[0] != "-" else None, "name": name, "semester": sem, "kind": "core" if k == "Υ" else "elective"})
    done("food", "https://www.fns.aegean.gr/Spoudes/Proptixiakes_Spoudes/Programma_Spoudon", rows)

icsd(); syros(); primedu(); marine(); env(); geo()
ba(); soc(); anthro(); med(); ship(); ct(); preedu(); fme(); math(); stat(); food()
missing("aegean", "aegean-tourism", ["https://tourem.aegean.gr/el/studies/undergraduate-studies/curriculum",
        "https://tourem.aegean.gr/docs/Οδηγός_Σπουδών_2024-2025.pdf"],
        "the programme page shows only the 1st semester (the other panels are empty) and the study guides return 404")
