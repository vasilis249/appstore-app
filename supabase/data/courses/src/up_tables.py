# Πάτρα «Πρόγραμμα Σπουδών» PDFs share one layout: ruled tables "Κωδικός | Τίτλος | hours… | ECTS" under headings
# («Νο Εξάμηνο», «ΜΑΘΗΜΑΤΑ ΕΠΙΛΟΓΗΣ …») that sit inside the table or just above it.
# rows(pdf) → (heading text so far, cells) for every table row, headings read in page order.
import pdfplumber
from lib import norm

def rows(path, first=0, last=None):
    pdf = pdfplumber.open(path)
    for page in pdf.pages[first:last]:
        top = 0
        for t in sorted(page.find_tables(), key=lambda t: t.bbox[1]):
            above = page.crop((0, top, page.width, t.bbox[1])).extract_text() or "" if t.bbox[1] > top else ""
            for l in above.splitlines():
                yield norm(l), None
            for r in t.extract():
                yield None, [norm(c) if c else "" for c in r]
            top = t.bbox[3]

from lib import recaser, fold
HAND = "αγροβιοποικιλότητα αγροβιοσυστημάτων γεωπονικές πιθανοθεωρία θερμοκινητήρες"  # words the recaser can't accent (shared by the Πάτρα scripts)
_case = recaser([], hand={fold(w).strip(): w for w in HAND.split()})
def case(title):
    """re-case capitals; first rejoin words a PDF cell broke in two ("ΗΛΕΚΤΡΟΦΥΣΙΟΛ ΟΓΙΑ")"""
    w = title.split()
    for i in range(len(w) - 2, -1, -1):
        a, b = w[i], w[i + 1]
        if a.isupper() and b.isupper() and a.isalpha() and b.isalpha() and not (_case.known(a) and _case.known(b)) \
                and _case.known(a + b):
            w[i:i + 2] = [a + b]
    return _case(" ".join(w))
