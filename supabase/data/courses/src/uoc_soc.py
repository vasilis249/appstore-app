# Κρήτη Κοινωνιολογίας: Οδηγός Σπουδών 2026-27 (raw/uoc/soc-guide.pdf). §5 «Ενδεικτικό πρόγραμμα» (pp. 13-15) gives the
# semesters 1-4 ("CODE title TYPE"); §6 «Γενικός Κατάλογος» (pp. 16-23) lists every course under its heading:
# Α = core, Β (area background) / Γ (required-choice lectures and seminars) = electives grouped by area.
import re
from lib import save, norm
from pdftext import pages
SRC = "https://sociology.soc.uoc.gr/spoudes/organosi-spoudon/odigos-spoudon-kai-mathimata/"
CODE = re.compile(r"([Α-Ω]{3,4}) ?(\d{3}(?:-ΕΡΓ)?)\s+(.+)")
AREA = {"Α": "Κοινωνικοί Μετασχηματισμοί, Ανισότητες, Δικαιώματα", "Β": "Πολιτισμός: Κοινωνικές Πρακτικές και Συγκρούσεις"}
lines = lambda a, b: [norm(l) for t in pages("raw/uoc/soc-guide.pdf", a, b) for l in t.splitlines() if norm(l)]
sem, s = {}, None
for l in lines(13, 15):
    if m := re.match(r"(\d)ο Εξάμηνο$", l): s = int(m[1])
    elif s and (m := CODE.match(l)) and re.search(r"ΥΠΟ(ΓΓ)?$", l): sem[m[1] + m[2]] = s
out, kind, group, cont = [], None, None, False
for l in lines(16, 23):
    if l.startswith("Γ. Περαιτέρω"): break
    if re.match(r"Α\.\d", l): kind, group = "core", None; continue
    if m := re.match(r"(Β\.\d|Γ\.[\d.]+):? ", l):
        kind, area = "elective", re.search(r"Επιστημονική Περιοχή ([ΑΒ])", l)
        group = AREA[area[1]] if area else "Υποβάθρου" if "Υποβάθρου" in l and "Ειδικού" not in l else "Διαθεματικά" if "Διαθεματικ" in l else None
        continue
    if kind and (m := CODE.match(l)):
        code = m[1] + " " + m[2]
        out.append({"code": code, "name": m[3], "semester": sem.get(m[1] + m[2]), "kind": kind, "group": group}); cont = True
    elif re.match(r"\d", l): cont = False  # page number / footnote: no more title continuations
    elif kind and cont and not re.match(r"[ΑΒΓ]\.", l):
        out[-1]["name"] = norm(out[-1]["name"] + " " + l)  # wrapped title
save("uoc", "uoc-soc", SRC, out)
