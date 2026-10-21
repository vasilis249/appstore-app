# ΠΑΔΑ, Μηχανικών Βιομηχανικής Σχεδίασης και Παραγωγής: the study-guide page embeds its courses as JSON
# (<script id="idpe-data">: code, title, semester, type "Μάθημα Υποχρεωτικό" | "… Επιλογής …").
import json, re, html
from lib import save
SRC = "https://idpe.uniwa.gr/studies/undergraduate/courses/"
s = open("raw/uniwa-idpe-all.html", errors="replace").read()
data = json.loads(html.unescape(re.search(r'<script id="idpe-data" type="application/json">(.*?)</script>', s, re.S)[1]))
rows = [{"code": c["code"], "name": c["title"], "semester": int(c["semester"]) if c.get("semester") else None,
         "kind": "elective" if "πιλογ" in c["type"] else "core"} for c in data]
save("uniwa", "uniwa-idpe", SRC, rows)
