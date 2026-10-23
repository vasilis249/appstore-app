# Κρήτη Οικονομικών Επιστημών: Οδηγός Σπουδών 2026-27 (raw/uoc/econ-guide.pdf) §4.1, programme for those admitted from
# 2023-24 (pp. 27-30). Unruled tables "Κωδικοί | Μαθήματα | ECTS | Διδάσκοντες" whose titles wrap above and below the code
# line, so each title = the words of the title column between the midpoints to the neighbouring codes.
# Type after the code: Υ = core, ΥΑ/ΥΒ = core of a track, ΕΑ/ΕΒ = electives of a track, ΕΕ = free elective.
import re, pdfplumber
from lib import save, norm
SRC = "https://economics.soc.uoc.gr/el/page/1/73/odigos-spoydwn"
TRACK = {"Α": "Οικονομική Θεωρία και Πολιτική", "Β": "Επιχειρηματική Οικονομική"}
lat = str.maketrans("OIKYAEB", "ΟΙΚΥΑΕΒ")
out = []
for page in pdfplumber.open("raw/uoc/econ-guide.pdf").pages[26:30]:
    w = page.extract_words()
    head = next(x for x in w if x["text"] == "Μαθήματα" and x["x0"] > 200)
    ects = next(x for x in w if x["text"] == "ECTS" and x["top"] == head["top"])
    codes = [x for x in w if re.fullmatch(r"(ΟΙΚ|OIK|ΣΚΕ)\d{3,4}", x["text"])]
    sems = [(x["top"], int(m[1])) for x, n in zip(w, w[1:]) if (m := re.fullmatch(r"(\d)ο(?:/\dο)?", x["text"])) and n["text"] == "Εξάμηνο"]
    for i, c in enumerate(codes):
        lo = (codes[i - 1]["top"] + c["top"]) / 2 if i else c["top"] - 12
        hi = (codes[i + 1]["top"] + c["top"]) / 2 if i + 1 < len(codes) else c["top"] + 12
        title = norm(" ".join(x["text"] for x in sorted(w, key=lambda x: (round(x["top"]), x["x0"]))
                              if 205 < x["x0"] < ects["x0"] - 5 and lo < x["top"] <= hi
                              and not re.fullmatch(r"\(?[ΥΕYEΑΒAB]{1,2}\)?,?|Μαθήματα|ECTS", x["text"])))  # tags, table headers
        title = re.sub(r"\s*Σύνολο ECTS:.*", "", title)
        tag = next((x["text"] for x in w if c["x1"] < x["x0"] < 205 and abs(x["top"] - c["top"]) < 10), "")
        tag = re.sub(r"[(),]", "", tag).translate(lat)
        sem = max((s for t, s in sems if t <= c["top"] + 1), default=None)
        sem = sem if sem and sem <= 4 else None  # 5ο/7ο, 6ο/8ο: no fixed semester
        kind = {"Υ": "core", "ΥΑ": "track_core", "ΥΒ": "track_core"}.get(tag, "elective")
        out.append({"code": c["text"].translate(lat), "name": re.sub(r"(?<=\w)- (?=\w)", "", title), "semester": sem,
                    "kind": kind, "group": TRACK.get(tag[-1:]) if tag in ("ΥΑ", "ΥΒ", "ΕΑ", "ΕΒ") else None})
save("uoc", "uoc-econ", SRC, out)
