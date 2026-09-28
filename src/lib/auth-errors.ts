type AuthLike = { message?: string; code?: string; status?: number; name?: string };

export function mapAuthError(err: unknown): string {
  const e: AuthLike =
    typeof err === "string"
      ? { message: err }
      : err && typeof err === "object"
        ? (err as AuthLike)
        : {};
  const message = (e.message ?? "").toString();
  const code = (e.code ?? "").toString().toLowerCase();
  const m = message.toLowerCase();
  const status = e.status;

  // Specific error codes from Supabase Auth
  if (code === "user_already_exists" || code === "email_exists")
    return "Υπάρχει ήδη λογαριασμός με αυτό το email. Δοκίμασε σύνδεση.";
  if (code === "over_email_send_rate_limit" || code === "email_send_rate_limit")
    return "Πολλά email επιβεβαίωσης σε σύντομο χρόνο. Περίμενε ~1 λεπτό και ξαναδοκίμασε.";
  if (code === "over_request_rate_limit" || code === "too_many_requests")
    return "Πολλές προσπάθειες. Δοκίμασε ξανά σε λίγο.";
  if (code === "weak_password")
    return "Ο κωδικός είναι αδύναμος. Χρησιμοποίησε τουλάχιστον 8 χαρακτήρες με πεζό και αριθμό.";
  if (code === "email_address_invalid" || code === "validation_failed")
    return "Μη έγκυρο email.";
  if (code === "email_not_confirmed")
    return "Το email σου δεν έχει επιβεβαιωθεί. Έλεγξε τα εισερχόμενά σου.";
  if (code === "invalid_credentials")
    return "Λάθος email ή κωδικός.";
  if (code === "signup_disabled")
    return "Οι εγγραφές είναι προσωρινά απενεργοποιημένες.";
  if (code === "unexpected_failure" || m.includes("database error saving new user"))
    return "Σφάλμα βάσης κατά τη δημιουργία λογαριασμού. Δοκίμασε ξανά ή επικοινώνησε μαζί μας.";
  if (code === "email_provider_disabled")
    return "Η εγγραφή με email είναι απενεργοποιημένη.";

  // Fallback heuristics on message
  if (m.includes("invalid login") || m.includes("invalid credentials"))
    return "Λάθος email ή κωδικός.";
  if (m.includes("email not confirmed"))
    return "Το email σου δεν έχει επιβεβαιωθεί. Έλεγξε τα εισερχόμενά σου για το link επιβεβαίωσης.";
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("already exists"))
    return "Υπάρχει ήδη λογαριασμός με αυτό το email. Δοκίμασε σύνδεση.";
  if (m.includes("password should be") || m.includes("password is too short") || m.includes("at least"))
    return "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες με πεζό και αριθμό.";
  if (m.includes("pwned") || m.includes("compromised") || m.includes("leaked"))
    return "Ο κωδικός εμφανίζεται σε γνωστές διαρροές. Διάλεξε άλλον.";
  if (m.includes("for security purposes") || m.includes("rate limit") || m.includes("too many"))
    return "Πολλές προσπάθειες. Δοκίμασε ξανά σε ~1 λεπτό.";
  if (m.includes("email") && m.includes("rate"))
    return "Πολλά email επιβεβαίωσης σε σύντομο χρόνο. Περίμενε ~1 λεπτό.";
  if (m.includes("invalid email"))
    return "Μη έγκυρο email.";
  if (m.includes("user not found"))
    return "Δεν βρέθηκε λογαριασμός με αυτό το email.";
  if (m.includes("token") && m.includes("expired"))
    return "Το link έχει λήξει. Ζήτα νέο.";
  if (m.includes("database error") || m.includes("saving new user"))
    return "Σφάλμα βάσης κατά τη δημιουργία λογαριασμού. Δοκίμασε ξανά ή επικοινώνησε μαζί μας.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Πρόβλημα δικτύου. Έλεγξε τη σύνδεσή σου και ξαναδοκίμασε.";
  if (status === 500)
    return "Σφάλμα διακομιστή. Δοκίμασε ξανά σε λίγο.";

  return message
    ? `Σφάλμα: ${message}`
    : "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
}
