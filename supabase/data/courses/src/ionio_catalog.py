# Ιόνιο Πανεπιστήμιο: every department site runs the same CMS (<host>.ionio.gr/gr/studies/…); a «Μαθήματα» page with
# one table per semester where the department fills one, else the programme PDF it links (ionio.gr/download.php?f=…).
# Fetch into raw/ionio/ (browser user agent; names below). history.ionio.gr fails TLS verification → missing.
import re, unicodedata
import html as h
import html_programme as hp
from html_tables import tables
from pdftext import pages
from lib import save, missing, recaser, norm

case = recaser([])

def html(f, keep=1): return tables(f"raw/ionio/{f}.html", keep)
def lines(f, a=0, b=None): return "\n".join(pages(f"raw/ionio/{f}.pdf")[a:b]).split("\n")
def fold(s): return re.sub(r"[^Α-ΩA-Z0-9]", "", hp.up(s.replace("&", "και")))
def flat(f):
    s = re.sub(r"(?is)<script.*?</script>|<style.*?</style>", "", open(f"raw/ionio/{f}.html", encoding="utf-8").read())
    s = s[s.find("<h1"):]
    return [x for x in (norm(h.unescape(y)) for y in re.split(r"<[^>]+>", s)) if x]
def done(dept, src, rows, note=None):
    first, out = {}, []
    for r in rows:  # a course listed again in a later semester keeps its first one
        r["name"] = norm(re.sub(r"^\*+\s*|\*+$|\u0301|(?<=[α-ωά-ώ])\d+$", "", unicodedata.normalize("NFC", r["name"])))
        k = r["name"].lower()
        if first.setdefault(k, r["semester"]) != r["semester"] or sum(map(str.isalpha, r["name"])) < 4: continue
        if r["semester"] is None: r["keep"] = True
        out.append(r)
    save("ionio", f"ionio-{dept}", src, hp.finish(out, case), note)

# tables per semester (head «Α΄ ΕΞΑΜΗΝΟ» above or a one-cell row); `cols` = (code, name, type) column indexes
def by_semester(f, cols, kind_of):
    rows, sem, choice = [], None, False
    for head, t in html(f):
        if (s := hp.semester_of(head)) is not None: sem, choice = s, False
        for r in t:
            if len(r) == 1 or (len(r) == 2 and not r[0]):
                x = r[-1]
                if (s := hp.semester_of(x)) is not None: sem, choice = s, False
                elif x.startswith("Επιλογή"): choice = True
                continue
            c, n, k = cols
            if len(r) <= max(n, k or 0) or not r[n] or len(r[n]) > 150 or re.match(r"Κωδικός|ΣΥΝΟΛΟ|Τίτλος", r[c] + r[n]): continue
            kind, group = kind_of(r[k] if k is not None else "", choice)
            if kind: rows.append({"code": r[c] or None, "name": r[n], "semester": sem, "kind": kind, "group": group})
    return rows

def csd():
    def kind(t, _):
        if (m := re.match(r"Κατεύθυνση (\S+) - (Υποχρεωτικά|Επιλογής)", t)):
            return ("track_core" if m[2] == "Υποχρεωτικά" else "elective"), f"Κατεύθυνση {m[1]}"
        return ("core" if "Κορμού" in t else "elective"), None
    done("csd", "https://di.ionio.gr/gr/studies/undergraduate-studies/courses-new", by_semester("c-csd", (0, 1, 2), kind))

def media():
    done("media", "https://dmc.ionio.gr/gr/studies/undergraduate/courses",
         by_semester("c-media", (0, 1, 2), lambda t, _: ("core" if t == "Υ" else "elective", None)))

# tourism: code in two cells («TOU», «100»), type Υ / Ε; rows after «Επιλογή 2 από 4» are the choices
def tourism():
    rows = []
    for r in by_semester("c-tourism", (0, 3, 2), lambda t, ch: ("elective" if ch or t == "Ε" else "core", None)): rows.append(r)
    for _, t in html("c-tourism"):  # the code is split over two cells: join them back by title
        for r in t:
            if len(r) == 6:
                for x in rows:
                    if x["name"] == r[3]: x["code"] = f"{r[0]} {r[1]}"
    done("tourism", "https://tourism.ionio.gr/gr/studies/undergraduate/courses", rows)

