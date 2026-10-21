# ΓΠΑ, «Αναλυτικό Πρόγραμμα Σπουδών» (the registry's export, one per department): pages headed "Ειδικότητα : 99 Βασική
# ειδικότητα" (or a specialisation) + "Εξάμηνο : N", each course "<code> <TITLE IN CAPS> Εργ.:<lab>" followed by
# "<n> <teaching type> 1 Υποχρεωτικό" | "… 2 Προαιρετικό". Titles re-cased with the ΓΠΑ sites' own spelling.
import re, sys
from lib import save, norm, recaser
DEPTS = {  # department → (export, source)
    "aua-crop": ("raw/aua-efp.txt", "https://w1.aua.gr/efp/wp-content/uploads/sites/9/2026/10/ΑΝΑΛΥΤΙΚΟ-ΠΡΟΓΡΑΜΜΑ-ΣΠΟΥΔΩΝ-2026-2027.pdf"),
    "aua-biotech": ("raw/aua-gbt.txt", "https://w1.aua.gr/gbt/wp-content/uploads/sites/7/2026/09/ΑΝΑΛΥΤΙΚΟ-ΠΡΟΓΡΑΜΜΑ-ΣΠΟΥΔΩΝ-ΒΙΟΤΕΧΝΟΛΟΓΙΑΣ-2026-2027.pdf"),
}
# the export abbreviates a few words ("ΜΕΤΑΧ/ΣΗ"); written out here (212's title is cut short in the export itself)
HAND = {"140": "Ανατομία και φυσιολογία αγροτικών ζώων", "328": "Φυσιολογία θρέψης φυτών και λιπασματικά συστατικά",
        "212": "Αρχές και μέθοδοι χρήσης και διαχείρισης", "945": "Μετασυλλεκτική μεταχείριση καρπών και λαχανικών",
        "1165": "Οικολογία και βιοκλιματολογία αστικού περιβάλλοντος",
        "1125": "Αμπελουργία ΙΙΙ (Τεχνολογία επιτραπέζιων σταφυλιών)", "213": "Γεωργική νηματωδολογία",
        "875": "Ειδικά θέματα εδαφοκατεργασίας", "266": "Ειδικά θέματα μικροκλιματολογίας και βιοκλιματολογίας",
        "264": "Εφαρμοσμένη υδρομετεωρολογία και υδρολογία",
        "2735": "Εχθροί και ασθένειες ανθοκομικών και καλλωπιστικών φυτών",
        "785": "Πολλαπλασιασμός καρποφόρων δένδρων και θάμνων",
        "865": "Φυσιολογία και τεχνολογία πολλαπλασιαστικού υλικού κηπευτικών",
        "3170": "Φαρμακογνωσία και βιοδραστικά προϊόντα", "3616": "Διδακτική - Γεωργική εκπαίδευση",
        "280": "Βελτίωση της ανθεκτικότητας των φυτών - Βελτίωση κηπευτικών"}
case = recaser(["raw/aua-wp-titles.txt", "raw/aua-etda.txt", "raw/aua-zp-prog.txt"])
TYPE = re.compile(r"\d+ .+ [12] (Υποχρεωτικό|Προαιρετικό)")
COURSE = re.compile(r"(\d+) ([^a-zα-ωά-ώ]+?)(?: Εργ\.:.*)?")
for dept in sys.argv[1:] or DEPTS:
    path, src = DEPTS[dept]
    L = [norm(l) for l in open(path)]
    rows, sem, spec = [], None, None
    for i, l in enumerate(L):
        if m := re.fullmatch(r"Εξάμηνο : (\d+)", l): sem = int(m[1]); continue
        if m := re.fullmatch(r"Ειδικότητα : (\d+) (.+)", l): spec = None if m[1] == "99" else case(m[2]); continue
        if not (t := TYPE.fullmatch(l)): continue
        j = i - 1  # the course line (its lab may wrap onto the next line)
        while not COURSE.fullmatch(L[j]): j -= 1
        code, title = COURSE.fullmatch(L[j]).groups()
        # the next line continues the title when no lab came first or the title ends mid-phrase ("…ΠΡΟΙΟΝΤΩΝ," "…-ΒΕΛΤΙΩΣΗ")
        if j + 1 < i and (" Εργ.:" not in L[j] or re.search(r"[,]$|-[Α-Ω]+$", title)):
            title += " " + L[j + 1].split(" Εργ.:")[0]
        title = HAND.get(code) or case(title)
        core = t[1] == "Υποχρεωτικό"
        rows.append({"code": code, "name": title, "semester": sem,
                     "kind": ("track_core" if spec else "core") if core else "elective", "group": spec})
    save("aua", dept, src, rows)
