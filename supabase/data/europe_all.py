"""Europe, phase E2: the rest of Europe's universities (user request 2026-10-11).

Source: Hipo university-domains-list (world_universities_and_domains.json, 2026-10-11), European countries minus Greece
and Cyprus (curated by hand), minus every entry overlapping a domain we already had (E1 and earlier win), minus generic
suffixes (ac.uk …) and entries overlapping each other; every kept domain has MX records (checked 2026-10-11). The kept
list is `europe_all.json` (name, country, domains). No departments; short name = see short(). Run:
  python3 supabase/data/europe_all.py > supabase/migrations/<ts>_europe_all.sql
  python3 supabase/data/europe_all.py shorts > supabase/migrations/<ts>_europe_short_names.sql   # re-derive shorts
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
# Long names the rules below can't shorten (2026-10-11), by first domain.
SHORT_BY_HAND = {
    "uft-plovdiv.bg": "UFT Plovdiv", "enitiaa-nantes.fr": "ENITIAA Nantes", "groupe-esa.com": "ESA Angers",
    "supelec.fr": "Supélec", "epitech.eu": "Epitech", "u-pec.fr": "UPEC (Paris XII)", "u-cergy.fr": "Cergy-Pontoise",
    "univ-tlse2.fr": "Toulouse II", "univ-tlse3.fr": "Toulouse III", "diploma.de": "DIPLOMA Hochschule",
    "europa-uni.de": "Viadrina", "eba-muenchen.de": "EBA München", "efh-bochum.de": "EvH Bochum",
    "fh-giessen.de": "THM Gießen-Friedberg", "fern-fh.de": "Fern-FH Hamburg", "fh-nuernberg.de": "TH Nürnberg",
    "hs-albsig.de": "HS Albstadt-Sigmaringen", "popakademie.de": "Popakademie",
    "alumnos.ui1.es": "UI1 Isabel I", "internationaluniversity-schoolofmedicine.org": "IUSOM", "jedlik.eu": "Jedlik Győr",
}


STOP = {"of", "de", "des", "du", "la", "le", "les", "et", "für", "fur", "und", "and", "the", "di", "del", "della", "degli",
        "dei", "y", "i", "a", "w", "z", "in", "am", "an", "der", "van", "voor", "en", "da", "do", "dos", "das", "e", "for",
        "d'", "l'", "im", "zu", "na", "u", "v", "pri", "o", "za"}
PLACE_AFTER = {"of", "de", "in", "w", "am", "an", "di", "del", "zu", "u", "v", "pri", "à", "en"}
# Words that start a field of study, not a place ("University of Technology …").
SUBJECT = {"technology", "technologies", "science", "sciences", "applied", "arts", "art", "economics", "economy", "management",
           "business", "engineering", "education", "health", "music", "design", "agriculture", "agricultural", "medicine",
           "law", "finance", "social", "technical", "physical", "fine", "performing", "theatre", "drama", "sport", "sports",
           "pharmacy", "veterinary", "architecture", "commerce", "administration", "public", "information", "communication",
           "tourism", "languages", "humanities", "political", "international", "life", "natural", "food", "mining",
           "forestry", "physical", "film", "media", "journalism", "theology", "philosophy", "psychology", "nursing"}


def fold(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def from_domain(name: str, domain: str) -> str | None:
    """fh-wels → FH Wels, esc-toulouse → ESC Toulouse, univ-lille1 → Univ. Lille 1 — when the parts are in the name."""
    parts = domain.split(".")[0].split("-")
    if len(parts) < 2 or not re.fullmatch(r"[a-z]{2,5}", parts[0]):
        return None
    head = {"univ": "Univ.", "uni": "Uni"}.get(parts[0], parts[0].upper())
    words, folded = [], fold(name)
    for part in parts[1:]:
        m = re.fullmatch(r"([a-z]{3,})(\d*)", part)
        if not m or m.group(1) not in folded:
            return None
        words.append(m.group(1).capitalize() + (f" {m.group(2)}" if m.group(2) else ""))
    return " ".join([head, *words])


def initials(words: list[str]) -> str:
    """First letters of the words that matter (d'Architecture → A)."""
    words = [re.sub(r"^[dlDL]'", "", w) for w in words]
    return "".join(w[0].upper() for w in words if w and w.lower() not in STOP and w[0].isalpha())


def acronym_place(name: str) -> str | None:
    """American Business School of Paris → ABS Paris; Ecole Supérieure de Commerce de Toulouse → ESC Toulouse
    (initials ≤ 4 letters, and the words after the cut are a place, not a field of study)."""
    words = name.replace("’", "'").split()
    cut = max((i for i, w in enumerate(words) if w.lower() in PLACE_AFTER and 0 < i < len(words) - 1), default=None)
    if cut is None or fold(words[cut + 1]) in SUBJECT or not words[cut + 1][0].isupper():
        return None
    letters = initials(words[:cut])
    out = f"{letters} {' '.join(words[cut + 1:])}"
    return out if 2 <= len(letters) <= 4 and len(out) <= SHORT_MAX else None


def before_of(name: str) -> str | None:
    """Frankfurt School of Finance & Management → Frankfurt School."""
    m = re.match(r"(\S+(?:\s+\S+)+?)\s+(?:of|for|für|de|di)\s", name)
    return m.group(1) if m and len(m.group(1)) <= SHORT_MAX else None


def initials_last(name: str) -> str | None:
    """Ostbayerische Technische Hochschule Amberg-Weiden → OTH Amberg-Weiden."""
    words = name.split()
    if len(words) < 3 or len(words[-1]) < 3 or not words[-1][0].isupper() or fold(words[-1]) in SUBJECT:
        return None
    letters = initials(words[:-1])
    out = f"{letters} {words[-1]}"
    return out if 2 <= len(letters) <= 5 and len(out) <= SHORT_MAX else None


def short(name: str, domain: str) -> str:
    """The name when short; else the part before a comma / bracket / quote / dash; else from the domain (FH Wels); else
    the domain label (usually the acronym); else initials + place (ABS Paris); else the part before "of" (Frankfurt
    School); else initials + last word (OTH Amberg-Weiden); else cut."""
    if len(name) <= SHORT_MAX:
        return name
    if domain in SHORT_BY_HAND:
        return SHORT_BY_HAND[domain]
    head = re.split(r"\s*[,(]", name)[0].strip()
    head = re.sub(r"\s*[\"“„«][^\"”“»]*[\"”“»]\s*", " ", head).strip()
    head = re.split(r"\s+[-–]\s+", head)[0].strip()
    if len(head) <= SHORT_MAX:
        return head
    label = domain.split(".")[0]
    found = from_domain(name, domain)
    if found and len(found) <= SHORT_MAX:
        return found
    # The label as an acronym (LJMU, UNED) — not when it is a word of the name (nancy, sorbon).
    if re.fullmatch(r"[a-z]{2,6}", label) and not (len(label) >= 4 and re.search(rf"\b{label}", fold(name))):
        return label.upper()
    return acronym_place(head) or before_of(head) or initials_last(head) or head[: SHORT_MAX - 1].rstrip() + "…"


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9_-]+", "-", s).strip("-")


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def institutions():
    """(id, entry, position) for every kept entry, plus the alias merges — the ids the E2 migration created."""
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
    taken, out = set(RESERVED), []
    for pos, x in enumerate(keep, start=1000):
        base = slug(x["domains"][0].split(".")[0])[:17] or "uni"
        uid, n = base, 2
        while uid in taken or len(uid) < 2:
            uid, n = f"{base[:17]}-{n}", n + 1
        taken.add(uid)
        out.append((uid, x, pos))
    return out, merged


def sql() -> str:
    items, merged = institutions()
    rows = []
    for uid, x, pos in items:
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

def shorts_sql() -> str:
    """UPDATEs re-deriving the short name of every E2 row with a long name (the first run cut many with "…")."""
    lines = []
    for uid, x, _ in institutions()[0]:
        if len(x["name"]) > SHORT_MAX:
            sh = q(short(x["name"], x["domains"][0]))
            lines.append(f"UPDATE public.universities SET short_el = {sh}, short_en = {sh} WHERE id = {q(uid)} AND short_en IS DISTINCT FROM {sh};")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    import sys
    print(shorts_sql() if sys.argv[1:] == ["shorts"] else sql(), end="")
