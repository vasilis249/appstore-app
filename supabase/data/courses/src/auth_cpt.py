# ΑΠΘ departments with one WordPress page per course (auth_fetch.py → raw/auth-<dept>/NNNN.html). Each site prints
# the course's fields differently; PARSE[dept](lines) → row or None (not a current undergraduate course).
# Usage: auth_cpt.py [dept…]   ·   auth_cpt.py --show <dept> [n]  (prints the text lines of a few pages)
import glob, html, re, sys
from lib import save, norm, recaser
SOURCES = {"chemeng": "https://cheng.auth.gr/courses/", "phil": "https://lit.auth.gr/lit-courses/", "physics": "https://www.physics.auth.gr/course/",
           "polsci": "https://www.polsci.auth.gr/course_polsci/"}
GREEK = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8, "Θ": 9, "Ι": 10}

def text(path):
    s = open(path, encoding="utf-8", errors="ignore").read()
    s = re.sub(r"(?s)<script.*?</script>|<style.*?</style>|<header.*?</header>|<nav.*?</nav>|<footer.*?</footer>|<!--.*?-->", "", s)
    return [norm(l) for l in html.unescape(re.sub(r"<[^>]+>", "\n", s)).split("\n") if norm(l)]

def title_of(L):
    return re.sub(r"\s*[–-]\s*(Τμήμα|Department).*$", "", L[0]) if L else ""

def after(L, label, n=1):
    """the value after a label line ("Κωδικός Μαθήματος:" → next line), or on the same line after the colon."""
    for i, l in enumerate(L):
        if re.match(label, l):
            rest = norm(re.sub(label, "", l, count=1).lstrip(":").strip())
            return rest or (L[i + n] if i + n < len(L) else None)

def semester(v):
    if not v: return None
    if m := re.search(r"(\d{1,2})\s*(?:ο|o|º)?", v): return int(m[1])
    if m := re.search(r"(ΣΤ|[ΑΒΓΔΕΖΗΘΙ])['΄’]?", v): return GREEK[m[1]]

PARSE = {}
def chemeng(L):  # "Τίτλος | 7ο | Εξάμηνο | ( | Υποχρεωτικό | ) | … | Κωδικός Μαθήματος: ΒΕ7"
    i = L.index("Εξάμηνο")
    return {"name": L[1], "code": after(L, r"Κωδικός Μαθήματος:"), "semester": semester(L[i - 1]),
            "kind": "elective" if L[i + 2].startswith("Επιλογ") else "core"}
PARSE["chemeng"] = chemeng

case = recaser([], hand={"ψυχογλωσσολογια": "ψυχογλωσσολογία", "πραγματολογιασ": "πραγματολογίας", "πραγματολογια": "πραγματολογία",
    "παπυρολογια": "παπυρολογία", "λεξικολογια": "λεξικολογία", "κειμενογλωσσολογια": "κειμενογλωσσολογία"})
def phil(L):  # "ΛΦΙ127: ΕΠΟΣ - ΔΡΑΜΑ | (5 ECTS) | Προπτυχιακό | 3o εξάμηνο | … | Υποχρεωτικό (κορμού)"; electives have no semester
    k = next((i for i, l in enumerate(L) if re.fullmatch(r"\(\d+(?:[.,]\d+)? ECTS\)", l)), None)
    if k is None or L[k + 1] != "Προπτυχιακό": return None
    code, _, title = L[k - 1].partition(": ")
    if re.search(r"ERASMUS|παλαιούς", code): return None  # Erasmus-only, and the old programme kept for older students
    seg = L[k:k + 8]
    sem = next((int(m[1]) for l in seg if (m := re.fullmatch(r"(\d+)[oο] εξάμηνο", l))), None)
    return {"name": case(title) if title.isupper() else title, "code": code, "semester": sem,
            "kind": "core" if any(l.startswith("Υποχρεωτικό") for l in seg) else "elective"}
PARSE["phil"] = phil

def physics(L):  # 2022 programme only; the code's 3rd letter: Υ = υποχρεωτικό, Ε = επιλογής ("ΑΑΥ1201", "ΓΘΕ5102")
    if "Πρόγραμμα Σπουδών 2022" not in L: return None
    code = after(L, r"Κωδικός Μαθήματος:")
    return {"name": L[1], "code": code, "semester": semester(after(L, r"Εξάμηνο Σπουδών:")),
            "kind": "core" if code[2] in "ΥY" else "elective"}
PARSE["physics"] = physics

def polsci(L):  # bilingual labels: "Κύκλος / Επίπεδο: | Cycle / Level: | Προπτυχιακό | Υποχρεωτικό / Επιλογής: | … | Υποχρεωτικό";
    # only a teaching period (winter / spring), no semester
    if after(L, r"Κύκλος / Επίπεδο:", 2) != "Προπτυχιακό": return None
    i = L.index("Κωδικός Μαθήματος:")
    return {"name": L[1], "code": L[i + 3], "semester": None,
            "kind": "core" if after(L, r"Υποχρεωτικό / Επιλογής:", 2) == "Υποχρεωτικό" else "elective"}
PARSE["polsci"] = polsci

def rows(dept):
    out = []
    for f in sorted(glob.glob(f"raw/auth-{dept}/*.html")):
        L = text(f)
        if L and (r := PARSE[dept](L)):
            out += r if isinstance(r, list) else [r]
    return out

if __name__ == "__main__":
    if sys.argv[1:2] == ["--show"]:
        files = sorted(glob.glob(f"raw/auth-{sys.argv[2]}/*.html"))
        for f in files[:: max(1, len(files) // int(sys.argv[3] if len(sys.argv) > 3 else 3))][:int(sys.argv[3] if len(sys.argv) > 3 else 3)]:
            print("==", f); print(" | ".join(text(f)[:45]))
        sys.exit()
    for dept in sys.argv[1:] or SOURCES:
        save("auth", f"auth-{dept}", SOURCES[dept], rows(dept))
