/**
 * Speak — pre-launch student survey (Google Forms).
 *
 * How to use: script.google.com → New project → paste this file → Run `createSurvey` (allow access once).
 * The log (View → Logs) prints the form link to send, the edit link and the responses sheet.
 * After the responses come in: Run `analyze` → a tab «Ανάλυση» appears in the responses sheet.
 *
 * Anonymous by design: no Google sign-in is required and email addresses are not collected, except the optional
 * contact address in the last section (beta testers only).
 */

const CONFIG = {
  title: 'Πώς οργανώνεις τις σπουδές σου; — Έρευνα για φοιτητές',
  contact: 'vasilis.har@gmail.com',
  minutes: 8,
};

// One list for the grid rows, the top-3 question and the analysis: keep the texts free of commas
// (Google Sheets joins checkbox answers with ", ").
const IDEAS = [
  'Σημειώσεις και παλιά θέματα για κάθε μάθημα του τμήματός μου',
  'Ερωτήσεις και απαντήσεις ανά μάθημα',
  'Ειδοποίηση όταν ανεβαίνει υλικό σε μάθημα που δίνω',
  'Ροή μόνο για φοιτητές του πανεπιστημίου μου',
  'Αυτόματη ομάδα του τμήματος και του έτους μου',
  'Ανακοινώσεις τμήματος και πανεπιστημίου σε ένα σημείο',
  'Αναρτήσεις με φωνή (ηχητικό έως 2 λεπτά)',
  'Μηνύματα με φωνητικό που ακούγεται μία φορά',
  'Walkie-talkie με φίλους (πατάς και μιλάς ζωντανά)',
  'Χάρτης με φίλους που επιλέγουν να δείχνουν πού είναι',
  'Αντίστροφη μέτρηση και υπενθυμίσεις για την εξεταστική',
  'Εύρεση συμφοιτητή για κοινό διάβασμα',
  'Εκδηλώσεις και πάρτι του πανεπιστημίου',
  'Περίληψη διαλέξεων και σημειώσεων με AI',
];
const USAGE = ['Δεν θα το χρησιμοποιούσα', 'Σπάνια', 'Μερικές φορές τον μήνα', 'Κάθε εβδομάδα', 'Σχεδόν κάθε μέρα'];

// Kano pairs: the same rows asked «if it had …» and «if it did not have …»
const KANO = [
  'σημειώσεις και θέματα ανά μάθημα',
  'ερωτήσεις και απαντήσεις ανά μάθημα',
  'αναρτήσεις με φωνή',
  'walkie-talkie με φίλους',
  'χάρτη με φίλους',
  'περίληψη με AI',
];
const KANO_COLS = ['Θα μου άρεσε', 'Το θεωρώ αυτονόητο', 'Μου είναι αδιάφορο', 'Θα το ανεχόμουν', 'Δεν θα μου άρεσε'];

const Q = {
  student: 'Σπουδάζεις αυτή τη στιγμή σε πανεπιστήμιο;',
  phone: 'Τι κινητό έχεις;',
  usage: 'Πόσο συχνά θα χρησιμοποιούσες καθένα από αυτά;',
  top3: 'Ποια θα σε έκαναν να κατεβάσεις την εφαρμογή; (έως 3)',
  kanoHas: 'Πώς θα ένιωθες αν η εφαρμογή ΕΙΧΕ…',
  kanoNot: 'Πώς θα ένιωθες αν η εφαρμογή ΔΕΝ ΕΙΧΕ…',
  verify: 'Για να μπαίνουν μόνο φοιτητές, η εφαρμογή στέλνει έναν κωδικό στο ακαδημαϊκό σου email. Θα το έκανες;',
  upload: 'Θα ανέβαζες δικές σου σημειώσεις ή θέματα;',
  intent: 'Αν κυκλοφορούσε αύριο για το πανεπιστήμιό σου, πόσο πιθανό είναι να την κατεβάσεις;',
  blockers: 'Υπάρχει κάτι που θα σε έκανε να μην τη χρησιμοποιήσεις;',
};

