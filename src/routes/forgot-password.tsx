import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "./auth";
import { mapAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Επαναφορά κωδικού — Courtsie" },
      { name: "description", content: "Επανέφερε τον κωδικό σου στο Courtsie." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(mapAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-bold text-petrol">Ξέχασα τον κωδικό μου</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Δώσε το email σου και θα σου στείλουμε link για επαναφορά.
      </p>

      {sent ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-lg border border-optic/60 bg-optic/15 px-3 py-3 text-sm text-petrol">
            Σου στείλαμε email με link επαναφοράς κωδικού. Έλεγξε τα εισερχόμενά σου.
          </p>
          <Link
            to="/auth"
            className="block w-full rounded-xl border border-border py-3 text-center text-sm font-semibold text-petrol hover:bg-surface"
          >
            Πίσω στη σύνδεση
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Email"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "..." : "Αποστολή link"}
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
