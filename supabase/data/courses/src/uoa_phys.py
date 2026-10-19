# Φυσικής ΕΚΠΑ: «Μαθήματα ανά εξάμηνο» (one page per semester: "Κωδικός | Ώρες | ECTS | ΜΑΘΗΜΑ" under kind headings).
import re
from lib import save, norm, lines_of
SRC = "https://www.phys.uoa.gr/proptychiakes_spoydes/mathimata_ana_examino"
HEAD = {"ΥΠΟΧΡΕΩΤΙΚΑ ΜΑΘΗΜΑΤΑ ΚΟΡΜΟΥ": ("core", None), "ΥΠΟΧΡΕΩΤΙΚΑ ΜΑΘΗΜΑΤΑ ΚΑΤΕΥΘΥΝΣΕΩΝ": ("track_core", ""),
        "ΜΑΘΗΜΑΤΑ ΕΙΣΑΓΩΓΗΣ ΚΑΤΕΥΘΥΝΣΕΩΝ": ("elective", "Εισαγωγή κατεύθυνσης"), "ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ ΚΟΡΜΟΥ": ("elective", "Επιλογής κορμού"),
        "ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ ΚΑΤΕΥΘΥΝΣΕΩΝ": ("elective", ""), "ΜΑΘΗΜΑΤΑ ΕΛΕΥΘΕΡΗΣ ΕΠΙΛΟΓΗΣ": ("elective", "Ελεύθερης επιλογής"),
        "ΠΤΥΧΙΑΚΗ ΕΡΓΑΣΙΑ": ("elective", "Πτυχιακή εργασία")}
rows = []
for n in range(1, 9):
    L = [norm(l) for l in lines_of(f"raw/phys-s{n}.html")]
    on, kg, sub = False, None, None
    for l in L:
        if re.match(r"^(ΣΤ|[Α-Η])' ΕΞΑΜΗΝΟ$", l): on = True; continue
        if not on: continue
        if l.startswith("Ανακοινώσεις και εκδηλώσεις"): break
        if l in HEAD: kg, sub = HEAD[l], None; continue
        if m := re.match(r"^\d η Κατεύθυνση: (.+)$", l): sub = "Κατεύθυνση: " + m[1]; continue
        if l.startswith("Από το "): sub = "Ελεύθερης επιλογής · " + l; continue
        if kg and (m := re.match(r"^(\S+) \| [^|]+ \| [^|]+ \| (.+)$", l)) and m[1] != "Κωδικός":
            g = sub if kg[1] == "" else (sub if kg[1] == "Ελεύθερης επιλογής" and sub else kg[1])
            rows.append({"code": m[1], "name": re.sub(r"\s*\(μεταπτυχιακό\)$", "", m[2]), "semester": n, "kind": kg[0], "group": g})
save("uoa", "uoa-phys", SRC, rows, note="Κατευθύνσεις από το 6ο: Αστροφυσική, Ηλεκτρονική-Υπολογιστές-Τηλεπικοινωνίες-Αυτοματισμός, Φυσική Περιβάλλοντος, Πυρηνική & Στοιχειωδών Σωματιδίων, Συμπυκνωμένη Ύλη.")
