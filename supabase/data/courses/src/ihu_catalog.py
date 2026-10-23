# Διεθνές Πανεπιστήμιο της Ελλάδος: each department's programme from its own site (www.ihu.gr/tmimata/<dept> links the
# sites) — an HTML curriculum page where one exists, else the newest guide / programme PDF, read with html_programme.
# Guides whose PDF tables spread a course over several rows take the titles from the guide's own course outlines
# («ΚΩΔΙΚΟΣ ΜΑΘΗΜΑΤΟΣ … / ΤΙΤΛΟΣ ΜΑΘΗΜΑΤΟΣ …»). Fetch into raw/ihu/ (browser user agent; names below).
import re
import html_programme as hp
from html_tables import tables
from pdftext import pages
from lib import save, missing, recaser, fold, norm

case = recaser([])

def html(f): return tables(f"raw/ihu/{f}.html")
def pdf(f, a=0, b=None): return hp.pdf_tabs(f"raw/ihu/{f}.pdf", a, b)
def lines(f, a=0, b=None): return "\n".join(pages(f"raw/ihu/{f}.pdf")[a:b]).split("\n")
def outlined(f, a, b, sem_of_code=None):
    """programme tables a..b + the guide's outlines for titles; rows without a code are leftovers of wrapped cells"""
    rows = hp.titled(hp.courses(pdf(f, a, b), split_rows=True), hp.outlines(lines(f)))
    rows = [r for r in rows if r["code"] and not r["name"].endswith(hp.CONNECT) and not r["name"][:1].islower()]
    if sem_of_code:
        for r in rows: r["semester"] = sem_of_code(r["code"]) or r["semester"]
    return rows
def done(dept, src, rows, note=None, groups=None):
    for r in rows: r["name"] = r["name"].split(" Διεθνές Πανεπιστήμιο της Ελλάδος")[0]  # a page footer run into a title
    rows = [r for r in rows if (r["semester"] is not None or r.get("keep")) and sum(map(str.isalpha, r["name"])) > 3
            and not re.fullmatch(r"(?i)κατηγορία|μάθημα|μαθήματα|μαθηματοσ|μαθήματος|κωδικός|ects|σύνολο", r["name"])]
    save("ihu", f"ihu-{dept}", src, hp.finish(rows, case, groups), note)

# HTML curriculum pages (the shared IHU WordPress theme: «Δομή Προγράμματος Σπουδών»)
# ba: the semester tables hold the compulsory courses; each track's electives (winter / spring) sit on their own page
BA_TRACKS = {"is": ("elective-courses-information-systems-and-operations-research", "Κατεύθυνση Πληροφοριακών Συστημάτων και Επιχειρησιακής Έρευνας"),
             "ef": ("elective-courses-economics-financial-management", "Κατεύθυνση Οικονομικής και Χρηματοοικονομικής Διοίκησης"),
             "mm": ("elective-courses-management-and-marketing", "Κατεύθυνση Μάνατζμεντ και Μάρκετινγκ")}
done("ba", "https://www.ba.ihu.gr/undergraduate-curriculum-courses/", hp.courses(html("ba")) + [
     {"code": r[0], "name": r[1], "semester": None, "kind": "elective", "group": track, "keep": True}
     for f, (_, track) in BA_TRACKS.items() for _, t in html(f"ba-el-{f}") for r in t
     if len(r) > 2 and r[2] == "ΜΕ" and r[0] != "ΚΩΔΙΚΟΣ"])
done("econ", "https://www.es.ihu.gr/curriculum/", hp.courses(html("econ")))
done("nurs", "https://www.nurse.ihu.gr/structure-of-the-curriculum/", hp.courses(html("nurs")))
done("ice", "https://www.ict.ihu.gr/curriculum-structure/", hp.courses(html("ice")))
done("food", "https://www.food.ihu.gr/structure-of-the-curriculum/", hp.courses(html("food")))
done("biomed", "https://bmsc.ihu.gr/curriculum-structure/", hp.courses(html("biomed")))
done("agri", "https://agro.ihu.gr/curriculum/", hp.courses(html("agri")))
done("nutr", "https://nutr.ihu.gr/el/studies/bsc-group/bsc-course-guide/", hp.courses(html("nutr-guide")))

# guides with outlines (codes 26SSnn / 20SSnn carry the semester)
done("mkt", "https://ommt.ihu.gr/wp-content/uploads/Dioikhsh/ODHGOS-SPOUDWN_TDOMT_23.pdf",
     outlined("mkt", 39, 49, lambda c: int(c[2:4]) if re.match(r"26\d{4}", c) else None), note="guide 2023")
