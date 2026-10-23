# Πανεπιστήμιο Δυτικής Μακεδονίας: each department's own programme (WordPress page with tables, or the newest guide /
# programme PDF on its site), read with html_programme. Fetch into raw/uowm/ (browser user agent; files named below);
# ot.docx → ot-pps.html with docx_html.py. eled.uowm.gr refuses this container (HTTP 403 on every page).
import re
import html_programme as hp
from html_tables import tables
from pdftext import pages
from lib import save, missing, recaser, fold, norm

U = "https://{}.uowm.gr/"
case = recaser([], hand={**{fold(w).strip(): w for w in "εργοθεραπεία εργοθεραπείας εργοθεραπευτική μεγαδεδομένα τελειόμηνου συνεργατισμός".split()},
                          fold("ΣΥΜΠΕΡΙΦΟΡΗ").strip(): "συμπεριφορά"})  # typo in the agri programme

def html(f): return tables(f"raw/uowm/{f}.html")
def pdf(f, a=0, b=None): return hp.pdf_tabs(f"raw/uowm/{f}.pdf", a, b)
def text(f, a, b): return "\n".join(pages(f"raw/uowm/{f}.pdf")[a:b]).split("\n")
def done(dept, src, rows, note=None, groups=None):
    rows = [r for r in rows if (r["semester"] is not None or r.get("keep"))
            and not re.fullmatch(r"(?i)κατηγορία|μάθημα|μαθήματα|κωδικός|ects|σύνολο", r["name"])]
    save("uowm", f"uowm-{dept}", src, hp.finish(rows, case, groups), note)

# Ηλεκτρολόγων Μηχανικών και Μηχανικών Υπολογιστών: guide 2026-27, programme pages (semesters 1–6 common, 7–9 per track)
done("ece", U.format("ece") + "wp-content/uploads/2026/10/ΟΔΗΓΟΣ-ΣΠΟΥΔΩΝ-ΤΗΜΜΥ-2026-2027.pdf",
     hp.text_courses(text("ece", 57, 72), r"[A-ZΑ-Ω]{1,4}\d{1,2}(?:-[A-ZΑ-Ω])?",
                     skip=r"^(Κωδικός|Μάθημα|Μαθήματος|επιλογής|Σύνολο|\(|Τμήμα Ηλεκτρολόγων)"),
     note="guide 2026-27", groups={"Κατεύθυνση Τηλεπικοινων": "Κατεύθυνση Τηλεπικοινωνιών και Δικτύων",
                                   "Κατεύθυνση Υπολογ": "Κατεύθυνση Υπολογιστών και Ηλεκτρονικής",
                                   "Κατεύθυνση Ενεργ": "Κατεύθυνση Ενέργειας"})

# Μηχανικών Ορυκτών Πόρων: programme page (8th–9th semester per track: "at least 4 of 5" track courses → elective)
done("mre", U.format("mre") + "spoydes/proptychiakes-spoydes/programma-spoydon/", hp.courses(html("mre")))

# Μηχανικών Σχεδίασης Προϊόντων και Συστημάτων: programme 2026-27; ΥΕΚ1–3 = electives of track 1–3, ΕΕ = free electives
def ide_kind(t, section):
    if t and (m := re.fullmatch(r"ΥΕΚ(\d)", t)): return "elective", f"Κατεύθυνση {m[1]}"
    return hp.default_kind(t, section)
rows = hp.courses(html("ide"), kind=ide_kind)
for r in rows: r["name"] = re.sub(r"^[KΚ]\d\s*-\s*", "", r["name"])
done("pdse", U.format("ide") + "programma-spoydon-2026-2027/", rows, note="programme 2026-27")

# Οργάνωσης και Διοίκησης Επιχειρήσεων / Στατιστικής / Οικονομικών / Πληροφορικής / Επικοινωνίας και Ψηφιακών Μέσων:
# programme pages
done("ba", U.format("ba") + "σπουδές/proptychiakes/programma-spoudwn/", hp.courses(html("ba")))
done("stat", U.format("stat") + "πρόγραμμα-σπουδών/", hp.courses(html("stat")))
done("econ", U.format("econ") + "courses/", hp.courses(html("econ"), sticky=True))
done("csd", U.format("cs") + "archiki-selida/programma-spoudwn/", hp.courses(html("cs")))
done("comm", U.format("cdm") + "programma-spoudon/", hp.courses(html("cdm")))

