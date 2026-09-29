import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { BigInput, FieldNote, StepShell } from "@/components/auth/step-shell";
import { mapAuthError } from "@/lib/auth-errors";
import { authRedirectUrl } from "@/lib/native";

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
  const back = () => void navigate({ to: "/auth", search: { mode: "signin" } });

  async function submit() {
    setError(null);
    setLoading(true);
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectUrl("/reset-password"),
    });
    setLoading(false);
    if (e) setError(mapAuthError(e));
    else setSent(true);
  }

  if (sent)
    return (
      <StepShell
        title={t("auth.resetSentTitle")}
        subtitle={t("auth.resetSentText", { email: email.trim() })}
        onBack={back}
        action={t("auth.backToSignin")}
        onSubmit={back}
      />
    );
  return (
    <StepShell
      title={t("auth.resetTitle")}
      subtitle={t("auth.resetHint")}
      onBack={back}
      action={t("auth.sendLink")}
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
