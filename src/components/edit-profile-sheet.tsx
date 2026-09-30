import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { UserAvatar } from "@/components/user-avatar";
import { supabase } from "@/integrations/supabase/client";
import { uploadAvatar } from "@/lib/avatar";
import { friendKeys, rpcErrorKey } from "@/lib/friends";
import { postKeys } from "@/lib/posts";
import type { MyProfile } from "@/hooks/use-my-profile";

const USERNAME_RE = /^[a-z0-9._]{3,20}$/;

/** Photo, name + username (people find you by username). */
export function EditProfileSheet({
  profile,
  open,
  onOpenChange,
}: {
  profile: MyProfile;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(profile.full_name);
  const [username, setUsername] = useState(profile.username);
  useEffect(() => {
    if (open) {
      setFullName(profile.full_name);
      setUsername(profile.username);
    }
  }, [open, profile]);

  // The photo is saved as soon as it is picked (iOS offers camera or library); the old file is removed.
  const fileRef = useRef<HTMLInputElement>(null);
  const photo = useMutation({
    mutationFn: async (file: File) => {
      await uploadAvatar(profile.id, file);
      if (profile.avatar_path) await supabase.storage.from("avatars").remove([profile.avatar_path]);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: friendKeys.me });
      void qc.invalidateQueries({ queryKey: friendKeys.all });
      void qc.invalidateQueries({ queryKey: postKeys.all });
      toast.success(t("profile.photoSaved"));
    },
    onError: (e) => toast.error(e instanceof Error && /[α-ω]/i.test(e.message) ? e.message : t(rpcErrorKey(e))),
  });

  const valid = USERNAME_RE.test(username) && fullName.trim().length <= 60;
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), username })
        .eq("id", profile.id);
      if (error) throw new Error(`${error.message} ${error.details ?? ""}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: friendKeys.me });
      onOpenChange(false);
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  const input = "h-12 w-full rounded-2xl bg-secondary px-4 text-body outline-none placeholder:text-muted-foreground";
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerTitle className="pt-4 text-center text-body font-semibold">{t("profile.edit")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("profile.edit")}</DrawerDescription>
        <form
          className="safe-bottom space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) save.mutate();
          }}
        >
          <div className="flex flex-col items-center gap-2 pb-1">
            <UserAvatar name={profile.full_name || profile.username} path={profile.avatar_path} size={72} />
            <button
              type="button"
              disabled={photo.isPending}
              onClick={() => fileRef.current?.click()}
              className="h-9 rounded-full bg-secondary px-4 text-caption font-semibold disabled:opacity-50"
            >
              {photo.isPending ? "…" : t("profile.photo")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) photo.mutate(f);
              }}
            />
          </div>
          <label className="block">
            <span className="mb-1 block text-fine text-muted-foreground">{t("profile.fullName")}</span>
            <input value={fullName} maxLength={60} onChange={(e) => setFullName(e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-fine text-muted-foreground">{t("profile.username")}</span>
            <input
              value={username}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
              className={input}
            />
            <span className="mt-1 block text-fine text-muted-foreground">{t("profile.usernameHint")}</span>
          </label>
          <button
            type="submit"
            disabled={!valid || save.isPending}
            className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t("common.save")}
          </button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
