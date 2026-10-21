# Πάντειο, Επικοινωνίας, Μέσων και Πολιτισμού: «Πρόγραμμα Σπουδών 2026-2027» (PDF). Rows "N. CODE Title Teacher ECTS
# HOURS"; a long title wraps around a row that holds only the teacher (line before + line after). «Υποχρεωτικά
# επιλογής» = elective; «Εργαστηριακά μαθήματα – υποχρεωτικά» per «Κύκλος Σπουδών» = track_core.
import re
from lib import save, norm
SRC = "https://cmc.panteion.gr/images/2027/programma_spoudon_2026-2027.pdf"
SEM = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
ROW = re.compile(r"^(?:\d+\.\s+)?(\d{6})\s*(.*?)\s+[\d,]+(?:\s+\d+)?(?:\s*\*+)?$")
TEACHER = re.compile(r"\s+(?:(?:[Α-ΩA-Z][α-ωa-zΑ-Ω]{0,2}\.\s?){1,3}\s?[Α-ΩA-Z][α-ωά-ώ]+|Εντ\. Διδ\.).*$")
SKIP = re.compile(r"^(ECTS|ΚΩΔΙΚΟΣ|Α/Α|ΜΑΘΗΜΑΤΟΣ|Μονάδες|\[|\*|#|●|=== page|\(Τμήμα|\[Τμήμα)")

L = [norm(l) for l in open("raw/pant-cmc.txt")]
rows, sem, kind, group, prev, i = [], None, None, None, "", 0
while i < len(L):
    l = L[i]; i += 1
    if m := re.match(r"^(ΣΤ|[Α-Η])΄ Ε Ξ Α Μ Η Ν Ο", l): sem, kind, group, prev = SEM[m[1]], None, None, ""; continue
    if "ΥΠΟΧΡΕΩΤΙΚΑ ΕΠΙΛΟΓΗΣ" in l: kind, group, prev = "elective", None, ""; continue
    if l.startswith("Ε Ρ Γ Α Σ Τ Η Ρ Ι Α Κ Α"): kind, group, prev = "track_core", None, ""; continue
    if m := re.match(r"^Κύκλος Σπουδών\s*:\s*(.+)$", l): group, prev = m[1], ""; continue
    if sem is None or kind is None or not l: continue
    if l.startswith("Παράμετροι λήψης πτυχίου"): break
    m = ROW.match(l)
    if m and m[1] != "000152":  # 000152 = Erasmus placement, not part of the programme
        title = TEACHER.sub("", m[2]).strip() if not re.match(r"^(?:[Α-ΩA-Z][α-ωa-zΑ-Ω]{0,2}\.\s?)+[Α-Ω]|^Εντ\. Διδ\.", m[2]) else ""
        if not title:
            nxt = L[i] if i < len(L) else ""
            title = norm(prev + " " + (nxt if not ROW.match(nxt) and not SKIP.match(nxt) else ""))
            if nxt and nxt in title: i += 1
        title = re.sub(r"\s*\*+$|\s*\(οφειλόμενο[^)]*\)", "", title).strip()
        k = "elective" if re.match(r"Πρακτική Άσκηση", title) else kind
        rows.append({"code": m[1], "name": title, "semester": sem, "kind": k, "group": group if k == "track_core" else None})
        prev = ""; continue
    prev = "" if SKIP.match(l) or TEACHER.fullmatch(" " + l) else l
# a title wrapped over three lines around a row that also holds its middle part
FIX = {"410267": "Εργαστηριακό μάθημα Διαφήμισης και Δημοσίων Σχέσεων VI – Δημόσιες Σχέσεις: Η δύναμη της αφήγησης "
                 "(Storytelling), Native/Branded Content/ Δημόσια Διπλωματία"}
for r in rows: r["name"] = FIX.get(r["code"], r["name"])
save("panteion", "panteion-cmc", SRC, rows)
