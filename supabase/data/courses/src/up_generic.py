# Πάτρα departments whose «Οδηγός / Πρόγραμμα Σπουδών» PDF lists courses in ruled tables (up_tables.rows): every line
# (text or table row) is read in order; «Νο Εξάμηνο» / «Χ΄ Εξάμηνο» headings set the semester (core), a heading with
# «ΕΠΙΛΟΓ» switches to electives until the next semester heading; a row whose first cell is a course code is a course
# (title = the next text cell). Usage: up_generic.py [dept…]
import re, sys
from lib import save, norm
from up_tables import rows as table_rows, case
G = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8, "Θ": 9, "Ι": 10}
# dept: (pdf, source URL, code regex, first page, last page[, electives without a semester])
DEPTS = {
    "fish": ("up-fish", "https://asfa.upatras.gr/wp-content/uploads/2026/10/AY_Odigos_Spoudon_2026-2027.pdf", r"AS_\w+", 0, None, True),
    "food": ("up-food", "https://foodscitech.upatras.gr/wp-content/uploads/foodsci_odigos_spoudon_2026-2027.pdf", r"FST_\w+", 0, None, True),
    "mst": ("up-mst", "https://dept.upatras.gr/wp-content/uploads/2026/09/programma-spoydon-akad.-etoys-2026-2027.pdf", r"MST_\w+", 0, None),
    "tourism": ("up-tourism", "https://tourism.upatras.gr/wp-content/uploads/2026/08/PPS_2026-2027.pdf", r"TMG_[\w.]+", 0, None),
    "hist-arch": ("up-ha", "https://ha.upatras.gr/wp-content/uploads/ΟΔΗΓΟΣ-ΣΠΟΥΔΩΝ.pdf", r"HIA_\w+", 0, None),
    "phil": ("up-phil", "https://philology.upatras.gr/wp-content/uploads/ΠΡΟΓΡ.-ΣΠΟΥΔΩΝ-2026-2027.pdf", r"PHL_\w+", 0, None),
    "econ": ("up-econ", "https://www.econ.upatras.gr/wp-content/uploads/sites/94/2026/08/Odigos-SpoudwnGR_2026-2027.pdf", r"ECO_\w+", 0, None, False, r"Κωδικός \| Μάθημα \| Υ/Ε"),
    "physio": ("up-physio", "https://physio.upatras.gr/proptixiaka/programs/", r"PTH_\w+", 0, None),
    "nurs": ("up-nurs", "https://nurs.upatras.gr/wp-content/uploads/2026/10/ΟΔΗΓΟΣ-ΣΠΟΥΔΩΝ-2026-2027.pdf", r"NUR_\w+", 0, None),
    "chem": ("up-chem", "https://drive.google.com/file/d/1LeiLDt-OS_w1O8D4nNe0i36Hw_Ynm1yz/view", r"[A-ZΑ-Ω]{2} ?\d{3}(?: [ΘΕE])?", 0, None),
    "chemeng": ("up-chemeng", "https://www.chemeng.upatras.gr/el/node/24", r"CHM_\w+", 0, None),
    "materials": ("up-materials", "https://www.matersci.upatras.gr/images/joomlart/university/studies/ProgrammeGuide2026.pdf", r"MAS_\w+", 0, None),
    "speech": ("up-speech", "https://logoth.upatras.gr/wp-content/uploads/sites/228/2026/09/Οδηγός-Σπουδών_26-27.pdf", r"SLT_\w+", 0, None),
}

SEM = re.compile(r"(?<!\w)(\d{1,2})\s?(?:ο|o|ου)(?:\s*\([^)]*\))?\s+(?:Εξάμηνο|ΕΞΑΜΗΝΟ|εξάμηνο|εξαμήνου)"
                 r"|(?<![\w΄'’])(ΣΤ|Στ|[Α-Ι])\s?['΄’]\s?(?:Εξάμηνο|ΕΞΑΜΗΝΟ|εξάμηνο|εξαμήνου)")

