import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { friendKeys, rpcErrorKey } from "@/lib/friends";
import type { MyProfile } from "@/hooks/use-my-profile";

const USERNAME_RE = /^[a-z0-9._]{3,20}$/;

/** Name + username (friends find you by username). */
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

  const input = "h-12 w-full rounded-2xl bg-secondary px-4 text-base outline-none placeholder:text-muted-foreground";
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg rounded-t-[28px] border-0 bg-surface-elevated">
        <DrawerTitle className="pt-4 text-center text-lg font-bold">{t("profile.edit")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("profile.edit")}</DrawerDescription>
        <form
          className="safe-bottom space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) save.mutate();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">{t("profile.fullName")}</span>
            <input value={fullName} maxLength={60} onChange={(e) => setFullName(e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">{t("profile.username")}</span>
            <input
              value={username}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
              className={input}
            />
            <span className="mt-1 block text-xs text-muted-foreground">{t("profile.usernameHint")}</span>
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