function createSurvey() {
  const form = FormApp.create(CONFIG.title)
    .setDescription(
      'Φτιάχνουμε μια εφαρμογή για φοιτητές και θέλουμε να μάθουμε πώς οργανώνεις σήμερα τις σπουδές σου ' +
      'και τι θα σου ήταν πραγματικά χρήσιμο. Διαρκεί περίπου ' + CONFIG.minutes + ' λεπτά.\n\n' +
      'Η έρευνα είναι ανώνυμη: δεν ζητάμε όνομα και δεν καταγράφουμε το email σου. Μόνο στο τέλος, αν θέλεις να ' +
      'δοκιμάσεις πρώτος/η την εφαρμογή, μπορείς να αφήσεις email. Οι απαντήσεις χρησιμοποιούνται μόνο για να ' +
      'αποφασίσουμε τι θα φτιάξουμε και δεν δίνονται σε κανέναν. Μπορείς να σταματήσεις όποτε θέλεις.\n' +
      'Επικοινωνία: ' + CONFIG.contact)
    .setProgressBar(true)
    .setCollectEmail(false)
    .setAllowResponseEdits(false)
    .setShowLinkToRespondAgain(false)
    .setPublishingSummary(false)
    .setConfirmationMessage('Ευχαριστούμε πολύ! Οι απαντήσεις σου μας βοηθούν να φτιάξουμε κάτι που θα χρησιμοποιείς στ’ αλήθεια.');

  // ── 1. About you ──
  form.addCheckboxItem()
    .setTitle('Συμμετοχή')
    .setChoiceValues(['Είμαι 15 ετών ή μεγαλύτερος/η, διάβασα τα παραπάνω και θέλω να συμμετάσχω'])
    .setRequired(true);
  const student = form.addMultipleChoiceItem().setTitle(Q.student).setRequired(true);
  const notStudentEnd = 'Όχι';
  student.setChoices([
    student.createChoice('Ναι, σε προπτυχιακό', FormApp.PageNavigationType.CONTINUE),
    student.createChoice('Ναι, σε μεταπτυχιακό ή διδακτορικό', FormApp.PageNavigationType.CONTINUE),
    student.createChoice(notStudentEnd, FormApp.PageNavigationType.SUBMIT),
  ]);

  form.addPageBreakItem().setTitle('Λίγα για σένα');
  form.addListItem().setTitle('Σε ποιο πανεπιστήμιο σπουδάζεις;').setRequired(true).setChoiceValues([
    'Εθνικό Μετσόβιο Πολυτεχνείο', 'Εθνικό και Καποδιστριακό Πανεπιστήμιο Αθηνών',
    'Αριστοτέλειο Πανεπιστήμιο Θεσσαλονίκης', 'Πανεπιστήμιο Πατρών', 'Πανεπιστήμιο Κρήτης', 'Πολυτεχνείο Κρήτης',
    'Πανεπιστήμιο Ιωαννίνων', 'Δημοκρίτειο Πανεπιστήμιο Θράκης', 'Πανεπιστήμιο Θεσσαλίας', 'Πανεπιστήμιο Μακεδονίας',
    'Πανεπιστήμιο Δυτικής Μακεδονίας', 'Διεθνές Πανεπιστήμιο της Ελλάδος', 'Πανεπιστήμιο Πελοποννήσου',
    'Πανεπιστήμιο Αιγαίου', 'Ιόνιο Πανεπιστήμιο', 'Ελληνικό Μεσογειακό Πανεπιστήμιο', 'Ελληνικό Ανοικτό Πανεπιστήμιο',
    'Οικονομικό Πανεπιστήμιο Αθηνών', 'Πανεπιστήμιο Πειραιώς', 'Πάντειο Πανεπιστήμιο', 'Πανεπιστήμιο Δυτικής Αττικής',
    'Γεωπονικό Πανεπιστήμιο Αθηνών', 'Χαροκόπειο Πανεπιστήμιο', 'Ανωτάτη Σχολή Καλών Τεχνών',
    'Ανώτατη Σχολή Παιδαγωγικής και Τεχνολογικής Εκπαίδευσης', 'Ιδιωτικό πανεπιστήμιο ή κολλέγιο στην Ελλάδα',
    'Πανεπιστήμιο στην Κύπρο', 'Πανεπιστήμιο σε άλλη χώρα',
  ]);
  form.addMultipleChoiceItem().setTitle('Σε ποιο πεδίο σπουδάζεις;').setRequired(true).showOtherOption(true)
    .setChoiceValues(['Μηχανική', 'Πληροφορική', 'Θετικές επιστήμες', 'Επιστήμες υγείας',
      'Οικονομικά και διοίκηση', 'Νομική και πολιτικές επιστήμες', 'Ανθρωπιστικές και κοινωνικές επιστήμες',
      'Παιδαγωγικά', 'Τέχνες', 'Γεωπονία και περιβάλλον']);
  form.addMultipleChoiceItem().setTitle('Σε ποιο έτος είσαι;').setRequired(true)
    .setChoiceValues(['1ο', '2ο', '3ο', '4ο', '5ο', '6ο ή επί πτυχίω', 'Μεταπτυχιακό', 'Διδακτορικό']);
  form.addMultipleChoiceItem().setTitle(Q.phone).setRequired(true)
    .setChoiceValues(['iPhone', 'Android', 'Άλλο']);

  // ── 2. How you do it today (behaviour, not opinions) ──
  form.addPageBreakItem().setTitle('Πώς τα κάνεις σήμερα')
    .setHelpText('Σκέψου τι έκανες πραγματικά αυτό το εξάμηνο, όχι τι θα ήθελες να κάνεις.');
  form.addCheckboxItem().setTitle('Από πού βρίσκεις σημειώσεις και παλιά θέματα;').setRequired(true).showOtherOption(true)
    .setChoiceValues(['eClass ή άλλη πλατφόρμα του πανεπιστημίου', 'Ομάδες στο Facebook',
      'Ομάδες στο Viber, Messenger ή WhatsApp', 'Discord', 'Κοινόχρηστοι φάκελοι (Drive, Dropbox)',
      'Φωτοτυπάδικο', 'Ζητάω από συμφοιτητές', 'Ιστοσελίδες με σημειώσεις', 'Δεν βρίσκω, τα φτιάχνω μόνος/η']);
  form.addScaleItem().setTitle('Την τελευταία φορά που έψαξες υλικό για ένα μάθημα, πόσο εύκολα το βρήκες;')
    .setBounds(1, 5).setLabels('Πολύ δύσκολα', 'Πολύ εύκολα').setRequired(true);
  form.addParagraphTextItem().setTitle('Τι σε δυσκόλεψε εκείνη τη φορά;')
    .setHelpText('Π.χ. δεν υπήρχε υλικό, ήταν παλιό, ήταν σκόρπιο σε πολλές ομάδες.');
  form.addCheckboxItem().setTitle('Όταν έχεις απορία σε ένα μάθημα, πού ρωτάς;').setRequired(true).showOtherOption(true)
    .setChoiceValues(['Τον καθηγητή ή τον βοηθό', 'Ομάδα του έτους στο Viber, Messenger ή WhatsApp',
      'Ομάδα στο Facebook', 'Discord', 'Φίλους προσωπικά', 'ChatGPT ή άλλο AI', 'Δεν ρωτάω πουθενά']);
  form.addMultipleChoiceItem().setTitle('Πόσες ομάδες συνομιλίας του πανεπιστημίου έχεις αυτή τη στιγμή;').setRequired(true)
    .setChoiceValues(['Καμία', '1 έως 3', '4 έως 10', 'Πάνω από 10']);
  form.addParagraphTextItem()
    .setTitle('Ποιο είναι το πιο ενοχλητικό πράγμα στη φοιτητική σου ζωή που καμία εφαρμογή δεν σου λύνει σήμερα;');

  // ── 3. Ideas ──
  form.addPageBreakItem().setTitle('Ιδέες που εξετάζουμε')
    .setHelpText('Η εφαρμογή θα είναι μόνο για φοιτητές που επιβεβαιώνουν ότι σπουδάζουν. Δεν έχουμε αποφασίσει ' +
      'ακόμα τι θα έχει: απάντησε με ειλικρίνεια, ένα «δεν θα το χρησιμοποιούσα» μας βοηθάει εξίσου.');
  form.addGridItem().setTitle(Q.usage).setRows(IDEAS).setColumns(USAGE).setRequired(true);
  form.addCheckboxItem().setTitle(Q.top3).setChoiceValues(IDEAS).setRequired(true)
    .setValidation(FormApp.createCheckboxValidation().setHelpText('Διάλεξε έως 3.').requireSelectAtMost(3).build());
  form.addParagraphTextItem().setTitle('Λείπει κάτι που θα χρησιμοποιούσες σίγουρα;');

  // ── 4. Kano pairs ──
  form.addPageBreakItem().setTitle('Δύο γρήγορες ερωτήσεις για έξι από αυτά')
    .setHelpText('Θα δεις τις ίδιες ιδέες δύο φορές: μία αν η εφαρμογή τις είχε και μία αν δεν τις είχε. Είναι ' +
      'σκόπιμο, μας δείχνει τι θεωρείς αυτονόητο και τι απλώς ωραίο.');
  form.addGridItem().setTitle(Q.kanoHas).setRows(KANO).setColumns(KANO_COLS).setRequired(true);
  form.addGridItem().setTitle(Q.kanoNot).setRows(KANO).setColumns(KANO_COLS).setRequired(true);

  // ── 5. Trust and taking part ──
  form.addPageBreakItem().setTitle('Εμπιστοσύνη και συμμετοχή');
  form.addMultipleChoiceItem().setTitle(Q.verify).setRequired(true)
    .setChoiceValues(['Ναι, χωρίς πρόβλημα', 'Ναι, αν μου εξηγούν γιατί', 'Μάλλον όχι', 'Όχι',
      'Δεν χρησιμοποιώ ή δεν θυμάμαι το ακαδημαϊκό μου email']);
  form.addMultipleChoiceItem().setTitle(Q.upload).setRequired(true)
    .setChoiceValues(['Ναι, συχνά', 'Μερικές φορές', 'Μόνο αν κερδίζω κάτι', 'Όχι']);
  form.addCheckboxItem().setTitle('Τι θα σε έκανε να ανεβάσεις υλικό;').setRequired(true).showOtherOption(true)
    .setChoiceValues(['Να βοηθήσω τους συμφοιτητές μου', 'Ένα «ευχαριστώ» και αναγνώριση στο προφίλ μου',
      'Πόντοι και κατάταξη στο τμήμα', 'Πρόσβαση σε υλικό άλλων', 'Να μπορώ να το ανεβάσω ανώνυμα',
      'Τίποτα, δεν θα ανέβαζα']);
  form.addGridItem().setTitle('Πόσο άνετα θα ένιωθες με τα παρακάτω;')
    .setRows(['Να βλέπουν οι συμφοιτητές μου το τμήμα και το έτος μου', 'Να ακούνε τη φωνή μου σε αναρτήσεις',
      'Να βλέπουν φίλοι πού βρίσκομαι (μόνο όταν το ανοίγω εγώ)', 'Να ανεβάζω σημειώσεις με το όνομά μου'])
    .setColumns(['Καθόλου', 'Λίγο', 'Ουδέτερα', 'Αρκετά', 'Πολύ']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Πόσες ειδοποιήσεις την εβδομάδα θα θεωρούσες εντάξει;').setRequired(true)
    .setChoiceValues(['Καμία', '1 έως 3', '4 έως 10', 'Όσες χρειάζεται, αν αφορούν μαθήματα που δίνω']);
  form.addCheckboxItem().setTitle(Q.blockers).setRequired(true).showOtherOption(true)
    .setChoiceValues(['Να ακούγεται δημόσια η φωνή μου', 'Να φαίνεται η θέση μου', 'Η επιβεβαίωση με το ακαδημαϊκό email',
      'Πολλές ειδοποιήσεις', 'Δεν θέλω άλλο ένα κοινωνικό δίκτυο', 'Ανησυχία για τα προσωπικά μου δεδομένα',
      'Να μην τη χρησιμοποιούν οι συμφοιτητές μου', 'Τίποτα από αυτά']);

  // ── 6. Intent ──
  form.addPageBreakItem().setTitle('Τελευταίες ερωτήσεις');
  form.addScaleItem().setTitle(Q.intent).setBounds(0, 10).setLabels('Καθόλου πιθανό', 'Σίγουρα').setRequired(true);
  form.addParagraphTextItem().setTitle('Τι θα έπρεπε να έχει για να την προτιμήσεις από τις ομάδες που ήδη χρησιμοποιείς;');
  form.addCheckboxItem().setTitle('Πώς θα ήθελες να μάθεις για μια τέτοια εφαρμογή;').setRequired(true).showOtherOption(true)
    .setChoiceValues(['Από φίλο ή συμφοιτητή', 'Στην ομάδα του έτους μου', 'Instagram', 'TikTok',
      'Από φοιτητικό σύλλογο', 'Από καθηγητή ή στο μάθημα', 'Αφίσα στη σχολή']);

  // ── 7. Optional beta ──
  form.addPageBreakItem().setTitle('Θες να τη δοκιμάσεις πρώτος/η; (προαιρετικό)')
    .setHelpText('Αν αφήσεις email, θα το χρησιμοποιήσουμε μόνο για την πρόσκληση στη δοκιμή και θα το σβήσουμε ' +
      'μετά την κυκλοφορία. Το email δεν συνδέεται με την ανάλυση των απαντήσεων.');
  form.addMultipleChoiceItem().setTitle('Θέλεις να συμμετάσχεις;')
    .setChoiceValues(['Ναι, στη δοκιμαστική έκδοση', 'Ναι, και σε μια συζήτηση 15 λεπτών', 'Όχι, ευχαριστώ']);
  form.addTextItem().setTitle('Email επικοινωνίας')
    .setValidation(FormApp.createTextValidation().setHelpText('Γράψε ένα έγκυρο email.').requireTextIsEmail().build());

  const ss = SpreadsheetApp.create(CONFIG.title + ' (απαντήσεις)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  try { form.setPublished(true); } catch (e) { /* older Apps Script runtimes publish new forms by default */ }
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  Logger.log('Σύνδεσμος για αποστολή: ' + form.shortenFormUrl(form.getPublishedUrl()));
  Logger.log('Επεξεργασία φόρμας: ' + form.getEditUrl());
  Logger.log('Απαντήσεις: ' + ss.getUrl());
}

// ───────────────────────── Analysis ─────────────────────────

// Kano table: functional answer (row) × dysfunctional answer (column), answers in KANO_COLS order
// A attractive, O one-dimensional, M must-be, I indifferent, R reverse, Q questionable
const KANO_TABLE = [
  ['Q', 'A', 'A', 'A', 'O'],
  ['R', 'I', 'I', 'I', 'M'],
  ['R', 'I', 'I', 'I', 'M'],
  ['R', 'I', 'I', 'I', 'M'],
  ['R', 'R', 'R', 'R', 'Q'],
];
const KANO_NAME = { A: 'Ενθουσιάζει', O: 'Όσο καλύτερο τόσο καλύτερα', M: 'Αυτονόητο', I: 'Αδιάφορο', R: 'Απωθεί', Q: 'Ασαφές' };

// Pure: header row + answer rows of the responses sheet → rows of the «Ανάλυση» tab
function summarize(header, rows) {
  const col = (t) => header.indexOf(t);
  const students = rows.filter((r) => !String(r[col(Q.student)] || '').startsWith('Όχι'));
  const n = students.length;
  const pct = (k, d) => (d ? Math.round((100 * k) / d) + '%' : '–');
  const out = [['Ανάλυση απαντήσεων', '', '', '', '', ''], ['Απαντήσεις φοιτητών', n, '', '', '', ''], ['', '', '', '', '', ''],
    ['Ιδέα', 'Κάθε εβδομάδα ή συχνότερα', 'Δεν θα το χρησιμοποιούσα', 'Στις 3 πρώτες', 'Απάντησαν', 'Πρόταση']];

  const ideaRows = IDEAS.map((idea) => {
    const c = col(Q.usage + ' [' + idea + ']');
    const answers = students.map((r) => r[c]).filter(Boolean);
    const weekly = answers.filter((a) => a === USAGE[3] || a === USAGE[4]).length;
    const never = answers.filter((a) => a === USAGE[0]).length;
    const top = students.filter((r) => String(r[col(Q.top3)] || '').split(', ').indexOf(idea) >= 0).length;
    const w = answers.length ? weekly / answers.length : 0, t = n ? top / n : 0;
    // shortcut: fixed thresholds as a first cut; read them together with the open answers
    const verdict = w >= 0.4 || t >= 0.3 ? 'Χτίσ’ το πρώτο' : w >= 0.2 || t >= 0.1 ? 'Δοκίμασέ το σε μικρή κλίμακα' : 'Άφησέ το έξω προς το παρόν';
    return [idea, pct(weekly, answers.length), pct(never, answers.length), pct(top, n), answers.length, verdict, w];
  }).sort((a, b) => b[6] - a[6]);
  ideaRows.forEach((r) => out.push(r.slice(0, 6)));

  out.push(['', '', '', '', '', ''], ['Kano', 'Κατηγορία', 'Ικανοποίηση αν υπάρχει', 'Δυσαρέσκεια αν λείπει', 'Απωθεί', 'Απάντησαν']);
  KANO.forEach((f) => {
    const ch = col(Q.kanoHas + ' [' + f + ']'), cn = col(Q.kanoNot + ' [' + f + ']');
    const count = { A: 0, O: 0, M: 0, I: 0, R: 0, Q: 0 };
    students.forEach((r) => {
      const i = KANO_COLS.indexOf(r[ch]), j = KANO_COLS.indexOf(r[cn]);
      if (i >= 0 && j >= 0) count[KANO_TABLE[i][j]]++;
    });
    const valid = count.A + count.O + count.M + count.I;
    const total = valid + count.R + count.Q;
    const top = Object.keys(count).reduce((a, b) => (count[b] > count[a] ? b : a), 'I');
    out.push([f, total ? KANO_NAME[top] : '–', valid ? ((count.A + count.O) / valid).toFixed(2) : '–',
      valid ? (-(count.O + count.M) / valid).toFixed(2) : '–', pct(count.R, total), total]);
  });

  const share = (q, match) => {
    const a = students.map((r) => String(r[col(q)] || '')).filter(Boolean);
    return pct(a.filter(match).length, a.length);
  };
  const intent = students.map((r) => Number(r[col(Q.intent)])).filter((x) => !isNaN(x) && String(x) !== '');
  out.push(['', '', '', '', '', ''], ['Βασικοί δείκτες', '', '', '', '', ''],
    ['Πρόθεση 9–10 στα 10', pct(intent.filter((x) => x >= 9).length, intent.length), '', '', '', ''],
    ['Μέση πρόθεση (0–10)', intent.length ? (intent.reduce((s, x) => s + x, 0) / intent.length).toFixed(1) : '–', '', '', '', ''],
    ['Θα επιβεβαίωνε με ακαδημαϊκό email', share(Q.verify, (a) => a.startsWith('Ναι')), '', '', '', ''],
    ['Θα ανέβαζε υλικό (συχνά ή μερικές φορές)', share(Q.upload, (a) => a === 'Ναι, συχνά' || a === 'Μερικές φορές'), '', '', '', ''],
    ['Έχει iPhone', share(Q.phone, (a) => a === 'iPhone'), '', '', '', ''],
    ['Έχει Android', share(Q.phone, (a) => a === 'Android'), '', '', '', '']);
  return out;
}

function analyze() {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  const data = ss.getSheets()[0].getDataRange().getValues();
  const out = summarize(data[0], data.slice(1));
  const sheet = ss.getSheetByName('Ανάλυση') || ss.insertSheet('Ανάλυση');
  sheet.clear();
  sheet.getRange(1, 1, out.length, 6).setValues(out);
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  sheet.autoResizeColumns(1, 6);
  Logger.log('Η ανάλυση είναι στο φύλλο «Ανάλυση»: ' + ss.getUrl());
}

if (typeof module !== 'undefined') module.exports = { summarize, IDEAS, USAGE, KANO, KANO_COLS, Q };
