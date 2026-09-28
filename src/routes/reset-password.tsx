import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "./auth";
import { mapAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Νέος κωδικός — Courtsie" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setSessionReady(true);
        setLinkInvalid(false);
      }
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        } else if (accessToken && refreshToken && type === "recovery") {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        const { data } = await supabase.auth.getSession();
        if (!cancelled && data.session) {
          setSessionReady(true);
        } else if (!cancelled && !code && !(accessToken && refreshToken)) {
          // No recovery params at all — wait briefly for PASSWORD_RECOVERY event
          setTimeout(() => {
            if (!cancelled) {
              setSessionReady((ready) => {
                if (!ready) setLinkInvalid(true);
                return ready;
              });
            }
          }, 1500);
        }
      } catch {
        if (!cancelled) setLinkInvalid(true);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!sessionReady) {
      setError("Ο σύνδεσμος επαναφοράς έληξε ή είναι άκυρος — ζήτησε νέο.");
      return;
    }
    if (password.length < 8 || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError(
        "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες, ένα πεζό γράμμα και έναν αριθμό.",
      );
      return;
    }
    if (password !== confirm) {
      setError("Οι κωδικοί δεν ταιριάζουν.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(
        () => navigate({ to: "/auth", search: { reset: "1" } as never }),
        1500,
      );
    } catch (err) {
      setError(mapAuthError(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-bold text-petrol">Νέος κωδικός</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Όρισε έναν νέο κωδικό για τον λογαριασμό σου.
      </p>

      {done ? (
        <p className="mt-6 rounded-lg border border-optic/60 bg-optic/15 px-3 py-3 text-sm text-petrol">
          Ο κωδικός σου ενημερώθηκε. Σε ανακατευθύνουμε…
        </p>
      ) : linkInvalid && !sessionReady ? (
        <div className="mt-6 space-y-3">
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">
            Ο σύνδεσμος επαναφοράς έληξε ή είναι άκυρος — ζήτησε νέο.
          </p>
          <Link
            to="/forgot-password"
            className="block w-full rounded-xl bg-primary py-3 text-center text-sm font-bold text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            Ζήτησε νέο σύνδεσμο
          </Link>
          <Link
            to="/auth"
            className="block w-full text-center text-xs text-muted-foreground hover:text-petrol"
          >
            ← Πίσω στη σύνδεση
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Νέος κωδικός"
            disabled={!sessionReady}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary disabled:opacity-60"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            placeholder="Επιβεβαίωση κωδικού"
            disabled={!sessionReady}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary disabled:opacity-60"
          />
          {!sessionReady && !initializing && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Επαλήθευση συνδέσμου επαναφοράς…
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !sessionReady}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "..." : "Αποθήκευση"}
          </button>
          <Link
            to="/auth"
            className="block w-full text-center text-xs text-muted-foreground hover:text-petrol"
          >
            ← Πίσω στη σύνδεση
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
