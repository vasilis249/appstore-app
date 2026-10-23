# Ελληνικό Μεσογειακό Πανεπιστήμιο: each department's programme from its own site (hmu.gr/scholes-tmimata links them;
# WordPress — pages the theme renders client-side are read from /wp-json/wp/v2/pages?slug=). Fetch into raw/hmu/ (browser
# user agent; names below). The Universis course catalogue needs a login here, so it is not used.
import re
import html as h
import html_programme as hp
from html_tables import tables
from pdftext import pages
from lib import save, missing, recaser, norm

case = recaser([])

def html(f): return tables(f"raw/hmu/{f}.html")
def lines(f, a=0, b=None): return "\n".join(pages(f"raw/hmu/{f}.pdf")[a:b]).split("\n")
def done(dept, src, rows, note=None):
    first, out = {}, []
    for r in rows:  # a course listed again in a later semester (another track) keeps its first semester
        r["name"] = norm(re.sub(r"\s*\((?:προαιρετικ\w*|Προαιρετικ\w*)\)|\*+$", "", r["name"]))
        k = r["name"].lower()
        if first.setdefault(k, r["semester"]) != r["semester"] or sum(map(str.isalpha, r["name"])) < 4: continue
        out.append(r)
    save("hmu", f"hmu-{dept}", src, hp.finish(out, case), note)

# ece: one table per semester; «Υποχρεωτικά» / «Προαιρετικά» blocks; from the 7th, one table per track and semester:
# «Ειδίκευσης» = compulsory in the track, «Επιλέγονται …» = its electives; the code «7.012» carries the semester
def ece():
    rows = []
    for above, t in html("ece"):
        track = next((m[1] for x in [above] + [" ".join(r) for r in t[:1]] if (m := re.search(r"(?:ΚΑΤΕΥΘΥΝΣΗ|ΚΑΤ/ΣΗ) (.+)", x))), None)
        track = track and "Κατεύθυνση " + case(norm(track))
        kind, blocks = "core", 0
        for r in t:
            j = " ".join(r)
            if r[0].replace(" ", "") == "ΚΩΔΙΚΟΣ":
                blocks += 1
                kind = ("core" if not track else "track_core") if re.search(r"Υποχρεωτικ|Ειδίκευσης", j) else "elective"
                continue
            if (m := re.fullmatch(r"(\d+)\s?\.\s?(\d\s?\d\s?\d)", r[0])) and len(r) > 1 and r[1]:
                rows.append({"code": f"{m[1]}.{m[2].replace(' ', '')}", "name": r[1], "semester": int(m[1]), "kind": kind,
                             "group": track if kind != "core" else None})
    return rows
done("ece", "https://ece.hmu.gr/proptyxiakes/programma-spoydwn/", ece())

# elec: 5-year programme, one table per semester (code NNN: 1st digit = semester, 10th = 10NN); from the 7th the
# «Α’–Δ’ Κύκλος Κατ’ Επιλογή Υποχρεωτικών» lists (2nd digit 1–4 = cycle; 6, 8 = free electives)
CYCLE = {"1": "Α’", "2": "Β’", "3": "Γ’", "4": "Δ’"}
def elec():
    rows = []
    for _, t in html("elec"):
        for r in t:
            if not (re.fullmatch(r"\d{3,4}", r[0]) and len(r) > 1 and r[1]): continue
            sem = int(r[0][:-2])
            if sem < 7 or r[0][-2:-1] == "0":
                kind, group = "elective" if "προαιρετικ" in r[1] else "core", None
            else:
                kind, group = "elective", (f"{CYCLE[r[0][-2]]} κύκλος" if r[0][-2] in CYCLE else None)
            rows.append({"code": r[0], "name": r[1], "semester": sem, "kind": kind, "group": group})
    return rows
done("elec", "https://ee.hmu.gr/proptyxiakes/neo-etes-programma-spoydwn-tmhmatos-hlektronikwn-mhchanikwn/", elec(),
     note="5-year programme")

