# pdfcols.py <pdf> <first-last> [split=0.5] : print each page as left column then right column (two-column tables).
import sys, pdfplumber
p = pdfplumber.open(sys.argv[1]); a, b = map(int, sys.argv[2].split("-")); s = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
for i in range(a - 1, b):
    pg = p.pages[i]; w = pg.width
    for name, box in (("L", (0, 0, w * s, pg.height)), ("R", (w * s, 0, w, pg.height))):
        print(f"=== page {i+1} {name}"); print(pg.crop(box).extract_text() or "")
