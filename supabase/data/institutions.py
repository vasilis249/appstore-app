"""Greek + Cypriot institutions added on 2026-10-01 (students-only Speak).

Sources: el.wikipedia «Ανώτατα Εκπαιδευτικά Ιδρύματα στην Ελλάδα» + each institution's article (sections «Σχολές και
τμήματα»), institution websites for colleges / Cyprus. Email domains = the institution's mail domains (MX checked on
2026-10-01); a sub-domain (e.g. ece.auth.gr, ac.upatras.gr, edu.hmu.gr) matches automatically. Staff addresses are
accepted on purpose (product decision). Run `python3 supabase/data/institutions.py > migration.sql`.
"""

# id, name_el, name_en, short_el, short_en, domains, city, departments ("code|name_el|short_el|name_en|short_en")
INSTITUTIONS = [
    ("auth", "Αριστοτέλειο Πανεπιστήμιο Θεσσαλονίκης", "Aristotle University of Thessaloniki", "ΑΠΘ", "AUTh", ["auth.gr"], "Θεσσαλονίκη", """
theol|Θεολογίας|Θεολογία|Theology|Theology
pastoral|Ποιμαντικής και Κοινωνικής Θεολογίας|Ποιμαντική Θεολογία|Pastoral and Social Theology|Pastoral Theology
phil|Φιλολογίας|Φιλολογία|Philology|Philology
hist-arch|Ιστορίας και Αρχαιολογίας|Ιστορία & Αρχαιολογία|History and Archaeology|History & Archaeology
philosophy|Φιλοσοφίας και Παιδαγωγικής|Φιλοσοφία & Παιδαγωγική|Philosophy and Education|Philosophy & Education
english|Αγγλικής Γλώσσας και Φιλολογίας|Αγγλική Φιλολογία|English Language and Literature|English
french|Γαλλικής Γλώσσας και Φιλολογίας|Γαλλική Φιλολογία|French Language and Literature|French
german|Γερμανικής Γλώσσας και Φιλολογίας|Γερμανική Φιλολογία|German Language and Literature|German
italian|Ιταλικής Γλώσσας και Φιλολογίας|Ιταλική Φιλολογία|Italian Language and Literature|Italian
psych|Ψυχολογίας|Ψυχολογία|Psychology|Psychology
math|Μαθηματικών|Μαθηματικά|Mathematics|Mathematics
physics|Φυσικής|Φυσική|Physics|Physics
chem|Χημείας|Χημεία|Chemistry|Chemistry
bio|Βιολογίας|Βιολογία|Biology|Biology
geo|Γεωλογίας|Γεωλογία|Geology|Geology
csd|Πληροφορικής|Πληροφορική|Informatics|Informatics
ece|Ηλεκτρολόγων Μηχανικών και Μηχανικών Υπολογιστών|ΗΜΜΥ|Electrical and Computer Engineering|ECE
mech|Μηχανολόγων Μηχανικών|Μηχανολόγοι|Mechanical Engineering|Mechanical
arch|Αρχιτεκτόνων Μηχανικών|Αρχιτέκτονες|Architecture|Architecture
civil|Πολιτικών Μηχανικών|Πολιτικοί Μηχανικοί|Civil Engineering|Civil
chemeng|Χημικών Μηχανικών|Χημικοί Μηχανικοί|Chemical Engineering|Chemical Eng.
rsge|Αγρονόμων Τοπογράφων Μηχανικών|Αγρονόμοι Τοπογράφοι|Rural and Surveying Engineering|Surveying
plandev|Μηχανικών Χωροταξίας και Ανάπτυξης|Χωροταξία|Spatial Planning and Development Engineering|Spatial Planning
med|Ιατρικής|Ιατρική|Medicine|Medicine
vet|Κτηνιατρικής|Κτηνιατρική|Veterinary Medicine|Veterinary
pharm|Φαρμακευτικής|Φαρμακευτική|Pharmacy|Pharmacy
dent|Οδοντιατρικής|Οδοντιατρική|Dentistry|Dentistry
law|Νομικής|Νομική|Law|Law
econ|Οικονομικών Επιστημών|Οικονομικό|Economics|Economics
polsci|Πολιτικών Επιστημών|Πολιτικές Επιστήμες|Political Sciences|Political Science
jour|Δημοσιογραφίας και Μέσων Μαζικής Επικοινωνίας|Δημοσιογραφία & ΜΜΕ|Journalism and Mass Media|Journalism
primedu|Παιδαγωγικό Τμήμα Δημοτικής Εκπαίδευσης|ΠΤΔΕ|Primary Education|Primary Education
ecedu|Επιστημών Προσχολικής Αγωγής και Εκπαίδευσης|Προσχολική Αγωγή|Early Childhood Education|Early Childhood
pe|Επιστήμης Φυσικής Αγωγής και Αθλητισμού|ΤΕΦΑΑ|Physical Education and Sport Science|PE & Sport
pe-serres|Επιστήμης Φυσικής Αγωγής και Αθλητισμού Σερρών|ΤΕΦΑΑ Σερρών|Physical Education and Sport Science (Serres)|PE & Sport Serres
arts|Εικαστικών και Εφαρμοσμένων Τεχνών|Εικαστικά|Visual and Applied Arts|Visual Arts
music|Μουσικών Σπουδών|Μουσικές Σπουδές|Music Studies|Music
theatre|Θεάτρου|Θέατρο|Drama|Drama
film|Κινηματογράφου|Κινηματογράφος|Film Studies|Film
agri|Γεωπονίας|Γεωπονία|Agriculture|Agriculture
forest|Δασολογίας και Φυσικού Περιβάλλοντος|Δασολογία|Forestry and Natural Environment|Forestry
"""),
    ("hmu", "Ελληνικό Μεσογειακό Πανεπιστήμιο", "Hellenic Mediterranean University", "ΕΛΜΕΠΑ", "HMU", ["hmu.gr"], "Ηράκλειο", """
ece|Ηλεκτρολόγων Μηχανικών και Μηχανικών Υπολογιστών|ΗΜΜΥ|Electrical and Computer Engineering|ECE
mech|Μηχανολόγων Μηχανικών|Μηχανολόγοι|Mechanical Engineering|Mechanical
elec|Ηλεκτρονικών Μηχανικών|Ηλεκτρονικοί Μηχανικοί|Electronic Engineering|Electronic Eng.
tourism|Διοίκησης Επιχειρήσεων και Τουρισμού|Διοίκηση Τουρισμού|Business Administration and Tourism|Tourism
mst|Διοικητικής Επιστήμης και Τεχνολογίας|Διοικητική Επιστήμη|Management Science and Technology|Management Science
acc|Λογιστικής και Χρηματοοικονομικής|Λογιστική|Accounting and Finance|Accounting
music|Μουσικής Τεχνολογίας και Ακουστικής|Μουσική Τεχνολογία|Music Technology and Acoustics|Music Technology
nurs|Νοσηλευτικής|Νοσηλευτική|Nursing|Nursing
socwork|Κοινωνικής Εργασίας|Κοινωνική Εργασία|Social Work|Social Work
nutr|Επιστημών Διατροφής και Διαιτολογίας|Διατροφή & Διαιτολογία|Nutrition and Dietetics|Nutrition
agri|Γεωπονίας|Γεωπονία|Agriculture|Agriculture
"""),
    ("upatras", "Πανεπιστήμιο Πατρών", "University of Patras", "Π. Πατρών", "UPatras", ["upatras.gr", "upnet.gr"], "Πάτρα", """
ecedu|Επιστημών της Εκπαίδευσης και της Αγωγής στην Προσχολική Ηλικία|Προσχολική Αγωγή|Early Childhood Education|Early Childhood
edu|Επιστημών της Εκπαίδευσης και Κοινωνικής Εργασίας|Εκπαίδευση & Κοινωνική Εργασία|Educational Sciences and Social Work|Education & Social Work
theatre|Θεατρικών Σπουδών|Θεατρικές Σπουδές|Theatre Studies|Theatre
phil|Φιλολογίας|Φιλολογία|Philology|Philology
philosophy|Φιλοσοφίας|Φιλοσοφία|Philosophy|Philosophy
hist-arch|Ιστορίας και Αρχαιολογίας|Ιστορία & Αρχαιολογία|History and Archaeology|History & Archaeology
culture|Διαχείρισης Πολιτισμικού Περιβάλλοντος και Νέων Τεχνολογιών|Πολιτισμικό Περιβάλλον|Cultural Heritage Management and New Technologies|Cultural Heritage
math|Μαθηματικών|Μαθηματικά|Mathematics|Mathematics
physics|Φυσικής|Φυσική|Physics|Physics
chem|Χημείας|Χημεία|Chemistry|Chemistry
bio|Βιολογίας|Βιολογία|Biology|Biology
geo|Γεωλογίας|Γεωλογία|Geology|Geology
materials|Επιστήμης των Υλικών|Επιστήμη Υλικών|Materials Science|Materials
agri|Γεωπονίας|Γεωπονία|Agriculture|Agriculture
food|Επιστήμης και Τεχνολογίας Τροφίμων|Τεχνολογία Τροφίμων|Food Science and Technology|Food Science
fish|Αλιείας και Υδατοκαλλιεργειών|Αλιεία|Fisheries and Aquaculture|Fisheries
sustagri|Αειφορικής Γεωργίας|Αειφορική Γεωργία|Sustainable Agriculture|Sustainable Agri.
med|Ιατρικής|Ιατρική|Medicine|Medicine
pharm|Φαρμακευτικής|Φαρμακευτική|Pharmacy|Pharmacy
speech|Λογοθεραπείας|Λογοθεραπεία|Speech and Language Therapy|Speech Therapy
nurs|Νοσηλευτικής|Νοσηλευτική|Nursing|Nursing
physio|Φυσικοθεραπείας|Φυσικοθεραπεία|Physiotherapy|Physiotherapy
ba|Διοίκησης Επιχειρήσεων|Διοίκηση Επιχειρήσεων|Business Administration|Business
tourism|Διοίκησης Τουρισμού|Διοίκηση Τουρισμού|Tourism Management|Tourism
mst|Διοικητικής Επιστήμης και Τεχνολογίας|Διοικητική Επιστήμη|Management Science and Technology|Management Science
econ|Οικονομικών Επιστημών|Οικονομικό|Economics|Economics
ece|Ηλεκτρολόγων Μηχανικών και Τεχνολογίας Υπολογιστών|ΗΜΤΥ|Electrical and Computer Engineering|ECE
mech|Μηχανολόγων και Αεροναυπηγών Μηχανικών|Μηχανολόγοι & Αεροναυπηγοί|Mechanical Engineering and Aeronautics|Mechanical & Aero
civil|Πολιτικών Μηχανικών|Πολιτικοί Μηχανικοί|Civil Engineering|Civil
chemeng|Χημικών Μηχανικών|Χημικοί Μηχανικοί|Chemical Engineering|Chemical Eng.
arch|Αρχιτεκτόνων Μηχανικών|Αρχιτέκτονες|Architecture|Architecture
ceid|Μηχανικών Ηλεκτρονικών Υπολογιστών και Πληροφορικής|ΜΗΥΠ (CEID)|Computer Engineering and Informatics|CEID
env|Μηχανικών Περιβάλλοντος|Μηχανικοί Περιβάλλοντος|Environmental Engineering|Environmental Eng.
"""),
    ("uoc", "Πανεπιστήμιο Κρήτης", "University of Crete", "Π. Κρήτης", "UoC", ["uoc.gr"], "Ηράκλειο / Ρέθυμνο", """
phil|Φιλολογίας|Φιλολογία|Philology|Philology
hist-arch|Ιστορίας και Αρχαιολογίας|Ιστορία & Αρχαιολογία|History and Archaeology|History & Archaeology
philosophy|Φιλοσοφίας|Φιλοσοφία|Philosophy|Philosophy
soc|Κοινωνιολογίας|Κοινωνιολογία|Sociology|Sociology
psych|Ψυχολογίας|Ψυχολογία|Psychology|Psychology
econ|Οικονομικών Επιστημών|Οικονομικό|Economics|Economics
polsci|Πολιτικής Επιστήμης|Πολιτική Επιστήμη|Political Science|Political Science
primedu|Παιδαγωγικό Τμήμα Δημοτικής Εκπαίδευσης|ΠΤΔΕ|Primary Education|Primary Education
preedu|Παιδαγωγικό Τμήμα Προσχολικής Εκπαίδευσης|ΠΤΠΕ|Preschool Education|Preschool
math|Μαθηματικών και Εφαρμοσμένων Μαθηματικών|Μαθηματικά|Mathematics and Applied Mathematics|Mathematics
physics|Φυσικής|Φυσική|Physics|Physics
chem|Χημείας|Χημεία|Chemistry|Chemistry
bio|Βιολογίας|Βιολογία|Biology|Biology
csd|Επιστήμης Υπολογιστών|Επιστήμη Υπολογιστών|Computer Science|Computer Science
materials|Επιστήμης και Μηχανικής Υλικών|Επιστήμη Υλικών|Materials Science and Engineering|Materials
med|Ιατρικής|Ιατρική|Medicine|Medicine
"""),
    ("tuc", "Πολυτεχνείο Κρήτης", "Technical University of Crete", "Πολυτεχνείο Κρήτης", "TUC", ["tuc.gr"], "Χανιά", """
pem|Μηχανικών Παραγωγής και Διοίκησης|Παραγωγής & Διοίκησης|Production Engineering and Management|Production Eng.
mre|Μηχανικών Ορυκτών Πόρων|Ορυκτοί Πόροι|Mineral Resources Engineering|Mineral Resources
ece|Ηλεκτρολόγων Μηχανικών και Μηχανικών Υπολογιστών|ΗΜΜΥ|Electrical and Computer Engineering|ECE
chenveng|Χημικών Μηχανικών και Μηχανικών Περιβάλλοντος|Χημικοί & Περιβάλλοντος|Chemical and Environmental Engineering|ChemEnv
arch|Αρχιτεκτόνων Μηχανικών|Αρχιτέκτονες|Architecture|Architecture
"""),
    ("uoi", "Πανεπιστήμιο Ιωαννίνων", "University of Ioannina", "Π. Ιωαννίνων", "UoI", ["uoi.gr"], "Ιωάννινα", """
phil|Φιλολογίας|Φιλολογία|Philology|Philology
hist-arch|Ιστορίας και Αρχαιολογίας|Ιστορία & Αρχαιολογία|History and Archaeology|History & Archaeology
philosophy|Φιλοσοφίας|Φιλοσοφία|Philosophy|Philosophy
math|Μαθηματικών|Μαθηματικά|Mathematics|Mathematics
physics|Φυσικής|Φυσική|Physics|Physics
chem|Χημείας|Χημεία|Chemistry|Chemistry
med|Ιατρικής|Ιατρική|Medicine|Medicine
bat|Βιολογικών Εφαρμογών και Τεχνολογιών|Βιολογικές Εφαρμογές|Biological Applications and Technology|Biological Applications
nurs|Νοσηλευτικής|Νοσηλευτική|Nursing|Nursing
speech|Λογοθεραπείας|Λογοθεραπεία|Speech and Language Therapy|Speech Therapy
cse|Μηχανικών Η/Υ και Πληροφορικής|Μηχανικοί Η/Υ|Computer Science and Engineering|CSE
materials|Μηχανικών Επιστήμης Υλικών|Μηχανικοί Υλικών|Materials Science and Engineering|Materials
arch|Αρχιτεκτόνων Μηχανικών|Αρχιτέκτονες|Architecture|Architecture
primedu|Παιδαγωγικό Τμήμα Δημοτικής Εκπαίδευσης|ΠΤΔΕ|Primary Education|Primary Education
preedu|Παιδαγωγικό Τμήμα Νηπιαγωγών|ΠΤΝ|Early Childhood Education|Early Childhood
econ|Οικονομικών Επιστημών|Οικονομικό|Economics|Economics
acc|Λογιστικής και Χρηματοοικονομικής|Λογιστική|Accounting and Finance|Accounting
ecec|Αγωγής και Φροντίδας στην Πρώιμη Παιδική Ηλικία|Πρώιμη Παιδική Ηλικία|Early Years Learning and Care|Early Years
psych|Ψυχολογίας|Ψυχολογία|Psychology|Psychology
arts|Εικαστικών Τεχνών και Επιστημών της Τέχνης|Εικαστικά|Fine Arts and Art Sciences|Fine Arts
music|Μουσικών Σπουδών|Μουσικές Σπουδές|Music Studies|Music
agri|Γεωπονίας|Γεωπονία|Agriculture|Agriculture
it|Πληροφορικής και Τηλεπικοινωνιών|Πληροφορική & Τηλεπικοινωνίες|Informatics and Telecommunications|Informatics & Telecom
"""),
    ("duth", "Δημοκρίτειο Πανεπιστήμιο Θράκης", "Democritus University of Thrace", "ΔΠΘ", "DUTh", ["duth.gr"], "Κομοτηνή / Ξάνθη", """
law|Νομικής|Νομική|Law|Law
socwork|Κοινωνικής Εργασίας|Κοινωνική Εργασία|Social Work|Social Work
socpol|Κοινωνικής Πολιτικής|Κοινωνική Πολιτική|Social Policy|Social Policy
polsci|Πολιτικής Επιστήμης|Πολιτική Επιστήμη|Political Science|Political Science
econ|Οικονομικών Επιστημών|Οικονομικό|Economics|Economics
grphil|Ελληνικής Φιλολογίας|Ελληνική Φιλολογία|Greek Philology|Greek Philology
hist|Ιστορίας και Εθνολογίας|Ιστορία & Εθνολογία|History and Ethnology|History & Ethnology
blacksea|Γλώσσας, Φιλολογίας και Πολιτισμού Παρευξείνιων Χωρών|Παρευξείνιες Χώρες|Language, Literature and Culture of the Black Sea Countries|Black Sea Studies
pe|Επιστήμης Φυσικής Αγωγής και Αθλητισμού|ΤΕΦΑΑ|Physical Education and Sport Science|PE & Sport
ot|Εργοθεραπείας|Εργοθεραπεία|Occupational Therapy|Occupational Therapy
civil|Πολιτικών Μηχανικών|Πολιτικοί Μηχανικοί|Civil Engineering|Civil
ece|Ηλεκτρολόγων Μηχανικών και Μηχανικών Υπολογιστών|ΗΜΜΥ|Electrical and Computer Engineering|ECE
env|Μηχανικών Περιβάλλοντος|Μηχανικοί Περιβάλλοντος|Environmental Engineering|Environmental Eng.
arch|Αρχιτεκτόνων Μηχανικών|Αρχιτέκτονες|Architecture|Architecture
pme|Μηχανικών Παραγωγής και Διοίκησης|Παραγωγής & Διοίκησης|Production and Management Engineering|Production Eng.
med|Ιατρικής|Ιατρική|Medicine|Medicine
mbg|Μοριακής Βιολογίας και Γενετικής|Μοριακή Βιολογία|Molecular Biology and Genetics|Molecular Biology
nurs|Νοσηλευτικής|Νοσηλευτική|Nursing|Nursing
primedu|Παιδαγωγικό Τμήμα Δημοτικής Εκπαίδευσης|ΠΤΔΕ|Primary Education|Primary Education
ecedu|Επιστημών της Εκπαίδευσης στην Προσχολική Ηλικία|Προσχολική Ηλικία|Early Childhood Education|Early Childhood
psych|Ψυχολογίας|Ψυχολογία|Psychology|Psychology
agrdev|Αγροτικής Ανάπτυξης|Αγροτική Ανάπτυξη|Agricultural Development|Agricultural Dev.
forest|Δασολογίας, Διαχείρισης Περιβάλλοντος και Φυσικών Πόρων|Δασολογία|Forestry and Management of the Environment and Natural Resources|Forestry
wine|Αμπελουργίας και Οινολογίας|Αμπελουργία & Οινολογία|Viticulture and Oenology|Viticulture
climate|Φυσικού Περιβάλλοντος και Κλιματικής Ανθεκτικότητας|Κλιματική Ανθεκτικότητα|Natural Environment and Climate Resilience|Climate Resilience
csd|Πληροφορικής|Πληροφορική|Informatics|Informatics
physics|Φυσικής|Φυσική|Physics|Physics
chem|Χημείας|Χημεία|Chemistry|Chemistry
mst|Διοικητικής Επιστήμης και Τεχνολογίας|Διοικητική Επιστήμη|Management Science and Technology|Management Science
acc|Λογιστικής και Χρηματοοικονομικής|Λογιστική|Accounting and Finance|Accounting
"""),
    ("ihu", "Διεθνές Πανεπιστήμιο της Ελλάδος", "International Hellenic University", "ΔΙΠΑΕ", "IHU", ["ihu.gr", "ihu.edu.gr"], "Θεσσαλονίκη / Σέρρες", """
ba|Οργάνωσης και Διοίκησης Επιχειρήσεων|Διοίκηση Επιχειρήσεων|Business Administration|Business
econ|Οικονομικών Επιστημών|Οικονομικό|Economics|Economics
scm|Διοίκησης Εφοδιαστικής Αλυσίδας|Εφοδιαστική Αλυσίδα|Supply Chain Management|Supply Chain
mkt|Διοίκησης Οργανισμών, Μάρκετινγκ και Τουρισμού|Μάρκετινγκ & Τουρισμός|Organisation Management, Marketing and Tourism|Marketing & Tourism
acc|Λογιστικής και Πληροφοριακών Συστημάτων|Λογιστική & Πληροφοριακά|Accounting and Information Systems|Accounting & IS
lib|Βιβλιοθηκονομίας, Αρχειονομίας και Συστημάτων Πληροφόρησης|Βιβλιοθηκονομία|Library Science, Archives and Information Systems|Library Science
ecec|Αγωγής και Φροντίδας στην Πρώιμη Παιδική Ηλικία|Πρώιμη Παιδική Ηλικία|Early Childhood Care and Education|Early Childhood
biomed|Βιοϊατρικών Επιστημών|Βιοϊατρικές Επιστήμες|Biomedical Sciences|Biomedical
nutr|Επιστημών Διατροφής και Διαιτολογίας|Διατροφή & Διαιτολογία|Nutritional Sciences and Dietetics|Nutrition
midwife|Μαιευτικής|Μαιευτική|Midwifery|Midwifery
physio|Φυσικοθεραπείας|Φυσικοθεραπεία|Physiotherapy|Physiotherapy
nurs|Νοσηλευτικής|Νοσηλευτική|Nursing|Nursing
mech|Μηχανολόγων Μηχανικών|Μηχανολόγοι|Mechanical Engineering|Mechanical
survey|Μηχανικών Τοπογραφίας και Γεωπληροφορικής|Τοπογράφοι|Surveying and Geoinformatics Engineering|Surveying
civil|Πολιτικών Μηχανικών|Πολιτικοί Μηχανικοί|Civil Engineering|Civil
ice|Μηχανικών Πληροφορικής, Υπολογιστών και Τηλεπικοινωνιών|Μηχανικοί Πληροφορικής Σερρών|Computer, Informatics and Telecommunications Engineering|Computer Eng. (Serres)
env|Μηχανικών Περιβάλλοντος|Μηχανικοί Περιβάλλοντος|Environmental Engineering|Environmental Eng.
pme|Μηχανικών Παραγωγής και Διοίκησης|Παραγωγής & Διοίκησης|Industrial Engineering and Management|Industrial Eng.
iee|Μηχανικών Πληροφορικής και Ηλεκτρονικών Συστημάτων|Μηχανικοί Πληροφορικής (ΘΕΣ)|Information and Electronic Engineering|IEE
interior|Εσωτερικής Αρχιτεκτονικής|Εσωτερική Αρχιτεκτονική|Interior Architecture|Interior Architecture
fashion|Δημιουργικού Σχεδιασμού και Ένδυσης|Σχεδιασμός Ένδυσης|Creative Design and Clothing|Fashion Design
food|Επιστήμης και Τεχνολογίας Τροφίμων|Τεχνολογία Τροφίμων|Food Science and Technology|Food Science
agri|Γεωπονίας|Γεωπονία|Agriculture|Agriculture
"""),
    ("uth", "Πανεπιστήμιο Θεσσαλίας", "University of Thessaly", "Π. Θεσσαλίας", "UTH", ["uth.gr"], "Βόλος / Λάρισα", """
preedu|Παιδαγωγικό Τμήμα Προσχολικής Εκπαίδευσης|ΠΤΠΕ|Early Childhood Education|Early Childhood
primedu|Παιδαγωγικό Τμήμα Δημοτικής Εκπαίδευσης|ΠΤΔΕ|Primary Education|Primary Education
sped|Παιδαγωγικό Τμήμα Ειδικής Αγωγής|Ειδική Αγωγή|Special Education|Special Education
hist|Ιστορίας, Αρχαιολογίας και Κοινωνικής Ανθρωπολογίας|ΙΑΚΑ|History, Archaeology and Social Anthropology|History & Anthropology
lang|Γλωσσικών και Διαπολιτισμικών Σπουδών|Διαπολιτισμικές Σπουδές|Language and Intercultural Studies|Intercultural Studies
culture|Πολιτισμού και Δημιουργικών Μέσων και Βιομηχανιών|Δημιουργικά Μέσα|Culture, Creative Media and Industries|Creative Media
prd|Μηχανικών Χωροταξίας, Πολεοδομίας και Περιφερειακής Ανάπτυξης|Χωροταξία|Planning and Regional Development|Planning
mech|Μηχανολόγων Μηχανικών|Μηχανολόγοι|Mechanical Engineering|Mechanical
civil|Πολιτικών Μηχανικών|Πολιτικοί Μηχανικοί|Civil Engineering|Civil
arch|Αρχιτεκτόνων Μηχανικών|Αρχιτέκτονες|Architecture|Architecture
ece|Ηλεκτρολόγων Μηχανικών και Μηχανικών Υπολογιστών|ΗΜΜΥ|Electrical and Computer Engineering|ECE
med|Ιατρικής|Ιατρική|Medicine|Medicine
biochem|Βιοχημείας και Βιοτεχνολογίας|Βιοχημεία|Biochemistry and Biotechnology|Biochemistry
nurs|Νοσηλευτικής|Νοσηλευτική|Nursing|Nursing
vet|Κτηνιατρικής|Κτηνιατρική|Veterinary Medicine|Veterinary
publichealth|Δημόσιας και Ενιαίας Υγείας|Δημόσια Υγεία|Public and One Health|Public Health
physio|Φυσικοθεραπείας|Φυσικοθεραπεία|Physiotherapy|Physiotherapy
agri-crop|Γεωπονίας, Φυτικής Παραγωγής και Αγροτικού Περιβάλλοντος|Φυτική Παραγωγή|Agriculture, Crop Production and Rural Environment|Crop Production
agri-fish|Γεωπονίας, Ιχθυολογίας και Υδάτινου Περιβάλλοντος|Ιχθυολογία|Ichthyology and Aquatic Environment|Ichthyology
agrotech|Γεωπονίας – Αγροτεχνολογίας|Αγροτεχνολογία|Agrotechnology|Agrotechnology
animal|Επιστήμης Ζωικής Παραγωγής|Ζωική Παραγωγή|Animal Science|Animal Science
food|Επιστήμης Τροφίμων και Διατροφής|Τρόφιμα & Διατροφή|Food Science and Nutrition|Food & Nutrition
acc|Λογιστικής και Χρηματοοικονομικής|Λογιστική|Accounting and Finance|Accounting
ba|Διοίκησης Επιχειρήσεων|Διοίκηση Επιχειρήσεων|Business Administration|Business
econ|Οικονομικών Επιστημών|Οικονομικό|Economics|Economics
ds|Ψηφιακών Συστημάτων|Ψηφιακά Συστήματα|Digital Systems|Digital Systems
energy|Συστημάτων Ενέργειας|Συστήματα Ενέργειας|Energy Systems|Energy Systems
envir|Περιβάλλοντος|Περιβάλλον|Environmental Sciences|Environment
wood|Δασολογίας, Επιστημών Ξύλου και Σχεδιασμού|Δασολογία & Ξύλο|Forestry, Wood Sciences and Design|Forestry & Wood
dit|Πληροφορικής και Τηλεπικοινωνιών|Πληροφορική & Τηλεπικοινωνίες|Informatics and Telecommunications|Informatics & Telecom
bioinf|Πληροφορικής με Εφαρμογές στη Βιοϊατρική|Βιοϊατρική Πληροφορική|Computer Science and Biomedical Informatics|Biomedical Informatics
math|Μαθηματικών|Μαθηματικά|Mathematics|Mathematics
physics|Φυσικής|Φυσική|Physics|Physics
pe|Επιστήμης Φυσικής Αγωγής και Αθλητισμού|ΤΕΦΑΑ|Physical Education and Sport Science|PE & Sport
diet|Διαιτολογίας και Διατροφολογίας|Διαιτολογία|Nutrition and Dietetics|Dietetics
"""),
    ("uom", "Πανεπιστήμιο Μακεδονίας", "University of Macedonia", "ΠΑΜΑΚ", "UoM", ["uom.edu.gr", "uom.gr"], "Θεσσαλονίκη", """
ba|Οργάνωσης και Διοίκησης Επιχειρήσεων|Διοίκηση Επιχειρήσεων|Business Administration|Business
acc|Λογιστικής και Χρηματοοικονομικής|Λογιστική|Accounting and Finance|Accounting
econ|Οικονομικών Επιστημών|Οικονομικό|Economics|Economics
balkan|Βαλκανικών, Σλαβικών και Ανατολικών Σπουδών|Βαλκανικές Σπουδές|Balkan, Slavic and Oriental Studies|Balkan Studies
ies|Διεθνών και Ευρωπαϊκών Σπουδών|Διεθνείς Σπουδές|International and European Studies|International Studies
esp|Εκπαιδευτικής και Κοινωνικής Πολιτικής|Εκπαιδευτική Πολιτική|Educational and Social Policy|Educational Policy
music|Μουσικής Επιστήμης και Τέχνης|Μουσική Επιστήμη|Music Science and Art|Music
dai|Εφαρμοσμένης Πληροφορικής|Εφαρμοσμένη Πληροφορική|Applied Informatics|Applied Informatics
"""),
    ("uowm", "Πανεπιστήμιο Δυτικής Μακεδονίας", "University of Western Macedonia", "ΠΔΜ", "UoWM", ["uowm.gr"], "Κοζάνη", """
ece|Ηλεκτρολόγων Μηχανικών και Μηχανικών Υπολογιστών|ΗΜΜΥ|Electrical and Computer Engineering|ECE
mech|Μηχανολόγων Μηχανικών|Μηχανολόγοι|Mechanical Engineering|Mechanical
mre|Μηχανικών Ορυκτών Πόρων|Ορυκτοί Πόροι|Mineral Resources Engineering|Mineral Resources
pdse|Μηχανικών Σχεδίασης Προϊόντων και Συστημάτων|Σχεδίαση Προϊόντων|Product and Systems Design Engineering|Product Design
chemeng|Χημικών Μηχανικών|Χημικοί Μηχανικοί|Chemical Engineering|Chemical Eng.
mst|Διοικητικής Επιστήμης και Τεχνολογίας|Διοικητική Επιστήμη|Management Science and Technology|Management Science
acc|Λογιστικής και Χρηματοοικονομικής|Λογιστική|Accounting and Finance|Accounting
ba|Οργάνωσης και Διοίκησης Επιχειρήσεων|Διοίκηση Επιχειρήσεων|Business Administration|Business
stat|Στατιστικής και Ασφαλιστικής Επιστήμης|Στατιστική|Statistics and Insurance Science|Statistics
econ|Οικονομικών Επιστημών|Οικονομικό|Economics|Economics
ieeo|Διεθνών και Ευρωπαϊκών Οικονομικών Σπουδών|Διεθνή Οικονομικά|International and European Economic Studies|Int. Economics
math|Μαθηματικών|Μαθηματικά|Mathematics|Mathematics
csd|Πληροφορικής|Πληροφορική|Informatics|Informatics
ot|Εργοθεραπείας|Εργοθεραπεία|Occupational Therapy|Occupational Therapy
midwife|Μαιευτικής|Μαιευτική|Midwifery|Midwifery
agri|Γεωπονίας|Γεωπονία|Agriculture|Agriculture
primedu|Παιδαγωγικό Τμήμα Δημοτικής Εκπαίδευσης|ΠΤΔΕ|Primary Education|Primary Education
preedu|Παιδαγωγικό Τμήμα Νηπιαγωγών|ΠΤΝ|Early Childhood Education|Early Childhood
psych|Ψυχολογίας|Ψυχολογία|Psychology|Psychology
comm|Επικοινωνίας και Ψηφιακών Μέσων|Ψηφιακά Μέσα|Communication and Digital Media|Digital Media
arts|Εικαστικών και Εφαρμοσμένων Τεχνών|Εικαστικά|Fine and Applied Arts|Fine Arts
"""),
    ("uop", "Πανεπιστήμιο Πελοποννήσου", "University of the Peloponnese", "Π. Πελοποννήσου", "UoP", ["uop.gr"], "Τρίπολη / Καλαμάτα", """
econ|Οικονομικών Επιστημών|Οικονομικό|Economics|Economics
dit|Πληροφορικής και Τηλεπικοινωνιών|Πληροφορική & Τηλεπικοινωνίες|Informatics and Telecommunications|Informatics & Telecom
ds|Ψηφιακών Συστημάτων|Ψηφιακά Συστήματα|Digital Systems|Digital Systems
mst|Διοικητικής Επιστήμης και Τεχνολογίας|Διοικητική Επιστήμη|Management Science and Technology|Management Science
hist|Ιστορίας, Αρχαιολογίας και Διαχείρισης Πολιτισμικών Αγαθών|Ιστορία & Πολιτισμικά Αγαθά|History, Archaeology and Cultural Resources Management|History & Archaeology
phil|Φιλολογίας|Φιλολογία|Philology|Philology
socpol|Κοινωνικής και Εκπαιδευτικής Πολιτικής|Κοινωνική Πολιτική|Social and Educational Policy|Social Policy
polsci|Πολιτικής Επιστήμης και Διεθνών Σχέσεων|Πολιτική Επιστήμη|Political Science and International Relations|Political Science
theatre|Θεατρικών Σπουδών|Θεατρικές Σπουδές|Theatre Studies|Theatre
pdart|Παραστατικών και Ψηφιακών Τεχνών|Παραστατικές Τέχνες|Performing and Digital Arts|Performing Arts
sport|Οργάνωσης και Διαχείρισης Αθλητισμού|Διαχείριση Αθλητισμού|Sport Organisation and Management|Sport Management
food|Επιστήμης και Τεχνολογίας Τροφίμων|Τεχνολογία Τροφίμων|Food Science and Technology|Food Science
agri|Γεωπονίας|Γεωπονία|Agriculture|Agriculture
ba|Διοίκησης Επιχειρήσεων και Οργανισμών|Διοίκηση Επιχειρήσεων|Business and Organisation Administration|Business
acc|Λογιστικής και Χρηματοοικονομικής|Λογιστική|Accounting and Finance|Accounting
nutr|Επιστήμης Διατροφής και Διαιτολογίας|Διατροφή & Διαιτολογία|Nutrition and Dietetics|Nutrition
speech|Λογοθεραπείας|Λογοθεραπεία|Speech and Language Therapy|Speech Therapy
nurs|Νοσηλευτικής|Νοσηλευτική|Nursing|Nursing
physio|Φυσικοθεραπείας|Φυσικοθεραπεία|Physiotherapy|Physiotherapy
ece|Ηλεκτρολόγων Μηχανικών και Μηχανικών Υπολογιστών|ΗΜΜΥ|Electrical and Computer Engineering|ECE
mech|Μηχανολόγων Μηχανικών|Μηχανολόγοι|Mechanical Engineering|Mechanical
civil|Πολιτικών Μηχανικών|Πολιτικοί Μηχανικοί|Civil Engineering|Civil
"""),
    ("aegean", "Πανεπιστήμιο Αιγαίου", "University of the Aegean", "Π. Αιγαίου", "Aegean", ["aegean.gr"], "Μυτιλήνη / νησιά Αιγαίου", """
geo|Γεωγραφίας|Γεωγραφία|Geography|Geography
anthro|Κοινωνικής Ανθρωπολογίας και Ιστορίας|Ανθρωπολογία & Ιστορία|Social Anthropology and History|Anthropology
soc|Κοινωνιολογίας|Κοινωνιολογία|Sociology|Sociology
ct|Πολιτισμικής Τεχνολογίας και Επικοινωνίας|Πολιτισμική Τεχνολογία|Cultural Technology and Communication|Cultural Technology
env|Περιβάλλοντος|Περιβάλλον|Environment|Environment
marine|Ωκεανογραφίας και Θαλασσίων Βιοεπιστημών|Ωκεανογραφία|Oceanography and Marine Biosciences|Oceanography
food|Επιστήμης Τροφίμων και Διατροφής|Τρόφιμα & Διατροφή|Food Science and Nutrition|Food & Nutrition
ba|Διοίκησης Επιχειρήσεων|Διοίκηση Επιχειρήσεων|Business Administration|Business
ship|Ναυτιλίας και Επιχειρηματικών Υπηρεσιών|Ναυτιλία|Shipping, Trade and Transport|Shipping
tourism|Οικονομικής και Διοίκησης Τουρισμού|Τουρισμός|Tourism Economics and Management|Tourism
fme|Μηχανικών Οικονομίας και Διοίκησης|Μηχανικοί Οικονομίας|Financial and Management Engineering|Financial Eng.
icsd|Μηχανικών Πληροφοριακών και Επικοινωνιακών Συστημάτων|Μηχανικοί Πληροφοριακών Συστημάτων|Information and Communication Systems Engineering|ICSD
syros|Μηχανικών Σχεδίασης Προϊόντων και Συστημάτων|Σχεδίαση Προϊόντων|Product and Systems Design Engineering|Product Design
math|Μαθηματικών|Μαθηματικά|Mathematics|Mathematics
stat|Στατιστικής και Αναλογιστικών – Χρηματοοικονομικών Μαθηματικών|Στατιστική|Statistics and Actuarial-Financial Mathematics|Statistics
primedu|Παιδαγωγικό Τμήμα Δημοτικής Εκπαίδευσης|ΠΤΔΕ|Primary Education|Primary Education
preedu|Επιστημών της Προσχολικής Αγωγής και του Εκπαιδευτικού Σχεδιασμού|Προσχολική Αγωγή|Preschool Education and Educational Design|Preschool
med|Μεσογειακών Σπουδών|Μεσογειακές Σπουδές|Mediterranean Studies|Mediterranean
"""),
    ("ionio", "Ιόνιο Πανεπιστήμιο", "Ionian University", "Ιόνιο", "Ionian", ["ionio.gr"], "Κέρκυρα", """
hist|Ιστορίας και Ψηφιακών Ανθρωπιστικών Επιστημών|Ιστορία|History and Digital Humanities|History
fltt|Ξένων Γλωσσών, Μετάφρασης και Διερμηνείας|Μετάφραση & Διερμηνεία|Foreign Languages, Translation and Interpreting|Translation
alm|Αρχειονομίας, Βιβλιοθηκονομίας και Μουσειολογίας|Αρχειονομία|Archives, Library Science and Museology|Library Science
csd|Πληροφορικής|Πληροφορική|Informatics|Informatics
media|Ψηφιακών Μέσων και Επικοινωνίας|Ψηφιακά Μέσα|Digital Media and Communication|Digital Media
music|Μουσικών Σπουδών|Μουσικές Σπουδές|Music Studies|Music
avarts|Τεχνών Ήχου και Εικόνας|Ήχος & Εικόνα|Audio and Visual Arts|Audio & Visual Arts
env|Περιβάλλοντος|Περιβάλλον|Environment|Environment
food|Επιστήμης και Τεχνολογίας Τροφίμων|Τεχνολογία Τροφίμων|Food Science and Technology|Food Science
tourism|Τουρισμού|Τουρισμός|Tourism|Tourism
"""),
    ("eap", "Ελληνικό Ανοικτό Πανεπιστήμιο", "Hellenic Open University", "ΕΑΠ", "HOU", ["eap.gr"], "Πάτρα (εξ αποστάσεως)", """
epo|Σπουδές στον Ευρωπαϊκό Πολιτισμό|Ευρωπαϊκός Πολιτισμός (ΕΠΟ)|European Civilisation|European Civilisation
elp|Σπουδές στον Ελληνικό Πολιτισμό|Ελληνικός Πολιτισμός (ΕΛΠ)|Greek Civilisation|Greek Civilisation
isp|Ισπανική Γλώσσα και Πολιτισμός|Ισπανικά (ΙΣΠ)|Spanish Language and Culture|Spanish
deo|Διοίκηση Επιχειρήσεων και Οργανισμών|Διοίκηση (ΔΕΟ)|Business Administration|Business
did|Δημόσια Διοίκηση|Δημόσια Διοίκηση (ΔΗΔ)|Public Administration|Public Administration
dit|Διοίκηση Τουρισμού|Τουρισμός (ΔΙΤ)|Tourism Management|Tourism
fye|Σπουδές στις Φυσικές Επιστήμες|Φυσικές Επιστήμες (ΦΥΕ)|Natural Sciences|Natural Sciences
pli|Πληροφορική|Πληροφορική (ΠΛΗ)|Computer Science|Computer Science
ski|Σπουδές Κινηματογραφικής Γραφής, Πρακτικής και Έρευνας|Κινηματογράφος (ΣΚΙ)|Film Writing, Practice and Research|Film
"""),
    # ── Cyprus (public)
    ("ucy", "Πανεπιστήμιο Κύπρου", "University of Cyprus", "Π. Κύπρου", "UCY", ["ucy.ac.cy"], "Λευκωσία", """
grphil|Βυζαντινών και Νεοελληνικών Σπουδών|Νεοελληνικές Σπουδές|Byzantine and Modern Greek Studies|Modern Greek
classics|Κλασικών Σπουδών και Φιλοσοφίας|Κλασικές Σπουδές|Classics and Philosophy|Classics
hist-arch|Ιστορίας και Αρχαιολογίας|Ιστορία & Αρχαιολογία|History and Archaeology|History & Archaeology
english|Αγγλικών Σπουδών|Αγγλικές Σπουδές|English Studies|English
french|Γαλλικών και Ευρωπαϊκών Σπουδών|Γαλλικές Σπουδές|French and European Studies|French
turkish|Τουρκικών και Μεσανατολικών Σπουδών|Τουρκικές Σπουδές|Turkish and Middle Eastern Studies|Turkish Studies
law|Νομικής|Νομική|Law|Law
econ|Οικονομικών|Οικονομικά|Economics|Economics
socpol|Κοινωνικών και Πολιτικών Επιστημών|Κοινωνικές & Πολιτικές|Social and Political Sciences|Social & Political
psych|Ψυχολογίας|Ψυχολογία|Psychology|Psychology
edu|Επιστημών της Αγωγής|Επιστήμες της Αγωγής|Education|Education
ba|Διοίκησης Επιχειρήσεων και Δημόσιας Διοίκησης|Διοίκηση Επιχειρήσεων|Business and Public Administration|Business
acc|Λογιστικής και Χρηματοοικονομικής|Λογιστική|Accounting and Finance|Accounting
math|Μαθηματικών και Στατιστικής|Μαθηματικά|Mathematics and Statistics|Mathematics
physics|Φυσικής|Φυσική|Physics|Physics
chem|Χημείας|Χημεία|Chemistry|Chemistry
bio|Βιολογικών Επιστημών|Βιολογία|Biological Sciences|Biology
cs|Πληροφορικής|Πληροφορική|Computer Science|Computer Science
ece|Ηλεκτρολόγων Μηχανικών και Μηχανικών Υπολογιστών|ΗΜΜΥ|Electrical and Computer Engineering|ECE
civil|Πολιτικών Μηχανικών και Μηχανικών Περιβάλλοντος|Πολιτικοί Μηχανικοί|Civil and Environmental Engineering|Civil
mech|Μηχανικών Μηχανολογίας και Κατασκευαστικής|Μηχανολόγοι|Mechanical and Manufacturing Engineering|Mechanical
arch|Αρχιτεκτονικής|Αρχιτεκτονική|Architecture|Architecture
med|Ιατρικής|Ιατρική|Medicine|Medicine
"""),
    ("cut", "Τεχνολογικό Πανεπιστήμιο Κύπρου", "Cyprus University of Technology", "ΤΕΠΑΚ", "CUT", ["cut.ac.cy"], "Λεμεσός", """
nurs|Νοσηλευτικής|Νοσηλευτική|Nursing|Nursing
rehab|Επιστημών Αποκατάστασης|Επιστήμες Αποκατάστασης|Rehabilitation Sciences|Rehabilitation
civil|Πολιτικών Μηχανικών και Γεωπληροφορικής|Πολιτικοί Μηχανικοί|Civil Engineering and Geomatics|Civil
eecei|Ηλεκτρολόγων Μηχανικών, Μηχανικών Η/Υ και Πληροφορικής|ΗΜΜΥ|Electrical and Computer Engineering and Informatics|ECE
mech|Μηχανολόγων Μηχανικών και Επιστήμης και Μηχανικής Υλικών|Μηχανολόγοι|Mechanical Engineering and Materials Science|Mechanical
chem|Χημικών Μηχανικών|Χημικοί Μηχανικοί|Chemical Engineering|Chemical Eng.
agri|Γεωπονικών Επιστημών, Βιοτεχνολογίας και Επιστήμης Τροφίμων|Γεωπονία & Τρόφιμα|Agricultural Sciences, Biotechnology and Food Science|Agriculture & Food
fine|Καλών Τεχνών|Καλές Τέχνες|Fine Arts|Fine Arts
multimedia|Πολυμέσων και Γραφικών Τεχνών|Πολυμέσα|Multimedia and Graphic Arts|Multimedia
comm|Επικοινωνίας και Σπουδών Διαδικτύου|Επικοινωνία|Communication and Internet Studies|Communication
hotel|Διοίκησης Ξενοδοχείων και Τουρισμού|Ξενοδοχειακά|Hotel and Tourism Management|Hotel & Tourism
fin|Χρηματοοικονομικής, Λογιστικής και Διοικητικής Επιστήμης|Χρηματοοικονομική|Finance, Accounting and Management Science|Finance
ship|Ναυτιλιακών|Ναυτιλιακά|Shipping|Shipping
"""),
    ("ouc", "Ανοικτό Πανεπιστήμιο Κύπρου", "Open University of Cyprus", "ΑΠΚΥ", "OUC", ["ouc.ac.cy"], "Λευκωσία (εξ αποστάσεως)", ""),
    # ── Cyprus (private universities)
    ("unic", "Πανεπιστήμιο Λευκωσίας", "University of Nicosia", "UNIC", "UNIC", ["unic.ac.cy"], "Λευκωσία", ""),
    ("euc", "Ευρωπαϊκό Πανεπιστήμιο Κύπρου", "European University Cyprus", "EUC", "EUC", ["euc.ac.cy"], "Λευκωσία", ""),
    ("frederick", "Πανεπιστήμιο Frederick", "Frederick University", "Frederick", "Frederick", ["frederick.ac.cy"], "Λευκωσία / Λεμεσός", ""),
    ("nup", "Πανεπιστήμιο Νεάπολις Πάφου", "Neapolis University Pafos", "Νεάπολις", "NUP", ["nup.ac.cy"], "Πάφος", ""),
    ("uclancy", "UCLan Cyprus", "UCLan Cyprus", "UCLan", "UCLan", ["uclancyprus.ac.cy"], "Λάρνακα", ""),
    # ── Greece (non-state universities / colleges; ACG already exists)
    ("city", "CITY College, University of York Europe Campus", "CITY College, University of York Europe Campus", "CITY", "CITY", ["citycollege.eu"], "Θεσσαλονίκη", ""),
    ("mitropolitiko", "Μητροπολιτικό Κολλέγιο", "Metropolitan College", "Metropolitan", "Metropolitan", ["mitropolitiko.edu.gr"], "Αθήνα / Θεσσαλονίκη", ""),
    ("bca", "BCA College", "BCA College", "BCA", "BCA", ["bca.edu.gr"], "Αθήνα", ""),
    ("ist", "IST College", "IST College", "IST", "IST", ["ist.edu.gr"], "Αθήνα", ""),
    ("nyc", "New York College", "New York College", "NYC", "NYC", ["nyc.gr"], "Αθήνα / Θεσσαλονίκη", ""),
    ("medcollege", "Mediterranean College", "Mediterranean College", "Mediterranean", "Mediterranean", ["medcollege.edu.gr"], "Αθήνα / Θεσσαλονίκη", ""),
    ("act", "American College of Thessaloniki", "American College of Thessaloniki", "ACT", "ACT", ["act.edu"], "Θεσσαλονίκη", ""),
    ("hau", "Hellenic American University", "Hellenic American University", "HAU", "HAU", ["hauniv.edu"], "Αθήνα", ""),
    ("perrotis", "Perrotis College", "Perrotis College", "Perrotis", "Perrotis", ["perrotiscollege.edu.gr"], "Θεσσαλονίκη", ""),
]


