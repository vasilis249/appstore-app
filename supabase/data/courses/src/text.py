# text.py <file> [grep-regex]: html -> readable text lines (tables as " | " rows)
import sys, re, html
s = open(sys.argv[1], encoding="utf-8", errors="replace").read()
s = re.sub(r"(?is)<(script|style|noscript).*?</\1>", " ", s)
s = re.sub(r"(?i)</t[dh]>", " | ", s); s = re.sub(r"(?i)<(br|/tr|/p|/li|/h\d|/div)[^>]*>", "\n", s)
s = html.unescape(re.sub(r"<[^>]+>", " ", s))
lines = [re.sub(r"[ \t\xa0]+", " ", l).strip(" |") for l in s.split("\n")]
lines = [l for l in lines if l]
pat = re.compile(sys.argv[2], re.I) if len(sys.argv) > 2 else None
for l in lines:
    if not pat or pat.search(l): print(l)