# tourism: two semesters side by side; «Κατεύθυνση …» tables from the 5th; «Μάθημα Επιλογής …» slots skipped; the
# shared elective table lists winter | spring electives (no fixed semester)
def tourism():
    rows, track, elective = [], None, False
    for _, t in html("tourism"):
        sems = (None, None)
        for r in t:
            j = " ".join(r)
            if (m := re.match(r"Κατεύθυνση (.+)", j)): track = "Κατεύθυνση " + case(m[1]); continue
            if "ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ" in j: elective, track = True, None; continue
            if (m := re.findall(r"(\d+)ο Εξάμηνο", j)): sems = tuple(map(int, m)) + (None,); continue
            if "Επιλογής" in j and len(r) == 2 and not elective: continue
            for i, c in enumerate(r[:2]):
                if not c or c.startswith(("Μάθημα Επιλογής", "Επιλογής")): continue
                if elective:
                    rows.append({"name": c, "semester": None, "kind": "elective", "keep": True})
                else:
                    rows.append({"name": c, "semester": sems[i], "kind": "track_core" if track else "core", "group": track})
    return rows
done("tourism", "https://bat.hmu.gr/proptyxiakes/mathhmata-bat/", tourism())

# nutr: one table per semester (one column); «ΣΥΝΙΣΤΩΜΕΝΑ ΠΡΟΑΙΡΕΤΙΚΑ …» / «ΕΠΙΛΟΓΗΣ» start the optional courses
def nutr():
    rows = []
    for above, t in html("nutr"):
        sem, kind = hp.semester_of(above), "elective" if "ΠΡΟΑΙΡΕΤ" in above else "core"
        for r in t:
            c = r[0]
            if re.search(r"ΠΡΟΑΙΡΕΤΙΚ|ΕΠΙΛΟΓ", c): kind = "elective"; continue
            if c.startswith("ΣΥΝΟΛΟ") or not c: continue
            rows.append({"name": c, "semester": sem, "kind": kind, **({"keep": True} if sem is None else {})})
    return rows
done("nutr", "https://nds.hmu.gr/proptyxiakes/katanomi-mathimaton-examino/", nutr())

# nurs: two semesters side by side, «Υποχρεωτικά» / «Επιλογής» rows per column
def nurs():
    rows = []
    for _, t in html("nurs")[:1]:
        sems, kinds = (None, None), ["core", "core"]
        for r in t:
            if (m := re.findall(r"(\d+)ο Εξάμηνο", " ".join(r))): sems, kinds = tuple(map(int, m)) + (None,), ["core", "core"]; continue
            for i, c in enumerate(r[:2]):
                if not c: continue
                if re.match(r"Υποχρεωτικά$", c): kinds[i] = "core"
                elif re.match(r"(?:Μαθήματα )?Επιλογής|Κατ.? επιλογή", c): kinds[i] = "elective"
                elif not re.match(r"Σύνολο|ECTS", c): rows.append({"name": c, "semester": sems[i], "kind": kinds[i]})
    return rows
done("nurs", "https://nurs.hmu.gr/proptyxiakes/programma-spoydwn/", nurs())

# mech: «Κατανομή Μαθημάτων/Εξάμηνο» lists titles under «Nο Εξάμηνο»; from the 7th each track's own list
# (the page does not say which track courses are compulsory: marked as the track's courses)
def mech():
    s = re.sub(r"(?s)<script.*?</script>|<style.*?</style>", "", open("raw/hmu/mech.html", encoding="utf-8").read())
    rows, sem, track = [], None, None
    for l in (norm(h.unescape(x)) for x in re.sub(r"<[^>]+>", "\n", s).split("\n")):
        if not l or l in ("Μαθήματα ανα εξάμηνο", "Μαθήματα Κατευθύνσεων"): continue
        if (m := re.fullmatch(r"(\d+)ο Εξάμηνο", l)): sem = int(m[1]); continue
        if re.search(r"Κατεύθυνση", l): track = l if l.startswith("Κατεύθυνση") else "Κατεύθυνση " + l.replace(" Κατεύθυνση", ""); continue
        if l.startswith(("Τους καλοκαιρινούς", "Το 10ο")): continue
        if l == "Διπλωματική Εργασία": rows.append({"name": l, "semester": 10, "kind": "core"}); continue
        if l.startswith("Πρακτική Άσκηση"): rows.append({"name": "Πρακτική Άσκηση", "semester": None, "kind": "elective", "keep": True}); continue
        if sem: rows.append({"name": l, "semester": sem, "kind": "track_core" if track else "core", "group": track})
    return rows
