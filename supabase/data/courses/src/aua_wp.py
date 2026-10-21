# ΓΠΑ departments whose site lists the programme as WordPress "courses" (w1.aua.gr/<site>/wp-json/wp/v2/courses, saved
# in raw/aua/<site>-courses-N.json with the taxonomies): undergraduate courses, semester terms "Nο Εξάμηνο", choice
# Υποχρεωτικό / Επιλογής, direction (Κορμός = everyone; on sites where directions are tracks).
import json, html, re, sys, glob
from lib import save, norm
SITES = {"aua-aoa": ("aoa", False), "aua-nrae": ("afp", True)}  # department → (site, its "direction" terms are tracks; aoa's are course categories)
for dept in sys.argv[1:] or SITES:
    site, tracks = SITES[dept]
    T = {e["id"]: html.unescape(e["name"]) for t in ("semester", "level", "choice", "direction")
         for e in json.load(open(f"raw/aua/{site}-{t}.json"))}
    C = [c for f in sorted(glob.glob(f"raw/aua/{site}-courses-*.json")) for c in json.load(open(f)) if isinstance(c, dict)]
    rows = []
    for c in C:
        if "Προπτυχιακό" not in [T.get(i) for i in c["level"]]: continue
        m = re.fullmatch(r"(.+?)\s*(?:\[(\d+)\])?", norm(html.unescape(c["title"]["rendered"])))
        choice = {T[i] for i in c["choice"]} & {"Υποχρεωτικό", "Επιλογής"}
        dirs = [T[i] for i in c["direction"] if tracks and not T[i].isascii() and T[i] != "Κορμός"]
        common = not dirs or any(T[i] == "Κορμός" for i in c["direction"])
        kind = ("core" if common else "track_core") if "Υποχρεωτικό" in choice else "elective"
        for s in c["semester"]:
            if sm := re.fullmatch(r"(\d+)[οo] Εξάμηνο", T[s]):
                rows += [{"code": m[2], "name": m[1], "semester": int(sm[1]), "kind": kind, "group": g}
                         for g in (dirs if not common and dirs else [None])]
    note = ("Groups = the directions that offer the course; the site tags some courses both Υποχρεωτικό and Επιλογής "
            "without saying in which direction, those are listed as track_core.") if tracks else None
    save("aua", dept, f"https://w1.aua.gr/{site}/", rows, note)
