# Πανεπιστήμιο Θεσσαλίας: each department's programme from its own site (www.uth.gr/spoydes/proptychiakes/schools-departments
# links them; most are one WordPress multisite). Fetch into raw/uth/ (browser user agent; names below). 19 department sites
# reset every connection from this container — recorded as missing.
import re
import html_programme as hp
from html_tables import tables
from pdftext import pages
from lib import save, missing, recaser, norm

case = recaser([])

def html(f): return tables(f"raw/uth/{f}.html")
def lines(f, a=0, b=None): return "\n".join(pages(f"raw/uth/{f}.pdf")[a:b]).split("\n")
def first_int(s): return int(m[0]) if (m := re.search(r"\d+", s or "")) else None
def done(dept, src, rows, note=None):
    first, out = {}, []
    for r in rows:  # a course offered in two semesters (two groups of students) is listed once, at the first
        r["name"] = norm(r["name"])
        k = r.get("code") or r["name"].lower()
        if first.setdefault(k, r["semester"]) != r["semester"] or sum(map(str.isalpha, r["name"])) < 4: continue
        out.append(r)  # same semester again (another track): lib.save merges it and keeps both groups
    save("uth", f"uth-{dept}", src, hp.finish(out, case), note)

# ece: one table per semester; «Υποχρεωτικά» / «… Επιλογής» rows; electives sit at their recommended semester, which the
# code also gives (ECE1xx odd = 1st, even = 2nd …), used for the tables that carry no semester heading
def ece():
    rows, kind = [], "core"
    for above, t in html("ece-u"):
        for r in t:
            j = " ".join(r)
            if "Υποχρεωτικά" in j: kind = "core"
            elif "Επιλογής" in j: kind = "elective"
            elif (m := re.fullmatch(r"ECE(\d)(\d\d)", r[0])) and len(r) > 1:
                rows.append({"code": r[0], "name": r[1], "semester": 2 * int(m[1]) - 1 + (int(m[2]) % 2 == 0), "kind": kind})
    return rows
done("ece", "https://www.e-ce.uth.gr/studies/undergraduate/", ece())

# cult: tables per category (κορμού / εργαστηρίου / ξένης γλώσσας = compulsory, then the electives with Ομάδα Α | Β);
# «1-3» semesters → the first
def cult():
    rows = []
    for above, t in html("cult-m"):
        if not t or t[0][0] != "ΚΩΔΙΚΟΣ": continue
        head = t[0]; core = "υποχρεωτικ" in above.lower()
        for r in t[1:]:
            if len(r) < len(head) or not r[0]: continue
            c = dict(zip(head, r))
            rows.append({"code": c["ΚΩΔΙΚΟΣ"], "name": c["ΟΝΟΜΑ ΜΑΘΗΜΑΤΟΣ"], "semester": first_int(c["ΕΞΑΜΗΝΟ"]),
                         "kind": "core" if core else "elective",
                         "group": f"Ομάδα {c['ΟΜΑΔΑ']}" if c.get("ΟΜΑΔΑ") else None})
    return rows
done("culture", "https://cult.uth.gr/spoudes/proptuxiakes-spoudes/mathimata/", cult())

# energy: one table, two semesters side by side (code, title | code, title); the code's 5th character = semester;
# a «Μαθήματα Επιλογής» row turns the rest of that year into electives
def energy():
    rows, elective = [], False
    for _, t in html("energy-m"):
        for r in t:
            j = " ".join(r)
            if "Έτος" in j: elective = False
            if "Επιλογής" in j: elective = True; continue
            for m in re.finditer(r"(ΜΣΕ\d{4}) \| ([^|]+)", " | ".join(r)):
                rows.append({"code": m[1], "name": m[2], "semester": int(m[1][4]),
                             "kind": "elective" if elective and not m[1].endswith("800") else "core"})
    return rows
done("energy", "https://energy.uth.gr/spoydes/proptuxiakes-spoudes/mathimata/", energy())

