import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Eye, EyeOff } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Wordmark } from "@/components/wordmark";
import { BigInput, FieldNote, StepShell } from "@/components/auth/step-shell";
import { mapAuthError } from "@/lib/auth-errors";
import { suggestEmail } from "@/lib/email-typos";
import { rpcErrorKey } from "@/lib/friends";
import { authRedirectUrl } from "@/lib/native";
import { enabledProviders, signInWithProvider, type OAuthProvider } from "@/lib/oauth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: "signup" | "signin"; welcome?: 1 } => ({
    mode: s.mode === "signup" || s.mode === "signin" ? s.mode : undefined,
    welcome: s.welcome ? 1 : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Σύνδεση — Speak" },
      { name: "description", content: "Συνδέσου ή δημιούργησε λογαριασμό στο Speak." },
    ],
  }),
  component: AuthPage,
});

type Step =
  | "welcome"
  | "signinEmail"
  | "signinPassword"
  | "signupName"
  | "signupEmail"
  | "signupPassword"
  | "checkEmail"
  | "username";

const PASSWORD_RULES = [
  { id: "len", test: (p: string) => p.length >= 8 },
  { id: "lower", test: (p: string) => /[a-z]/.test(p) },
  { id: "num", test: (p: string) => /[0-9]/.test(p) },
] as const;
const USERNAME_RE = /^[a-z0-9._]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** A brand-new account (e.g. first Google sign-in) gets the "pick a username" step once. */
function isNewUser(u: User) {
  return Date.now() - new Date(u.created_at).getTime() < 10 * 60 * 1000;
}

/** Welcome → sign in (email → password) or sign up (name → email → password → username), one question per screen. */
function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { session, user } = useAuth();
  const [step, setStep] = useState<Step>(search.mode === "signup" ? "signupName" : search.mode === "signin" ? "signinEmail" : "welcome");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signed in: new accounts pick a username first (after sign-up or a first social login), others go home.
  useEffect(() => {
    if (!session || !user || step === "username") return;
    if (step === "signupPassword" || (search.welcome && isNewUser(user))) setStep("username");
    else void navigate({ to: "/", replace: true });
  }, [session, user, step, search.welcome, navigate]);

  const common = { email, setEmail, go: setStep };
  switch (step) {
    case "welcome":
      return <Welcome go={setStep} />;
    case "signinEmail":
      return <EmailStep {...common} title="auth.signinEmailTitle" back="welcome" next="signinPassword" autoComplete="username" />;
    case "signinPassword":
      return <SigninPassword {...common} password={password} setPassword={setPassword} />;
    case "signupName":
      return <NameStep name={name} setName={setName} go={setStep} />;
    case "signupEmail":
      return <EmailStep {...common} title="auth.signupEmailTitle" back="signupName" next="signupPassword" autoComplete="email" />;
    case "signupPassword":
      return <SignupPassword {...common} name={name} password={password} setPassword={setPassword} />;
    case "checkEmail":
      return <CheckEmail email={email} go={setStep} />;
    case "username":
      return user ? <UsernameStep user={user} /> : null;
  }
}

function Terms() {
  const { t } = useTranslation();
  return (
    <p className="px-2 pb-3 text-center text-caption leading-snug text-muted-foreground">
      {t("auth.termsPrefix")}{" "}
      <Link to="/terms" className="text-foreground underline">
        {t("auth.terms")}
      </Link>{" "}
      {t("auth.and")}{" "}
      <Link to="/privacy" className="text-foreground underline">
        {t("auth.privacy")}
      </Link>
      .
    </p>
  );
}

