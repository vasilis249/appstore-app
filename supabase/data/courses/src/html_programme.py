# Programme tables (HTML or PDF) laid out by semester → course rows for lib.save().
# Semester / track / section come from the text above a table, a header row or a one-cell row ("3ο Εξάμηνο",
# "Κατεύθυνση X", "Μαθήματα Επιλογής"); columns from the header row (μάθημα / τίτλος, κωδ, είδος / κατηγορία / τύπος).
import re, unicodedata
from lib import norm

GREEK = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8, "Θ": 9, "Ι": 10}
WORDS = {"ΠΡΩΤΟ": 1, "ΔΕΥΤΕΡΟ": 2, "ΤΡΙΤΟ": 3, "ΤΕΤΑΡΤΟ": 4, "ΠΕΜΠΤΟ": 5, "ΕΚΤΟ": 6, "ΕΒΔΟΜΟ": 7, "ΟΓΔΟΟ": 8,
         "ΕΝΑΤΟ": 9, "ΔΕΚΑΤΟ": 10}
LATIN = str.maketrans("ABEZHIKMNOPTYXΆΈΉΊΌΎΏ", "ΑΒΕΖΗΙΚΜΝΟΡΤΥΧΑΕΗΙΟΥΩ")

def up(s):
    s = "".join(ch for ch in unicodedata.normalize("NFD", s) if not unicodedata.combining(ch))
    return s.upper().translate(LATIN)

SEM = r"ΕΞΑΜΗΝ(?:Ο|ΟΥ)(?![Α-Ω])"  # singular only: "Α’- ΣΤ’ εξάμηνα" is prose

def semester_of(text):
    """the semester a heading names; None for prose ("(5ο και 6ο εξάμηνο).", "Στα Α’- ΣΤ’ εξάμηνα")"""
    if text[:1].islower() or re.search(r"\d\s*ο\s+(?:και|ή|-|–)\s+\d+\s*ο", text): return None
    t = up(text)
    if m := re.search(r"(?<!\d)(\d{1,2})\s*(?:Ο|ΟΥ|ΤΟ|Η|ΗΣ)?\s*\.?\s*" + SEM, t): return int(m[1])
    if m := re.search(r"ΕΞΑΜΗΝΟ\s*(\d{1,2})(?![\d-])", t): return int(m[1])
    if m := re.search(r"ΕΞΑΜΗΝΟ\s*(ΣΤ|[ΑΒΓΔΕΖΗΘΙ])['’΄`]?(?![Α-Ω])", t): return GREEK[m[1]]
    if m := re.search(r"(?<![Α-Ω])(ΣΤ|[ΑΒΓΔΕΖΗΘΙ])\s*['’΄`]?\s*" + SEM, t): return GREEK[m[1]]
    if m := re.search(r"(ΠΡΩΤΟ|ΔΕΥΤΕΡΟ|ΤΡΙΤΟ|ΤΕΤΑΡΤΟ|ΠΕΜΠΤΟ|ΕΚΤΟ|ΕΒΔΟΜΟ|ΟΓΔΟΟ|ΕΝΑΤΟ|ΔΕΚΑΤΟ)\s*" + SEM, t): return WORDS[m[1]]
    return None

WORD = {"ΚΑΤΕΥΘΥΝΣΗ": "Κατεύθυνση", "ΕΙΔΙΚΕΥΣΗ": "Ειδίκευση", "ΡΟΗ": "Ροή"}
def track_of(text):
    text = unicodedata.normalize("NFC", text)
    u = up(text)  # same length as text (NFC): find in folded capitals, cut from the original
    if m := re.search(r"(\d)\s*(?:Η|ΗΣ)\s+(ΚΑΤΕΥΘΥΝΣΗ|ΡΟΗ)(?![Α-Ω])", u): return f"{WORD[m[2]]} {m[1]}"
    m = re.search(r"(ΚΑΤΕΥΘΥΝΣΗ|ΕΙΔΙΚΕΥΣΗ|ΡΟΗ)(?![Α-Ω])\s*[:–-]?\s*(.+)", u)
    if not m: return None
    t = norm(re.sub(r"\(.*", "", text[m.start(2):])).strip(" :–-«»\"")
    return f"{WORD[m[1]]} {t}" if t else None