done("mech", "https://mech.hmu.gr/proptyxiakes/katanomh-mathhmatwn-eksamhno/", mech(),
     note="track courses from the 7th semester are listed without compulsory / elective")

# agri: «Μαθήματα Προπτυχιακού Προγράμματος Σπουδών» (pdf): «Nο ΕΞΑΜΗΝΟ» tables with codes 0810.S.NNN.0 (the 7th–9th
# compulsory courses are the same for every track; the track names are not in the text); the elective lists
# (winter = 7th, spring = 8th) name each course's track in the «Τύπος» column, or «Ελεύθερης Επιλογής»
def agri():
    rows_ = [r for _, t in hp.pdf_tabs("raw/hmu/agri.pdf") for r in t if len(r) > 1]  # one-cell rows = the page text again
    rows, sem, elective = [], None, None
    for i, r in enumerate(rows_):
        j = " ".join(c for c in r if c)
        if (m := re.match(r"(\d+)ο ΕΞΑΜΗΝΟ$", j)):
            sem, elective = int(m[1]), None; continue
        if j.startswith("ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ ΥΠΟΧΡΕΩΤΙΚΑ"): elective = 7 if "ΧΕΙΜΕΡΙΝΟΥ" in j else 8; continue
        if not re.match(r"-?0810\.", r[0]) or len(r) < 4: continue
        ti = next((k for k in range(1, 5) if r[k] and not re.fullmatch(r"[\d,.\s]+", r[k])), None)
        code, title = r[0].lstrip("-"), r[ti] if ti else ""
        nxt = rows_[i + 1] if i + 1 < len(rows_) and not re.match(r"-?0810", rows_[i + 1][0]) else []
        if ti and nxt and len(nxt) > ti and nxt[ti] and not re.match(r"(Υποβάθρου|Επιλογής|Κατεύθυνσης|ΣΥΝΟΛΟ|Σύνολο)", nxt[ti]):
            title += " " + nxt[ti]  # a title wrapped into the next row
        title = re.sub(r"(\s+\d+)+$", "", title)
        if title.endswith(" και") and i + 2 < len(rows_) and len(rows_[i + 2]) > ti and rows_[i + 2][ti]:
            title += " " + rows_[i + 2][ti]  # a title over three rows
        typ =" ".join(c for c in r[4:] + nxt if c)
        if elective:
            t = re.search(r"Κατεύθυνσης ([ΑΒΓ])", typ)
            rows.append({"code": code, "name": title, "semester": elective, "kind": "elective",
                         "group": f"Κατεύθυνση {t[1]}" if t else None})
        elif sem:
            rows.append({"code": code, "name": title, "semester": sem,
                         "kind": "elective" if "Ξένη Γλώσσα" in title else "core"})
    return rows
done("agri", "https://agro.hmu.gr/wp-content/uploads/2025/09/Μαθήματα-Προπτυχιακού-Προγράμματος-Σπουδών.pdf", agri(),
     note="programme 2025: tracks named Α, Β, Γ as in the source tables")

# socwork: «Courses_Semester» (pdf): codes 0804.S.NNN.x, «N. Title», category Υ-… (compulsory) / Ε-… (elective)
def socwork():
    rows = []
    for _, t in hp.pdf_tabs("raw/hmu/sw.pdf"):
        for r in t:
            code = next((c for c in r if re.match(r"0804\.\d+\.\d{3}\.\d", c)), None)
            title = next((c for c in r if re.match(r"\d+\.\s", c)), None)
            cat = next((c for c in r if re.fullmatch(r"[ΥΕYE]-\S+", c)), "")
            if code and title:
                rows.append({"code": code.split()[0], "name": re.sub(r"^\d+\.\s*", "", title), "semester": int(code.split(".")[1]),
                             "kind": "elective" if cat[:1] in "ΕE" else "core"})
    return rows
done("socwork", "https://sw.hmu.gr/wp-content/uploads/2022/03/Courses_Semester.pdf", socwork())

