# links.py <file> <base-url>: links whose text or href looks like a curriculum / course list
import sys, re, html
from urllib.parse import urljoin
s = open(sys.argv[1], encoding="utf-8", errors="replace").read()
pat = re.compile(r"(πρόγραμμα σπουδών|προγραμμα σπουδων|μαθήματα|μαθηματα|οδηγός σπουδών|οδηγος σπουδων|curricul|courses|program|odigos|ma8hmata|mathimata|spoudes|undergrad|προπτυχιακ)", re.I)
seen = set()
for href, text in re.findall(r'<a[^>]+href="([^"#]+)"[^>]*>(.*?)</a>', s, re.S | re.I):
    t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", text))).strip()
    if pat.search(t) or pat.search(href):
        u = urljoin(sys.argv[2], html.unescape(href))
        if u not in seen: seen.add(u); print(f"{t[:60]:60} {u}")
