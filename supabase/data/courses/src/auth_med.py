# ΑΠΘ Ιατρικής: «Πρόγραμμα Προπτυχιακών Σπουδών (2019-σήμερα)» page (get.sh → raw/auth-med-pps.html, text.py → .txt).
# Per «Νο εξάμηνο»: rows code / title / ECTS / type; Υ, Υ-ΚΑ (κλινική άσκηση) = υποχρεωτικό, ΞΓ = ξένη γλώσσα (one of the four), ΕΑ / Ε… = επιλογής.
import re
from lib import save, norm
SRC = "https://www.med.auth.gr/content/programma-proptyhiakon-spoydon-2019-simera"
L = [norm(l) for l in open("raw/auth-med-pps.txt")]
rows, sem = [], None
for i in range(len(L) - 3):
    if m := re.fullmatch(r"(\d+)ο εξάμηνο", L[i]): sem = int(m[1]); continue
    if sem and re.fullmatch(r"ΙΑ\d{4}\w?", L[i]) and re.fullmatch(r"\d+(?:[.,]\d+)?", L[i + 2]):
        rows.append({"code": L[i], "name": L[i + 1], "semester": sem, "kind": "core" if L[i + 3].startswith("Υ") else "elective"})
save("auth", "auth-med", SRC, rows)