# med: «Νέο Πρόγραμμα Σπουδών 2021» (the page's content via the WordPress API: the theme renders it client-side);
# one table per semester (11ο–12ο = 11), then winter / spring electives (no fixed semester)
GREEK_LOOK = str.maketrans("ABEHIKMNOPTXYZ", "ΑΒΕΗΙΚΜΝΟΡΤΧΥΖ")
def med():
    rows, sem = [], None
    for above, t in html("med-new"):
        if (m := re.search(r"(\d+)\s*o\b.*Εξάμηνο", above)): sem = int(m[1])
        elif "Επιλογής" in above: sem = None
        for r in t:
            if len(r) >= 4 and re.fullmatch(r"[Α-ΩA-Z]{2}\d{4}", r[0]):
                name = re.sub(r"\b[ABEHIKMNOPTXYZ]+\b", lambda w: w[0].translate(GREEK_LOOK), r[3])  # «THN» typed in Latin
                rows.append({"code": r[0], "name": name, "semester": sem,
                             "kind": "elective" if r[2].replace("Ε", "E").startswith("E") else "core"})
    return rows
done("med", "https://med.uth.gr/proptyxiaka/neos-odigos-spoudon/", med(), note="programme from 2021")

# mech: «Προπτυχιακά Μαθήματα» lists «CODE TITLE (kind)» per semester; Υ / Υ1–3 compulsory, ΥΚn compulsory in track n,
# ΕΚn elective offered by track n, Ε general elective
MECH_TRACKS = {"1": "Κατεύθυνση Ενέργειας, Βιομηχανικών Διεργασιών & Τεχνολογίας Περιβάλλοντος",
               "2": "Κατεύθυνση Μηχανικής Υλικών & Κατεργασιών", "3": "Κατεύθυνση Οργάνωσης Παραγωγής & Βιομηχανικής Διοίκησης"}
def mech():
    s = open("raw/uth/mie-m.html", encoding="utf-8").read()
    text = re.sub(r"<[^>]+>", "\n", re.sub(r"(?s)<script.*?</script>|<style.*?</style>", "", s))
    import html as h
    rows, sem = [], None
    for l in (norm(h.unescape(x)) for x in text.split("\n")):
        if (m := re.match(r"(\d+)° Εξάμηνο", l)): sem = int(m[1]); continue
        if l.startswith("Σημειώσεις"): break
        if sem and (m := re.match(r"(?:([A-ZΑ-Ω0-9]{2}\s?\d{3,4}|ΕΠΕΑΕΚ3)\s+)?(.+?)\s*\(([ΥΕYEΚK]{1,2})(\d?)\)", l)):
            k = m[3].translate(str.maketrans("YEK", "ΥΕΚ"))
            kind = "track_core" if k == "ΥΚ" else "elective" if k.startswith("Ε") else "core"
            rows.append({"code": m[1], "name": m[2], "semester": sem, "kind": kind,
                         "group": MECH_TRACKS.get(m[4]) if k in ("ΥΚ", "ΕΚ") else None})
    return rows
done("mech", "https://mie.uth.gr/?page_id=8475", mech())

# preedu: «Πρόγραμμα Σπουδών 2026-2027» (.docx): a table per semester; Χαρακτηρισμός ΘΥ / ΠΥ / ΤΥ = compulsory,
# ΘΕ / ΠΕ / ΤΕ / ΙΕ = elective, ΣΕΜ (practicum) and ΞΓ (language) compulsory
def preedu():
    rows, sem = [], None
    for _, t in html("preedu-ps"):
        for r in t:
            if len(r) == 1 and (m := re.match(r"Εξάμηνο (\d+)", r[0])): sem = int(m[1]); continue
            if len(r) >= 5 and r[0].isdigit() and r[1]:
                k = r[3].split()[0] if r[3] else ""
                rows.append({"code": r[4] or None, "name": re.sub(r"\s*(\*+|ΝΕΟ ΜΑΘΗΜΑ)\s*$", "", r[1]), "semester": sem,
                             "kind": "elective" if k.endswith("Ε") and k not in ("ΣΕΜ",) else "core"})
    return rows
done("preedu", "https://ece.uth.gr/spoudes/proptuxiakes-spoudes/programma-spoudwn/", preedu(), note="programme 2026-27")

# econ: guide 2025-26, «Πρόγραμμα Προπτυχιακών Σπουδών Πλήρους Φοίτησης» (pdf pages 75–85). Semesters 1–6: numbered
# rows, «ή» alternatives and «Επιλογή (1 από τα N)» make a choice group (electives); semesters 7–8: one table per track,
# Ζ΄ | Η΄ side by side, «ΥΠΟΧΡΕΩΤΙΚΑ» / «ΕΠΙΛΟΓΗΣ» headings; the teacher's name is cut off the title
TEACHER = r"\s+(?:Καθηγ|Αναπλ|Επίκ|Δρ\.|Ε\.ΔΙ\.Π|Ε\.Ε\.Π|Συμβασιούχ|Ομότ|Ντέλιου)\S*.*$"
def econ_title(c):
    c = re.sub(TEACHER, "", c)
    return norm(re.sub(r"\((?:Δεν προσφέρεται|στα Αγγλικά)[^)]*\)?|\*", "", c))
