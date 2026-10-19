import sys, re; sys.path.insert(0, "."); from lib import *
rows, heads = [], set()
for n in range(1, 11):
    L = [norm(l) for l in lines_of(f"raw/chem-s{n}.html") if norm(l)]
    i = L.index("10 ο") + 1; j = L.index("Πληροφορίες", i)
    seg = L[i:j]; head = None; track = None
    for k, l in enumerate(seg):
        nxt = seg[k + 1] if k + 1 < len(seg) else ""
        if re.fullmatch(r"\d{4,5}", l): continue
        if re.fullmatch(r"\d{4,5}", nxt):
            h = head or ""
            kind = "core" if h.startswith("Υποχρεωτικ") else "track_core" if h.startswith("Κατεύθυνση:") else "elective"
            group = None if kind == "core" else " · ".join(x for x in (track if h.startswith("Εμβάθυνση") else None, h) if x)
            rows.append({"name": l, "code": nxt, "semester": n, "kind": kind, "group": group})
        elif k > 0 and re.fullmatch(r"\d{4,5}", seg[k - 1]): continue  # teachers line
        else:
            head = l; heads.add(l)
            if l.startswith("Κατεύθυνση:"): track = l
            elif not l.startswith("Εμβάθυνση"): track = None
print(sorted(heads))
rows.append({"name": "Διπλωματική Εργασία", "semester": 10, "kind": "core"})
save("ntua", "ntua-chem", "https://www.chemeng.ntua.gr/semester/1/ … /semester/10/", rows)
