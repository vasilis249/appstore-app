# Δημοκρίτειο Πανεπιστήμιο Θράκης: duth.gr and most department sites refuse this container (TLS reset, proxy 502 / 503),
# so only the departments whose own programme pages answered are read here; the rest are recorded as missing.
# Fetch (browser user agent) into raw/duth/: cs-courses.html ← CS, ee-pps-2025.pdf ← EE, mst-pps.html ← MST,
# he-2025-all.html ← HE, pe-3483/3533/3560/3585.html (year pages) + pe-3933.html (electives) ← PE_*, psed-2023.html ← PSED.
# (ΤΕΦΑΑ's own guide sguidec.pdf is password protected; its year + electives pages carry the same programme.)
import re
from html_tables import tables
from pdftext import pages
from lib import save, missing, norm

CS = "https://cs.duth.gr/courses.xhtml"
EE = "https://www.ee.duth.gr/wp-content/uploads/Πρόγραμμα-Σπουδών-ακαδημαϊκού-έτους-2025-2026_v1.pdf"
MST = "https://www.mst.duth.gr/index.php/programma_spoudon/"
HE = "https://he.duth.gr/el/list_of_courses?field_academic_year_tid_i18n=149"
PE_YEARS = [3483, 3533, 3560, 3585]
PE = "https://phyed.duth.gr/?page_id=3933"
PSED = ("https://www.psed.duth.gr/endeiktiko-programma-spoydon/"
        "endeiktiko-programma-spoydon-gia-eisakteoys-apo-to-akadi-aiko-etos-2023-24/")
GREEK = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}

# Πληροφορική: "Εξάμηνο N" rows split the table; type Υ = core, ΥΕ / Ε = elective
rows, sem = [], None
for r in tables("raw/duth/cs-courses.html")[0][1]:
    if m := re.fullmatch(r"Εξάμηνο (\d+)", r[0]): sem = int(m[1]); continue
    if sem and len(r) == 5 and r[4] in ("Υ", "ΥΕ", "Ε"):
        rows.append({"code": r[0], "name": norm(r[1].lstrip("- ")), "semester": sem,
                     "kind": "core" if r[4] == "Υ" else "elective", "group": None})
save("duth", "duth-csd", CS, rows)

# ΗΜΜΥ: one page per semester; pages 1–6 are common to the three tracks, 7–9 one page per track, 10 = diploma thesis.
# Sections: ΥΠΟΧΡΕΩΤΙΚΑ → core (track_core on a track page), ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ / ΕΛΕΥΘΕΡΗΣ ΕΠΙΛΟΓΗΣ → elective.
# Titles wrap around the row line ("title above / N <numbers> / rest below"), so text above a row is kept as pending.
TRACKS = ["Ενεργειακού Ηλεκτρολόγου Μηχανικού", "Ηλεκτρονικού Ηλεκτρολόγου Μηχανικού και Μηχανικού Υπολογιστών",
          "Τηλεπικοινωνιακού Ηλεκτρολόγου Μηχανικού"]