def parse(pdf, code_re, first=0, last=None, header=None):
    """header: regex of a table header row; when given, the n-th such table is semester n (paired tables share one heading)"""
    out, sem, kind, group, seen, prev, tables = [], None, "core", None, {}, None, 0
    for text, cells in table_rows(f"raw/{pdf}.pdf", first, last):
        cs = [c for c in (cells or []) if c]
        if len(cs) > 2 and re.fullmatch(r"\d+\.?", cs[0]): cs = cs[1:]  # "1. | CODE | Title"
        if cs:
            cs[0] = re.sub(r"\s*_\s*", "_", cs[0]).split(" & ")[0]
            if (m := re.match(rf"({code_re}) (.+)", cs[0])) and re.search(r"[^\W\d_]{3}", m[2]): cs[:1] = [m[1], m[2]]  # "CODE TITLE" in one cell
        j = next((i for i, c in enumerate(cs[:4]) if re.fullmatch(code_re, re.sub(r"\s*_\s*", "_", c))), None)
        if j: cs = [re.sub(r"\s*_\s*", "_", cs[j])] + [c for i, c in enumerate(cs) if i != j]  # "N | Title | CODE"
        code = re.fullmatch(code_re, cs[0]) if cs else None
        if not code:
            line = text or " | ".join(cs)
            if prev and len(cs) == 1 and not text and len(line) < 60 and not re.search(r"ξάμην|ΞΑΜΗΝ|ΕΠΙΛΟΓ|πιλογ|Electives|Σύνολο|ΣΥΝΟΛΟ|^\d", line):
                prev["name"] = norm(f"{prev['name']} {case(line) if line.isupper() else line}"); continue  # wrapped title cell
            prev = None
            if header and re.match(header, line): tables += 1; sem, kind = tables, "core"; continue
            if not text and len(cs) > 2 or len(line) > 140: continue  # a placeholder / filler row, not a heading
            if not header and (m := SEM.search(line)):
                sem, kind, group = int(m[1]) if m[1] else G[m[2].upper()], "core", None
            if m := re.search(r"ΚΑΤΕΥΘΥΝΣΗΣ\s*[‘'«\"]([^’'»\"]+)|ΚΑΤΕΥΘΥΝΣΗ:\s*(\S.*)", line):
                kind, group = "track_core", norm(m[1] or m[2])
            elif re.match(r"ΥΠΟΧΡΕΩΤΙΚΑ", line): kind = "track_core" if group else "core"
            elif re.search(r"ΕΠΙΛΟΓ|Επιλογ|επιλογ|ΕΠΙΛΕΓΟΜΕΝ|Επιλεγόμεν", line):
                kind = "elective"
                if m := re.search(r"ΕΠΙΛΟΓΗΣ\s*[‘'«\"]([^’'»\"]+)", line): group = norm(m[1])
            continue
        title = next((c for c in cs[1:] if re.search(r"[^\W\d_]{3}", c) and not re.fullmatch(code_re, c)), None)
        if title: title = re.sub(r"(?<=[α-ωά-ώ])- (?=[α-ωά-ώ])", "", re.sub(r"\s+Electives - .*$", "", title))  # "Μεταβλη- τής": hyphenated at a line end
        mark = next((c for c in cs[2:5] if c in ("Υ", "Y", "Ε", "E", "ΕΥ", "ΥΕ")), None)  # a Υ/Ε column, when there is one
        if mark: kind = "core" if mark in ("Υ", "Y") else "elective"
        had = seen.get(cs[0])  # later mentions (description pages) repeat a code: the first wins, except another track
        if title and (not had or group and had[0] == kind and group not in had[1]):
            seen.setdefault(cs[0], (kind, set()))[1].add(group)
            out.append({"code": cs[0], "name": case(title) if title.isupper() else title, "semester": sem, "kind": kind,
                        "group": group and (case(group) if group.isupper() else group)})
            prev = out[-1]
    return out

if __name__ == "__main__":
    for d in sys.argv[1:] or DEPTS:
        pdf, src, code_re, a, b, free, header = (*DEPTS[d], False, None)[:7]
        rows = parse(pdf, code_re, a, b, header)
        for r in rows:
            if free and r["kind"] == "elective": r["semester"] = None
        save("upatras", f"upatras-{d}", src, rows)
