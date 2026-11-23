import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { BigInput, FieldNote, StepShell } from "@/components/auth/step-shell";
import { mapAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/forgot-password")({
  validateSearch: (s: Record<string, unknown>): { email?: string } => ({
    email: typeof s.email === "string" ? s.email : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Επαναφορά κωδικού — Speak" },
      { name: "description", content: "Επανέφερε τον κωδικό σου στο Speak." },
    ],
  }),
  component: ForgotPasswordPage,
});

/** Same one-question layout as /auth: email → "check your inbox". */
function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);
  const back = () => void navigate({ to: "/auth", search: { mode: "signin" } });

  async function submit() {
    setError(null);
    setLoading(true);
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (e) setError(mapAuthError(e));
    else setSent(true);
  }

  // The emailed code signs you in for the reset; /reset-password then sets the new password.
  async function verify() {
    setError(null);
    setLoading(true);
    const { error: e } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "recovery" });
    setLoading(false);
    if (e) setError(mapAuthError(e));
    else void navigate({ to: "/reset-password", replace: true });
  }

  if (sent)
    return (
      <StepShell
        title={t("auth.resetSentTitle")}
        subtitle={t("auth.resetSentText", { email: email.trim() })}
        onBack={() => setSent(false)}
        action={t("student.verify")}
        disabled={!/^\d{6}$/.test(code)}
        loading={loading}
        onSubmit={() => void verify()}
      >
        <BigInput
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          placeholder="000000"
          className="tracking-[0.3em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        {error && <FieldNote error>{error}</FieldNote>}
        <button
          type="button"
          disabled={loading || resent}
          onClick={async () => {
            const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim());
            if (e) setError(mapAuthError(e));
            else setResent(true);
          }}
          className="mt-5 text-callout font-semibold text-link disabled:opacity-60"
        >
          {resent ? t("auth.resent") : t("student.resend")}
        </button>
      </StepShell>
    );
  return (
    <StepShell
      title={t("auth.resetTitle")}
      subtitle={t("auth.resetHint")}
      onBack={back}
      action={t("auth.sendCode")}
      disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())}
      loading={loading}
      onSubmit={() => void submit()}
    >
      <BigInput
        autoFocus
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="send"
        placeholder={t("auth.emailPlaceholder")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && <FieldNote error>{error}</FieldNote>}
    </StepShell>
  );
}
