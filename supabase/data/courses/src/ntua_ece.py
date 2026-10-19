import json, sys; sys.path.insert(0, "."); from lib import save
FLOWS = {"y":"Ροή Υ: Υπολογιστικά Συστήματα","l":"Ροή Λ: Λογισμικό Η/Υ","h":"Ροή Η: Ηλεκτρονική-Κυκλώματα-Υλικά","d":"Ροή Δ: Επικοινωνίες και Δίκτυα Υπολογιστών","t":"Ροή Τ: Κύματα και Τηλεπικοινωνίες","s":"Ροή Σ: Σήματα Έλεγχος και Ρομποτική","z":"Ροή Ζ: Ηλεκτρομηχανική Μετατροπή Ενέργειας, Υψηλές Τάσεις και Εγκαταστάσεις","e":"Ροή Ε: Συστήματα Ηλεκτρικής Ενέργειας","o":"Ροή Ο: Διοίκηση και Απόφαση","i":"Ροή Ι: Βιοϊατρική","f":"Ροή Φ: Φυσική","m":"Ροή Μ: Μαθηματικά"}
KIND = {"obligatoryCore":"core","obligatoryFull":"track_core","obligatoryFullHalf":"track_core","bySelection":"elective","foreignLanguage":"elective"}
rows = []
for f, label in [("base", None)] + list(FLOWS.items()):
    for s in json.load(open(f"raw/ece-flow-{f}.json")):
        for c in s["categories"]:
            group = "Ξένη γλώσσα" if c["category"] == "foreignLanguage" else label
            for x in c["courses"]:
                rows.append({"name": x["title"], "semester": s["semester"], "kind": KIND[c["category"]], "group": group})
rows.append({"name": "Διπλωματική Εργασία", "semester": 10, "kind": "core"})
save("ntua", "ntua-ece", "https://www.ece.ntua.gr/el/undergraduate/courses (API /api/courses/byFlow, όλες οι ροές)", rows)