# a slot in the programme, not a course: «Μάθημα Επιλογής Κατεύθυνσης», «Κατ΄ Επιλογήν Υποχρεωτικό Μάθημα», «Επιλογή 3»
PLACEHOLDER = r"(?:\d+\s*)?(?:ΜΑΘΗΜΑ(?:ΤΑ)?\s+(?:ΓΕΝΙΚΗΣ\s+|ΕΛΕΥΘΕΡΗΣ\s+)?ΕΠΙΛΟΓΗΣ(?:\s+ΚΑΤΕΥΘΥΝΣΗΣ)?|ΚΑΤ.?\s*ΕΠΙΛΟΓΗΝ\s+ΥΠΟΧΡΕΩΤΙΚΟ\s+ΜΑΘΗΜΑ|ΕΠΙΛΟΓΗ\s*\d*\*?|ΜΑΘΗΜΑ\s+ΕΠΙΛΟΓΗΣ\s*\d*)(?:\s+Η\s+ΠΤΥΧΙΑΚΗ(?:\s+ΕΡΓΑΣΙΑ)?)?(?:\s+\d+)?"
HEAD = (r"(?:ΜΑΘΗΜΑ|ΜΑΘΗΜΑΤΑ|ΤΙΤΛΟΣ|ΟΝΟΜΑΣΙΑ)(?: ΜΑΘΗΜΑΤΟΣ| ΜΑΘΗΜΑΤΩΝ)?|ΜΑΘΗΜΑΤΑ \d.*|ΜΑΘΗΜΑΤΑ .*ΕΞΑΜΗΝΟΥ|ΤΙΤΛΟΣ .*"
        r"|(?:ΥΠΟΧΡΕΩΤΙΚΑ|ΕΠΙΛΕΓΟΜΕΝΑ|ΚΑΤ.{0,3}ΕΠΙΛΟΓΗΝ ΥΠΟΧΡΕΩΤΙΚΑ)\s+ΜΑΘΗΜΑΤΑ.*|ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ.*")  # header cells
TYPE = re.compile(r"(?:[ΥΕΓΚΠΟΗΑΤΧΣΔ]{1,5}\d?|ΥΕΚ\d|Ε\.?Ε\.?|Υ\.?Ε\.?|Ε/Υ|Υ/Ε|ΠΑ)")

def default_kind(t, section):
    """t = the course's type code (folded), section = 'core' | 'elective' | None from the last marker row."""
    if section == "elective": return "elective"  # «Μαθήματα Επιλογής (2 από 3)» above rows still typed Υ
    if t:
        t = t.split()[-1] if " " in t else t  # "ς ΥΚ" (a broken cell) → ΥΚ
        if t.startswith("ΥΠΟΧΡ"): return "elective" if "ΕΠΙΛΟΓ" in t else "track_core" if "ΚΑΤΕΥΘ" in t else "core"
        if "ΕΠΙΛΟΓ" in t or "ΠΡΟΑΙΡ" in t: return "elective"
        if re.fullmatch(r"Υ\.?Κ\d?|ΥΚΑΤ|Υ\.?Ε\.?Κ\d?", t) and not t.startswith("ΥΕΚ"): return "track_core"
        if "Ε" in t.replace("ΓΕΝ", "") or t.startswith(("ΠΡΟ", "ΠΑ", "ΕΛ")): return "elective"
        if t.startswith(("Υ", "ΓΥ", "ΕΥ", "ΚΥ", "ΓΚ")): return "core"
    return section or "core"