def econ():
    rows, sem, group, choice, join, track, cols = [], None, [], False, False, None, None
    def flush():
        nonlocal group, choice
        for g in group: rows.append({**g, "kind": "elective" if len(group) > 1 or choice else "core"})
        group, choice = [], False
    for _, t in hp.pdf_tabs("raw/uth/econ.pdf", 74, 86):
        for r in t:
            j = " ".join(c for c in r if c)
            if re.match(r"1ο ΕΞΑΜΗΝΟ", j): flush(); return rows  # the part-time programme repeats the same courses
            if (m := re.match(r"(ΣΤ|[Α-Ζ])΄ Εξάμηνο", j)):
                flush(); sem = hp.semester_of(f"{m[1]}΄ ΕΞΑΜΗΝΟ"); continue
            if (m := re.match(r"ΚΑΤΕΥΘΥΝΣΗ ([ΑΒΓ])΄: (.+)", j)):
                flush(); track = f"Κατεύθυνση {m[1]}΄ {case(m[2])}"; continue
            if "ΔΙΔΑΣΚΩΝ" in j: continue  # a table header
            if track is None:
                if j.startswith("Επιλογή ("): flush(); choice = True; continue
                if j == "ή": join = True; continue
                title = next((c for c in r[1:] if c and c not in ("ή", "ΜΑΘΗΜΑ") and not re.match(TEACHER.strip(r"\s+"), c)), None)
                if r[0].isdigit() and title:
                    if not choice: flush()
                    group.append({"name": econ_title(title), "semester": sem}); join = False
                elif title and join and len(title) > 3 and sum(map(str.isupper, title[:1])):
                    group.append({"name": econ_title(title), "semester": sem}); join = False
                continue
            # track tables: header row gives the Η΄ column and each column's kind; one-cell rows are the page's text again
            if len(r) < 2: continue
            if "ΕΞΑΜΗΝΟ Ζ" in j or "Ε Ξ" in j:
                h = next((i for i, c in enumerate(r) if i and "ΑΜΗΝΟ" in c.replace(" ", "")), len(r) // 2)
                cols = (h, {7: "ΕΠΙΛΟΓΗΣ" not in r[0], 8: "ΕΠΙΛΟΓΗΣ" not in r[h]}); continue
            if not cols: continue
            for i, c in enumerate(r[:-1] if r[-1].isdigit() else r):
                s = 8 if i >= cols[0] else 7
                if not c or c == "ή" or c.startswith(("ΜΑΘΗΜΑΤΑ", "Ένα μάθημα")) or re.match(TEACHER.strip(r"\s+"), c): continue
                if c.startswith("Μέθοδοι Έρευνας"):
                    rows += [{"name": "Μέθοδοι Έρευνας", "semester": 7, "kind": "elective", "group": track},
                             {"name": "Πτυχιακή Εργασία", "semester": 8, "kind": "elective", "group": track}]; continue
                prev = next((x for x in reversed(rows) if x["semester"] == s and x.get("group") == track), None)
                if prev and prev["name"].count("(") > prev["name"].count(")"):
                    prev["name"] = econ_title(prev["name"] + " " + c); continue
                rows.append({"name": econ_title(c), "semester": s, "kind": "track_core" if cols[1][s] else "elective",
                             "group": track})
    flush(); return rows
done("econ", "https://econ.uth.gr/wp-content/uploads/sites/6/page/odigos_spoudwn_latest_5726638873.pdf", econ(),
     note="guide 2025-26")

# civil: guide 2024-25 «ΠΡΟΓΡΑΜΜΑ ΣΠΟΥΔΩΝ» (pdf pages 45–51): «N) Title (Υ | ΥΤ | Ε | Σ,Υ) hours ECTS» per semester,
# «ΚΑΤΕΥΘΥΝΣΗ …» headings (ΥΤ = compulsory in that track); long titles wrap around the kind; «A ή B» = a choice.
# The 8th / 9th-semester electives of each track: «ΠΙΝΑΚΑΣ 1» (bullets; «(Γ)»-style tags = another track's course)
CIV_TRACK = r"ΚΑΤΕΥΘΥΝΣΗ (.+)"
def civil():
    rows, sem, track, pend, tail, prose = [], None, None, [], False, False
    ls = [l.strip() for l in lines("civ", 44, 51)]
    for i, l in enumerate(ls):
        if not l or re.match(r"ΠΑΝΕΠΙΣΤΗΜΙΟ ΘΕΣΣΑΛΙΑΣ|ΠΡΟΓΡΑΜΜΑ ΣΠΟΥΔΩΝ \d|\d+ ΤΜΗΜΑ ΠΟΛΙΤΙΚΩΝ|Μαθήματα ώρες", l): tail = False; continue
        if (m := re.match(r"(\d+)ο Εξάμηνο", l)): sem, track, pend, tail, prose = int(m[1]), None, [], False, False; continue
        if l == "Διπλωματική Εργασία":
            rows.append({"name": l, "semester": 10, "kind": "core"}); break
        if (m := re.match(CIV_TRACK, l)):
            track = m[1] + (" " + ls[i + 1] if ls[i + 1].isupper() and not ls[i + 1].startswith("ΚΑΤ") and not re.match(r"\d", ls[i + 1]) else "")
            pend, tail, prose = [], False, False; continue
        if ls[i - 1].startswith("ΚΑΤΕΥΘΥΝΣΗ") and l.isupper(): continue  # the heading's second line
        if l.startswith(("Σημείωση", "Μαθήματα Σεμιναριακού", "*")):
            prose, tail, pend = True, False, []
            if not l.startswith("Σημείωση"): track = None  # notes and seminars after the track lists are for everyone
            continue
        if prose and not re.match(r"\d+\)", l) and "(" not in l: continue
        prose = False
        if (m := re.match(r"(?:\d+\)|\d+-)?\s*(.*?)\s*\(([ΥYΕΣΔΤ,\s]+)\)\s+[\d\-]", l)):
            name = norm(" ".join(pend + [m[1]])); pend, tail = [], True
            k = m[2].replace("Y", "Υ").replace(" ", "")
            rows.append({"name": name, "semester": sem, "group": track if k != "Υ" and k != "Σ,Υ" else None,
                         "kind": "track_core" if k == "ΥΤ" else "elective" if k in ("Ε", "Σ") else "core"})
        elif re.match(r"\d+\)", l): pend, tail = [re.sub(r"^\d+\)\s*", "", l)], False
        elif tail and rows: rows[-1]["name"] += " " + l
        else: pend.append(l)
    out = []
    for r in rows:  # drop the «Επιλογή …» slots, split «A ή B» choices, drop the other-track tags
        if r["name"].startswith("Επιλογή"): continue
        parts = [norm(re.sub(r"\((?:Γ|Δ|Σ|Υδ|Building[^)]*)\)|\*", "", p)) for p in re.split(r"\s+ή\s+", r["name"])]
        out += [{**r, "name": p, "kind": "elective" if len(parts) > 1 else r["kind"]} for p in parts if p]
    for _, t in hp.pdf_tabs("raw/uth/civ.pdf", 51, 54):
        for r in t:
            if len(r) < 5 or not r[0] or r[0] == "Κατεύθυνση": continue
            track = f"{norm(r[0])}"
            for s, cell in ((8, r[1]), (9, r[4])):
                for piece in re.split(r"[•]", cell)[1:]:
                    p = re.split(r"\s+(?:Μαθήματα|Εφόσον|Δίνεται|Επιλογή|Γενικές)\b", piece)[0]
                    if re.search(r"\((?:Γ|Δ|Σ|Υδ)\)", p): continue
                    if (p := norm(p.rstrip(". "))): out.append({"name": p, "semester": s, "kind": "elective",
                                                                "group": "ΚΑΤΕΥΘΥΝΣΗ " + track.upper()})
    for r in out:
        if r.get("group"): r["group"] = "Κατεύθυνση " + case(r["group"].replace("ΚΑΤΕΥΘΥΝΣΗ ", ""))
    return out
done("civil", "https://civ.uth.gr/wp-content/uploads/sites/7/2025/04/P2.1-Odigos-Spoudwn-TPM_1219403995.pdf", civil(),
     note="guide 2024-25")

# nurs: «ΝΕΟ Πρόγραμμα Σπουδών» (pdf): «CODE Title Υ|Ε category hours…»; the code's first digit = semester;
# a long title wraps to the next line
def nurs():
    rows = []
    for l in (x.strip() for x in lines("nurs")):
        if (m := re.match(r"(Ν\d{3,4}[ΥΕ])\s+(.*?)\s+([ΥΕ])\s+(?:ΜΓΥ|ΜΕΥ|ΜΕ|ΜΑΔ|ΜΓΓ)\b", l)):
            rows.append({"code": m[1], "name": m[2], "semester": int(m[1][1]), "kind": "core" if m[3] == "Υ" else "elective"})
        elif rows and l and not re.match(r"Γενικό Σύνολο|Υ: |ΜΓΥ:|Ώρες|Κωδικός|Μαθήματος|[Α-Ω]+[΄’] ΕΞΑΜΗΝΟ|\d+ο ΕΞΑΜΗΝΟ|Ακολουθεί", l) \
                and not re.search(r"\d", l) and len(l) < 60:
            rows[-1]["name"] += " " + l
    return rows
done("nurs", "https://www.nurs.uth.gr/programma", nurs(), note="new programme")

# primedu: «Πρόγραμμα σπουδών εισακτέων 2026-2027» (pdf): compulsory courses per semester (numbered rows), then the
# electives with their semesters («3, 5, 7» → the first)
def primedu():
    rows, sem = [], None
    for _, t in hp.pdf_tabs("raw/uth/primedu.pdf"):
        for r in t:
            j = " ".join(c for c in r if c)
            if not j.startswith("Σύνολο") and (m := re.search(r"(?:Υποχρεωτικά μαθήματα\s+|^)(\d+)ου εξαμήνου", j)):
                sem = int(m[1]); continue
            code = next((c for c in r if re.fullmatch(r"[Α-Ω]{2,3}\d{4}", c)), None)
            if r[0].isdigit() and len(r) > 2:
                title = next(c for c in r[1:] if c)
                rows.append({"code": code, "name": re.sub(r"\s+Ενσωματωμέν.*", "", title), "semester": sem, "kind": "core"})
            elif code and r[0] == code and len(r) > 2 and r[1]:
                rows.append({"code": code, "name": r[1], "semester": first_int(r[2]), "kind": "elective"})
    return rows
done("primedu", "https://pre.uth.gr/spoudes/spoudes-sto-p-t-d-e/programma-kai-odigos-spoudwn/", primedu(),
     note="programme for students admitted 2026-27")

# publichealth: «Πρόγραμμα Προπτυχιακών Σπουδών» — one table per semester, «ΥΠΟΧΡΕΩΤΙΚΑ» / «ΕΠΙΛΟΓΗΣ» rows
def publichealth():
    rows = []
    for above, t in html("pub-prog"):
        sem, kind = hp.semester_of(above.upper().replace("'", "΄")), "core"
        for r in t:
            j = " ".join(r).upper()
            if len(r) == 1 and "ΕΠΙΛΟΓ" in j: kind = "elective"
            elif len(r) == 1 and "ΥΠΟΧΡΕΩΤ" in j: kind = "core"
            elif r[0].isdigit() and len(r) > 1 and r[1]:
                rows.append({"name": r[1], "semester": sem, "kind": kind})
    return rows
done("publichealth", "https://pubhealth.uth.gr/program/programma-proptuxiakwn-spoudwn/", publichealth())

# bioinf: guide 2025-26 «Κατανομή Μαθημάτων στα Εξάμηνα» (pdf pages 43–47, text): «CODE Title Θ Ε Σ ECTS» under
# «Nο ΕΞΑΜΗΝΟ», «ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ (n από τα m)» blocks; then the free electives (winter / spring, no semester)
def bioinf():
    ls = [l for l in lines("dib", 42, 47) if not re.match(r"\s*(ΣΥΝΟΛΟ|ΓΕΝΙΚΟ ΣΥΝΟΛΟ|\d+ x \d+|[Α-Δ]’ ΕΤΟΣ)", l)]
    rows = hp.text_courses(ls, r"\d[Α-Ω]{2}\d{2}|ΠΤ0\d", kind=lambda t, s: s or "core")
    for r in rows:
        r["name"] = re.sub(r"(\s+(?:\d+|x|=\d+))+$", "", r["name"])  # hours / page numbers run into the title
    # two titles wrap around their codes in opposite directions on page 47 (read off the PDF)
    fix = {"7ΕΒ06": "Οργάνωση και Διοίκηση Συστημάτων Υγείας", "7ΕΒ07": "Ειδικά Θέματα Ηλεκτρονικής Υγείας και Οικονομικά Δομών Υγείας"}
    for r in rows: r["name"] = fix.get(r["code"], r["name"])
    free = []
    for l in lines("dib", 47, 48):
        if (m := re.match(r"(0Ε[ΠΜ]\d\d|E?Υ?\d{3}|ΕΥ\d{3})\s+(\D+?)\s+[\d-]", l.strip())):
            free.append({"code": m[1], "name": m[2], "semester": None, "kind": "elective", "keep": True})
    return rows + free
done("bioinf", "http://dib.uth.gr/wp-content/uploads/2025/09/ΟΔΗΓΟΣ_ΣΠΟΥΔΩΝ_2025-26.pdf", bioinf(), note="guide 2025-26")

# sped: guide 2026-27 «ΕΝΔΕΙΚΤΙΚΟ ΠΡΟΓΡΑΜΜΑ ΣΠΟΥΔΩΝ» (pdf pages 72–78, text): «CODE Title ECTS» under «N⁰ ΕΞΑΜΗΝΟ»,
# the code ends in Υ (compulsory) or Ε (elective); ΠΑn = practicum; long titles wrap around the code line
def sped():
    ls = [l.replace("⁰", "ο") for l in lines("sed", 70, 78) if not re.fullmatch(r"\s*\d+\s*|Οδηγός Σπουδών ΠΤΕΑ.*", l)]
    code = r"[Α-Ω]{2}\d{1,2}[ΥΕ]|ΠΑ\d{1,2}"
    for i in range(len(ls) - 1):  # «… σε τυπικά και» / «ΕΑ19Ε μη τυπικά …»: a title begun above a code line with text
        if re.search(r"\s(και|της|του|των|σε|στη|στην|με)$", ls[i]) and (m := re.match(rf"\s*({code})\s+(\D.*)", ls[i + 1])):
            ls[i], ls[i + 1] = "", f"{m[1]} {ls[i].strip()} {m[2]}"
    rows = hp.text_courses(ls, code, kind=lambda t, s: "core", tail=r"(?:\s+\d+(?:,\d+)?)+")
    for r in rows: r["kind"] = "elective" if r["code"].endswith("Ε") else "core"
    sem = None
    for l in ls:  # the foreign language has no code
        if (m := re.match(r"\s*(\d)ο ΕΞΑΜΗΝΟ", l)): sem = int(m[1])
        if (m := re.match(r"\s*(Ξένη [γΓ]λώσσα [IΙV]+)\s+[\d,]+$", l)): rows.append({"name": m[1], "semester": sem, "kind": "core"})
    return rows
done("sped", "https://sed.uth.gr/wp-content/uploads/sites/9/page/os26-27_3172038110.pdf", sped(), note="guide 2026-27")

# agri-crop: guide 2026-27 «Αναλυτικό Πρόγραμμα Σπουδών» (pdf pages 29–33): numbered rows per «Nο ΕΞΑΜΗΝΟ»; semesters
# 1–8 are compulsory, the 9th / 10th lists are electives (47 compulsory + 7 of 24 electives); ΠΡΑΚΤΙΚΗ ΑΣΚΗΣΗ optional
def agri_crop():
    rows, sem = [], None
    for _, t in hp.pdf_tabs("raw/uth/agr.pdf", 28, 33):
        for r in t:
            if len(r) < 2: continue
            if (m := re.match(r"(\d+)ο ΕΞΑΜΗΝΟ", r[1])): sem = int(m[1]); continue
            if re.fullmatch(r"\d+\.", r[0]) and r[1]:
                rows.append({"name": r[1], "semester": sem, "kind": "core" if sem <= 8 else "elective"})
            elif r[1] in ("ΠΡΑΚΤΙΚΗ ΑΣΚΗΣΗ", "ΠΤΥΧΙΑΚΗ ΕΡΓΑΣΙΑ"):
                rows.append({"name": r[1], "semester": sem, "kind": "core" if "ΠΤΥΧΙΑΚΗ" in r[1] else "elective"})
    return rows
done("agri-crop", "https://agr.uth.gr/wp-content/uploads/sites/4/2026/09/Odigos-Propt.-Prog.-Spoudwn-2026-27-FINAL_6332565287.pdf",
     agri_crop(), note="guide 2026-27")

# arch: «Οδηγός Προγράμματος Προπτυχιακών Σπουδών» — two semesters side by side (N | title | hours | ECTS); the
# «Επιλογή» slots are skipped: the elective lists sit in a rotated table by subject area that does not read cleanly
def arch():
    rows, sems = [], (None, None)
    for _, t in hp.pdf_tabs("raw/uth/arch.pdf", 5, 20):
        for r in t:
            j = " ".join(c for c in r if c)
            if r and r[0].startswith("ονημάξε"): return rows
            if (m := re.findall(r"(\d+)ο εξάμηνο", j)) and len(m) == 2: sems = tuple(map(int, m)); continue
            right = next((i for i in range(1, len(r)) if r[i].isdigit() and i > 3 and i + 1 < len(r) and r[i + 1]
                          and not r[i + 1].isdigit()), None)
            for side, (a, b) in enumerate(((0, right or len(r)), (right, len(r))) if right else ((0, len(r)),)):
                cells = r[a:b]
                if not cells or not cells[0].isdigit(): continue
                title = next((c for c in cells[1:4] if c and not c.isdigit()), None)
                if title and title != "Επιλογή":
                    rows.append({"name": title, "semester": sems[side], "kind": "core", "side": side})
            if not r[0] and len(r) > 2 and r[2] and not any(c.isdigit() for c in r) and rows:
                rows[-1 if rows[-1]["side"] == 0 else -2]["name"] += " " + r[2]  # a wrapped left-hand title
    return rows
done("arch", "https://www.arch.uth.gr/el/studies/undergraduate", arch(),
     note="compulsory courses only: the elective lists (by subject area) are not readable")

# agri-fish: guide 2026-27 (diae.uth.gr answers over http only), «CODE TITLE hours ECTS» per «Nο ΕΞΑΜΗΝΟ»
# (pdf pages 55–62, text) with «ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ» lists in the 9th / 10th; the language and the thesis have no code
def agri_fish():
    # the 9th / 10th headings say «ΥΠΟΧΡΕΩΤΙΚΑ 3 + ΕΠΙΛΟΓΗΣ 2»: only the «ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ» lists below are electives
    ls = [re.sub(r"\+ ΕΠΙΛΟΓΗΣ \d", "", re.sub(r"ΕΞΑΜ ΗΝΟ", "ΕΞΑΜΗΝΟ", l)) for l in lines("diae", 54, 62)
          if not re.match(r"\s*(Θ Α Ε|ώρες|ΚΩ\s?ΔΙΚ|Σύνολο|\d+ο ΕΤΟΣ|\d+$|ΔΙΠΛΩΜΑΤΙΚΗ$)", l)]
    rows = hp.text_courses(ls, r"[Α-Ω]{2}\d{4}", kind=lambda t, s: s or "core")
    rows += [{"name": "Ξένη Γλώσσα", "semester": 1, "kind": "core"},
             {"name": "Διπλωματική Εργασία", "semester": 5, "kind": "core"}]  # spread over semesters 5–10
    return rows
done("agri-fish", "http://diae.uth.gr/docs/files/anakoinoseis/2026/Οδηγός σπουδών 2026-2027.pdf", agri_fish(),
     note="guide 2026-27")

# department sites that reset every connection (https and http) from this container — re-run from a normal network
UNREACHABLE = {"prd": "www.prd.uth.gr", "lang": "gdia.uth.gr", "hist": "www.ha.uth.gr", "diet": "dnd.uth.gr",
               "pe": "www.pe.uth.gr", "biochem": "www.bio.uth.gr", "physio": "physio.uth.gr", "vet": "www.vet.uth.gr",
               "food": "food.uth.gr", "animal": "as.uth.gr", "agrotech": "agrtec.uth.gr", "ba": "de.uth.gr",
               "acc": "accfin.uth.gr", "wood": "www.fwsd.uth.gr", "envir": "env.uth.gr", "ds": "ds.uth.gr",
               "physics": "phys.uth.gr", "math": "math.uth.gr", "dit": "www.dit.uth.gr"}
for dept, host in UNREACHABLE.items():
    missing("uth", f"uth-{dept}", [f"https://{host}/", f"http://{host}/"], "site unreachable from this container (connection reset)")