# music: guide 2022-23 (the newer per-semester PDFs use a font whose text does not decode), «3.6 ΜΑΘΗΜΑΤΑ … ΑΝΑ
# ΑΚΑΔΗΜΑΪΚΟ ΕΞΑΜΗΝΟ»: «0807.S.NNN.x Υ|ΕΥ|Π Title hours…» (Υ compulsory, ΕΥ elective, Π optional)
def music():
    rows = []
    for l in lines("music-guide", 18, 26):
        if (m := re.match(r"\s*(0807\.(\d+)\.\d{3}\.\d)\s+(Υ|ΕΥ|Π)\s+(.+?)\s+\d", l)):
            rows.append({"code": m[1], "name": m[4], "semester": int(m[2]), "kind": "core" if m[3] == "Υ" else "elective"})
    return rows
done("music", "https://mta.hmu.gr/wp-content/uploads/2023/06/Β11-Οδηγός-Σπουδών_2022-23_v090623.pdf", music(), note="guide 2022-23")

# mst: guide (Google Docs, exported as pdf) «ΠΡΟΤΥΠΟ ΠΡΟΓΡΑΜΜΑ ΣΠΟΥΔΩΝ»: «N Title ΜΥ|ΜΕΥ hours» under «Χ’ ΕΞΑΜΗΝΟ», from the
# 6th one list per «ΚΑΤΕΥΘΥΝΣΗ: …» (ΜΥ = compulsory in that track, ΜΕΥ = its electives)
LETTER = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
def mst():
    rows, sem, track, ls = [], None, None, [l.strip() for l in lines("mst", 19, 25)]
    for i, l in enumerate(ls):
        if (m := re.match(r"(ΣΤ|[Α-Η])’ ΕΞΑΜΗΝΟ(?:\s*[-–]\s*ΚΑΤΕΥΘΥΝΣΗ:\s*(.+))?", l)):
            sem = LETTER[m[1]]
            t = m[2] and m[2] + (" " + ls[i + 1] if ls[i + 1].isupper() and not ls[i + 1].startswith("Α/Α") else "")
            track = t and "Κατεύθυνση " + case(norm(t)); continue
        if sem and (m := re.match(r"\d+\s+(.+?)\s+(ΜΥ|ΜΕΥ)\b", l)):
            kind = "elective" if m[2] == "ΜΕΥ" else "track_core" if track else "core"
            rows.append({"name": m[1], "semester": sem, "kind": kind, "group": track})
    return rows
done("mst", "https://mst.hmu.gr/proptyxiako/odhgos-spoydwn/", mst(), note="guide (Google Docs link on the department page)")

# acc: guide 2024-25 «3.2 Πρόγραμμα Σπουδών – Μαθήματα ανά Εξάμηνο» (pdf pages 25–28): «N Title Υ|Ε/Υ|Π ECTS teacher»;
# a long title wraps around «N Υ ECTS …»; the languages (Π) have no number
ACC_SEM = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
def acc():
    rows, sem, ls = [], None, [l.strip() for l in lines("acc", 24, 28)]
    for i, l in enumerate(ls):
        if (m := re.search(r"\((ΣΤ|[Α-Η])'\) Εξάμηνο$", l)): sem = ACC_SEM[m[1]]; continue
        if l.startswith("4.1"): break
        if not sem: continue
        if (m := re.match(r"(\d+(?:\.\d)?)\s+(.+?)\s+(Υ|Ε/Υ|Π)\s+\d", l)): name, kind = m[2], m[3]
        elif (m := re.match(r"(\d+(?:\.\d)?)\s+(Υ|Ε/Υ|Π)\s+\d", l)): name, kind = f"{ls[i - 1]} {ls[i + 1]}", m[2]
        elif (m := re.match(r"(Αγγλικά [IΙV]+)\s+Π$", l)): name, kind = m[1], "Π"
        else: continue
        rows.append({"name": re.sub(r"\s*\((?:Π/[ΕΑ][^)]*|=[^)]*)\)", "", name), "semester": sem,
                     "kind": "core" if kind == "Υ" else "elective"})
    return rows
done("acc", "https://accfin.hmu.gr/wp-content/uploads/2025/03/2025.03.13_Επικ.Οδηγός.Σπουδών_2024-25_final.pdf", acc(),
     note="guide 2024-25")
