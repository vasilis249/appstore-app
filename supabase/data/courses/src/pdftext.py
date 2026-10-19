# pdftext.py <pdf> [first-last] : print page text (pdfplumber), one "=== page N" header per page.
import sys, pdfplumber
p = pdfplumber.open(sys.argv[1]); a, b = (map(int, sys.argv[2].split("-")) if len(sys.argv) > 2 else (1, len(p.pages)))
for i in range(a - 1, min(b, len(p.pages))):
    print(f"=== page {i+1}"); print(p.pages[i].extract_text() or "")
