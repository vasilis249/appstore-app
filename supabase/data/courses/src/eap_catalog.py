# Ελληνικό Ανοικτό Πανεπιστήμιο: each undergraduate programme page (www.eap.gr/education/undergraduate/<slug>/) lists its
# Θεματικές Ενότητες (year-long modules, 10-20 ECTS) by year («1ο έτος σπουδών») or by semester («1ο Εξάμηνο»), some
# with the type «(Υ, 20 ECTS)» / «(Ε, …)». A year-long module is filed under the year's first semester (2y − 1).
# Where the page gives no type, the choice comes from the page's own «Οδηγίες επιλογής» (CHOICE below).
# Fetch: raw/eap/p-<id>.html (browser user agent).
import re
import html as h
import html_programme as hp
from lib import save, recaser, norm

case = recaser([])
SLUG = {"did": "public-administration", "deo": "business-organizational-management", "dit": "tourism-administration",
        "isp": "spanish-language-and-culture", "pli": "computer-science", "fye": "studies-in-physical-sciences",
        "elp": "studies-in-greek-culture", "epo": "european-studies-history-society-and-civilization",
        "ski": "spoudes-kinimatografikis-grafis-praktikis-ereunas"}
# «να επιλέξουν ακόμα μία μεταξύ …», «δύο (2) εκ των ακόλουθων πέντε (5)», «1 από τις ΘΕ ΕΠΟ 20, ΕΠΟ 21 και ΕΠΟ 22»,
# «3 από τις ΘΕ που προσφέρονται» (elp 4th year)
CHOICE = {"deo": {"ΔΕΟ33", "ΔΕΟ45", "ΔΕΟ41", "ΔΕΟ44"}, "did": {"ΔΗΔ82", "ΔΗΔ83", "ΔΗΔ84", "ΔΗΔ85", "ΔΗΔ86"},
          "elp": {"ΕΠΟ20", "ΕΠΟ21", "ΕΠΟ22"}}
CODE = r"(?:[Α-Ω]{3} ?\d{2,3}[Α-Ω]?|[Α-Ω]{3}(?:ΠΡΟ|ΨΙ+)|ΕΘΕ[Α-Ω]{2,5}|ΦΥΕ Π[ΕΑ])"

def tokens(f):
    s = re.sub(r"(?is)<script.*?</script>|<style.*?</style>", "", open(f"raw/eap/{f}.html", encoding="utf-8").read())
    t = " | ".join(x for x in (norm(h.unescape(y)) for y in re.split(r"<[^>]+>", s)) if x)
    t = re.sub(r"(\d) \| ο \| ", r"\1ο ", t)  # «1 | ο | Εξάμηνο» (superscript ο)
    t = re.sub(r"(\d+) \| ος \| ", r"\1ος ", t)
    return t.split(" | ")

def programme(d):
    t = tokens(f"p-{d}")
    start = next(i for i, x in enumerate(t) if re.match(r"(?:\d+ο|[Α-Δ]’) (?:έτος|Έτος) [Σσ]πουδών$|1ο Εξάμηνο$", x)
                 and i > 200)
    rows, sem, year_sem, section = [], None, None, None
    for i in range(start, len(t)):
        x = t[i]
        if re.match(r"Προαπαιτούμεν|Οδηγίες|Συντονιστές|Κανονισμός Εργαστηρίων", x): break
        if (m := re.match(r"(\d+)ο (?:έτος|Έτος) σπουδών$", x)) or (m := re.match(r"([Α-Δ])’ Έτος Σπουδών$", x)):
            y = int(m[1]) if m[1].isdigit() else hp.GREEK[m[1]]
            sem = year_sem = 2 * y - 1; continue
        if (m := re.match(r"(\d+)ο Εξάμηνο$", x)): sem = int(m[1]); continue
        if re.match(r"Θ\.Ε\. Κορμού|Οι Εργαστηριακές", x): section = "core"; continue
        if re.match(r"ΘΕ Επιλογής|Θ\.Ε\. Επιλογής|Και επιλογή", x): section = "elective"; continue
        m = re.fullmatch(rf"({CODE})(?: \(ΕΘΕ\))?(?: (.+))?", x)
        if not m or x.startswith(("ΘΕ ", "Θ.Ε.")): continue
        name = m[2] or (t[i + 1] if i + 1 < len(t) else "")
        if not name or re.fullmatch(CODE, name): continue
        typ = next((y for y in t[i + 1:i + 4] if re.match(r"\(?[ΥΕ][¹²³]?,", y)), "")
        code = m[1].replace(" ", "")
        kind = "elective" if section == "elective" or typ.lstrip("(").startswith("Ε") or code in CHOICE.get(d, ()) \
            or (d == "elp" and sem == 7) else "core"
        name = re.sub(r"^Εργαστηριακή ΘΕ |\s*\(Τύπος.*$", "", name)
        rows.append({"code": code, "name": name, "semester": sem, "kind": kind, "listed": section is not None})
    first, out = {}, []
    for r in rows:  # the «Θ.Ε. Κορμού / Επιλογής» lists repeat the year lists: keep the first (its year), take their kind
        listed, k = r.pop("listed"), r["code"]
        if k in first:
            if listed: first[k]["kind"] = r["kind"]
            continue
        first[k] = r; out.append(r)
    save("eap", f"eap-{d}", f"https://www.eap.gr/education/undergraduate/{SLUG[d]}/", hp.finish(out, case))

for d in SLUG: programme(d)
