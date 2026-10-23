# pdftext.py <pdf> [first-last] : print page text (pdfplumber), one "=== page N" header per page.
import sys, pdfplumber
def pages(path, a=1, b=None):
    """page texts a..b (1-based, inclusive)"""
    p = pdfplumber.open(path)
    return [p.pages[i].extract_text() or "" for i in range(a - 1, min(b or len(p.pages), len(p.pages)))]
if __name__ == "__main__":
    a, b = (map(int, sys.argv[2].split("-")) if len(sys.argv) > 2 else (1, None))
    for i, t in enumerate(pages(sys.argv[1], a, b), a):
        print(f"=== page {i}"); print(t)