NUM = {"ΕΝΑ": 1, "ΔΥΟ": 2, "ΤΡΙΑ": 3, "ΤΕΣΣΕΡΑ": 4, "ΠΕΝΤΕ": 5, "ΕΞΙ": 6}
def scope_of(text):
    """«Υποχρεωτικό Επιλογής: Ένα από τα Δύο» → 2: the marker covers only the next N courses"""
    if m := re.search(r"(?:\d+|ΕΝΑ|ΔΥΟ|ΤΡΙΑ|ΤΕΣΣΕΡΑ)\s+ΑΠΟ\s+(?:ΤΑ\s+)?(\d+|ΔΥΟ|ΤΡΙΑ|ΤΕΣΣΕΡΑ|ΠΕΝΤΕ|ΕΞΙ)(?![Α-Ω\d])", up(text)):
        return int(m[1]) if m[1].isdigit() else NUM[m[1]]
    return None

def section_of(text):
    t = up(text)
    if "ΥΠΟΧΡΕΩΤΙΚ" in t and "ΕΠΙΛΟΓ" not in t: return "core"
    if re.search(r"ΕΠΙΛΟΓ|ΕΠΙΛΕΓ|ΕΠΙΛΕΞ|ΠΡΟΑΙΡΕΤΙΚ", t): return "elective"
    return None

def courses(tabs, kind=default_kind, sticky=False, stop=r"ΙΔΡΥΜΑΤΙΚΟΣ ΚΑΤΑΛΟΓΟΣ|ΙΔΡΥΜΑΤΙΚΟΥ ΚΑΤΑΛΟΓΟΥ ΜΑΘΗΜΑΤΩΝ$", skip=r"(?i)^(σύνολο|συνολο|ΣΥΝΟΛΟ)|^[Α-ΩA-Z]{1,5}\s*[:=]\s", tracks=True, code_re=r"[A-ZΑ-Ω]{1,6}[\s.-]?\d{2,5}[A-ZΑ-Ω]{0,3}|\d{3,5}[A-ZΑ-Ω]{1,3}"):
    """tabs: [(text above, rows)] as html_tables.tables() / up_tables.rows() give them."""
    out, sem, track, section, left = [], None, None, None, None
    for head, table in tabs:
        for line in head.split("\n")[-3:]:
            if (s := semester_of(line)) is not None: sem, track, section = s, track if sticky else None, None
            if tracks and (t := track_of(line)): track = t
            if (k := section_of(line)): section = k
        cols = None
        for r in table:
            cells = [norm(c) for c in r]
            filled = [c for c in cells if c]
            joined = " ".join(filled)
            if not filled or re.search(skip, joined): continue
            if stop and re.search(stop, up(joined)): return out  # other departments' courses (institutional list)
            if len(filled) == 1 and len(joined) > 80: continue  # a paragraph between tables, not a heading
            sem_cell = next((c for c in filled if semester_of(c) is not None and len(c) <= 80), None)
            if sem_cell and not any(re.search(r"\d", c) for c in filled if c != sem_cell) \
               and not any(re.search(r"ΜΑΘΗΜΑ|ΤΙΤΛΟΣ", up(c)) for c in filled if c != sem_cell):
                sem, track, section = semester_of(sem_cell), track if sticky else None, section_of(sem_cell)
                continue
            if len(filled) >= 2 and any(re.fullmatch(HEAD, up(c)) for c in cells):
                cols = {}
                for i, c in enumerate(cells):
                    u = up(c)
                    if "ΚΩΔ" in u: cols.setdefault("code", i)
                    elif re.search(r"ΜΑΘΗΜΑ|ΤΙΤΛΟΣ|ΟΝΟΜΑΣΙΑ", u) and "name" not in cols: cols["name"] = i
                    elif re.search(r"ΚΑΤΗΓΟΡ|ΕΙΔΟΣ|ΤΥΠΟΣ|^Υ/Ε|^Υ/ΕΥ|^Υ/ΕΠ|ΧΑΡΑΚΤΗΡ|^ΕΜ$", u) and not (u == "ΚΜ" or "type" in cols and u.startswith("ΚΑΤΗΓΟΡ")):
                        cols["type"] = i  # ΕΜ = είδος (Υ/Ε); ΚΜ = κατηγορία (ΓΥ/ΕΥ…), not compulsory/elective
                if (s := semester_of(joined)) is not None: sem, track, section = s, None, None
                if (k := section_of(joined)) and not re.search(r"(?i)^μαθήματα$|^μάθημα$", joined): section = k
                continue
            if len(filled) == 1 or (len(filled) <= 2 and not any(re.search(r"\d", c) for c in filled)
                                    and (semester_of(joined) or section_of(joined) or track_of(joined))):
                if (s := semester_of(joined)) is not None: sem, track, section = s, track if sticky else None, None
                if tracks and (t := track_of(joined)): track = t
                if (k := section_of(joined)): section, left = k, scope_of(joined)
                continue
            if cols and "name" in cols and cols["name"] < len(cells) and cells[cols["name"]]: name = cells[cols["name"]]
            else: name = max(cells, key=lambda c: sum(ch.isalpha() for ch in c) if not TYPE.fullmatch(up(c)) else 0)
            if sum(ch.isalpha() for ch in name) < 3 or re.fullmatch(PLACEHOLDER, up(name)): continue
            code = cells[cols["code"]] if cols and "code" in cols and cols["code"] < len(cells) else \
                next((c for c in cells if c != name and re.fullmatch(code_re, c) and re.search(r"\d", c) and len(c) >= 3), None)
            if code and (len(code) < 3 or not re.search(r"\d", code)): code = None  # an A/A number, not a code
            t = up(cells[cols["type"]]) if cols and "type" in cols and cols["type"] < len(cells) else \
                next((up(c) for c in cells if c != name and TYPE.fullmatch(up(c))), None)
            k = kind(t.replace(".", "") if t else None, section)
            if k is None: continue
            group = None
            if isinstance(k, tuple): k, group = k
            elif track: k, group = ("track_core" if k == "core" else k), track  # compulsory inside a track
            out.append({"code": code or None, "name": name, "semester": sem, "kind": k, "group": group})
            if left is not None:
                left -= 1
                if left == 0: section, left = None, None
    return out