# Εργοθεραπείας: programme 2022-23 (docx); ΕΜ column = Υ / Ε
done("ot", U.format("ot") + "wp-content/uploads/sites/14/2022/10/Πρόγραμμα-Σπουδών-Τμήματος-Εργοθεραπείας-2022-23.docx",
     hp.courses(html("ot-pps")), note="programme 2022-23")

# Λογιστικής και Χρηματοοικονομικής: programme (2023)
done("acc", U.format("accfin") + "wp-content/uploads/2023/09/Πρόγραμμα-Σπουδών_2.pdf", hp.courses(pdf("accfin")))

# Μαιευτικής: programme 2025. A cell "ΕΠΙΛΟΓΗΣ: Επιλέγετε 1 από τα 3 A B C" runs three capital titles together with
# nothing to split them on → left out; "Προαιρετικό: X" = optional course X
rows = [r for r in hp.courses(pdf("mw")) if not r["name"].upper().startswith("ΕΠΙΛΟΓΗΣ:")]
for r in rows: r["name"] = re.sub(r"(?i)^προαιρετικό:\s*", "", r["name"])
done("midwife", U.format("mw") + "wp-content/uploads/sites/13/2026/03/ΠΡΟΓΡΑΜΜΑ-ΣΠΟΥΔΩΝ-2025-ΙΣΤΟΣΕΛΙΔΑ.pdf", rows,
     note="programme 2025; the one-of-three elective cells of semesters 3, 4, 8 list unseparated titles and are left out")

# Χημικών Μηχανικών: programme 2025-26 (cells "ΜΠ103 Title (TEACHER)")
rows = hp.courses(pdf("chemeng"))
for r in rows:
    if m := re.match(r"([A-ZΑ-Ω]{2,4}\d{2,3})\s+(.*)", r["name"]): r["code"], r["name"] = m[1], m[2]
    r["name"] = norm(re.sub(r"\s*\([^()]*[Α-ΩA-Z]{3,}[^()a-zα-ω]*\)\s*$", "", r["name"]))
done("chemeng", U.format("chemeng") + "wp-content/uploads/2025/10/ΠΡΟΓΡΑΜΜΑ-ΣΠΟΥΔΩΝ-ΤΧΜ-2025-2026.pdf", rows,
     note="programme 2025-26")

# Μηχανολόγων Μηχανικών: guide 2022-23 programme tables (pages 19–36; numeric codes; ΥΚ / ΕΚ per track)
done("mech", U.format("mech") + "wp-content/uploads/2019/10/Curriculum-Greek-20-06-22-with-names-spring.pdf",
     hp.courses(pdf("mech", 18, 36), code_re=r"\d{3}"), note="guide 2022-23")

# Γεωπονίας: revised programme 2026-27 (common years 1–3, then Φυτικής / Ζωικής Παραγωγής tracks)
done("agri", U.format("agro") + "wp-content/uploads/2026/08/Αναθεωρημένο-Πρόγραμμα-Σπουδών-2026-2027.pdf",
     hp.courses(pdf("agro"), sticky=True), note="programme 2026-27")

# Μαθηματικών: guide 2025-26, "Μαθήματα ανά εξάμηνο" (ΜΥ = compulsory, ΜΕ = elective)
done("math", U.format("math") + "wp-content/uploads/sites/3/2025/09/ΟΔΗΓΟΣ-ΣΠΟΥΔΩΝ_2025-2026_v2.pdf",
     hp.text_courses(text("math", 20, 25), r"Μ[ΥΕ]\d{2,3}", skip=r"^(Α/Α|Θ Φ|Οδηγός Σπουδών)"), note="guide 2025-26")

# Διεθνών και Ευρωπαϊκών Οικονομικών Σπουδών: guide (2022), programme pages
done("ieeo", U.format("iees") + "wp-content/uploads/sites/12/2022/05/Β11-OΔΗΓΟΣ-ΣΠΟΥΔΩΝ-ΤΜΗΜΑΤΟΣ-ΔΕΟΣ.pdf",
     hp.text_courses(text("iees", 9, 13), r"ΔΕΟΣ\d{3}", skip=r"^(ΜΑΘΗΜΑΤΑ ΩΡΕΣ|ΜΟΝΑΔΕΣ|ΣΥΝΟΛΟ)"), note="guide 2022")