def env():
    done("env", "https://envi.ionio.gr/gr/studies/undergraduate-studies/curriculum",
         by_semester("p-env", (0, 1, 9), lambda t, ch: ("elective" if ch or t == "Επιλογής" else "core", None)))

# food: rows FST | 101 | TITLE …; «* TITLE» (one of two / three) = κατ' επιλογήν
def food():
    rows, sem = [], None
    for _, t in html("p-food"):
        for r in t:
            if len(r) == 1 and (s := hp.semester_of(r[0])) is not None: sem = s
            elif len(r) >= 3 and r[0] == "FST":
                rows.append({"code": f"FST {r[1]}", "name": r[2], "semester": sem, "kind": "elective" if r[2].startswith("*") else "core"})
    done("food", "https://fst.ionio.gr/gr/studies/undergraduate-studies/curriculum", rows)

# fltt: «Μαθήματα» page, four tabs: ΔΙΑΛΕΞΕΙΣ / ΕΙΔΙΚΑ ΜΑΘΗΜΑΤΑ (by semester; the third-language ones are elective),
# ΥΠΟΧΡΕΩΤΙΚΑ ΕΠΙΛΟΓΗΣ (winter / spring), ΤΡΙΤΗΣ ΓΛΩΣΣΑΣ (by semester), ΣΕΜΙΝΑΡΙΑΚΑ; tokens «EN-1100», title
def fltt():
    t = flat("c-fltt")
    t = t[t.index("ΣΕΜΙΝΑΡΙΑΚΑ") + 1:]
    t = t[:next(i for i, x in enumerate(t) if x == "Προπτυχιακό")]
    third = {t[i] for i, x in enumerate(t) if x == "ΤΡΙΤΗΣ ΓΛΩΣΣΑΣ" for i in range(i, len(t)) if re.fullmatch(r"[A-Z]{2}-\d{4}", t[i])}
    rows, tab, sem = [], None, None
    for i, x in enumerate(t):
        if x in ("ΔΙΑΛΕΞΕΙΣ / ΕΙΔΙΚΑ ΜΑΘΗΜΑΤΑ", "ΥΠΟΧΡΕΩΤΙΚΑ ΕΠΙΛΟΓΗΣ", "ΤΡΙΤΗΣ ΓΛΩΣΣΑΣ", "ΣΕΜΙΝΑΡΙΑΚΑ"): tab, sem = x, None
        elif "ΕΞΑΜΗΝΟ" in x: sem = hp.semester_of(x) if re.match(r"(ΣΤ|[Α-Η])΄", x) else None
        elif re.fullmatch(r"[A-Z]{2}-\d{4}", x) and i + 1 < len(t):
            core = tab.startswith("ΔΙΑΛΕΞΕΙΣ") and x not in third
            rows.append({"code": x, "name": t[i + 1], "semester": sem, "kind": "core" if core else "elective",
                         "group": "Τρίτη γλώσσα" if x in third else None})
    done("fltt", "https://dflti.ionio.gr/gr/undergraduate-studies/courses", rows)

# avarts: indicative programme PDF (19/02/2026): rows THE | 100 | Υ / Ε | title; the hundreds digit is the semester
def avarts():
    rows = []
    for _, t in hp.pdf_tabs("raw/ionio/g-avarts.pdf"):
        for r in t:
            if len(r) > 3 and re.fullmatch(r"[A-Z]{3}", r[0]) and r[0] != "FRE" and re.fullmatch(r"\d{3}", r[1]):
                rows.append({"code": f"{r[0]} {r[1]}", "name": r[3], "semester": int(r[1][0]) or None,
                             "kind": "core" if r[2] == "Υ" else "elective"})
    done("avarts", "https://avarts.ionio.gr/download.php?f=/ic/ic_gr_2026-02-19-15-22.pdf", rows)

