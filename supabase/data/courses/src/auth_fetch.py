# ΑΠΘ department sites (WordPress) with one page per course: download every Greek course page listed in the site's
# sitemap(s) into raw/auth-<dept>/<n>.html (kept; re-runs only fetch what is missing). Usage: auth_fetch.py <dept>…
import os, re, sys, subprocess, concurrent.futures as cf
SITEMAPS = {
    "chemeng": ["https://cheng.auth.gr/courses-sitemap.xml"],
    "phil": ["https://lit.auth.gr/wp-sitemap-posts-lit_courses-1.xml"],
    "physics": ["https://www.physics.auth.gr/course-sitemap1.xml", "https://www.physics.auth.gr/course-sitemap2.xml"],
    "polsci": ["https://www.polsci.auth.gr/wp-sitemap-posts-course_polsci-1.xml"],
}
UA = "Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36"
def get(url, path=None):
    args = ["curl", "-sSL", "-m", "40", "--retry", "3", "--retry-all-errors", "-A", UA, url]
    out = subprocess.run(args + (["-o", path] if path else []), capture_output=True, text=not path)
    return out.stdout
for dept in sys.argv[1:] or SITEMAPS:
    urls = []
    for sm in SITEMAPS[dept]:
        urls += [u for u in re.findall(r"<loc>([^<]+)</loc>", get(sm)) if "/en/" not in u]
    os.makedirs(f"raw/auth-{dept}", exist_ok=True)
    open(f"raw/auth-{dept}/urls.txt", "w").write("\n".join(urls) + "\n")
    todo = [(u, f"raw/auth-{dept}/{i:04d}.html") for i, u in enumerate(urls) if not os.path.exists(f"raw/auth-{dept}/{i:04d}.html")]
    with cf.ThreadPoolExecutor(6) as ex:
        list(ex.map(lambda a: get(*a), todo))
    print(dept, len(urls), "pages,", len(todo), "fetched")