def pdf_tabs(path, first=0, last=None):
    """a PDF's ruled tables as one table for courses(): text lines between tables become one-cell marker rows"""
    import up_tables
    return [("", [[h] if c is None else c for h, c in up_tables.rows(path, first, last)])]

CONNECT = ("και", "της", "των", "του", "τη", "την", "το", "με", "-", "–", "για", "στη", "στην", "στο", "στα", "σε", ",", "&", "/", ":")

def text_courses(lines, code_re, kind=default_kind, tail=r"(?:\s+(?:[\d]+(?:[,.]\d+)?|-|–))+", skip=r"^$", sticky=False):
    """Text lines of a programme ("CODE Title <numbers>" under semester / track / section headings). A title that wraps
    around a bare "CODE <numbers>" line takes the text above and, when it looks unfinished, the line below."""
    row = re.compile(rf"^({code_re})\s+(.*?)\s*(?:{tail})?$")
    out, sem, track, section, pending, i, left = [], None, None, None, [], 0, None
    lines = [norm(l) for l in lines if norm(l)]
    while i < len(lines):
        l = lines[i]; i += 1
        m = row.match(l)
        if not m:
            s = semester_of(l) if "ΜΑΘΗΜΑΤΑ" not in up(l) or re.match(r"\d", l) else None
            if s is not None and len(l) < 120: sem, track, section, pending = s, (track if sticky else None), None, []
            if (t := track_of(l)) and len(l) < 120: track, pending = t, []
            if (k := section_of(l)) and (len(l) < 60 or s is not None or "ΜΑΘΗΜΑ" in up(l)) and len(l) < 120:
                section, pending, left = k, [], scope_of(l)
            if s is None and not track_of(l) and not section_of(l) and not re.search(skip, l): pending.append(l)
            else: pending = []
            continue
        name = m[2]
        bare = not name or re.fullmatch(r"[\d\s,.\-–]*", name)
        if bare: name = " ".join(pending[-1:])
        nxt = lines[i] if i < len(lines) else ""
        after = row.match(lines[i + 1]) if i + 1 < len(lines) else None
        # the line below finishes this title unless it is a heading or the start of the next title (its bare row follows)
        if nxt and not row.match(nxt) and semester_of(nxt) is None and not section_of(nxt) and not track_of(nxt) \
           and not re.search(skip, nxt) and not (after and re.fullmatch(r"[\d\s,.\-–]*", after[2])) \
           and (nxt[0].islower() or len(nxt.split()) <= 3 or name.endswith(CONNECT)):
            name = norm(name + " " + nxt); i += 1
        pending = []
        if sem is None or sum(ch.isalpha() for ch in name) < 3 or re.fullmatch(PLACEHOLDER, up(name)): continue
        k = kind(None, section)
        group = None
        if isinstance(k, tuple): k, group = k
        elif track: k, group = ("track_core" if k == "core" else k), track
        out.append({"code": m[1], "name": name, "semester": sem, "kind": k, "group": group})
        if left is not None:
            left -= 1
            if left == 0: section, left = None, None
    return out