ROW = re.compile(r"(\d+)\s+(.*?)\s*(\d+(?:,\d+)?|\d+ ή \d+)(\s+\d+(?:,\d+)?){4}")
SKIP = re.compile(r"^\d$|Σ\.Τ\./[ΣΕ]\.Τ\.|Δεν θα διδαχθεί|Α/Α|\(Δεν υπολογίζονται|έως \d+ ΜΑΘΗΜΑ|\d\(Υ\)\+")
CONNECT = ("και", "με", "της", "των", "του", "για", "στα", "στη", "στην", "στο", "σε", ":", "-", "/")
rows = []
for page in pages("raw/duth/ee-pps-2025.pdf")[:16]:
    lines = [norm(l) for l in page.split("\n") if norm(l)]
    sem = int(re.search(r"(\d+)ο Ε ξ ά μ η ν ο", page)[1])
    head = page[:page.find("Α/Α")]
    tracks = [t for t in TRACKS if t in head]
    track = tracks[0] if len(tracks) == 1 else None
    kind, group, pending, i = None, None, [], 0
    while i < len(lines):
        l = lines[i]; i += 1
        if "ΥΠΟΧΡΕΩΤΙΚΑ ΜΑΘΗΜΑΤΑ" in l: kind, group = ("track_core", track) if track else ("core", None); pending = []; continue
        if "ΕΛΕΥΘΕΡΗΣ ΕΠΙΛΟΓΗΣ" in l: kind, group = "elective", "Ελεύθερης επιλογής"; pending = []; continue
        if "ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ" in l: kind, group = "elective", track; pending = []; continue
        if l.startswith(("ΣΥΝΟΛΟ", "ΕΛΑΧΙΣΤΑ")): kind = None; continue
        if not kind or SKIP.search(l): continue
        m = ROW.fullmatch(l)
        if not m: pending.append(l); continue
        parts = pending + ([m[2]] if m[2] else [])
        nxt = lines[i] if i < len(lines) else ""
        # an empty row middle: the title may go on below — unless that line is the next course's title (its own row follows)
        if not m[2] and nxt and not ROW.fullmatch(nxt) and not SKIP.search(nxt) and not nxt.startswith(("ΣΥΝΟΛΟ", "ΕΛΑΧΙΣΤΑ")) \
           and "ΜΑΘΗΜΑΤΑ" not in nxt and not (i + 1 < len(lines) and ROW.fullmatch(lines[i + 1]) and not ROW.fullmatch(lines[i + 1])[2]) \
           and (nxt[0].islower() or (parts and parts[-1].endswith(CONNECT)) or len(nxt.split()) <= 2):
            parts.append(nxt); i += 1
        pending = []
        name = norm(" ".join(parts))
        if name.startswith("Οποιοδήποτε"):  # "any compulsory course of the other tracks" — not a course
            if nxt.startswith("εξαμήνου"): i += 1
            continue
        if name: rows.append({"code": None, "name": name, "semester": sem, "kind": kind, "group": group})
core = {(r["name"], r["semester"]) for r in rows if r["kind"] != "elective"}
rows = [r for r in rows if r["kind"] != "elective" or (r["name"], r["semester"]) not in core]  # compulsory in another track
save("duth", "duth-ece", EE, rows, note="programme 2025-26")

# Διοικητικής Επιστήμης και Τεχνολογίας: "Nο ΕΞΑΜΗΝΟ" rows, "Κατεύθυνση X (επιλογή …)" rows open a track;
# Υ = core, ΥΚ = track core, Ε / ΕΚ = elective
MST_KIND = {"Υ": "core", "ΥΚ": "track_core", "Ε": "elective", "ΕΚ": "elective"}
rows, sem, track = [], None, None
for r in tables("raw/duth/mst-pps.html")[0][1]:
    if m := re.fullmatch(r"(\d+)ο ΕΞΑΜΗΝΟ", r[0]): sem, track = int(m[1]), None; continue
    if m := re.match(r"(Κατεύθυνση [^(]+)", r[0]): track = norm(m[1]); continue
    if sem and len(r) == 4 and r[3] in MST_KIND and r[0]:
        rows.append({"code": None, "name": norm(r[0]), "semester": sem, "kind": MST_KIND[r[3]],
                     "group": track if r[3] in ("ΥΚ", "ΕΚ") else None})
save("duth", "duth-mst", MST, rows)

# Ιστορίας και Εθνολογίας: the 2025-26 course list (semester "Nο", or only winter / spring → no fixed semester)
ZONES = {"Υποχρεωτικό": ("core", None), "Υποχρεωτικό κατ' Επιλογή Κατεύθυνσης Εθνολογίας": ("elective", "Κατεύθυνση Εθνολογίας"),
         "Υποχρεωτικό κατ' Επιλογή Κατεύθυνσης Ιστορίας": ("elective", "Κατεύθυνση Ιστορίας"),
         "Ελεύθερης Επιλογής": ("elective", "Ελεύθερης επιλογής"), "Ξένη Γλώσσα": ("elective", "Ξένη γλώσσα"),
         "Σεμιναριακό": ("elective", "Σεμινάρια")}