function Welcome({ go }: { go: (s: Step) => void }) {
  const { t } = useTranslation();
  const providers = useQuery({ queryKey: ["auth", "providers"], queryFn: enabledProviders, staleTime: 5 * 60_000 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const social = (["apple", "google"] as const).filter((p) => providers.data?.[p]);

  async function oauth(p: OAuthProvider) {
    setError(null);
    setBusy(p);
    try {
      await signInWithProvider(p);
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setBusy(null);
    }
  }

  const pill = "flex h-[52px] w-full items-center justify-center gap-3 rounded-xl text-body font-semibold active:opacity-80 disabled:opacity-60";
  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-6">
      <div className="flex flex-1 flex-col justify-center">
        <Wordmark className="text-[56px] leading-none" />
        <p className="mt-4 text-display font-semibold">{t("auth.tagline")}</p>
      </div>
      <div className="space-y-3">
        {social.map((p) => (
          <button key={p} type="button" disabled={!!busy} onClick={() => void oauth(p)} className={cn(pill, "bg-foreground text-background")}>
            {p === "google" ? <GoogleIcon /> : <AppleIcon />}
            {t(p === "google" ? "auth.google" : "auth.apple")}
          </button>
        ))}
        {social.length > 0 && (
          <div className="flex items-center gap-3 py-1 text-caption text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> {t("auth.or")} <span className="h-px flex-1 bg-border" />
          </div>
        )}
        <button
          type="button"
          onClick={() => go("signupName")}
          className={cn(pill, social.length ? "bg-secondary text-foreground" : "bg-primary text-primary-foreground")}
        >
          {t("auth.createAccount")}
        </button>
        {error && <p className="text-center text-caption text-destructive">{error}</p>}
        <Terms />
        <p className="pt-2 text-center text-callout text-muted-foreground">
          {t("auth.haveAccount")}{" "}
          <button type="button" onClick={() => go("signinEmail")} className="font-semibold text-foreground">
            {t("auth.signin")}
          </button>
        </p>
      </div>
    </div>
  );
}

function EmailStep({
  email,
  setEmail,
  go,
  title,
  back,
  next,
  autoComplete,
}: {
  email: string;
  setEmail: (v: string) => void;
  go: (s: Step) => void;
  title: string;
  back: Step;
  next: Step;
  autoComplete: string;
}) {
  const { t } = useTranslation();
  const suggestion = suggestEmail(email);
  const valid = EMAIL_RE.test(email.trim());
  return (
    <StepShell
      title={t(title)}
      onBack={() => go(back)}
      action={t("auth.continue")}
      disabled={!valid}
      onSubmit={() => {
        setEmail(email.trim().toLowerCase());
        go(next);
      }}
    >
      <BigInput
        autoFocus
        type="email"
        inputMode="email"
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        placeholder={t("auth.emailPlaceholder")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {suggestion && (
        <button type="button" onClick={() => setEmail(suggestion)} className="mt-4 block text-left text-callout text-muted-foreground">
          {t("auth.didYouMean")} <span className="font-semibold text-foreground underline">{suggestion}</span>;
        </button>
      )}
    </StepShell>
  );
}

function PasswordInput({
  value,
  onChange,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
}) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <BigInput
        autoFocus
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        enterKeyHint="go"
        placeholder={t("auth.passwordPlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={t(show ? "auth.hide" : "auth.show")}
        className="grid h-11 w-11 shrink-0 place-items-center text-muted-foreground"
      >
        {show ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
      </button>
    </div>
  );
}

function SigninPassword({
  email,
  go,
  password,
  setPassword,
}: {
  email: string;
  go: (s: Step) => void;
  password: string;
  setPassword: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (e) {
      setUnconfirmed((e as { code?: string }).code === "email_not_confirmed");
      setError(mapAuthError(e));
      setPassword("");
    }
  }

  return (
    <StepShell
      title={t("auth.passwordTitle")}
      subtitle={email}
      onBack={() => go("signinEmail")}
      right={
        <Link to="/forgot-password" search={{ email }} className="text-body font-normal">
          {t("auth.forgot")}
        </Link>
      }
      action={t("auth.signin")}
      disabled={!password}
      loading={loading}
      onSubmit={() => void submit()}
    >
      <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      {error && <FieldNote error>{error}</FieldNote>}
      {unconfirmed && <ResendButton email={email} />}
    </StepShell>
  );
}

function NameStep({ name, setName, go }: { name: string; setName: (v: string) => void; go: (s: Step) => void }) {
  const { t } = useTranslation();
  return (
    <StepShell
      title={t("auth.nameTitle")}
      subtitle={t("auth.nameHint")}
      onBack={() => go("welcome")}
      action={t("auth.continue")}
      disabled={name.trim().length < 2}
      onSubmit={() => go("signupEmail")}
    >
      <BigInput
        autoFocus
        autoComplete="name"
        autoCapitalize="words"
        enterKeyHint="next"
        maxLength={60}
        placeholder={t("auth.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
    </StepShell>
  );
}

function SignupPassword({
  name,
  email,
  go,
  password,
  setPassword,
}: {
  name: string;
  email: string;
  go: (s: Step) => void;
  password: string;
  setPassword: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checks = PASSWORD_RULES.map((r) => ({ id: r.id, ok: r.test(password) }));

  async function submit() {
    setError(null);
    setLoading(true);
    const { data, error: e } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: authRedirectUrl("/auth?welcome=1"), data: { full_name: name.trim() } },
    });
    setLoading(false);
    if (e) return setError(mapAuthError(e));
    // With a session the effect in AuthPage moves on to the username step.
    if (!data.session) go("checkEmail");
  }

  return (
    <StepShell
      title={t("auth.newPasswordTitle")}
      onBack={() => go("signupEmail")}
      action={t("auth.createAccount")}
      disabled={!checks.every((c) => c.ok)}
      loading={loading}
      onSubmit={() => void submit()}
      above={<Terms />}
    >
      <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      <ul className="mt-5 space-y-2">
        {checks.map((c) => (
          <li key={c.id} className="flex items-center gap-2.5 text-callout">
            <span
              className={cn(
                "grid h-5 w-5 place-items-center rounded-full",
                c.ok ? "bg-primary text-primary-foreground" : "bg-secondary text-transparent",
              )}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{t(`auth.rule.${c.id}`)}</span>
          </li>
        ))}
      </ul>
      {error && <FieldNote error>{error}</FieldNote>}
    </StepShell>
  );
}

function ResendButton({ email }: { email: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "sent" | string>("idle");
  return (
    <button
      type="button"
      disabled={state === "sent"}
      onClick={async () => {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: authRedirectUrl("/auth?welcome=1") },
        });
        setState(error ? mapAuthError(error) : "sent");
      }}
      className="mt-4 block text-left text-callout font-semibold underline disabled:no-underline disabled:opacity-60"
    >
      {state === "sent" ? t("auth.resent") : state === "idle" ? t("auth.resend") : state}
    </button>
  );
}

function CheckEmail({ email, go }: { email: string; go: (s: Step) => void }) {
  const { t } = useTranslation();
  return (
    <StepShell
      title={t("auth.checkEmailTitle")}
      subtitle={t("auth.checkEmailText", { email })}
      onBack={() => go("signupEmail")}
      action={t("auth.signin")}
      onSubmit={() => go("signinEmail")}
    >
      <ResendButton email={email} />
    </StepShell>
  );
}

function UsernameStep({ user }: { user: User }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  // Start from the username generated at sign-up (from the name, Greek → Latin).
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single()
      .then(({ data }) => data && setUsername((u) => u || data.username));
  }, [user.id]);

  async function submit() {
    setError(null);
    setLoading(true);
    const { error: e } = await supabase.from("profiles").update({ username }).eq("id", user.id);
    setLoading(false);
    if (e) return setError(t(rpcErrorKey(new Error(`${e.message} ${e.details ?? ""}`))));
    void navigate({ to: "/student", search: { welcome: 1 }, replace: true });
  }

  return (
    <StepShell
      title={t("auth.usernameTitle")}
      subtitle={t("auth.usernameHint")}
      right={
        <button type="button" onClick={() => void navigate({ to: "/student", search: { welcome: 1 }, replace: true })} className="text-body font-normal">
          {t("auth.skip")}
        </button>
      }
      action={t("auth.continue")}
      disabled={!USERNAME_RE.test(username)}
      loading={loading}
      onSubmit={() => void submit()}
    >
      <BigInput
        prefix="@"
        autoFocus
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        maxLength={20}
        placeholder="username"
        value={username}
        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
      />
      {error ? <FieldNote error>{error}</FieldNote> : <FieldNote>{t("profile.usernameHint")}</FieldNote>}
    </StepShell>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M16.37 12.62c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.51 1.25-2.58-.03-.01-2.4-.92-2.38-3.65zM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.76-.96 2.8 1.02.08 2.05-.51 2.68-1.28z" />
    </svg>
  );
}

/** Kept for the password reset page. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="safe-top mx-auto flex min-h-screen max-w-md flex-col px-5">
      <Wordmark className="mt-4 mb-10 text-center text-display" />
      <div className="animate-fade-in-up">{children}</div>
    </div>
  );
}
