# HTML pages with course tables: tables(path) → [(text just before the table, [[cell, …], …]), …]
import re, html
from lib import norm
def _text(s): return norm(html.unescape(re.sub(r"<[^>]+>", " ", s)))
def tables(path, keep=1):
    """keep = how many text lines above the table to return (joined with \\n; headings in several elements)"""
    s = re.sub(r"(?is)<(script|style|noscript).*?</\1>", " ", open(path, encoding="utf-8", errors="replace").read())
    out, end = [], 0
    for m in re.finditer(r"(?is)<table.*?</table>", s):
        before = [l for l in (_text(x) for x in re.split(r"(?i)<(?:br|/p|/h\d|/div|/li)[^>]*>", s[end:m.start()])) if l]
        rows = [[_text(c) for c in re.findall(r"(?is)<t[dh][^>]*>(.*?)</t[dh]>", tr)] for tr in re.findall(r"(?is)<tr.*?</tr>", m[0])]
        out.append(("\n".join(before[-keep:]), [r for r in rows if any(r)])); end = m.end()
    return out