rows = []
for r in tables("raw/duth/he-2025-all.html")[0][1][1:]:
    kind, group = ZONES[r[3]]
    m = re.fullmatch(r"(\d+)ο", r[2])
    rows.append({"code": r[0] or None, "name": norm(r[1]), "semester": int(m[1]) if m else None, "kind": kind, "group": group})
save("duth", "duth-hist", HE, rows, note="course list 2025-26")

# ΤΕΦΑΑ: year pages = compulsory courses per semester (the surname halves swap some between semesters 1/2 and 3/4 →
# earliest); "Επιλογή N" are slots, filled from the electives page ("Επιλογές Γ’ & Δ’ εξαμήνου" → semester 3)
rows = []
for p in PE_YEARS:
    for head, table in tables(f"raw/duth/pe-{p}.html"):
        sem = GREEK[re.match(r"(ΣΤ|[ΑΒΓΔΕΖΗ])’", head.split("\n")[-1].strip())[1]]
        rows += [{"code": r[0], "name": norm(r[1]), "semester": sem, "kind": "core", "group": None}
                 for r in table[1:] if r[0] and not r[1].startswith("Επιλογή")]
for head, table in tables("raw/duth/pe-3933.html"):
    sem = GREEK[re.search(r"(ΣΤ|[ΑΒΓΔΕΖΗ])’", head)[1]]
    rows += [{"code": r[0], "name": norm(r[1]), "semester": sem, "kind": "elective", "group": None} for r in table[1:] if r[0]]
first = {}
for r in rows: first[r["code"]] = min(first.get(r["code"], 99), r["semester"])
rows = [r for r in rows if r["semester"] == first[r["code"]]]
save("duth", "duth-pe", PE, rows, note="programme from 2025 (year pages + electives page)")

# Προσχολική: indicative programme for students admitted from 2023-24; "Nο ΕΞΑΜΗΝΟ" = core,
# «Κατ’ επιλογήν υποχρεωτικά μαθήματα Nου εξαμήνου» = elective; placeholders («Πτυχιακή εργασία ή Μάθημα επιλογής») dropped
rows = []
for head, table in tables("raw/duth/psed-2023.html"):
    sem = int(re.search(r"(\d+)ο", head)[1])
    elective = "επιλογήν" in head
    for r in table[1:]:
        if r[0] in ("", "-") or " ή Μάθημα επιλογής" in r[1] or "Μάθημα επιλογής" == r[1]: continue
        lang = r[0].startswith("Ξ")
        rows.append({"code": norm(r[0]), "name": norm(r[1]), "semester": sem,
                     "kind": "elective" if elective or lang else "core", "group": "Ξένη γλώσσα" if lang else None})
save("duth", "duth-ecedu", PSED, rows, note="indicative programme for students admitted from 2023-24")

# the rest: duth.gr and these department sites refuse this container (re-run from a normal network)
SITES = {"law": "law", "socwork": "sw", "socpol": "sp", "polsci": "polsci", "econ": "econ", "grphil": "helit", "blacksea": "bscc",
         "ot": "ot", "civil": "civil", "env": "env", "arch": "arch", "pme": "pme", "med": "med", "mbg": "mbg", "nurs": "nurs",
         "primedu": "eled", "psych": "psy", "agrdev": "agro", "forest": "fmenr", "wine": "vine", "climate": "nerc",
         "physics": "physics", "chem": "chem", "acc": "af"}
for dept, host in SITES.items():
    missing("duth", f"duth-{dept}", [f"https://{host}.duth.gr/", "https://duth.gr/Σπουδές/Προπτυχιακές-Σπουδές"],
            "site refuses this container (TLS reset / proxy 502–503)")
