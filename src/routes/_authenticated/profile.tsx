import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Settings } from "lucide-react";
import { uploadAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { ProfileView } from "@/components/social/profile-view";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { updateSocialProfile } from "@/lib/api/social.functions";
import { SettingsSheet } from "@/components/settings-sheet";

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
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const profileQ = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "full_name, level, games_played, rating, photo_url, username, bio, is_private, discoverable",
        )
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
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
    mutationFn: async ({
      phone,
      username,
      bio,
      is_private,
      discoverable,
      ...patch
    }: EditValues) => {
      await updateSocialFn({ data: { username, bio, is_private, discoverable } });
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

  const p = profileQ.data;

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
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-10 flex-1 rounded-xl bg-secondary text-sm font-semibold transition hover:bg-muted"
            >
              {t("social.editProfile")}
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={t("settings.title")}
              className="grid h-10 w-10 place-items-center rounded-xl bg-secondary transition hover:bg-muted"
            >
              <Settings className="h-5 w-5" />
            </button>
          </>
        }
      />

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />

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
                  discoverable: p.discoverable,
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
    </div>
  );
}

type EditValues = {
  full_name: string;
  username: string;
  bio: string | null;
  is_private: boolean;
  discoverable: boolean;
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
      <label className="flex items-start justify-between gap-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/60">
        <span>
          <span className="block text-sm font-semibold">{t("social.discoverable")}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {t("social.discoverableHint")}
          </span>
        </span>
        <Switch checked={v.discoverable} onCheckedChange={(c) => set("discoverable", c)} />
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
