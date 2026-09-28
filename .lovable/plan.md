# Σχέδιο: i18n audit + ορολογία + τηλεφωνικές κρατήσεις realtime

Μεγάλη δουλειά σε 3 ανεξάρτητα κομμάτια. Το προτείνω σε αυτή τη σειρά για να μπορείς να δοκιμάζεις κάθε βήμα.

## 1) Audit μετάφρασης EL/EN (όλη η εφαρμογή)

Στόχος: όταν αλλάζεις γλώσσα, **κανένα** ορατό κείμενο να μη μένει αμετάφραστο.

Τι θα κάνω:
- Σαρώνω όλα τα `src/routes/**`, `src/components/**`, `src/hooks/**` για ελληνικά/αγγλικά string literals (κουμπιά, labels, placeholders, toasts, modal, empty states, tooltips, μηνύματα σφάλματος, μέρες/μήνες, μονάδες όπως "€/ώρα", "λεπτά").
- Τα μεταφέρω σε i18n keys με δομή ανά οθόνη:
  - `home.*`, `venues.*`, `venue.*`, `booking.*`, `games.*`, `profile.*`, `owner.*` (dashboard/venues/bookings/pricing/hours/reports), `admin.*`, `auth.*`, `account.*`, `bottomNav.*`, `footer.*`
  - Κοινά: `common.*` (back, save, cancel, delete, edit, loading, retry, confirm, yes/no, search, filter, sort, today, tomorrow, all)
  - Datetime: `datetime.days.{mon..sun}`, `datetime.months.{jan..dec}`, `datetime.shortDays.*`
  - Units: `units.perHour`, `units.minutes`, `units.hours`, `units.players`, `units.eur`
  - Errors: `errors.generic`, `errors.network`, `errors.notFound`, `errors.unauthorized`, `errors.bookingFailed`, …
  - Toasts: `toasts.bookingCreated`, `toasts.bookingCancelled`, `toasts.saved`, …
- Συμπληρώνω ΚΑΙ `el.json` ΚΑΙ `en.json` ώστε να μην υπάρχουν missing keys.
- Φτιάχνω helper `formatDate(date, locale)` για ημερομηνίες ώστε να ακολουθούν τη γλώσσα.
- Επιβεβαιώνω ότι κάθε σελίδα καλεί `useTranslation()` και ότι ο `LanguageToggle` αλλάζει άμεσα όλες τις οθόνες (ήδη ναι, αλλά θα ελέγξω για τυχόν cached strings σε loaders).

## 2) Ορολογία "γήπεδο" / "court"

- Στα **ελληνικά** strings: replace `κορτ` / `κουρτ` / `Court` (όταν μέσα σε ελληνική πρόταση) → `γήπεδο` / `Γήπεδο`. Πληθυντικός: `γήπεδα`.
- Στα **αγγλικά** strings: `γήπεδο` → `court`, `γήπεδα` → `courts`.
- Ελέγχω ονόματα default (π.χ. το auto-provision `Γήπεδο 1` παραμένει — είναι δεδομένο, όχι UI string).
- Δεν αλλάζω database column names (`courts`, `courts_count`) — μόνο UI text.

## 3) Τηλεφωνικές κρατήσεις ιδιοκτήτη: τύπος + realtime

### Επιλογή τύπου
Στη φόρμα τηλεφωνικής κράτησης (`src/routes/_authenticated/owner/bookings.tsx`):
- Νέο radio "Τύπος κράτησης":
  - **Ολόκληρο γήπεδο** (`mode: "whole"`) — κλειδώνει όλο το slot, όπως σήμερα.
  - **Μία θέση** (`mode: "slot"`) — διαθέσιμο μόνο για sports με `slotEnabled` (padel/tennis). Δημιουργεί booking ΚΑΙ ένα `open_games` entry ώστε online παίκτες να βλέπουν τις υπόλοιπες θέσεις (ίδια λογική με την online ατομική κράτηση).
- Server function `createPhoneBooking` (ή επέκταση της υπάρχουσας) με `type: "phone"`, `mode: "whole" | "slot"`.

### Realtime
- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings, public.open_games, public.open_game_players;`
- Hook `useBookingsRealtime(venueId, date)` που:
  - Καλεί `getVenueAvailability` αρχικά.
  - Κάνει subscribe σε `postgres_changes` για `bookings` (filter `venue_id=eq.<id>`) και invalidates το React Query cache.
- Η σελίδα ιδιοκτήτη (calendar) και η σελίδα κράτησης παίκτη χρησιμοποιούν το ίδιο hook → όταν ο owner καταχωρεί τηλεφωνική, εμφανίζεται **άμεσα** και στις δύο οθόνες.
- Στον calendar/list: τα τηλεφωνικά bookings παίρνουν badge `Τηλεφωνική` (διαφορετικό χρώμα από online).
- Στον player view: τα slots μειώνονται/κλειδώνουν αυτόματα.

### Επικύρωση
- Επιβεβαιώνω ότι το `createBooking` ήδη υπολογίζει σωστά τα taken courts. Η νέα τηλεφωνική θα περάσει από την ίδια λογική overlap → δεν χρειάζεται διπλή υλοποίηση.
- RLS: owner μπορεί να βάλει `type=phone` για venues που του ανήκουν. Νέο policy ή επέκταση υπαρχόντων.

## Τεχνικά (μη‑τεχνικός χρήστης μπορεί να αγνοήσει)

- Locales: `src/i18n/locales/{el,en}.json` διευρύνονται μαζικά.
- Helper: `src/lib/format.ts` με `formatDate`, `formatTime`, `formatCurrency` που δέχονται locale.
- `src/lib/api/bookings.functions.ts`: νέα `createPhoneBooking` server fn (auth + role check `has_role(uid,'owner'|'admin')`, venue ownership check).
- `src/hooks/use-bookings-realtime.ts`: νέο hook με `supabase.channel(...).on('postgres_changes',…)`, cleanup σε unmount.
- Migration για realtime publication + (αν χρειαστεί) policy για phone bookings.

## Σειρά εκτέλεσης

1. **Realtime + phone booking type** (μικρότερο, ξεκάθαρο scope, σου ξεμπλοκάρει τη ροή ιδιοκτήτη).
2. **Ορολογία γήπεδο/court** (γρήγορο sweep).
3. **i18n audit** (μεγαλύτερο, θα γίνει σε ένα πέρασμα ανά route group).

## Εκτίμηση μεγέθους

Είναι αρκετά μεγάλο — περίπου 25–35 αρχεία για να αγγίξω συνολικά (κυρίως locales + routes). Δεν θα σπάσει τίποτα υπάρχον· οι αλλαγές είναι additive (νέα keys, νέο mode, νέο hook).

**Θες να προχωρήσω και με τα 3 σε αυτή τη σειρά**, ή προτιμάς να ξεκινήσω από ένα συγκεκριμένο κομμάτι πρώτα (π.χ. μόνο οι τηλεφωνικές κρατήσεις για να ξεμπλοκάρεις);
