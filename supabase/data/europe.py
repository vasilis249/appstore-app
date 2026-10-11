"""Europe, phase E1 (user request 2026-10-11: "all universities of Europe, the best known first").

The ~140 best-known European universities (QS / THE top of each country), no departments (the student goes straight
to the year, like the Cypriot private universities). Email domains = the institution's domain plus the separate student
domain where students get one (e.g. TUM → mytum.de, Bocconi → studbocconi.it, UCD → ucdconnect.ie); a sub-domain
(student.uva.nl, stud.ki.se …) matches automatically. Every domain was checked for MX records (2026-10-11).
Names in English (as the universities use them), city in Greek. Run:
  python3 supabase/data/europe.py > supabase/migrations/<ts>_europe_top.sql
"""

# id, name, short, domains, city (el)
EUROPE = [
    # United Kingdom (LSE exists)
    ("oxford", "University of Oxford", "Oxford", ["ox.ac.uk"], "Οξφόρδη, Ηνωμένο Βασίλειο"),
    ("cambridge", "University of Cambridge", "Cambridge", ["cam.ac.uk"], "Κέιμπριτζ, Ηνωμένο Βασίλειο"),
    ("imperial", "Imperial College London", "Imperial", ["imperial.ac.uk", "ic.ac.uk"], "Λονδίνο, Ηνωμένο Βασίλειο"),
    ("ucl", "University College London", "UCL", ["ucl.ac.uk"], "Λονδίνο, Ηνωμένο Βασίλειο"),
    ("kcl", "King's College London", "King's", ["kcl.ac.uk"], "Λονδίνο, Ηνωμένο Βασίλειο"),
    ("edinburgh", "University of Edinburgh", "Edinburgh", ["ed.ac.uk"], "Εδιμβούργο, Ηνωμένο Βασίλειο"),
    ("manchester", "University of Manchester", "Manchester", ["manchester.ac.uk"], "Μάντσεστερ, Ηνωμένο Βασίλειο"),
    ("bristol", "University of Bristol", "Bristol", ["bristol.ac.uk"], "Μπρίστολ, Ηνωμένο Βασίλειο"),
    ("warwick", "University of Warwick", "Warwick", ["warwick.ac.uk"], "Κόβεντρι, Ηνωμένο Βασίλειο"),
    ("glasgow", "University of Glasgow", "Glasgow", ["gla.ac.uk"], "Γλασκώβη, Ηνωμένο Βασίλειο"),
    ("durham", "Durham University", "Durham", ["durham.ac.uk", "dur.ac.uk"], "Ντάραμ, Ηνωμένο Βασίλειο"),
    ("standrews", "University of St Andrews", "St Andrews", ["st-andrews.ac.uk"], "Σεντ Άντριους, Ηνωμένο Βασίλειο"),
    ("southampton", "University of Southampton", "Southampton", ["soton.ac.uk", "southampton.ac.uk"], "Σαουθάμπτον, Ηνωμένο Βασίλειο"),
    ("leeds", "University of Leeds", "Leeds", ["leeds.ac.uk"], "Λιντς, Ηνωμένο Βασίλειο"),
    ("birmingham", "University of Birmingham", "Birmingham", ["bham.ac.uk", "birmingham.ac.uk"], "Μπέρμιγχαμ, Ηνωμένο Βασίλειο"),
    ("sheffield", "University of Sheffield", "Sheffield", ["sheffield.ac.uk"], "Σέφιλντ, Ηνωμένο Βασίλειο"),
    ("nottingham", "University of Nottingham", "Nottingham", ["nottingham.ac.uk"], "Νότιγχαμ, Ηνωμένο Βασίλειο"),
    ("qmul", "Queen Mary University of London", "Queen Mary", ["qmul.ac.uk"], "Λονδίνο, Ηνωμένο Βασίλειο"),
    ("bath", "University of Bath", "Bath", ["bath.ac.uk"], "Μπαθ, Ηνωμένο Βασίλειο"),
    ("exeter", "University of Exeter", "Exeter", ["exeter.ac.uk"], "Έξετερ, Ηνωμένο Βασίλειο"),
    ("york", "University of York", "York", ["york.ac.uk"], "Γιορκ, Ηνωμένο Βασίλειο"),
    ("lancaster", "Lancaster University", "Lancaster", ["lancaster.ac.uk"], "Λάνκαστερ, Ηνωμένο Βασίλειο"),
    ("cityuol", "City St George's, University of London", "City St George's", ["city.ac.uk", "citystgeorges.ac.uk"], "Λονδίνο, Ηνωμένο Βασίλειο"),
    ("strathclyde", "University of Strathclyde", "Strathclyde", ["strath.ac.uk"], "Γλασκώβη, Ηνωμένο Βασίλειο"),
    # Ireland
    ("tcd", "Trinity College Dublin", "Trinity", ["tcd.ie"], "Δουβλίνο, Ιρλανδία"),
    ("ucd", "University College Dublin", "UCD", ["ucd.ie", "ucdconnect.ie"], "Δουβλίνο, Ιρλανδία"),
    # Switzerland
    ("ethz", "ETH Zurich", "ETH", ["ethz.ch"], "Ζυρίχη, Ελβετία"),
    ("epfl", "EPFL", "EPFL", ["epfl.ch"], "Λωζάνη, Ελβετία"),
    ("uzh", "University of Zurich", "UZH", ["uzh.ch"], "Ζυρίχη, Ελβετία"),
    ("unige", "University of Geneva", "UNIGE", ["unige.ch"], "Γενεύη, Ελβετία"),
    ("unibe", "University of Bern", "Bern", ["unibe.ch"], "Βέρνη, Ελβετία"),
    ("unil", "University of Lausanne", "UNIL", ["unil.ch"], "Λωζάνη, Ελβετία"),
    ("unibas", "University of Basel", "Basel", ["unibas.ch"], "Βασιλεία, Ελβετία"),
    ("unisg", "University of St. Gallen", "HSG", ["unisg.ch"], "Σανκτ Γκάλεν, Ελβετία"),
    # Germany
    ("tum", "Technical University of Munich", "TUM", ["tum.de", "mytum.de"], "Μόναχο, Γερμανία"),
    ("lmu", "LMU Munich", "LMU", ["lmu.de", "uni-muenchen.de"], "Μόναχο, Γερμανία"),
    ("heidelberg", "Heidelberg University", "Heidelberg", ["uni-heidelberg.de"], "Χαϊδελβέργη, Γερμανία"),
    ("fuberlin", "Freie Universität Berlin", "FU Berlin", ["fu-berlin.de"], "Βερολίνο, Γερμανία"),
    ("huberlin", "Humboldt-Universität zu Berlin", "HU Berlin", ["hu-berlin.de"], "Βερολίνο, Γερμανία"),
    ("tuberlin", "Technische Universität Berlin", "TU Berlin", ["tu-berlin.de"], "Βερολίνο, Γερμανία"),
    ("rwth", "RWTH Aachen University", "RWTH", ["rwth-aachen.de"], "Άαχεν, Γερμανία"),
    ("kit", "Karlsruhe Institute of Technology", "KIT", ["kit.edu"], "Καρλσρούη, Γερμανία"),
    ("freiburg", "University of Freiburg", "Freiburg", ["uni-freiburg.de"], "Φράιμπουργκ, Γερμανία"),
    ("tuebingen", "University of Tübingen", "Tübingen", ["uni-tuebingen.de"], "Τύμπινγκεν, Γερμανία"),
    ("bonn", "University of Bonn", "Bonn", ["uni-bonn.de"], "Βόννη, Γερμανία"),
    ("hamburg", "University of Hamburg", "Hamburg", ["uni-hamburg.de"], "Αμβούργο, Γερμανία"),
    ("goettingen", "University of Göttingen", "Göttingen", ["uni-goettingen.de"], "Γκέτινγκεν, Γερμανία"),
    ("tudresden", "TU Dresden", "TU Dresden", ["tu-dresden.de"], "Δρέσδη, Γερμανία"),
    ("goethe", "Goethe University Frankfurt", "Goethe", ["uni-frankfurt.de"], "Φρανκφούρτη, Γερμανία"),
    ("koeln", "University of Cologne", "Cologne", ["uni-koeln.de"], "Κολωνία, Γερμανία"),
    ("mannheim", "University of Mannheim", "Mannheim", ["uni-mannheim.de"], "Μάνχαϊμ, Γερμανία"),
    ("tudarmstadt", "TU Darmstadt", "TU Darmstadt", ["tu-darmstadt.de"], "Ντάρμσταντ, Γερμανία"),
    ("stuttgart", "University of Stuttgart", "Stuttgart", ["uni-stuttgart.de"], "Στουτγκάρδη, Γερμανία"),
    ("charite", "Charité – Universitätsmedizin Berlin", "Charité", ["charite.de"], "Βερολίνο, Γερμανία"),
    # France
    ("psl", "PSL University", "PSL", ["psl.eu"], "Παρίσι, Γαλλία"),
    ("polytechnique", "Institut Polytechnique de Paris", "IP Paris", ["polytechnique.edu", "ip-paris.fr"], "Παλεζό, Γαλλία"),
    ("sorbonne", "Sorbonne University", "Sorbonne", ["sorbonne-universite.fr"], "Παρίσι, Γαλλία"),
    ("parissaclay", "Université Paris-Saclay", "Paris-Saclay", ["universite-paris-saclay.fr"], "Ορσέ, Γαλλία"),
    ("sciencespo", "Sciences Po", "Sciences Po", ["sciencespo.fr"], "Παρίσι, Γαλλία"),
    ("hec", "HEC Paris", "HEC", ["hec.edu"], "Ζουί-αν-Ζοζά, Γαλλία"),
    ("paris1", "Paris 1 Panthéon-Sorbonne University", "Paris 1", ["univ-paris1.fr"], "Παρίσι, Γαλλία"),
    ("upcite", "Université Paris Cité", "Paris Cité", ["u-paris.fr"], "Παρίσι, Γαλλία"),
    ("centralesupelec", "CentraleSupélec", "CentraleSupélec", ["centralesupelec.fr", "student-cs.fr"], "Ζιφ-συρ-Ιβέτ, Γαλλία"),
    ("essec", "ESSEC Business School", "ESSEC", ["essec.edu"], "Σερζί, Γαλλία"),
    ("insead", "INSEAD", "INSEAD", ["insead.edu"], "Φοντενεμπλό, Γαλλία"),
    ("uga", "Université Grenoble Alpes", "UGA", ["univ-grenoble-alpes.fr"], "Γκρενόμπλ, Γαλλία"),
    ("unistra", "University of Strasbourg", "Strasbourg", ["unistra.fr"], "Στρασβούργο, Γαλλία"),
    ("enssaclay", "ENS Paris-Saclay", "ENS Paris-Saclay", ["ens-paris-saclay.fr"], "Ζιφ-συρ-Ιβέτ, Γαλλία"),
    ("enslyon", "ENS de Lyon", "ENS Lyon", ["ens-lyon.fr"], "Λυών, Γαλλία"),
    ("aixmarseille", "Aix-Marseille University", "AMU", ["univ-amu.fr"], "Μασσαλία, Γαλλία"),
    # Netherlands
    ("tudelft", "Delft University of Technology", "TU Delft", ["tudelft.nl"], "Ντελφτ, Ολλανδία"),
    ("uva", "University of Amsterdam", "UvA", ["uva.nl"], "Άμστερνταμ, Ολλανδία"),
    ("leiden", "Leiden University", "Leiden", ["leidenuniv.nl"], "Λέιντεν, Ολλανδία"),
    ("utrecht", "Utrecht University", "Utrecht", ["uu.nl"], "Ουτρέχτη, Ολλανδία"),
    ("eur", "Erasmus University Rotterdam", "Erasmus", ["eur.nl"], "Ρότερνταμ, Ολλανδία"),
    ("rug", "University of Groningen", "Groningen", ["rug.nl"], "Χρόνινγκεν, Ολλανδία"),
    ("wur", "Wageningen University & Research", "Wageningen", ["wur.nl"], "Βάχενινγκεν, Ολλανδία"),
    ("tue", "Eindhoven University of Technology", "TU/e", ["tue.nl"], "Αϊντχόφεν, Ολλανδία"),
    ("vuamsterdam", "Vrije Universiteit Amsterdam", "VU Amsterdam", ["vu.nl"], "Άμστερνταμ, Ολλανδία"),
    ("maastricht", "Maastricht University", "Maastricht", ["maastrichtuniversity.nl"], "Μάαστριχτ, Ολλανδία"),
    ("utwente", "University of Twente", "Twente", ["utwente.nl"], "Ένσχεντε, Ολλανδία"),
    ("tilburg", "Tilburg University", "Tilburg", ["tilburguniversity.edu", "uvt.nl"], "Τίλμπουργκ, Ολλανδία"),
    ("radboud", "Radboud University", "Radboud", ["ru.nl"], "Ναϊμέγκεν, Ολλανδία"),
    # Belgium
    ("kuleuven", "KU Leuven", "KU Leuven", ["kuleuven.be"], "Λέουβεν, Βέλγιο"),
    ("ugent", "Ghent University", "UGent", ["ugent.be"], "Γάνδη, Βέλγιο"),
    ("uclouvain", "UCLouvain", "UCLouvain", ["uclouvain.be"], "Λουβέν-λα-Νεβ, Βέλγιο"),
    ("ulb", "Université libre de Bruxelles", "ULB", ["ulb.be", "ulb.ac.be"], "Βρυξέλλες, Βέλγιο"),
    ("vub", "Vrije Universiteit Brussel", "VUB", ["vub.be"], "Βρυξέλλες, Βέλγιο"),
    ("uantwerpen", "University of Antwerp", "Antwerp", ["uantwerpen.be"], "Αμβέρσα, Βέλγιο"),
    # Luxembourg
    ("unilu", "University of Luxembourg", "Uni.lu", ["uni.lu"], "Λουξεμβούργο"),
    # Denmark
    ("ucph", "University of Copenhagen", "UCPH", ["ku.dk"], "Κοπεγχάγη, Δανία"),
    ("dtu", "Technical University of Denmark", "DTU", ["dtu.dk"], "Κοπεγχάγη, Δανία"),
    ("aarhus", "Aarhus University", "Aarhus", ["au.dk"], "Ώρχους, Δανία"),
    ("cbs", "Copenhagen Business School", "CBS", ["cbs.dk"], "Κοπεγχάγη, Δανία"),
    # Sweden
    ("karolinska", "Karolinska Institutet", "Karolinska", ["ki.se"], "Στοκχόλμη, Σουηδία"),
    ("kth", "KTH Royal Institute of Technology", "KTH", ["kth.se"], "Στοκχόλμη, Σουηδία"),
    ("lund", "Lund University", "Lund", ["lu.se"], "Λουντ, Σουηδία"),
    ("uppsala", "Uppsala University", "Uppsala", ["uu.se"], "Ουψάλα, Σουηδία"),
    ("stockholm", "Stockholm University", "Stockholm", ["su.se"], "Στοκχόλμη, Σουηδία"),
    ("chalmers", "Chalmers University of Technology", "Chalmers", ["chalmers.se"], "Γκέτεμποργκ, Σουηδία"),
    ("gu", "University of Gothenburg", "Gothenburg", ["gu.se"], "Γκέτεμποργκ, Σουηδία"),
    ("hhs", "Stockholm School of Economics", "SSE", ["hhs.se"], "Στοκχόλμη, Σουηδία"),
    # Finland, Norway, Iceland
    ("helsinki", "University of Helsinki", "Helsinki", ["helsinki.fi"], "Ελσίνκι, Φινλανδία"),
    ("aalto", "Aalto University", "Aalto", ["aalto.fi"], "Έσποο, Φινλανδία"),
    ("uio", "University of Oslo", "Oslo", ["uio.no"], "Όσλο, Νορβηγία"),
    ("ntnu", "Norwegian University of Science and Technology", "NTNU", ["ntnu.no"], "Τρόντχαϊμ, Νορβηγία"),
    ("uib", "University of Bergen", "Bergen", ["uib.no"], "Μπέργκεν, Νορβηγία"),
    ("bi", "BI Norwegian Business School", "BI", ["bi.no"], "Όσλο, Νορβηγία"),
    ("hi", "University of Iceland", "UI", ["hi.is"], "Ρέικιαβικ, Ισλανδία"),
    # Italy
    ("polimi", "Politecnico di Milano", "PoliMi", ["polimi.it"], "Μιλάνο, Ιταλία"),
    ("bocconi", "Bocconi University", "Bocconi", ["unibocconi.it", "studbocconi.it"], "Μιλάνο, Ιταλία"),
    ("sapienza", "Sapienza University of Rome", "Sapienza", ["uniroma1.it"], "Ρώμη, Ιταλία"),
    ("unibo", "University of Bologna", "Bologna", ["unibo.it"], "Μπολόνια, Ιταλία"),
    ("unipd", "University of Padua", "Padova", ["unipd.it"], "Πάντοβα, Ιταλία"),
    ("unimi", "University of Milan", "UniMi", ["unimi.it"], "Μιλάνο, Ιταλία"),
    ("polito", "Politecnico di Torino", "PoliTo", ["polito.it"], "Τορίνο, Ιταλία"),
    ("sns", "Scuola Normale Superiore", "SNS", ["sns.it"], "Πίζα, Ιταλία"),
    ("unipisa", "University of Pisa", "Pisa", ["unipi.it"], "Πίζα, Ιταλία"),
    ("unifi", "University of Florence", "Firenze", ["unifi.it"], "Φλωρεντία, Ιταλία"),
    ("unina", "University of Naples Federico II", "Federico II", ["unina.it"], "Νάπολη, Ιταλία"),
    ("unito", "University of Turin", "UniTo", ["unito.it"], "Τορίνο, Ιταλία"),
    ("luiss", "LUISS Guido Carli", "LUISS", ["luiss.it"], "Ρώμη, Ιταλία"),
    # Spain
    ("ub", "University of Barcelona", "UB", ["ub.edu"], "Βαρκελώνη, Ισπανία"),
    ("uab", "Autonomous University of Barcelona", "UAB", ["uab.cat", "autonoma.cat"], "Βαρκελώνη, Ισπανία"),
    ("ucm", "Complutense University of Madrid", "UCM", ["ucm.es"], "Μαδρίτη, Ισπανία"),
    ("uam", "Autonomous University of Madrid", "UAM", ["uam.es"], "Μαδρίτη, Ισπανία"),
    ("upf", "Pompeu Fabra University", "UPF", ["upf.edu"], "Βαρκελώνη, Ισπανία"),
    ("upm", "Technical University of Madrid", "UPM", ["upm.es"], "Μαδρίτη, Ισπανία"),
    ("upc", "Polytechnic University of Catalonia", "UPC", ["upc.edu"], "Βαρκελώνη, Ισπανία"),
    ("uc3m", "Carlos III University of Madrid", "UC3M", ["uc3m.es"], "Μαδρίτη, Ισπανία"),
    ("uv", "University of Valencia", "UV", ["uv.es"], "Βαλένθια, Ισπανία"),
    ("unav", "University of Navarra", "Navarra", ["unav.es"], "Παμπλόνα, Ισπανία"),
    ("ieu", "IE University", "IE", ["ie.edu"], "Μαδρίτη / Σεγκόβια, Ισπανία"),
    ("esade", "ESADE", "ESADE", ["esade.edu"], "Βαρκελώνη, Ισπανία"),
    # Portugal
    ("ulisboa", "University of Lisbon", "ULisboa", ["ulisboa.pt"], "Λισαβόνα, Πορτογαλία"),
    ("uporto", "University of Porto", "U.Porto", ["up.pt"], "Πόρτο, Πορτογαλία"),
    ("ucoimbra", "University of Coimbra", "Coimbra", ["uc.pt"], "Κοΐμπρα, Πορτογαλία"),
    ("unl", "NOVA University Lisbon", "NOVA", ["unl.pt", "novasbe.pt"], "Λισαβόνα, Πορτογαλία"),
    # Austria
    ("univie", "University of Vienna", "Uni Wien", ["univie.ac.at"], "Βιέννη, Αυστρία"),
    ("tuwien", "TU Wien", "TU Wien", ["tuwien.ac.at"], "Βιέννη, Αυστρία"),
    ("wu", "WU Vienna University of Economics and Business", "WU", ["wu.ac.at"], "Βιέννη, Αυστρία"),
    # Central / Eastern Europe
    ("uw", "University of Warsaw", "UW", ["uw.edu.pl"], "Βαρσοβία, Πολωνία"),
    ("uj", "Jagiellonian University", "UJ", ["uj.edu.pl"], "Κρακοβία, Πολωνία"),
    ("pw", "Warsaw University of Technology", "PW", ["pw.edu.pl"], "Βαρσοβία, Πολωνία"),
    ("cuni", "Charles University", "Charles", ["cuni.cz"], "Πράγα, Τσεχία"),
    ("cvut", "Czech Technical University in Prague", "ČVUT", ["cvut.cz"], "Πράγα, Τσεχία"),
    ("elte", "Eötvös Loránd University", "ELTE", ["elte.hu"], "Βουδαπέστη, Ουγγαρία"),
    ("bme", "Budapest University of Technology and Economics", "BME", ["bme.hu"], "Βουδαπέστη, Ουγγαρία"),
    ("unibuc", "University of Bucharest", "UniBuc", ["unibuc.ro"], "Βουκουρέστι, Ρουμανία"),
    ("unisofia", "Sofia University", "Sofia", ["uni-sofia.bg"], "Σόφια, Βουλγαρία"),
    ("bgacrs", "University of Belgrade", "Belgrade", ["bg.ac.rs"], "Βελιγράδι, Σερβία"),
    ("unizg", "University of Zagreb", "Zagreb", ["unizg.hr"], "Ζάγκρεμπ, Κροατία"),
    ("unilj", "University of Ljubljana", "Ljubljana", ["uni-lj.si"], "Λιουμπλιάνα, Σλοβενία"),
    ("tartu", "University of Tartu", "Tartu", ["ut.ee"], "Τάρτου, Εσθονία"),
    ("vilnius", "Vilnius University", "Vilnius", ["vu.lt"], "Βίλνιους, Λιθουανία"),
    ("rtu", "Riga Technical University", "RTU", ["rtu.lv"], "Ρίγα, Λετονία"),
    ("um", "University of Malta", "Malta", ["um.edu.mt"], "Μάλτα"),
]


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def sql() -> str:
    rows = []
    for pos, (uid, name, short, domains, city) in enumerate(EUROPE, start=100):
        doms = "ARRAY[" + ", ".join(q(d) for d in domains) + "]"
        rows.append(f"  ({q(uid)}, {q(name)}, {q(name)}, {q(short)}, {q(short)}, {doms}, {q(city)}, true, {pos})")
    return (
        "-- Generated by supabase/data/europe.py (phase E1: the best-known European universities, no departments).\n"
        "INSERT INTO public.universities (id, name_el, name_en, short_el, short_en, email_domains, city, open, position) VALUES\n"
        + ",\n".join(rows)
        + "\nON CONFLICT (id) DO UPDATE SET name_el = excluded.name_el, name_en = excluded.name_en, short_el = excluded.short_el,\n"
        "  short_en = excluded.short_en, email_domains = excluded.email_domains, city = excluded.city;\n"
    )


if __name__ == "__main__":
    print(sql(), end="")