def years(name_el: str) -> int:
    """6 = Medicine, 5 = engineering / dentistry / pharmacy / architecture / veterinary, else 4."""
    if name_el in ("Ιατρικής",):
        return 6
    if any(k in name_el for k in ("Μηχανικ", "Οδοντιατρ", "Φαρμακευτ", "Αρχιτεκτ", "Κτηνιατρ")):
        return 5
    return 4


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def sql() -> str:
    unis, deps = [], []
    for pos, (uid, el, en, sel, sen, domains, city, block) in enumerate(INSTITUTIONS, start=20):
        doms = "ARRAY[" + ", ".join(q(d) for d in domains) + "]"
        unis.append(f"  ({q(uid)}, {q(el)}, {q(en)}, {q(sel)}, {q(sen)}, {doms}, {q(city)}, true, {pos})")
        for i, line in enumerate([l for l in block.strip().splitlines() if l.strip()], start=1):
            code, nel, sel_, nen, sen_ = [x.strip() for x in line.split("|")]
            deps.append(f"  ({q(uid + '-' + code)}, {q(uid)}, {q(nel)}, {q(nen)}, {q(sel_)}, {q(sen_)}, {years(nel)}, {i})")
    return (
        "INSERT INTO public.universities (id, name_el, name_en, short_el, short_en, email_domains, city, open, position) VALUES\n"
        + ",\n".join(unis)
        + "\nON CONFLICT (id) DO UPDATE SET name_el = excluded.name_el, name_en = excluded.name_en, short_el = excluded.short_el,\n"
        "  short_en = excluded.short_en, email_domains = excluded.email_domains, city = excluded.city;\n\n"
        "INSERT INTO public.departments (id, university_id, name_el, name_en, short_el, short_en, years, position) VALUES\n"
        + ",\n".join(deps)
        + "\nON CONFLICT (id) DO UPDATE SET name_el = excluded.name_el, name_en = excluded.name_en, short_el = excluded.short_el,\n"
        "  short_en = excluded.short_en, years = excluded.years, position = excluded.position;\n"
    )


if __name__ == "__main__":
    print(sql(), end="")