done("env", "https://www.env.ihu.gr/wp-content/uploads/2026/02/2024-σήμερα-ΟΔΗΓΟΣ-ΣΠΟΥΔΩΝ.pdf",
     outlined("env", 37, 43, lambda c: int(c[2:4]) if re.match(r"20\d{4}", c) else None), note="guide 2024–")
done("scm", "https://logistics.ihu.gr/shared-files/17860", outlined("scm3", 34, 40), note="guide 2025")
done("physio", "http://phys.ihu.gr/wp-content/uploads/2024/01/ΟΔΗΓΟΣ-ΣΠΟΥΔΩΝ-ΤΜΗΜΑ-ΦΥΣΙΚΟΘΕΡΑΠΕΙΑΣ-5.pdf",
     outlined("physio", 40, 45), note="guide (2024)")
done("interior", "https://www.ia.ihu.gr/wp-content/uploads/2023/07/ΕΑ-analytiko_program_spoudon_ARXIKO.pdf",
     outlined("interior", 2, 5), note="programme (2023)")

# programme / guide PDFs with clean tables
done("civil", "https://www.civil.ihu.gr/wp-content/uploads/2023/05/Study_guide.pdf", hp.courses(pdf("civil", 17, 27)),
     note="guide (2023)")
done("mech", "https://www.mech.ihu.gr/wp-content/uploads/2023/05/1._5ετές_ΠΠΣ_Πρόγραμμα_Σπουδών_2022.pdf",
     hp.courses(pdf("mech")), note="programme 2022")
done("acc", "https://www.accis.ihu.gr/wp-content/uploads/2024/05/study_guide_2024.pdf", hp.courses(pdf("acc", 5, 12)),
     note="guide 2024")
done("ecec", "https://ecec.ihu.gr/wp-content/uploads/ΠΡΟΓΡΑΜΜΑ-ΣΠΟΥΔΩΝ-2023-ΕΙΣΑΚΤΕΟΙ-ΦΟΙΤΗΤΕΣ-ΑΚΑΔ.-ΕΤΟΥΣ-2023-2024-2.pdf",
     hp.courses(pdf("ecec")), note="programme for students admitted from 2023-24")
done("lib", "https://www.lisa.ihu.gr/wp-content/uploads/2026/09/programma-spoudon.pdf", hp.courses(pdf("lib")),
     note="programme from 2026-27")

# iee: text tables (Πίνακας ΙΙΙ) — one header per semester, «Ομάδα …» headings = the two groups (ΥΠ-ΕΠ = compulsory in
# that group), «Κοινά Μαθήματα Επιλογής» = no group; a long title wraps around the code line (above + below)
def iee():
    ls = [l for l in lines("iee", 43, 47)]
    rows, sem, group, above = [], 0, None, ""
    row_re = re.compile(r"^(?:\d{1,2} )?(1-\d{3}) (\S+) (ΥΠ-ΕΠ|ΥΠ|ΕΠ|Π)(?: [Α-Ω]{2,4})? (?:\d+ \d+ |- )?(.*)$")
    for i, l in enumerate(ls):
        l = l.strip()
        if l.startswith("Εξ Κωδικός"): sem, group, above = sem + 1, None, ""; continue
        if l.startswith("Ομάδα "): group = re.sub(r"\s*\(.*", "", l); continue
        if l.startswith("Κοινά Μαθήματα"): group = None; continue
        if not sem or l.startswith(("ΩΡΕΣ", "Θ Ε")) or re.fullmatch(r"\d{1,3}", l): continue
        if (m := row_re.match(l)):
            # drop the hours (and the «*» = not taught this year) at the end; «(CCNA) 1 * 2 4 6» keeps its «1»
            name = re.sub(r"(\s*\*)?(\s+\d+){1,3}$", "", " " + re.sub(r"(\s+-)+$", "", m[4])).strip()
            if re.fullmatch(r"Ελεύθερη Επιλογή [ΑΒ]", name): above = ""; continue  # a free-choice slot
            if not name:  # wrapped: the line above + the line below
                below = ls[i + 1].strip() if i + 1 < len(ls) else ""
                name = f"{above} {below}".replace("- ", "") if above.endswith("-") else f"{above} {below}"
            kind = {"ΥΠ": "core", "ΥΠ-ΕΠ": "track_core"}.get(m[3], "elective")
            rows.append({"code": m[1], "name": norm(name.replace("*", "")), "semester": sem, "kind": kind,
                         "group": group if kind != "core" else None})
            above = ""
        else: above = l
        if sem == 10 and rows and rows[-1]["code"] == "1-999": break
    return rows
done("iee", "https://www.iee.ihu.gr/wp-content/uploads/2025/10/ΜΠΗΣ_Οδηγός_Σπουδών_25-26_Α_s.pdf", iee(), note="guide 2025-26")

