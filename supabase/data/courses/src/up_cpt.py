# Πάτρα departments with one page per course (up_fetch.py → raw/up-<dept>/NNNN.html): PARSE[dept](text lines) → row or
# None. Usage: up_cpt.py [dept…]   ·   up_cpt.py --show <dept> [n]
import glob, re, sys
from lib import save
from auth_cpt import text, after, semester
SOURCES = {"physics": "https://physics.upatras.gr/courses/"}
PARSE = {}

def physics(L):  # "Κωδικός Μαθήματος | MCC105 | Εξάμηνο | 1ο | Κατηγορία | Υποχρεωτικό |…"
    if "Κωδικός Μαθήματος" not in L: return None
    cat = after(L, r"Κατηγορία$") or ""
    return {"code": after(L, r"Κωδικός Μαθήματος$"), "name": L[L.index("Πληροφορίες") - 1].replace("‘Α", "Ά"),
            "semester": semester(after(L, r"Εξάμηνο$")), "kind": "core" if cat.startswith("Υποχρεωτ") else "elective"}
PARSE["physics"] = physics

if __name__ == "__main__":
    if sys.argv[1:2] == ["--show"]:
        for f in sorted(glob.glob(f"raw/up-{sys.argv[2]}/0*.html"))[: int(sys.argv[3]) if len(sys.argv) > 3 else 2]:
            print("==", f); print(" | ".join(text(f)[:80]))
        sys.exit()
    for dept in sys.argv[1:] or SOURCES:
        rows = [r for f in sorted(glob.glob(f"raw/up-{dept}/0*.html")) if (r := PARSE[dept](text(f)))]
        save("upatras", f"upatras-{dept}", SOURCES[dept], rows)
