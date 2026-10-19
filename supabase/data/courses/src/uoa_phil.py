# Φιλολογίας ΕΚΠΑ: «Πρόγραμμα σπουδών ανά κατεύθυνση» 2026-27 (site pages). 1st year common (core); semesters 3-8 per
# direction: a course is track_core of its direction, or elective when it is joined to others by «ή» (one of them).
import re, subprocess
from lib import save, norm, fold
BASE = "https://www.phil.uoa.gr/proptychiakes_spoydes/programma_spoydon_ana_kateythynsi"
SEMS = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Z": 7, "Η": 8}
PAGES = {"mathimata_a_etoys": None, "kateythynsi_klasikis_filologias": "Κλασικής Φιλολογίας",
         "kateythynsi_mesaionikis_kai_neoellinikis_filologias": "Μεσαιωνικής και Νεοελληνικής Φιλολογίας",
         "kateythynsi_glossologias": "Γλωσσολογίας"}
ROW = re.compile(r"^([Α-Ω]{2,6}) ([Α-ΩA-Z]{3,4}\d{2,3}) (.+)$")
rows = []
for page, track in PAGES.items():
    L = [norm(l) for l in subprocess.run(["python3", "text.py", f"raw/phil-{page}.html"], capture_output=True, text=True).stdout.split("\n")]
    L = L[next(i for i, l in enumerate(L) if re.match(r"^(ΜΑΘΗΜΑΤΑ Α|ΚΑΤΕΥΘΥΝΣΗ)", l)):next(i for i, l in enumerate(L) if l == "Ανακοινώσεις και εκδηλώσεις")]
    sem, block, cur, open_ = None, [], None, False
    def close():
        global block
        alt = len(block) > 1
        for r in block:
            r["kind"] = "core" if not track else ("elective" if alt else "track_core")
            r["group"] = track and f"Κατεύθυνση {track}"
            rows.append(r)
        block = []
    for l in L:
        if m := re.match(r"^(ΣΤ|[Α-ΗZ])' (?:ΕΞΑΜΗΝ|Εξάμηνο)", l): close(); sem = SEMS[m[1]]; continue
        if l == "ή": open_ = True; continue
        if m := ROW.match(l):
            if not open_: close()
            open_ = False
            cur = {"code": m[2], "name": m[3], "semester": sem}; block.append(cur)
        elif cur and "|" not in cur["name"] and not l.startswith("Αντικ."): cur["name"] += " " + l
        if cur: cur["name"] = re.sub(r"\s*\|.*$", "|", cur["name"]) if "| " in cur["name"] else cur["name"]
    close()
spelling, code = {}, {}  # one course across directions: same title (and semester) → one spelling, the first code
for r in rows:
    r["name"] = r["name"].rstrip("|").strip()
    k = (r["semester"], fold(r["name"]))
    r["name"] = spelling.setdefault(k, r["name"]); r["code"] = code.setdefault(k, r["code"])
save("uoa", "uoa-phil", BASE, rows, note="2026-27 programme by direction; a course listed with «ή» is one choice among alternatives (elective).")
