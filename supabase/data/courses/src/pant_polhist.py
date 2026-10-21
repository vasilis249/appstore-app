# Πάντειο, Πολιτικής Επιστήμης και Ιστορίας: semester and kind from «Πρόγραμμα Σπουδών 2026-27» (PDF, full-time
# programme), names from the Οδηγός Σπουδών 2025-26 list «Μαθήματα ανά έτος» ("110001 Σ. Σεφεριάδης: Πολιτική επιστήμη
# Ι"), because the programme prints titles in capitals mixed with the teachers' names. Courses the 2025-26 guide lacks:
# the title column of the programme (word positions), re-accented / lower-cased word by word from the guide's own text. «Υποχρεωτικά» = core; «Υποχρεωτικά επιλογής», «Ελεύθερης επιλογής», «Σεμινάρια» = elective.
import collections, glob, re
import pdfplumber
from lib import save, norm, fold
SRC = "https://polhist.panteion.gr/images/Documents/pdf/PPS_2026-27.pdf"
GUIDE = "https://polhist.panteion.gr/images/Documents/pdf/odigos_spoudon_2025-26.pdf"

names = {}
for l in map(norm, open("raw/pant-polhist-og.txt")):
    if m := re.match(r"^(\d{6,7}) [^:]{2,80}?: (.+)$", l):
        names.setdefault(m[1][:3] + m[1][-3:] if len(m[1]) == 7 else m[1], m[2])  # "1100021" (typo) = 110021

# word forms: folded → written forms, from the guide (its own style wins) and, for words it lacks, every other text we
# have (lower-case form preferred there); a few words appear nowhere and are given by hand.
guide, other = collections.defaultdict(collections.Counter), collections.defaultdict(collections.Counter)
WORD = r"[A-Za-zΑ-Ωα-ωΆ-Ώά-ώϊϋΐΰΪΫ]+"
for f in sorted(glob.glob("raw/*.txt")):
    for w in re.findall(WORD, open(f, errors="replace").read()):
        if not w.isupper() or len(w) == 1: (guide if f == "raw/pant-polhist-og.txt" else other)[fold(w).strip()][w] += 1
HAND = {"οθωμανικοσ": "οθωμανικός", "μικροιστορια": "μικροϊστορία", "κοινωνιοβιογραφια": "κοινωνιοβιογραφία",
        "κομμουνιστικοσ": "κομμουνιστικός", "γεωγραφικεσ": "γεωγραφικές", "polycrisis": "polycrisis"}
# teachers' surnames leak into the title column ("110001 Σ. Σεφεριάδης: …" lines of the guide, + one not in it)
surnames = {fold(w).strip() for l in open("raw/pant-polhist-og.txt") if (m := re.match(r"^\d{6,7} ([^:]{2,80}?):", l))
            for w in re.findall(r"[^\s.,-]{3,}", m[1])} | {"παπαστεφανακη"}


def written(key):
    if key in HAND: return HAND[key]
    if f := guide.get(key):
        best = f.most_common(1)[0][0]
        low = sum(n for k, n in f.items() if k[0].islower())
        return best if best[0].isupper() and low < f[best] else best.lower()
    if f := other.get(key):
        lows = [k for k, _ in f.most_common() if k[0].islower()]
        return lows[0] if lows else f.most_common(1)[0][0]
    return None


def sentence(caps):
    caps = re.sub(r"(\d)ΟΣ\b", r"\1ος", re.sub(r"(\d)ΟΥ\b", r"\1ου", caps))
    words = [x for x in caps.split() if fold(x).strip() not in surnames and not re.fullmatch(r"[Α-ΩA-Z]{1,2}\.", x)]
    out = []
    for i, w in enumerate(words):
        core = re.sub(r"^[«(\-]+|[»):,.\-]+$", "", w)
        word = written(fold(core).strip()) if core and not re.fullmatch(r"[IVXΙ]+", core) else None
        if word:
            if i == 0: word = word[0].upper() + word[1:]
            w = w.replace(core, word)
        elif core.isupper() and len(core) > 3: print("  unknown word:", core)
        out.append(w)
    return re.sub(r"(?<=[α-ωά-ώ])\.$", "", " ".join(out))


