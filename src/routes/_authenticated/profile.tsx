import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, LogOut, Pencil, Phone, Star, Trophy } from "lucide-react";
import { uploadAvatar } from "@/lib/avatar";
import { StarRating } from "@/components/star-rating";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Προφίλ — Courtsie" },
      { name: "description", content: "Το προφίλ παίκτη σου στο Courtsie." },
    ],
  }),
  component: ProfilePage,
});

type Level = "beginner" | "intermediate" | "advanced";

function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);

  const profileQ = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, level, games_played, rating, photo_url")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const reviewsQ = useQuery({
    queryKey: ["my-reviews", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer_id")
        .eq("target_player_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((r) => r.reviewer_id)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("user_id, full_name, photo_url").in("user_id", ids)
        : { data: [] as Array<{ user_id: string; full_name: string | null; photo_url: string | null }> };
      const byId = new Map((profs ?? []).map((p) => [p.user_id, p]));
      return (data ?? []).map((r) => ({ ...r, reviewer: byId.get(r.reviewer_id) ?? null }));
    },
  });

  // Contact phone lives in player_contact_info, NOT profiles: profiles is
  // world-readable by RLS design, while this table is self-only. Owners see
  // the phone exclusively through get_owner_player_profile, and only while
  // the player has an active booking at their venue.
  const contactQ = useQuery({
    queryKey: ["player-contact", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_contact_info")
        .select("phone")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveProfile = useMutation({
    mutationFn: async ({ phone, ...patch }: { full_name?: string; level?: Level; phone?: string }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("user_id", user!.id);
      if (error) throw error;
      const trimmed = (phone ?? "").trim();
      const { error: cErr } = await supabase
        .from("player_contact_info")
        .upsert({ user_id: user!.id, phone: trimmed || null }, { onConflict: "user_id" });
      if (cErr) throw cErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["player-contact", user?.id] });
      toast.success(t("profile.saved"));
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    try {
      await uploadAvatar(user.id, f);
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success(t("profile.photoUpdated"));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const p = profileQ.data;
  const initial = (p?.full_name ?? user?.email ?? "?").charAt(0).toUpperCase();
  const avgRating = p?.rating ? Number(p.rating) : 0;
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";

  const roleLabel =
    role === "owner" ? t("profile.owner")
    : role === "coach" ? t("profile.coach")
    : role === "admin" ? t("profile.admin")
    : t("profile.player");

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-24">
      <div className="rounded-3xl border border-border/60 bg-surface p-6 sm:p-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative">
            <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-primary text-3xl font-bold text-primary-foreground">
              {p?.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> : initial}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-card border border-border shadow-md transition hover:bg-primary hover:text-primary-foreground"
              aria-label={t("profile.changePhoto")}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            {editing ? (
              <EditForm
                initialName={p?.full_name ?? ""}
                initialPhone={contactQ.data?.phone ?? ""}
                initialLevel={(p?.level as Level) ?? "beginner"}
                onCancel={() => setEditing(false)}
                onSave={(patch) => saveProfile.mutate(patch)}
                saving={saveProfile.isPending}
              />
            ) : (
              <>
                <h1 className="truncate font-display text-2xl font-bold">{p?.full_name || user?.email}</h1>
                <p className="text-sm text-muted-foreground">{roleLabel}</p>
                {contactQ.data?.phone && (
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {contactQ.data.phone}
                  </p>
                )}
                <button onClick={() => setEditing(true)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  <Pencil className="h-3.5 w-3.5" /> {t("profile.edit")}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat icon={<Trophy className="h-4 w-4" />} label={t("profile.games")} value={String(p?.games_played ?? 0)} />
          <Stat icon={<Star className="h-4 w-4" />} label={t("profile.rating")} value={avgRating ? avgRating.toFixed(1) : "—"} />
          <Stat label={t("profile.level")} value={p?.level ? t(`levels.${p.level}`, p.level) : "—"} />
        </div>

        <button onClick={signOut} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold transition hover:border-destructive/40 hover:text-destructive">
          <LogOut className="h-4 w-4" /> {t("profile.signOut")}
        </button>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold">{t("profile.reviews")}</h2>
          <span className="text-xs text-muted-foreground">{t("profile.totalReviews", { n: reviewsQ.data?.length ?? 0 })}</span>
        </div>
        {reviewsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !reviewsQ.data?.length ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            {t("profile.noReviews")}
          </div>
        ) : (
          <ul className="space-y-3">
            {reviewsQ.data.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-muted text-sm font-semibold">
                      {r.reviewer?.photo_url ? <img src={r.reviewer.photo_url} alt="" className="h-full w-full object-cover" /> : (r.reviewer?.full_name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{r.reviewer?.full_name ?? t("openGames.player")}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString(locale)}</p>
                    </div>
                  </div>
                  <StarRating value={r.rating} readOnly size={16} />
                </div>
                {r.comment && <p className="mt-3 text-sm text-foreground/90">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 font-display text-2xl font-bold text-primary">
        {icon}<span>{value}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function EditForm({ initialName, initialPhone, initialLevel, onCancel, onSave, saving }: { initialName: string; initialPhone: string; initialLevel: Level; onCancel: () => void; onSave: (p: { full_name: string; level: Level; phone: string }) => void; saving: boolean }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [level, setLevel] = useState<Level>(initialLevel);

  function submit() {
    const trimmed = phone.trim();
    if (trimmed && (trimmed.length < 6 || trimmed.length > 40)) {
      toast.error(t("profile.phoneInvalid"));
      return;
    }
    onSave({ full_name: name, level, phone: trimmed });
  }

  return (
    <div className="space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("profile.namePh")}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <div>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          placeholder={t("profile.phonePh")}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t("profile.phoneHint")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["beginner", "intermediate", "advanced"] as Level[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLevel(l)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              level === l ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40",
            )}
          >
            {t(`levels.${l}`)}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button disabled={saving} onClick={submit} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving ? "…" : t("common.save")}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm">{t("common.cancel")}</button>
      </div>
    </div>
  );
}
