import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { groupKeys, joinGroup, leaveGroup, type GroupDetail } from "@/lib/groups";
import { rpcErrorKey } from "@/lib/friends";
import { postKeys } from "@/lib/posts";
import { cn } from "@/lib/utils";
import { VoiceIcon } from "@/components/voice/voice-icon";

const pill = "flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold active:opacity-80 disabled:opacity-50";

/**
 * The group's main action for you: Join (public) · Ask to join (private) · Request sent (tap twice to cancel) ·
 * Accept / Decline an invite · members: Speak + Invite.
 */
export function GroupActions({ group, onInvite }: { group: GroupDetail; onInvite: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: groupKeys.all });
    void qc.invalidateQueries({ queryKey: postKeys.all });
  };
  const join = useMutation({
    mutationFn: () => joinGroup(group.id),
    onSuccess: (r) => {
      toast.success(t(r === "joined" ? "groups.joined" : "groups.requested"));
      refresh();
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  const leave = useMutation({
    mutationFn: () => leaveGroup(group.id),
    onSuccess: () => {
      setConfirmCancel(false);
      refresh();
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  const busy = join.isPending || leave.isPending;

  if (group.my_role)
    return (
      <div className="flex gap-2">
        <Link to="/record" search={{ group: group.id }} className={cn(pill, "bg-primary text-primary-foreground")}>
          <VoiceIcon className="h-4 w-4" /> {t("groups.speak")}
        </Link>
        {!group.auto && (
          <button type="button" onClick={onInvite} className={cn(pill, "bg-secondary")}>
            <UserPlus className="h-4 w-4" /> {t("groups.invite")}
          </button>
        )}
      </div>
    );

  // School / year groups: students of it get in (again) at once; for anyone else the page's lock says why.
  if (group.auto)
    return group.can_join ? (
      <button type="button" disabled={busy} onClick={() => join.mutate()} className={cn(pill, "w-full bg-primary text-primary-foreground")}>
        {t("groups.join")}
      </button>
    ) : null;

  if (group.my_pending === "invite")
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("groups.invitedBy", { name: group.invited_by_name ?? "" })}</p>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => join.mutate()} className={cn(pill, "bg-primary text-primary-foreground")}>
            {t("groups.accept")}
          </button>
          <button type="button" disabled={busy} onClick={() => leave.mutate()} className={cn(pill, "bg-secondary")}>
            {t("groups.decline")}
          </button>
        </div>
      </div>
    );

  if (group.my_pending === "request")
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => (confirmCancel ? leave.mutate() : setConfirmCancel(true))}
        className={cn(pill, "w-full", confirmCancel ? "bg-destructive text-white" : "bg-secondary")}
      >
        {t(confirmCancel ? "groups.cancelRequest" : "groups.requestSent")}
      </button>
    );

  return (
    <button type="button" disabled={busy} onClick={() => join.mutate()} className={cn(pill, "w-full bg-primary text-primary-foreground")}>
      {t(group.privacy === "public" ? "groups.join" : "groups.askToJoin")}
    </button>
  );
}
