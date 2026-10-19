# Επικοινωνίας & ΜΜΕ ΕΚΠΑ: «Πρόγραμμα σπουδών (έτος εισαγωγής 2015 και μετά)», one page per semester and per elective list
# (rows: ΤΙΤΛΟΣ / διδάσκων / ECTS). Titles are kept in capitals as the department writes them (no accents to restore).
import re
from lib import save, norm, lines_of
SRC = "https://www.media.uoa.gr/proptychiakes_spoydes/kanonismos_programma_spoydon/programma_spoydon_etos_eisagogis_2015_kai_meta"
PAGES = [(f"{s}_examino", n, "core", None) for n, s in enumerate("a b g d e st z i".split(), 1)] + [
    ("mathimata_epilogis_cheimerinoy_examinoy", None, "elective", "Επιλογής χειμερινού εξαμήνου"),
    ("mathimata_epilogis_earinoy_examinoy", None, "elective", "Επιλογής εαρινού εξαμήνου"),
    ("seminaria_ypochreotika_kat_epilogin_cheimerinoy_examinoy", None, "elective", "Σεμινάρια κατ' επιλογήν υποχρεωτικά (χειμερινό)"),
    ("seminaria_ypochreotika_kat_epilogin_earinoy_examinoy", None, "elective", "Σεμινάρια κατ' επιλογήν υποχρεωτικά (εαρινό)"),
    ("seminaria_eidikeysis_earinoy_examinoy_kat_epilogin_ypochreotika", None, "elective", "Σεμινάρια ειδίκευσης (εαρινό)")]
rows = []
for page, sem, kind, group in PAGES:
    L = [norm(l) for l in lines_of(f"raw/media-{page}.html")]
    a = next(i for i, l in enumerate(L) if re.match(r"^--> \S", l)); b = next(i for i in range(a + 1, len(L)) if L[i] == "-->")
    block = [re.sub(r"^--> ", "", l) for l in L[a:b] if l]
    TEACHER = re.compile(r"^([Α-ΩA-Z][α-ωa-zΑ-Ω]{0,2}\.\s?)+\S")
    num = lambda x: re.fullmatch(r"\d+", x)
    k, g = kind, group
    for i, t in enumerate(block):
        if t.startswith("ΚΑΤ’ ΕΠΙΛΟΓΗΝ ΥΠΟΧΡΕΩΤΙΚ"): k, g = "elective", "Κατ' επιλογήν υποχρεωτικό"; continue
        if num(t) or TEACHER.match(t) or "ECTS" in t or re.match(r"^(ΥΠΟΧΡΕΩΤΙΚΑ|ΔΙΔΑΣΚ|ΕΝΑ \(|ΔΥΟ \(|ΤΡΙΑ \(|ΤΕΣΣΕΡΑ \(|ΑΠΟ ΤΟΝ|\(|\d+[ΧX]\d+$)", t): continue
        j = i + 1
        if j < len(block) and TEACHER.match(block[j]):
            while j < len(block) and not num(block[j]) and j <= i + 3: j += 1
            if j < len(block) and num(block[j]): rows.append({"name": t, "semester": sem, "kind": k, "group": g})
    if sem in (7, 8):  # thesis seminar / thesis appear as text rows without a teacher
        for l in block:
            if l in ("ΣΕΜΙΝΑΡΙΟ ΠΤΥΧΙΑΚΗΣ", "ΠΤΥΧΙΑΚΗ"): rows.append({"name": "ΠΤΥΧΙΑΚΗ ΕΡΓΑΣΙΑ" if l == "ΠΤΥΧΙΑΚΗ" else l, "semester": sem, "kind": "core"})
save("uoa", "uoa-media", SRC, rows, note="Τίτλοι με κεφαλαία όπως στο site του Τμήματος. Κατ' επιλογήν: χωρίς σταθερό εξάμηνο (χειμερινό / εαρινό).")
