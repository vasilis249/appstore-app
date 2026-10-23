# Πανεπιστήμιο Πελοποννήσου: every department site (www.uop.gr/sholes-kai-tmimata links them) runs the same Drupal theme
# with a «/courses» view: one block per «Εξάμηνο X» (or «Μαθήματα Επιλογής Χειμερινού Εξαμήνου» …), one table per
# category or track — the caption is either the category (Κορμού, Βασικά / Επιλογής Κατεύθυνσης X, Ελεύθερης Επιλογής)
# or a track name; tables with a «Κατηγορία» column give each course's category there.
# Fetch: raw/uop/c-<host>.html = https://<host>.uop.gr/courses (ts: /courses-new); browser user agent.
import re
import html as h
import html_programme as hp
from lib import save, missing, recaser, norm

case = recaser([])
HOSTS = {"dit": "dit", "econ": "es", "mst": "det", "ds": "ds", "phil": "phil", "hist": "ham", "socpol": "dsep",
         "polsci": "pedis", "theatre": "ts", "pdart": "pda", "sport": "sportmanagement", "agri": "agro", "food": "fst",
         "ba": "boa", "acc": "accfin", "nurs": "nrs", "speech": "slt", "nutr": "nds", "physio": "physiotherapy",
         "civil": "civil", "mech": "mech"}
LETTER = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8, "Θ": 9, "Ι": 10}

def text(x): return norm(h.unescape(re.sub(r"<[^>]+>", " ", x)))
def semester(head):
    t = hp.up(head)
    if (m := re.search(r"ΕΞΑΜΗΝΟ\s*(\d+)", t)): return int(m[1])
    if (m := re.search(r"ΕΞΑΜΗΝΟ\s*(ΣΤ|[Α-Ι])\b", t)): return LETTER[m[1]]
    return None
def kind_of(s):
    t = hp.up(s)
    if "ΕΛΕΥΘΕΡ" in t or "ΕΠΙΛΟΓ" in t or "ΠΡΑΚΤΙΚΗ" in t or "ΠΑΙΔΑΓΩΓΙΚΗΣ ΚΑΙ ΔΙΔΑΚΤΙΚΗΣ" in t: return "elective"
    if "ΚΑΤΕΥΘΥΝΣ" in t or t.startswith("ΒΑΣΙΚΑ"): return "track_core"
    if "ΥΠΟΧΡΕΩΤ" in t or "ΚΟΡΜ" in t: return "core"
    return None
def tracks_of(cap):
    if (names := re.findall(r"Κατεύθυνσης (.+?)(?= και Κατεύθυνσης|$)", cap)): return names
    if kind_of(cap) or re.search(r"ΔΥΟ Ή ΠΕΡΙΣΣΟΤΕΡΕΣ", cap): return []
    return [p.strip() for p in cap.split(",")]  # the caption is the track itself

def department(host):
    s = re.sub(r"(?s)<script.*?</script>|<style.*?</style>", "", open(f"raw/uop/c-{host}.html", encoding="utf-8").read())
    rows = []
    for block in s.split('<div class="view-grouping-header">')[1:]:
        head = text(block.split("</div>", 1)[0])
        sem = semester(head)
        for tm in re.finditer(r"(?s)<table.*?</table>", block):
            t = tm[0]
            cap = text(m[1]) if (m := re.search(r"(?s)<caption>(.*?)</caption>", t)) else ""
            if "taxonomy-term" in (m[1] if m else ""):  # a caption that renders the category's own term page
                cap = text(re.search(r'field__item">(.*?)</div>', m[1])[1])
            cols = [text(c) for c in re.findall(r"(?s)<th[^>]*>(.*?)</th>", t)]
            for tr in re.findall(r"(?s)<tr[^>]*>(.*?)</tr>", t)[1:]:
                cells = [text(c) for c in re.findall(r"(?s)<td[^>]*>(.*?)</td>", tr)]
                if len(cells) < 2 or not cells[1]: continue
                c = dict(zip(cols, cells))
                cat = c.get("Κατηγορία", "")
                kind = kind_of(cat) or kind_of(cap) or kind_of(head) or "core"
                groups = [g for g in tracks_of(cap)] if cap else []
                if kind == "core" and groups: kind = "track_core"
                if kind == "track_core" and not groups: kind = "core"
                for g in groups or [None]:
                    name = re.sub(r"\s*\((?:ΔΕΝ ΘΑ ΔΙΔΑΧΘΕΙ|Δεν θα διδαχθεί)[^)]*\)|\s*\(στην αγγλική για φοιτητές Erasmus.*$", "",
                                  c.get("Τίτλος", cells[1]))  # notes about this year's teaching
                    rows.append({"code": c.get("Κωδικός") or None, "name": name, "semester": sem,
                                 "kind": kind, "group": g and "Κατεύθυνση " + (case(g) if g.isupper() else g),
                                 **({"keep": True} if sem is None else {})})
    first, out = {}, []
    for r in rows:  # a course offered in several semesters («Εξάμηνο Γ / Ε / Ζ» blocks too) keeps its first
        k = (r["code"] or r["name"]).lower()
        if first.setdefault(k, r["semester"]) != r["semester"]: continue
        out.append(r)
    return out

for dept, host in HOSTS.items():
    if host == "ts": src = "https://ts.uop.gr/courses-new"
    else: src = f"https://{host}.uop.gr/courses"
    save("uop", f"uop-{dept}", src, hp.finish(department(host), case))
missing("uop", "uop-ece", ["https://ece.uop.gr/", "https://www.ece.uop.gr/"], "site unreachable from this container")