# Ψυχολογίας: guide 2021 — programme tables (compulsory; elective slots skipped) + the elective courses described in it
# ("Κατ’ Επιλογήν Υποχρεωτικά Μαθήματα <area> …" → «Κωδικός Μαθήματος: Ψ-ΥΕ201 / Τίτλος Μαθήματος: …», no fixed semester)
rows = hp.courses(pdf("psy", 38, 43))
# whole text: a title or area wraps onto the next lines
area = None
blob = "\n".join(pages("raw/uowm/psy.pdf")[43:])
for m in re.finditer(r"(?s)(?:Κατ.\s*Επιλογήν Υποχρεωτικά Μαθήματα (?P<area>.+?)\s+που θα|"
                     r"Κωδικός Μαθήματος:\s*(?P<code>Ψ-\S+)\s+Τίτλος Μαθήματος:\s*(?P<title>.+?)\s+Διδάσκ)", blob):
    if m["area"]: area = norm(m["area"]); continue
    code = m["code"].replace("Y", "Υ")
    rows.append({"code": code, "name": norm(m["title"]), "semester": None, "kind": "elective", "keep": True,
                 "group": f"Επιλογής {area}" if "ΥΕ" in code else "Ελεύθερης επιλογής"})
done("psych", U.format("psy") + "wp-content/uploads/2021/01/odigos-spoudon-2021.pdf", rows,
     note="guide 2021 (programme + elective courses described in it)")

# Παιδαγωγικό Τμήμα Νηπιαγωγών: guide 2026-27, «Πρόγραμμα μαθημάτων» per semester; cells "0302Υ. Title"
# (suffix Υ = compulsory, ΥΕ = compulsory elective (didactics), Ε = elective)
# (a didactics cell lists several: "2201ΥΕ. A ή / και 2209ΥΕ. B …" → one row each)
CODE = r"(\d{4}\s?(?:ΥΕ|YΕ|ΥE|YE|Υ|Y|Ε|E))\s*[.–-]?\s*"
rows = []
for r in hp.courses(pdf("nured", 27, 39)):
    parts = re.split(r"\s*(?:ή\s*/?\s*και\s*)?" + CODE, " " + r["name"])
    if len(parts) < 3:
        if re.match(r"Π\d+\.", r["name"]): rows.append(r)
        continue
    for code, name in zip(parts[1::2], parts[2::2]):
        code = code.replace(" ", "").translate(str.maketrans("YE", "ΥΕ"))
        rows.append({**r, "code": code, "name": norm(re.sub(r"\s*ή\s*/?\s*και$", "", name)),
                     "kind": "core" if code.endswith("Υ") and not code.endswith("ΥΕ") else "elective"})
done("preedu", U.format("nured") + "wp-content/uploads/2026/10/odigos-spoudon-2026-2027.pdf", rows, note="guide 2026-27")

# Εικαστικών και Εφαρμοσμένων Τεχνών: guide 2021-22 (newest published), programme by semester (studios + theory)
rows = [r for r in hp.courses(pdf("eetf", 55, 66)) if not re.search(r"(?i)κατ.\s*επίλογή|ects|^ΠΜ", r["name"])]
done("arts", U.format("eetf") + "wp-content/uploads/2021/06/ΟΔΗΓΟΣ-ΣΠΟΥΔΩΝ-2021-2022.pdf", rows, note="guide 2021-22")

missing("uowm", "uowm-primedu", [U.format("eled"), U.format("eled") + "wp-content/uploads/2025/10/ΟΔΗΓΟΣ-ΣΠΟΥΔΩΝ-ΔΗΜΟΤΙΚΗΣ-2025-26.pdf"],
        "site refuses this container (HTTP 403 on every page)")

# Διοικητικής Επιστήμης και Τεχνολογίας: guide 2021-22 (as amended 2023, embedded on the guide page), pages 26–33
done("mst", "https://mst.uowm.gr/wp-content/uploads/2023/06/21_Κ1_Απόσπασμα_ΕΞΕ_Έγκριση-τροποποιησης-με-προσθήκη-"
     "ΠΤΥΧΙΑΚΗΣ-ΕΡΓΑΣΙΑΣ-οδηγού-σπουδών-Τμήματος-ΔΕΤ_signed_με-συνημμένο.pdf",
     hp.courses(pdf("mst", 25, 33)), note="guide 2021-22 as amended in 2023")
