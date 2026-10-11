"""Europe, phase E2: the rest of Europe's universities (user request 2026-10-11).

Source: Hipo university-domains-list (world_universities_and_domains.json, 2026-10-11), European countries minus Greece
and Cyprus (curated by hand), minus every entry overlapping a domain we already had (E1 and earlier win), minus generic
suffixes (ac.uk …) and entries overlapping each other; every kept domain has MX records (checked 2026-10-11). The kept
list is `europe_all.json` (name, country, domains). No departments; short name = the name when short, else the part
before a comma, else the domain label (usually the acronym). Run:
  python3 supabase/data/europe_all.py > supabase/migrations/<ts>_europe_all.sql
"""
import json, re, unicodedata
from pathlib import Path

COUNTRY_EL = {
    "Albania": "Αλβανία", "Andorra": "Ανδόρα", "Austria": "Αυστρία", "Belarus": "Λευκορωσία", "Belgium": "Βέλγιο",
    "Bosnia and Herzegovina": "Βοσνία-Ερζεγοβίνη", "Bulgaria": "Βουλγαρία", "Croatia": "Κροατία", "Czech Republic": "Τσεχία",
    "Czechia": "Τσεχία", "Denmark": "Δανία", "Estonia": "Εσθονία", "Finland": "Φινλανδία", "France": "Γαλλία", "Germany": "Γερμανία",
    "Hungary": "Ουγγαρία", "Iceland": "Ισλανδία", "Ireland": "Ιρλανδία", "Italy": "Ιταλία", "Kosovo": "Κόσοβο", "Latvia": "Λετονία",
    "Liechtenstein": "Λιχτενστάιν", "Lithuania": "Λιθουανία", "Luxembourg": "Λουξεμβούργο", "Malta": "Μάλτα",
    "Moldova, Republic of": "Μολδαβία", "Monaco": "Μονακό", "Montenegro": "Μαυροβούνιο", "Netherlands": "Ολλανδία",
    "North Macedonia": "Βόρεια Μακεδονία", "Norway": "Νορβηγία", "Poland": "Πολωνία", "Portugal": "Πορτογαλία",
    "Romania": "Ρουμανία", "San Marino": "Άγιος Μαρίνος", "Serbia": "Σερβία", "Slovakia": "Σλοβακία", "Slovenia": "Σλοβενία",
    "Spain": "Ισπανία", "Sweden": "Σουηδία", "Switzerland": "Ελβετία", "Ukraine": "Ουκρανία", "United Kingdom": "Ηνωμένο Βασίλειο",
    "Holy See (Vatican City State)": "Βατικανό",
}
# Ids already used by earlier migrations (Greece, Cyprus, US, LSE, E1): never reused.
RESERVED = {
    "aalto", "aarhus", "acg", "act", "aegean", "aixmarseille", "asfa", "aspete", "aua", "aueb", "auth", "bath",
    "bca", "bgacrs", "bi", "birmingham", "bme", "bocconi", "bonn", "bristol", "cambridge", "cbs", "centralesupelec",
    "chalmers", "charite", "city", "cityuol", "cuni", "cut", "cvut", "dtu", "durham", "duth", "eap", "edinburgh",
    "elte", "enslyon", "enssaclay", "epfl", "esade", "essec", "ethz", "euc", "eur", "exeter", "frederick",
    "freiburg", "fuberlin", "glasgow", "goethe", "goettingen", "gu", "hamburg", "hau", "hec", "heidelberg",
    "helsinki", "hhs", "hi", "hmu", "hua", "huberlin", "ieu", "ihu", "imperial", "insead", "ionio", "ist",
    "karolinska", "kcl", "kit", "koeln", "kth", "kuleuven", "lancaster", "leeds", "leiden", "lmu", "lse", "luiss",
    "lund", "maastricht", "manchester", "mannheim", "medcollege", "mitropolitiko", "nottingham", "ntnu", "ntua",
    "nup", "nyc", "ouc", "oxford", "panteion", "paris1", "parissaclay", "perrotis", "polimi", "polito",
    "polytechnique", "psl", "pw", "qmul", "radboud", "rtu", "rug", "rwth", "sapienza", "sciencespo", "sheffield",
    "sns", "sorbonne", "southampton", "standrews", "stockholm", "strathclyde", "stuttgart", "tartu", "tcd",
    "tilburg", "tuberlin", "tuc", "tudarmstadt", "tudelft", "tudresden", "tue", "tuebingen", "tum", "tuwien", "uab",
    "uam", "uantwerpen", "ub", "uc3m", "ucd", "ucl", "uclancy", "uclouvain", "ucm", "ucoimbra", "ucph", "ucy",
    "uga", "ugent", "uib", "uio", "uj", "ulb", "ulisboa", "um", "unav", "unibas", "unibe", "unibo", "unibuc",
    "unic", "unifi", "unige", "unil", "unilj", "unilu", "unimi", "unina", "unipd", "unipi", "unipisa", "unisg",
    "unisofia", "unistra", "unito", "univie", "uniwa", "unizg", "unl", "uoa", "uoc", "uoi", "uom", "uop", "uowm",
    "upatras", "upc", "upcite", "upf", "upm", "uporto", "uppsala", "usc", "uth", "utrecht", "utwente", "uv", "uva",
    "uw", "uzh", "vilnius", "vuamsterdam", "vub", "warwick", "wu", "wur", "york",
}