# midwife: the newest guide (2021-22) has no table; its table of contents lists every course (code, title) under
# «Χ΄ εξάμηνο» and «Υποχρεωτικά μαθήματα κορμού» / «Κατ΄ επιλογή υποχρεωτικά μαθήματα»; the code's first digit = semester
def midwife():
    rows, kind, on = [], "core", False
    for l in lines("midwife", 0, 6):
        l = norm(re.sub(r"[.…,\s]*\d*\s*$", "", l.replace("�", "")))
        if l.startswith("Περιγραφή μαθημάτων"): on = True; continue
        if not on: continue
        if l.startswith("Εργαστήριο"): break
        if re.match(r"(?i)υποχρεωτικά μαθήματα κορμού", l): kind = "core"
        elif re.match(r"(?i)κατ.\s*επιλογή", l): kind = "elective"
        elif re.search(r"εξάμηνο$", l): kind = "core"
        elif (m := re.match(r"(\d{4,5}) (.+)", l)):
            rows.append({"code": m[1], "name": m[2], "semester": int(m[1][0]), "kind": kind})
    return rows
done("midwife", "https://www.ihu.gr/tmima-maieftikis/wp-content/uploads/sites/6/2023/05/Οδηγός-Προπτυχιακών-Σπουδών-του-Τμήματος-Μαιευτικής-2021-2022-ΣΕΥ-ΔΙΠΑΕ.pdf",
     midwife(), note="guide 2021-22 (the newest published)")

# pme: the handbook's course outlines — a capital title, then «ΚΩΔΙΚΟΣ: n ΕΞΑΜΗΝΟ: Χ ΤΥΠΟΣ: … / ΥΠΟΧΡΕΩΤΙΚΟ | ΕΠΙΛΟΓΗΣ»
LATIN = str.maketrans("HZ", "ΗΖ")
LETTER = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8, "Θ": 9, "Ι": 10}
def pme():
    rows, ls = [], lines("pme")
    for i, l in enumerate(ls):
        if not (m := re.match(r"ΚΩΔΙΚΟΣ:\s*([\d.]*)\s*ΕΞΑΜΗΝΟ:\s*(\S+)\s+ΤΥΠΟΣ:.*?/\s*([Α-Ω]+)", l)): continue
        title, j = [], i - 1
        while j >= 0 and (t := ls[j].strip()) and sum(c.isupper() for c in t) > 0.8 * sum(c.isalpha() for c in t) > 0 \
                and not t.startswith(("ΒΙΒΛΙΟΓΡΑΦΙΑ", "ΜΑΘΗΣΙΑΚΑ")):
            title.insert(0, t); j -= 1
        rows.append({"code": m[1] or None, "name": norm(" ".join(title)), "semester": int(m[1][0]) if m[1] else LETTER[m[2].translate(LATIN)],  # the code's 1st digit (some letters are typos)
                     "kind": "core" if m[3] == "ΥΠΟΧΡΕΩΤΙΚΟ" else "elective"})
    # shortcut: the thesis has no outline; added from the programme (10th semester)
    rows.append({"code": None, "name": "Διπλωματική Εργασία", "semester": 10, "kind": "core"})
    return rows
done("pme", "https://www.iem.ihu.gr/wp-content/uploads/2025/11/2025-2026_IEM_Undergraduate_Programme_Handbook_GR.pdf",
     pme(), note="handbook 2025-26 (course outlines)")

# survey: one table of three columns per row band (κωδ | title); a column headed «ΕΥ …» or «… 6ΕΥ» lists electives
def survey():
    rows, elective = [], {}
    for _, t in pdf("survey"):
        for r in t:
            for c in range(0, len(r) - 3, 6):
                code, name = r[c] or r[c + 1], r[c + 3] or r[c + 4]
                if code == "κωδ" or r[c + 1] == "κωδ": elective[c] = bool(re.search(r"^ΕΥ|\dΕΥ \(", r[c + 3] or r[c + 4])); continue
                if re.fullmatch(r"\d{3}", code) and name:
                    rows.append({"code": code, "name": name, "semester": int(code[0]),
                                 "kind": "elective" if elective.get(c) else "core"})
    return rows
done("survey", "https://www.topogeo.ihu.gr/wp-content/uploads/2023/06/pinakas_mathimaton.pdf", survey(),
     note="course table (2023)")
missing("ihu", "ihu-fashion", ["https://cdc.ihu.gr/", "https://cdc.ihu.gr/wp-content/uploads/2020/10/Πρόγραμμα-Σπουδών-2016-2017.doc"],
        "only a 2016-17 programme as a .doc (not readable here); no current programme published")