# music: «Συγκεντρωτικός πίνακας μαθημάτων ανά Κατεύθυνση»: per track «1. ΥΠΟΧΡΕΩΤΙΚΑ» and «2. … ΚΑΤ’ ΕΠΙΛΟΓΗΝ» lists of
# «N Title ΔΜ ECTS Εξάμηνο»; a wrapped title continues on the next line
def music():
    rows, track, kind = [], None, None
    for l in lines("g-music"):
        if l.startswith("ΚΑΤΕΥΘΥΝΣΗ"): track = "Κατεύθυνση " + case(l.split(" ", 1)[1])
        elif l.startswith("1. ΥΠΟΧΡΕΩΤΙΚΑ"): kind = "track_core"
        elif l.startswith("2. ") or "ΚΑΤ’ ΕΠΙΛΟΓΗΝ" in l: kind = "elective"
        elif track and kind and (m := re.match(r"\d+ (.+?) \d+ \d+(?:,\d+)? ((ΣΤ|[Α-ΙABEZHI])΄?(?:\s.*)?|\d εξάμηνο.*)$", l)):
            sem = hp.GREEK.get(hp.up(m[3])) if m[3] else None  # Latin look-alikes («Z΄», «H») too
            rows.append({"code": None, "name": re.sub(r"(?:\s\d+)+$", "", m[1]), "semester": sem, "kind": kind, "group": track})
        elif rows and track and not re.match(r"\d+(?: |$)|Α/Α|Σύνολο|Υπόλοιπο|\(ΑΝΑ|[α-ω]{1,2}\) |[A-ZΑ-Ω ]{12,}$", l): rows[-1]["name"] += " " + l
    done("music", "https://ionio.gr/download.php?f=00001-00999/IU-pf-00214-95852-gr.pdf", rows)

# alm: the current course list (c-alm, by semester, no type) + the kind from the programme PDF 2021-22 sections:
# ΚΟΡΜΟΣ / ΥΠΟΧΡΕΩΤΙΚΑ ΓΙΑ ΟΛΕΣ → compulsory, ΡΟΗ ΓΕΝΙΚΗΣ ΠΑΙΔΕΙΑΣ → elective, per «ΚΑΤΕΥΘΥΝΣΗ X:» the
# «ΥΠΟΧΡΕΩΤΙΚΑ … ΡΟΗΣ» / «ΕΠΙΛΟΓΗΣ … ΡΟΗΣ» lists
def alm():
    seen, state = [], ("core", None)
    for l in lines("g-alm", 9):
        if (m := re.match(r"ΚΑΤΕΥΘΥΝΣΗ (\S+):", l)): state = ("track_core", "Κατεύθυνση " + case(m[1]))
        elif l.startswith("ΡΟΗ ΓΕΝΙΚΗΣ ΠΑΙΔΕΙΑΣ"): state = ("elective", None)
        elif re.search(r"ΥΠΟΧΡΕΩΤΙΚΑ (?:ΒΑΣΙΚΗΣ|ΨΗΦΙΑΚΗΣ) ΡΟΗΣ", l) and state[1]: state = ("track_core", state[1])
        elif re.match(r"ΕΠΙΛΟΓΗΣ (?:ΒΑΣΙΚΗΣ|ΨΗΦΙΑΚΗΣ) ΡΟΗΣ", l) and state[1]: state = ("elective", state[1])
        seen.append((fold(l), state))
    rows, sem = [], None
    for _, t in html("c-alm"):
        for r in t:
            if len(r) == 1 and (s := hp.semester_of(r[0])) is not None: sem = s
            elif len(r) == 3 and r[1] and r[1] != "Τίτλος":
                k = fold(r[1])[:14]
                hits = [st for l, st in seen if k in l]
                kind = "elective" if "ξένη γλώσσα" in r[1].lower() else hits[0][0] if hits else "core" if sem <= 4 else "elective"
                groups = sorted({g for kd, g in hits if g and kd == kind}) if kind != "core" else []
                for g in groups or [None]:
                    rows.append({"code": r[0] or None, "name": r[1], "semester": sem,
                                 "kind": kind if g or kind != "track_core" else "elective", "group": g})
    done("alm", "https://ilam.ionio.gr/gr/studies/undergraduate/courses", rows)

csd(); media(); tourism(); env(); food(); fltt(); avarts(); music(); alm()
missing("ionio", "ionio-hist", ["https://history.ionio.gr/", "http://history.ionio.gr/"],
        "the site fails TLS certificate verification from this container")
