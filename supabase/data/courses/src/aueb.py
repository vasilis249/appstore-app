# ΟΠΑ (AUEB): every department's "Μαθήματα Προγράμματος Σπουδών" page on dept.aueb.gr (a Drupal view: grouping
# headers "Εξάμηνο: Nο" → "Υποχρεωτικά Μαθήματα" / "Μαθήματα Κατευθύνσεων" / "Μαθήματα Επιλογής …", table captions =
# direction, rows = course links). Pages without the kind (cs: <dt> semesters; stat) take it from each course page's
# "Υποχρεωτικό … / Επιλογής …" line. Usage: python3 aueb.py [dept …]  (fetches into raw/, cached)
import hashlib, html, os, re, subprocess, sys
from lib import save, norm

BASE = "https://www.dept.aueb.gr"
PAGES = {"aueb-econ": "/el/econ_courses", "aueb-deos": "/el/deos_courses", "aueb-ode": "/el/ode_courses",
         "aueb-dmst": "/el/dmst_courses", "aueb-stat": "/el/stat-courses", "aueb-cs": "/el/cs/courses",
         "aueb-mke": "/el/mbc_courses", "aueb-accfin": "/el/loxri_courses"}
NOTES = {"aueb-stat": "Kinds from each course page; «Προχωρημένες Μέθοδοι Δειγματοληψίας» (5th) states none and is left out."}
# semesters without a kind heading list required courses only
DEFAULT = {"aueb-accfin": "core"}
ORD = {"ΠΡΩΤΟΥ": 1, "ΔΕΥΤΕΡΟΥ": 2, "ΤΡΙΤΟΥ": 3, "ΤΕΤΑΡΤΟΥ": 4, "ΠΕΜΠΤΟΥ": 5, "ΕΚΤΟΥ": 6, "ΕΒΔΟΜΟΥ": 7, "ΟΓΔΟΟΥ": 8}


def fetch(url, name):
    path = f"raw/{name}.html"
    if not os.path.exists(path):
        subprocess.run(["bash", "get.sh", url, name], check=True, capture_output=True)
    return open(path, encoding="utf-8", errors="replace").read()


def text(s): return norm(html.unescape(re.sub(r"<[^>]+>", " ", s)))


def kind_of(header):
    h = header.lower()
    if "επιλογ" in h: return "elective"
    if "κατευθ" in h or "ροή" in h or "ροών" in h: return "track_core"
    if "υποχρεωτ" in h: return "core"
    return None


def page_kind(href, name):
    """Kind from a course page, right after its title: 'Υποχρεωτικό Μάθημα Πυρήνα, Δ’ εξάμηνο' (cs) or a line
    'Υποχρεωτικά Μαθήματα' / 'Μαθήματα Επιλογής' (stat)."""
    t = text(fetch(href if href.startswith("http") else BASE + href, name))
    t = t[t.find("Αναζήτηση για:"):][:500]
    m = re.search(r"Υποχρεωτικ\w*(?:\s+\w+){0,4}|\w*\s*Επιλογ\w*", t)
    line = m[0] if m else ""
    if re.search(r"επιλογ", line, re.I): return "elective"
    if re.search(r"κατεύθυνσ|ροής", line, re.I): return "track_core"
    return "core" if line else None


def parse(dept, url):
    h = fetch(BASE + url, f"{dept}-courses")
    tok = re.compile(r'view-grouping-header">(.*?)</div>|<caption>(.*?)</caption>|<dt>(.*?)</dt>'
                     r'|views-field-title[^>]*>\s*<a href="([^"]+)"[^>]*>(.*?)</a>'
                     r'|<p><a href="([^"]*/courses/\d+)"[^>]*>(.*?)</a>', re.S)
    rows, sem, kind, group, n, in_dir = [], None, None, None, 0, False
    for m in tok.finditer(h):
        if m[1] is not None or m[2] is not None:
            t = text(m[1] if m[1] is not None else m[2])
            if s := re.match(r"Εξάμηνο:\s*(\d+)", t): sem, kind, group, in_dir = int(s[1]), None, None, False
            elif m[1] is not None and re.match(r"(Κατεύθυνση|Ροή)\b", t): kind, group, in_dir = None, t, True
            elif (k := kind_of(t)) is not None:
                if in_dir: kind = "track_core" if k == "core" else k  # "ΥΠΟΧΡΕΩΤΙΚΑ" under a direction header
                else: kind, group = k, None
            elif m[2] is not None: group = t
        elif m[3] is not None:
            s = re.search(r"ΜΑΘΗΜΑΤΑ (\w+) ΕΞΑΜΗΝΟΥ", text(m[3]))
            if s: sem, kind, group = ORD[s[1]], None, None
        elif sem is not None:
            href, label = (m[4], m[5]) if m[4] is not None else (m[6], m[7])
            name = re.sub(r"\s*\((?:\d+(?:,\d+)?\s*-?\s*)+Π\.?\s?Μ\.?\)\s*$", "", text(label))
            name = re.sub(r"\s*\([^)]*εξάμηνο για το ακαδ[^)]*\)|\s*\((?:ΔΕΝ ΠΡΟΣΦΕΡΕΤΑΙ|Δεν προσφέρεται)[^)]*\)"
                          r"|\s+-\s+Προαιρετικ.*$|\s*\(X\d\)|\s+Δύο Κλιμάκια:?.*$|\*+$", "", name).strip()
            if not name or re.search(r"ERASMUS|Erasmus|επαναληπτικό", name): continue  # resits repeat a course
            n += 1
            k = kind or DEFAULT.get(dept) or page_kind(href, "aueb-c-" + hashlib.md5(href.encode()).hexdigest()[:10])
            if k is None: print("  ?", sem, name); continue
            rows.append({"name": name, "semester": sem, "kind": k, "group": group if k != "core" else None})
    return rows


if __name__ == "__main__":
    for dept in sys.argv[1:] or PAGES:
        rows = parse(dept, PAGES[dept])
        save("aueb", dept, BASE + PAGES[dept], rows, note=NOTES.get(dept))
