import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { claimRememberedInvite } from "@/lib/invites";

/** After sign-up through an invite link: tie the new account to the inviter (mutual follow) and say so. */
export function InviteClaimer() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    void claimRememberedInvite().then((r) => {
      if (r?.status !== "ok") return;
      toast.success(t("invite.claimed", { username: r.inviter_username }));
      void qc.invalidateQueries();
    });
  }, [user, t, qc]);
  return null;
}
