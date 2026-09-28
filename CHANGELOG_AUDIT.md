# Courtsie — Αλλαγές (Audit + Visual pass)

Αυτό το αρχείο συνοψίζει ό,τι άλλαξε σε αυτόν τον γύρο: έλεγχος ασφαλείας
βάσει της λίστας σου, λειτουργικοί έλεγχοι, και ο γύρος εμφάνισης.
Ο πυρήνας του κώδικα (RLS, booking RPCs, δομή) ήταν ήδη πολύ καλά φτιαγμένος —
οι αλλαγές είναι χειρουργικές, όχι ανακατασκευή.

---

## 1) Ασφάλεια — διορθώσεις

### Security headers (νέο) — `src/lib/security-headers.server.ts`, `src/server.ts`
Προστέθηκε πλήρες σετ HTTP security headers σε κάθε απόκριση:
`Content-Security-Policy`, `Strict-Transport-Security` (HSTS),
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy`, `Permissions-Policy`.
Το CSP επιτρέπει μόνο Supabase (REST + realtime WSS), Google Maps και Google Fonts.
> Σημείωση: επειδή το TanStack Start κάνει stream inline hydration scripts χωρίς
> nonce, το `script-src` κρατά `'unsafe-inline'`. Όλα τα υπόλοιπα είναι κλειδωμένα
> (`frame-ancestors 'none'` κ.λπ.). Αν χρειαστεί, μελλοντικά μπορεί να μπει nonce.
Καλύπτει: λίστα §5 (securityheaders.com → A) και §7 (TLS/clickjacking/MIME).

### Rate limiting στο public translate endpoint — `src/routes/api/public/translate.ts`
Το endpoint μετάφρασης ήταν δημόσιο, χωρίς throttle, και καλεί το DeepL (κοστίζει).
Προστέθηκε per-IP token bucket (30 req/min, 429 + `Retry-After`).
Best-effort σε Cloudflare (in-memory ανά isolate) — για production προτείνεται
επιπλέον Cloudflare rate-limit rule ή Durable Object/KV. Το `translations_cache`
ήδη απορροφά επαναλήψεις. Καλύπτει: §5 (rate limiting σε APIs).

### `.gitignore` + `.env.example` — `.gitignore`, `.env.example`
Το `.env` προστέθηκε στο `.gitignore` ώστε να μη μπαίνει ποτέ σε git history
(το anon key είναι ασφαλές για client, αλλά έτσι αποτρέπεται μελλοντική διαρροή
service-role key). Προστέθηκε `.env.example` που τεκμηριώνει τα env vars.
Καλύπτει: §1 (secrets εκτός git).

### Ισότητα πολιτικής κωδικού στο reset — `src/routes/reset-password.tsx`
Η σελίδα επαναφοράς απαιτούσε μόνο 6 χαρακτήρες, ενώ η εγγραφή απαιτεί 8 +
πεζό + αριθμό. Ευθυγραμμίστηκε (ίδιοι κανόνες, `minLength=8`). Καλύπτει: §2.

### Έλεγχος τύπου/μεγέθους στο avatar upload — `src/lib/avatar.ts`
Το ανέβασμα avatar δεν είχε έλεγχο (το venue-photo είχε). Προστέθηκε whitelist
τύπων (JPG/PNG/WEBP/GIF) + όριο 5MB πριν το upload. Καλύπτει: §4 (file uploads).

### Data minimization στο `getVenue` — `src/lib/api/venues.functions.ts`
Επέστρεφε `select("*")` (και `owner_id`, timestamps, `place_id`) σε όλους.
Τώρα επιστρέφει explicit allowlist δημόσιων πεδίων· τα internal πεδία μόνο σε
owner/admin. Καλύπτει: §5 (over-exposure) και §9 (community privacy).

### Explicit ownership check στο owner cancel — `src/lib/api/owner.functions.ts`
Το `cancelBookingAsOwner` βασιζόταν μόνο σε RLS — μια μη-εξουσιοδοτημένη
προσπάθεια γινόταν σιωπηλό no-op που επέστρεφε `ok:true`. Προστέθηκε ρητός
έλεγχος ιδιοκτησίας (`assertOwnerOfVenue`) ώστε να αποτυγχάνει καθαρά.
Καλύπτει: §3 (authorization, defense in depth).

### Τι ήταν ήδη σωστό (δεν χρειάστηκε αλλαγή)
- **§3 Authorization / IDOR**: κάθε server function με `supabaseAdmin` κάνει
  δικό της authz (`assertAdmin` / `assertOwnerOfVenue` / friends checks), και τα
  per-user queries φιλτράρουν πάντα με τον authenticated χρήστη. RLS ενεργό σε
  όλους τους πίνακες. Mass assignment κλειστό (allowlist patches, `approved`
  δεν μπορεί να self-set, admin role δεν μπορεί να self-assign στο signup).
- **§4 Injection**: όλα τα endpoints με Zod validators· LIKE wildcards escaped
  στο search· καμία string-concatenation SQL (Supabase query builder + `.or()`
  με τιμές από JWT/DB, όχι raw input).
- **§6 Business logic**: double-booking κλειστό με Postgres `EXCLUDE USING gist`
  constraint + advisory locks στα RPCs — υποδειγματικό. Timezone (Europe/Athens)
  σωστά. Χωρίς κάρτες (cash-only) → χωρίς PCI επιφάνεια.
- **§9 Community**: `discoverable` false by default, profiles χωρίς email/τηλέφωνο,
  moderation (report/block/admin actions) υπάρχει.
- **§10**: `bunfig.toml` supply-chain guard (24h release age).

---

## 2) GDPR / νομικά — νέες σελίδες

Το footer παρέπεμπε σε `/terms` και `/privacy` που **δεν υπήρχαν (404)**.
Για EU booking site είναι νομικά απαραίτητα. Προστέθηκαν:
- `src/routes/terms.tsx` — Όροι Χρήσης (8 ενότητες)
- `src/routes/privacy.tsx` — Πολιτική Απορρήτου GDPR-oriented (10 ενότητες:
  υπεύθυνος επεξεργασίας, νομική βάση, διατήρηση, δικαιώματα, cookies κ.λπ.)
- `src/components/legal-page.tsx` — κοινό layout
- Δίγλωσσο περιεχόμενο (EL/EN) στα `src/i18n/locales/*.json` (`legal.*`)
- Καταχωρήθηκαν στο `src/routeTree.gen.ts` (regen αυτόματα σε `vite dev`/`build`)

> Ανοιχτό (recommendation, όχι bug): πλήρες self-service data export / διαγραφή
> λογαριασμού μέσα από το UI. Υπάρχει soft-delete σε μηνύματα και admin ban, αλλά
> ένα DSAR-flow (§8) είναι μεγαλύτερο feature — προτείνεται ως επόμενο βήμα.

---

## 3) Λειτουργικοί έλεγχοι (ADMIN / USER / OWNER)

Ελέγχθηκε ότι οι οντότητες αλληλεπιδρούν σωστά end-to-end:
- **Player**: search → venue → book (slot/whole/recurring) → open_game →
  join/leave → cancel· προαγωγή oldest-joiner σε host όταν ακυρώνει ο host
  (trigger)· notifications· community (friends/blocks/messages).
- **Owner**: venues (create pending → admin approve)· hours/slots· pricing·
  closures· phone/closed bookings· reports· equipment.
- **Admin**: stats· approve/reject/delete venues· enable/disable users (+auth ban)·
  message reports moderation· "view as" owner/player.

Δεν βρέθηκαν σπασμένες ροές πέρα από τα 404 σε terms/privacy (διορθώθηκαν).
Μικρο-παρατήρηση (μη-blocking): το `last_message_deleted` στο `listConversations`
είναι πρακτικά πάντα false λόγω RLS (τα deleted μηνύματα δεν επιστρέφονται καν) —
το preview δείχνει το τελευταίο μη-διαγραμμένο μήνυμα, που είναι σωστό UX.

---

## 4) Εμφάνιση — πιο vivid/δυναμικό, ίδια ταυτότητα

Διατηρήθηκαν **ακριβώς** τα χρώματα (petrol/coral/optic + sport accents), η
γραμματοσειρά (Inter) και το layout. Προστέθηκε ένα πειθαρχημένο motion layer:

- **`src/styles.css`** — νέο σύστημα κίνησης: cross-page View Transitions,
  ομαλά micro-interactions (button press, focus rings σε coral, input focus glow),
  keyframe/utility library (`fade-in-up`, `scale-in`, `card-lift`, `zoom-img`,
  `btn-shine`, `badge-pop`, `stagger-children`, `hero-blob-*`), και
  scroll-reveal (`reveal-on-scroll`) με progressive enhancement. Πλήρης σεβασμός
  `prefers-reduced-motion`.
- **`src/router.tsx`** — `defaultViewTransition: true` + `defaultPreload: "intent"`
  (ομαλές μεταβάσεις + instant navigation με hover-preload).
- **`src/routes/index.tsx`** — hero blobs που "αναπνέουν", orchestrated entrance,
  shine στα CTAs, hover-lift + scroll-reveal στις κάρτες.
- **`src/routes/venues.index.tsx`** — πλουσιότερες venue cards (image zoom, lift,
  scrim, animated CTA), staggered grid, hover στα sport chips.
- **`src/routes/auth.tsx`** — entrance στην κάρτα, shine στο submit.
- **`src/components/notifications-bell.tsx`** — pop animation στο unread badge.

Οι sport cards στο home είχαν ήδη εξαιρετικά animations — διατηρήθηκαν.

---

## Πώς τρέχει / publish

```bash
bun install          # ή npm install
bun run dev          # τοπικά (regen του routeTree.gen.ts αυτόματα)
bun run build        # production build (Cloudflare/Nitro)
```

Env: αντέγραψε το `.env` (ή φτιάξε από `.env.example`). Τα server-only secrets
(`SUPABASE_SERVICE_ROLE_KEY`, `DEEPL_API_KEY`, `GOOGLE_MAPS_API_KEY`) πρέπει να
οριστούν στο περιβάλλον του host — **όχι** σε committed αρχείο.

---

## Γύρος OWNER — Αλλαγή #1: Προφίλ παίκτη για ιδιοκτήτη (clickable από το Overview)

### Νέα αρχεία
- `supabase/migrations/20260704120000_feb9258f….sql` — πίνακας `player_contact_info`
  (ιδιωτικός, self-only RLS, ΧΩΡΙΣ anon grant) + SECURITY DEFINER RPC
  `get_owner_player_profile(_player_id)`. Πλήρως αναστρέψιμο (DROP function + DROP table),
  δεν αγγίζει υπάρχοντα αντικείμενα.
- `src/lib/api/owner-players.functions.ts` — server function `getOwnerPlayerProfile`
  (RPC + ιστορικό κρατήσεων ΜΟΝΟ στα γήπεδα του καλούντος: RLS + ρητό φίλτρο venue ids).
- `src/routes/_authenticated/owner/players.$playerId.tsx` — σελίδα προφίλ παίκτη
  κάτω από το owner layout (ήδη φραγμένο σε owner/admin από το beforeLoad).

### Κανόνας απορρήτου τηλεφώνου (server-side)
Το τηλέφωνο επιστρέφεται ΜΟΝΟ όσο ο παίκτης έχει ΕΝΕΡΓΗ κράτηση στο γήπεδο του
ιδιοκτήτη: `status='confirmed'` ΚΑΙ `(date + start_time) > now()` (Europe/Athens,
ίδια σύμβαση με `create_whole_booking`). Το enum `booking_status` είναι μονότιμο,
άρα το `confirmed` αποκλείει εξ ορισμού τα completed/cancelled/pending.
Όταν η συνθήκη δεν ισχύει: NULL μέσα στη βάση, και το server function αφαιρεί
τελείως το key από το payload — το τηλέφωνο δεν ταξιδεύει ποτέ στον client.
Το πεδίο ΔΕΝ μπήκε στο `profiles` επειδή εκείνος ο πίνακας έχει `SELECT USING (true)`
(world-readable) — μπήκε σε νέο, αυστηρά ιδιωτικό πίνακα.

### Τροποποιήσεις υπαρχόντων
- `owner.functions.ts` — το `BookingRow` απέκτησε `player_id` + `player_photo_url`
  (ήδη διαθέσιμα δεδομένα, καμία αλλαγή σε RLS/queries πέρα από +1 στήλη στο select).
- `owner/index.tsx` — στο dialog λεπτομερειών κράτησης, όνομα+avatar εγγεγραμμένου
  παίκτη έγιναν Link προς `/owner/players/$playerId`. Τηλεφωνικές κρατήσεις χωρίς
  `player_id` μένουν απλό κείμενο.
- `profile.tsx` — πεδίο «Τηλέφωνο επικοινωνίας» για τον παίκτη (upsert στο
  `player_contact_info`, με hint για το πότε είναι ορατό).
- `types.ts`, `routeTree.gen.ts` — συγχρονίστηκαν χειροκίνητα ώστε το repo να
  κάνει typecheck αμέσως· και τα δύο θα ξαναγεννηθούν πανομοιότυπα από το
  Lovable/vite μετά το migration.
- `i18n/locales/{el,en}.json` — κλειδιά `ownerPlayerProfile.*`, `profile.phone*`,
  `ownerDashboard.details.viewPlayer`.