def title_column():
    """code → title words of its row in the programme table (between the code column and the teachers)."""
    out, x0, x1 = {}, None, None
    for page in pdfplumber.open("raw/pant-polhist.pdf").pages:
        words = page.extract_words()
        head = {w["text"]: w["x0"] for w in words if w["text"] in ("ΤΙΤΛΟΣ", "ΔΙΔΑΣΚΟΝΤΕΣ")}
        if len(head) == 2: x0, x1 = head["ΤΙΤΛΟΣ"] - 40, head["ΔΙΔΑΣΚΟΝΤΕΣ"] - 8  # else: the previous page's table
        if x0 is None: continue
        codes = sorted((w["top"], w["text"]) for w in words if re.fullmatch(r"\d{6}", w["text"]) and w["x0"] < x0)
        bad = {round(w["top"]) for w in words if re.match(r"ΜΑΘΗΜΑ|ΠΡΟΣΦΕΡ|ΚΩΔΙΚΟΣ|ΤΙΤΛΟΣ|ΟΥΜΕΝΑ|ΠΡΟΑΠΑΙΤ|\*|ΣΕΜΙΝΑΡ|ΕΠΙΠΛΕΟΝ", w["text"])}
        for k, (y, code) in enumerate(codes):
            lo = max(y - 20, (codes[k - 1][0] + y) / 2 if k else y - 20)
            hi = min(y + 20, (codes[k + 1][0] + y) / 2 if k + 1 < len(codes) else y + 20)
            ws = sorted((w for w in words if x0 <= w["x0"] < x1 and lo <= w["top"] < hi and round(w["top"]) not in bad),
                        key=lambda w: (round(w["top"]), w["x0"]))
            out.setdefault(code, norm(" ".join(w["text"] for w in ws)))
    return out


L = [norm(l) for l in open("raw/pant-polhist.txt")]
rows, sem, kind, group, caps = [], None, None, None, []
column = title_column()
for i, l in enumerate(L):
    if l.startswith("ΜΑΘΗΜΑΤΑ ERASMUS"): break
    if m := re.match(r"^(\d)[οΟ] ΕΞΑΜΗΝΟ", l): sem, kind, group = int(m[1]), None, None; continue
    if re.match(r"^ΜΑΘΗΜΑΤΑ ΥΠΟΧΡΕΩΤΙΚΑ \(", l): kind, group = "core", None; continue
    if "ΥΠΟΧΡΕΩΤΙΚΑ ΕΠΙΛΟΓΗΣ" in l: kind, group = "elective", "Υποχρεωτικά επιλογής"; continue
    if l.startswith("ΣΕΜΙΝΑΡΙΑ"): kind, group = "elective", "Σεμινάρια ελεύθερης επιλογής"; continue
    if "ΕΛΕΥΘΕΡΗΣ ΕΠΙΛΟΓΗΣ" in l: kind, group = "elective", "Ελεύθερης επιλογής"; continue
    m = re.match(r"^(\d{6})\b", l)
    if m and kind and sem:
        name = names.get(m[1])
        if not name:
            if m[1] == "000152": continue  # Erasmus placement, not part of the programme
            caps.append(m[1]); name = sentence(column[m[1]])
        rows.append({"code": m[1], "name": name, "semester": sem, "kind": kind, "group": group})
for r in rows:
    if r["code"] in caps: print("re-cased:", r["code"], r["name"])
save("panteion", "panteion-polhist", SRC, rows, note=f"Names from the 2025-26 guide ({GUIDE}); courses it lacks: "
     "programme title re-cased from the guide's word forms.")