def finish(rows, case=None, groups=None):
    """re-case capital titles / groups (lib.recaser) and rename group variants (groups: {folded prefix: name})"""
    from lib import fold
    def fix(s):
        if not s: return s
        letters = [ch for ch in s if ch.isalpha()]
        return case(s) if case and letters and sum(map(str.isupper, letters)) > 0.6 * len(letters) else s
    for r in rows:
        r["name"] = fix(norm(re.sub(r"\+[A-Z]+\d+:[A-Z]+\d+", "", r["name"])))  # "+B64:B70": a spreadsheet formula left in
        g = r.get("group")
        if g:
            head, _, rest = g.partition(" ")
            g = f"{head} {fix(rest)}" if head in WORD.values() and rest else fix(g)
            for k, v in (groups or {}).items():
                if fold(g).strip().startswith(fold(k).strip()): g = v
            r["group"] = g
    return rows

if __name__ == "__main__":
    assert semester_of("3ο Εξάμηνο") == 3 and semester_of("Α’ ΕΞΑΜΗΝΟ") == 1 and semester_of("ΜΑΘΗΜΑΤΑ 1 ου ΕΞΑΜΗΝΟΥ") == 1
    assert semester_of("Εξάμηνο1") == 1 and semester_of("ΣΤ' Εξάμηνο") == 6 and semester_of("Μαθήματα 2ου εξαμήνου") == 2
    assert semester_of("κατ΄ επιλογήν μαθήματα (5ο και 6ο εξάμηνο).") is None and semester_of("7ο εξάμηνο*") == 7
    assert semester_of("ΕΞΑΜΗΝΟ Ζ ΜΑΘΗΜΑΤΑ") == 7 and semester_of("Στα Α’- ΣΤ’ εξάμηνα") is None
    assert semester_of("Πέμπτο εξάμηνο") == 5 and semester_of("Μαθήματα 1ου έτους") is None
    assert default_kind("Υ", None) == "core" and default_kind("ΕΕ", None) == "elective" and default_kind("ΥΕΚ1", None) == "elective"
    assert default_kind("ΥΚ", None) == "track_core" and default_kind(None, "elective") == "elective"
    assert default_kind("ΥΠΟΧΡΕΩΤΙΚΟ", None) == "core" and default_kind("ΕΠΙΛΟΓΗΣ", None) == "elective"
    assert default_kind("Σ ΥΚ", None) == "track_core"
    assert track_of("7Ο ΕΞΑΜΗΝΟ – ΚΑΤΕΥΘΥΝΣΗ ΕΝΕΡΓΕΙΑΣ") == "Κατεύθυνση ΕΝΕΡΓΕΙΑΣ" and track_of("μαθήματα κατεύθυνσης") is None
    assert scope_of("Υποχρεωτικό Επιλογής: Ένα από τα Δύο") == 2 and scope_of("Μαθήματα Επιλογής 2 από τα 3") == 3
    assert track_of("8ο Εξάμηνο – 1η Κατεύθυνση (6)") == "Κατεύθυνση 1"
    assert all(re.fullmatch(PLACEHOLDER, up(x)) for x in ["Μάθημα Ελεύθερης Επιλογής ή Πτυχιακή Εργασία", "Μάθημα Επιλογής Κατεύθυνσης", "Κατ΄ Επιλογήν Υποχρεωτικό Μάθημα", "Επιλογή 12*"])
    print("ok")
