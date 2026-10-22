# Πάτρα department sites with one page per course: download every course page listed in the sitemap into
# raw/up-<dept>/<n>.html (kept; re-runs fetch only what is missing). Usage: up_fetch.py <dept>…
import os, re, sys, subprocess, concurrent.futures as cf
SITEMAPS = {
    "bio": "https://biology.upatras.gr/wp-sitemap-posts-course-1.xml",
    "ceid": "https://www.ceid.upatras.gr/wp-sitemap-posts-course-1.xml",
    "physics": "https://physics.upatras.gr/courses-sitemap.xml",
    "mech": "https://mead.upatras.gr/courses-sitemap.xml",
    "edu": "https://www.edu-sw.upatras.gr/wp-sitemap-posts-courses-1.xml",
}
UA = "Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36"
def get(url, path=None):
    out = subprocess.run(["curl", "-sSL", "-m", "40", "--retry", "3", "-A", UA, url] + (["-o", path] if path else []),
                         capture_output=True, text=not path)
    return out.stdout
for dept in sys.argv[1:] or SITEMAPS:
    urls = [u for u in re.findall(r"<loc>([^<]+)</loc>", get(SITEMAPS[dept])) if "/en/" not in u and u.rstrip("/").count("/") > 3]
    os.makedirs(f"raw/up-{dept}", exist_ok=True)
    open(f"raw/up-{dept}/urls.txt", "w").write("\n".join(urls) + "\n")
    todo = [(u, f"raw/up-{dept}/{i:04d}.html") for i, u in enumerate(urls) if not os.path.exists(f"raw/up-{dept}/{i:04d}.html")]
    with cf.ThreadPoolExecutor(6) as ex: list(ex.map(lambda a: get(*a), todo))
    print(dept, len(urls), "pages,", len(todo), "fetched")
