# Πολιτικής Επιστήμης & Δημόσιας Διοίκησης ΕΚΠΑ: «Πρόγραμμα σπουδών» — κορμός (1ο–4ο), κύκλοι Α' / Γ' / Δ' (υποχρεωτικά +
# ειδικής επιλογής), ελεύθερη και προαιρετική επιλογή. Rows "ΚΩΔ | Τίτλος | | Διδάσκοντες" (a title may wrap to "(Α' Κύκλος)").
import re
from lib import save, norm, lines_of
SRC = "https://www.pspa.uoa.gr/proptychiakes_spoydes/programma_spoydon"
CYC = {"a_kyklos_politiki_analysi": "Α' κύκλος: Πολιτική Ανάλυση", "g_kyklos_diethneis_kai_eyropaikes_spoydes": "Γ' κύκλος: Διεθνείς και Ευρωπαϊκές Σπουδές",
       "d_kyklos_dioikitiki_epistimi_kai_dimosio_dikaio": "Δ' κύκλος: Διοικητική Επιστήμη και Δημόσιο Δίκαιο"}
urls = [l.strip() for l in open("raw/pspa-urls.txt")]
rows = []
for n, u in enumerate(urls, 1):
    part = u.split("/programma_spoydon")[1].strip("/").split("/")
    if not part[0] or (part[0] in CYC and len(part) == 1): continue
    if part[0] == "kormos": kind, group = "core", None
    elif part[0] == "eleytheri_epilogi": kind, group = "elective", "Ελεύθερης επιλογής"
    elif part[0] == "proairetiki_epilogi": kind, group = "elective", "Προαιρετικό"
    else: kind, group = ("track_core", CYC[part[0]]) if part[1] == "ypochreotika_mathimata" else ("elective", CYC[part[0]] + " · ειδικής επιλογής")
    L = [norm(l) for l in lines_of(f"raw/pspa-p{n}.html")]
    a = next(i for i, l in enumerate(L) if l.startswith("--> ")); text = "\n".join(L[a:])
    text = text[:text.index("\n-->")]
    text = re.sub(r"\n(\([ΑΓΔ]' Κύκλος\))", r" \1", text)
    sem, k, g = None, kind, group
    for l in (x.removeprefix("--> ") for x in text.split("\n")):
        if m := re.match(r"^(\d)ο εξάμηνο$", l): sem = int(m[1]); continue
        if re.match(r"^(Χειμερινό|Εαρινό)", l): sem = None; continue
        if l == "Επιλογές Κορμού": k, g = "elective", "Επιλογές κορμού (4 από 9)"; continue
        if m := re.match(r"^(\d{5}\S*|42ΠΡΚ) \| ([^|]+?)\s*(?:\(([ΑΓΔ])' Κύκλος\))?\s*\*?\s*(\||$)", l):
            gg = g + f" · {m[3]}' κύκλος" if m[3] else g
            rows.append({"code": m[1], "name": m[2].strip(" *"), "semester": sem, "kind": k, "group": gg})
save("uoa", "uoa-pspa", SRC, rows, note="Από το 5ο: κύκλοι Α' / Γ' / Δ' (track_core = υποχρεωτικά του κύκλου)· ειδικής επιλογής ανά χειμερινό / εαρινό.")
