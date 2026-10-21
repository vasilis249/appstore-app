# ΠΑΔΑ, Κοινωνικής Εργασίας: «Μαθήματα ανά εξάμηνο σπουδών» — per «Α ΕΞΑΜΗΝΟ» rows a/a / code / title (may wrap) / ECTS
# under "Υποχρεωτικά Μαθήματα" or "Κατ’ Επιλογήν Υποχρεωτικά – Β ΄ ΟΜΑΔΑ: 1 από 4" (+ the group's theme lines).
import re
from lib import save, norm
SRC = "https://sw.uniwa.gr/undergraduate-studies/proptychiako-programma-spoydon/"
SEM = {"Α": 1, "Β": 2, "Γ": 3, "Δ": 4, "Ε": 5, "ΣΤ": 6, "Ζ": 7, "Η": 8}
L = [norm(l) for l in open("raw/uniwa-sw-all.txt") if norm(l)]
rows, sem, kind, group = [], None, None, None
for i, l in enumerate(L[:-1]):
    if m := re.fullmatch(r"(ΣΤ|[ΑΒΓΔΕΖΗ]) ΕΞΑΜΗΝΟ", l): sem, kind, group = SEM[m[1]], "core", None; continue
    if l == "Υποχρεωτικά Μαθήματα": kind, group = "core", None; continue
    if m := re.match(r"Κατ’ Επιλογήν Υποχρεωτικά – (\S+) ΄ ΟΜΑΔΑ: (.+)", l): kind, group = "elective", f"{m[1]}΄ ομάδα ({m[2]})"; continue
    if sem and re.fullmatch(r"\d(?:στ|[α-ζ])?", L[i - 1] if i else "") and re.fullmatch(r"\d{4}(?:ΣΤ|[Α-Ζα-ζ])?", l):
        j = i + 1
        while not re.fullmatch(r"\d+", L[j]): j += 1
        rows.append({"code": l.upper(), "name": re.sub(r"\s*\[\d\]$", "", " ".join(L[i + 1:j])), "semester": sem, "kind": kind, "group": group})
save("uniwa", "uniwa-sw", SRC, rows)
