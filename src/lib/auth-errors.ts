import i18n from "@/i18n";

type AuthLike = { message?: string; code?: string; status?: number; name?: string };

/** Supabase Auth error → a short message in the app's language (keys under `authErrors.*`). */
export function mapAuthError(err: unknown): string {
  const e: AuthLike =
    typeof err === "string"
      ? { message: err }
      : err && typeof err === "object"
        ? (err as AuthLike)
        : {};
  const t = (k: string) => i18n.t(`authErrors.${k}`);
  const message = (e.message ?? "").toString();
  const code = (e.code ?? "").toString().toLowerCase();
  const m = message.toLowerCase();

  // Specific error codes from Supabase Auth
  if (code === "user_already_exists" || code === "email_exists") return t("exists");
  if (code === "over_email_send_rate_limit" || code === "email_send_rate_limit") return t("emailRate");
  if (code === "over_request_rate_limit" || code === "too_many_requests") return t("tooMany");
  if (code === "weak_password") return t("weakPassword");
  if (code === "email_address_invalid" || code === "validation_failed") return t("invalidEmail");
  if (code === "email_not_confirmed") return t("notConfirmed");
  if (code === "otp_expired") return t("badCode");
  if (code === "invalid_credentials") return t("wrongLogin");
  if (code === "signup_disabled" || code === "email_provider_disabled") return t("signupOff");
  if (code === "unexpected_failure" || m.includes("database error saving new user")) return t("server");

  // Fallback heuristics on message
  if (m.includes("invalid login") || m.includes("invalid credentials")) return t("wrongLogin");
  if (m.includes("email not confirmed")) return t("notConfirmed");
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("already exists")) return t("exists");
  if (m.includes("pwned") || m.includes("compromised") || m.includes("leaked")) return t("leakedPassword");
  if (m.includes("password should be") || m.includes("password is too short") || m.includes("at least")) return t("weakPassword");
  if (m.includes("for security purposes") || m.includes("rate limit") || m.includes("too many")) return t("tooMany");
  if (m.includes("invalid email")) return t("invalidEmail");
  if (m.includes("user not found")) return t("noUser");
  if (m.includes("token") && m.includes("expired")) return t("linkExpired");
  if (m.includes("database error") || m.includes("saving new user")) return t("server");
  if (m.includes("failed to fetch") || m.includes("network")) return t("network");
  if (e.status === 500) return t("server");
  return t("generic");
}
