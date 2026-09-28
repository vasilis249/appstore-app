import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/logo";
import { mapAuthError } from "@/lib/auth-errors";
import { authRedirectUrl } from "@/lib/native";
import { Check } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Σύνδεση — Courtsie" },
      { name: "description", content: "Συνδέσου ή δημιούργησε λογαριασμό στο Courtsie." },
    ],
  }),
  component: AuthPage,
});

type Role = "player" | "owner";

const PASSWORD_RULES = [
  { id: "len", label: "Τουλάχιστον 8 χαρακτήρες", test: (p: string) => p.length >= 8 },
  { id: "lower", label: "Ένα πεζό γράμμα (a–z)", test: (p: string) => /[a-z]/.test(p) },
  { id: "num", label: "Έναν αριθμό (0–9)", test: (p: string) => /[0-9]/.test(p) },
];

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">((search as any)?.mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>((search as any)?.role === "owner" ? "owner" : "player");
  // App Store guideline 1.2 (user-generated content): users must accept the terms.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const passwordChecks = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(password) }));
  const passwordValid = passwordChecks.every((c) => c.ok);

  if (session) {
    setTimeout(() => navigate({ to: "/" }), 0);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: e1 } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: authRedirectUrl("/"),
            data: { full_name: fullName, role },
          },
        });
        if (e1) throw e1;
        if (!data.session) {
          setInfo("Σου στείλαμε email επιβεβαίωσης. Πάτησε το link για να ενεργοποιηθεί ο λογαριασμός σου.");
          return;
        }
        navigate({ to: role === "owner" ? "/owner" : "/" });
      } else {
        const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
        if (e2) throw e2;
        navigate({ to: "/" });
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-bold text-petrol">{mode === "signin" ? "Σύνδεση" : "Εγγραφή"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "signin" ? "Καλωσήρθες πίσω στο Courtsie." : "Φτιάξε λογαριασμό σε δευτερόλεπτα."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        {mode === "signup" && (
          <>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Ονοματεπώνυμο"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Είμαι:</label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { v: "player", l: "Παίκτης" },
                    { v: "owner", l: "Ιδιοκτήτης" },
                  ] as { v: Role; l: string }[]
                ).map((r) => (
                  <button
                    key={r.v}
                    type="button"
                    onClick={() => setRole(r.v)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      role === r.v
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r.l}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="Email"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          placeholder="Κωδικός"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />

        {mode === "signup" && (
          <ul className="space-y-1 rounded-lg border border-border/60 bg-background/50 px-3 py-2">
            {passwordChecks.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-xs">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full ${
                    c.ok ? "bg-optic text-petrol" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {c.ok ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
              </li>
            ))}
          </ul>
        )}

        {mode === "signup" && (
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              Αποδέχομαι τους{" "}
              <Link to="/terms" className="font-medium text-primary underline">
                Όρους χρήσης
              </Link>{" "}
              και την{" "}
              <Link to="/privacy" className="font-medium text-primary underline">
                Πολιτική απορρήτου
              </Link>
              . Δεν επιτρέπεται προσβλητικό ή καταχρηστικό περιεχόμενο.
            </span>
          </label>
        )}

        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
        {info && <p className="rounded-lg border border-optic/60 bg-optic/15 px-3 py-2 text-xs text-petrol">{info}</p>}

        <button
          type="submit"
          disabled={loading || (mode === "signup" && (!passwordValid || !acceptedTerms))}
          className="btn-shine w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow transition hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:opacity-60"
        >
          {loading ? "..." : mode === "signin" ? "Σύνδεση" : "Δημιουργία λογαριασμού"}
        </button>
      </form>

      {mode === "signin" && (
        <Link to="/forgot-password" className="mt-4 block text-center text-xs text-muted-foreground hover:text-petrol">
          Ξέχασες τον κωδικό σου;
        </Link>
      )}

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setInfo(null);
        }}
        className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-petrol"
      >
        {mode === "signin" ? "Δεν έχεις λογαριασμό; Εγγραφή" : "Έχεις λογαριασμό; Σύνδεση"}
      </button>
    </AuthShell>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col px-4 pt-10">
      <Link to="/" className="mb-6 flex items-center justify-center">
        <Logo className="h-10 w-auto" />
      </Link>
      <div className="animate-scale-in rounded-3xl border border-border/60 bg-card p-8 shadow-sm">{children}</div>
    </div>
  );
}