# Old / alternate domains of institutions we already have (mergers, renames): added to that institution, never a new
# campus. Reviewed by hand against E1 on 2026-10-11.
ALIASES = {
    "universiteitleiden.nl": "leiden", "ucl.ac.be": "uclouvain", "ex.ac.uk": "exeter", "lancs.ac.uk": "lancaster",
    "ub.es": "ub", "uab.es": "uab", "bath.edu": "bath", "hut.fi": "aalto", "hkkk.fi": "aalto", "uiah.fi": "aalto",
    "u-psud.fr": "parissaclay", "sigu7.jussieu.fr": "upcite", "univ-paris-diderot.fr": "upcite", "univ-paris5.fr": "upcite",
    "paris-sorbonne.fr": "sorbonne", "ens.fr": "psl", "dauphine.fr": "psl", "ensmp.fr": "psl", "enst.fr": "polytechnique",
    "int-evry.fr": "polytechnique", "univmed.fr": "aixmarseille", "ens-fcl.fr": "enslyon", "ushs.u-strasbg.fr": "unistra",
    "upmf-grenoble.fr": "uga", "sgul.ac.uk": "cityuol", "sghms.ac.uk": "cityuol", "ioe.ac.uk": "ucl", "rsm.nl": "eur",
    "hha.dk": "aarhus", "iha.dk": "aarhus", "ihk.dk": "dtu", "khi.is": "hi",
}
# Old Strasbourg web hosts (www-*.u-strasbg.fr): not where anyone's mail lives any more.
DROP_SUFFIXES = ("u-strasbg.fr",)

SHORT_MAX = 26


def short(name: str, domain: str) -> str:
    """The name when short; else its part before a comma / bracket; else the domain's label (usually the acronym)."""
    if len(name) <= SHORT_MAX:
        return name
    head = re.split(r"\s*[,(]", name)[0].strip()
    if len(head) <= SHORT_MAX:
        return head
    label = domain.split(".")[0]
    if re.fullmatch(r"[a-z]{2,6}", label):
        return label.upper()
    return head[: SHORT_MAX - 1].rstrip() + "…"


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9_-]+", "-", s).strip("-")


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def sql() -> str:
    data = json.loads((Path(__file__).parent / "europe_all.json").read_text())
    merged: dict[str, list[str]] = {}
    keep = []
    for x in data:
        target = next((ALIASES[d] for d in x["domains"] if d in ALIASES), None)
        if target:
            merged.setdefault(target, []).extend(x["domains"])
        elif not any(d.endswith(DROP_SUFFIXES) for d in x["domains"]):
            keep.append(x)
    keep.sort(key=lambda x: (COUNTRY_EL[x["country"]], x["name"]))
    taken, rows = set(RESERVED), []
    for pos, x in enumerate(keep, start=1000):
        base = slug(x["domains"][0].split(".")[0])[:17] or "uni"
        uid, n = base, 2
        while uid in taken or len(uid) < 2:
            uid, n = f"{base[:17]}-{n}", n + 1
        taken.add(uid)
        doms = "ARRAY[" + ", ".join(q(d) for d in x["domains"]) + "]"
        sh = q(short(x["name"], x["domains"][0]))
        rows.append(f"  ({q(uid)}, {q(x['name'])}, {q(x['name'])}, {sh}, {sh}, {doms}, {q(COUNTRY_EL[x['country']])}, true, {pos})")
    updates = [
        f"UPDATE public.universities SET email_domains = email_domains || ARRAY[{', '.join(q(d) for d in sorted(set(ds)))}]::text[]\n"
        f"  WHERE id = {q(uid)} AND NOT email_domains && ARRAY[{', '.join(q(d) for d in sorted(set(ds)))}]::text[];"
        for uid, ds in sorted(merged.items())
    ]
    return (
        "-- Generated by supabase/data/europe_all.py (phase E2: the rest of Europe, from europe_all.json). An id that\n"
        "-- already exists is left alone (ON CONFLICT DO NOTHING): curated rows always win.\n"
        "-- Old / alternate domains of institutions we already have:\n"
        + "\n".join(updates)
        + "\n\nINSERT INTO public.universities (id, name_el, name_en, short_el, short_en, email_domains, city, open, position) VALUES\n"
        + ",\n".join(rows)
        + "\nON CONFLICT (id) DO NOTHING;\n"
    )

if __name__ == "__main__":
    print(sql(), end="")
