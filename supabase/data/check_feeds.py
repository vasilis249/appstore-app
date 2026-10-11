"""Check candidate RSS feeds the way private.fetch_news fetches them (SpeakBot UA, final URL, XML declaration stripped).

  python3 -I supabase/data/check_feeds.py candidates.txt   # lines: <university id> <section> <url>
OK = RSS 2.0 with dated items, newest ≤ 30 days; OLD = older; BAD = not RSS / blocked / redirected elsewhere.
"""
import re, sys, subprocess, datetime, email.utils, xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

UA = "SpeakBot/1.0 (headlines only; +https://courtsie.vasilis-har.workers.dev)"

def check(line):
    uni, section, url = line.split()
    try:
        r = subprocess.run(["curl", "-sSL", "--max-time", "25", "-A", UA, "-w", "\n%{url_effective}", url],
                           capture_output=True, timeout=40).stdout
        body, _, final = r.rpartition(b"\n")
        final = final.decode()
        if final != url:
            return check(f"{uni} {section} {final}") + f"  (redirected from {url})"
        body = re.sub(rb"^\s*<\?xml[^>]*\?>", b"", body)
        root = ET.fromstring(body)
    except Exception as e:
        return f"BAD  {uni} {section} {url} ({type(e).__name__})"
    if root.tag != "rss":
        return f"BAD  {uni} {section} {url} (root {root.tag})"
    items = root.findall("./channel/item")
    dates = []
    for it in items[:30]:
        p = it.findtext("pubDate")
        try: dates.append(email.utils.parsedate_to_datetime(p.strip()))
        except Exception: pass
    if not items or not dates:
        return f"BAD  {uni} {section} {url} (items {len(items)}, dated {len(dates)})"
    newest = max(d if d.tzinfo else d.replace(tzinfo=datetime.timezone.utc) for d in dates)
    age = (datetime.datetime.now(datetime.timezone.utc) - newest).days
    img = sum(1 for it in items[:30] if any(c.tag.endswith(("content", "thumbnail")) or c.tag == "enclosure" for c in it))
    tag = "OK  " if age <= 30 else "OLD "
    return f"{tag} {uni} {section} {url} items={len(items)} newest={age}d imgs={img}"

lines = [l for l in open(sys.argv[1]).read().splitlines() if l.strip() and not l.startswith("#")]
with ThreadPoolExecutor(12) as ex:
    for r in ex.map(check, lines): print(r, flush=True)
