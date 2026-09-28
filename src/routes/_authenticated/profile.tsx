import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, LogOut } from "lucide-react";
import { uploadAvatar } from "@/lib/avatar";
import { StarRating } from "@/components/star-rating";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { ProfileView } from "@/components/social/profile-view";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { updateSocialProfile } from "@/lib/api/social.functions";
import { DeleteAccountButton } from "@/components/delete-account-button";

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
  const { user } = useAuth();
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
        .select("full_name, level, games_played, rating, photo_url, username, bio, is_private")
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
        : {
            data: [] as Array<{
              user_id: string;
              full_name: string | null;
              photo_url: string | null;
            }>,
          };
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

  const updateSocialFn = useServerFn(updateSocialProfile);
  const saveProfile = useMutation({
    mutationFn: async ({ phone, username, bio, is_private, ...patch }: EditValues) => {
      await updateSocialFn({ data: { username, bio, is_private } });
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
      qc.invalidateQueries({ queryKey: ["social-profile"] });
      toast.success(t("profile.saved"));
      setEditing(false);
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("username_taken")
          ? t("social.usernameTaken")
          : e.message.includes("username_invalid")
            ? t("social.usernameHint")
            : e.message,
      ),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    try {
      await uploadAvatar(user.id, f);
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      qc.invalidateQueries({ queryKey: ["social-profile"] });
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
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-24">
      <ProfileView
        username="me"
        avatarOverlay={
          <>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md"
              aria-label={t("profile.changePhoto")}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </>
        }
        ownActions={
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-10 flex-1 rounded-xl bg-secondary text-sm font-semibold transition hover:bg-muted"
          >
            {t("social.editProfile")}
          </button>
        }
      />

      <Drawer open={editing} onOpenChange={setEditing}>
        <DrawerContent className="mx-auto max-h-[92vh] max-w-lg rounded-t-[28px] border-0 bg-background">
          <DrawerTitle className="px-5 pt-4 text-center font-display text-lg font-bold">
            {t("social.editProfile")}
          </DrawerTitle>
          <DrawerDescription className="sr-only">{t("social.editProfile")}</DrawerDescription>
          <div className="safe-bottom overflow-y-auto px-5 pb-5 pt-3">
            {p && (
              <EditForm
                initial={{
                  full_name: p.full_name ?? "",
                  username: p.username,
                  bio: p.bio ?? "",
                  is_private: p.is_private,
                  level: (p.level as Level) ?? "beginner",
                  phone: contactQ.data?.phone ?? "",
                }}
                onCancel={() => setEditing(false)}
                onSave={(v) => saveProfile.mutate(v)}
                saving={saveProfile.isPending}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold">{t("profile.reviews")}</h2>
          <span className="text-xs text-muted-foreground">
            {t("profile.totalReviews", { n: reviewsQ.data?.length ?? 0 })}
          </span>
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
                      {r.reviewer?.photo_url ? (
                        <img
                          src={r.reviewer.photo_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (r.reviewer?.full_name ?? "?").charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {r.reviewer?.full_name ?? t("openGames.player")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString(locale)}
                      </p>
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

      <div className="mt-8 grid gap-2 sm:grid-cols-2">
        <button
          onClick={signOut}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold transition hover:border-destructive/40 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" /> {t("profile.signOut")}
        </button>
        <DeleteAccountButton />
      </div>
    </div>
  );
}

type EditValues = {
  full_name: string;
  username: string;
  bio: string | null;
  is_private: boolean;
  level: Level;
  phone: string;
};

function EditForm({
  initial,
  onCancel,
  onSave,
  saving,
}: {
  initial: EditValues;
  onCancel: () => void;
  onSave: (v: EditValues) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [v, setV] = useState<EditValues>(initial);
  const set = <K extends keyof EditValues>(k: K, val: EditValues[K]) =>
    setV((cur) => ({ ...cur, [k]: val }));
  const input = "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm";

  function submit() {
    const phone = v.phone.trim();
    if (phone && (phone.length < 6 || phone.length > 40)) {
      toast.error(t("profile.phoneInvalid"));
      return;
    }
    const username = v.username.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,30}$/.test(username)) {
      toast.error(t("social.usernameHint"));
      return;
    }
    onSave({ ...v, username, phone, bio: v.bio?.trim() || null });
  }

  return (
    <div className="space-y-4">
      <Field label={t("profile.namePh")}>
        <input
          value={v.full_name}
          onChange={(e) => set("full_name", e.target.value)}
          className={input}
        />
      </Field>
      <Field label={t("social.username")} hint={t("social.usernameHint")}>
        <div className="flex items-center rounded-xl border border-border bg-card pl-3">
          <span className="text-sm text-muted-foreground">@</span>
          <input
            value={v.username}
            onChange={(e) => set("username", e.target.value.toLowerCase())}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={30}
            className="w-full bg-transparent px-1 py-2.5 text-sm outline-none"
          />
        </div>
      </Field>
      <Field label={t("social.bio")}>
        <textarea
          value={v.bio ?? ""}
          onChange={(e) => set("bio", e.target.value)}
          maxLength={150}
          rows={3}
          placeholder={t("social.bioPh")}
          className={input}
        />
      </Field>
      <Field label={t("profile.phone")} hint={t("profile.phoneHint")}>
        <input
          value={v.phone}
          onChange={(e) => set("phone", e.target.value)}
          type="tel"
          inputMode="tel"
          placeholder={t("profile.phonePh")}
          className={input}
        />
      </Field>
      <Field label={t("profile.level")}>
        <div className="flex flex-wrap gap-2">
          {(["beginner", "intermediate", "advanced"] as Level[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => set("level", l)}
              className={cn(
                "rounded-[14px] px-3.5 py-2 text-sm font-medium transition",
                v.level === l
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "bg-card shadow-sm ring-1 ring-border/60",
              )}
            >
              {t(`levels.${l}`)}
            </button>
          ))}
        </div>
      </Field>
      <label className="flex items-start justify-between gap-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/60">
        <span>
          <span className="block text-sm font-semibold">{t("social.privateToggle")}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {t("social.privateToggleHint")}
          </span>
        </span>
        <Switch checked={v.is_private} onCheckedChange={(c) => set("is_private", c)} />
      </label>
      <div className="flex gap-2 pt-1">
        <button
          disabled={saving}
          onClick={submit}
          className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          {saving ? "…" : t("common.save")}
        </button>
        <button
          onClick={onCancel}
          className="h-11 rounded-xl bg-secondary px-5 text-sm font-semibold"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}
