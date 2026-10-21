# Fetch a ΠΑΔΑ department's course pages (the shared theme: an overview + one page per semester under /courses/)
# into raw/uniwa-<site>-p<N>.txt. Usage: python3 uniwa_fetch.py <site> <overview path> [only links matching this]
import re, sys, html, subprocess
site, path = sys.argv[1], sys.argv[2]
def get(url, name):
    subprocess.run(["bash", "get.sh", url, name], capture_output=True)
    subprocess.run(f"python3 text.py raw/{name}.html | awk 'length($0)>0' > raw/{name}.txt", shell=True)
    return open(f"raw/{name}.html", errors="replace").read()
s = get(f"https://{site}.uniwa.gr/{path}", f"uniwa-{site}-p0")
links = []
for h in re.findall(r'href="([^"]+)"', s):
    h = html.unescape(h)
    if re.search(rf"{site}\.uniwa\.gr/courses/[^/?#]*(semester|examino|exam|-new|kateythynsi|epilog|elective)[^/?#]*/?$", h, re.I) and h not in links:
        if len(sys.argv) < 4 or re.search(sys.argv[3], h): links.append(h)
for n, u in enumerate(links, 1): get(u, f"uniwa-{site}-p{n}"); print(n, u)
