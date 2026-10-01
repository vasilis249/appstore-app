import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { PersonRow } from "@/components/friends/person-row";
import { useAuth } from "@/hooks/use-auth";
import { rpcErrorKey } from "@/lib/friends";
import { groupKeys, groupMembers, removeMember, setGroupRole, type GroupMember, type GroupRole } from "@/lib/groups";

/** Members, owner and admins first; admins get ⋯ per person (roles are the owner's; removing is the admins'). */
export function MembersList({ groupId, myRole }: { groupId: string; myRole: GroupRole | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const list = useQuery({ queryKey: groupKeys.members(groupId), queryFn: () => groupMembers(groupId) });
  const [target, setTarget] = useState<GroupMember | null>(null);
  const canManage = (m: GroupMember) =>
    m.user_id !== user?.id && m.role !== "owner" && (myRole === "owner" || (myRole === "admin" && m.role === "member"));

  return (
    <>
      <ul className="px-4 pb-28">
        {(list.data ?? []).map((m) => (
          <PersonRow
            key={m.user_id}
            person={m}
            subtitle={m.role !== "member" ? t(`groups.role.${m.role}`) : undefined}
            onOpen={() => void navigate({ to: "/u/$username", params: { username: m.username } })}
          >
            {canManage(m) && (
              <button type="button" onClick={() => setTarget(m)} aria-label={t("friends.actions")} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            )}
          </PersonRow>
        ))}
      </ul>
      <MemberSheet groupId={groupId} member={target} myRole={myRole} onClose={() => setTarget(null)} />
    </>
  );
}

function MemberSheet({ groupId, member, myRole, onClose }: { groupId: string; member: GroupMember | null; myRole: GroupRole | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<"owner" | "remove" | null>(null);
  const run = useMutation({
    mutationFn: async (a: "admin" | "member" | "owner" | "remove") =>
      a === "remove" ? removeMember(groupId, member!.user_id) : setGroupRole(groupId, member!.user_id, a),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.all });
      setConfirm(null);
      onClose();
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  const row = "flex w-full items-center px-4 py-3.5 text-body font-normal disabled:opacity-50";
  const name = member ? member.full_name || member.username : "";

  return (
    <Drawer open={!!member} onOpenChange={(o) => !o && (setConfirm(null), onClose())}>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerTitle className="pt-4 text-center text-body font-semibold">{name}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("friends.actions")}</DrawerDescription>
        <div className="safe-bottom p-4">
          {confirm ? (
            <div className="space-y-3 text-center">
              <p className="px-4 text-caption text-muted-foreground">
                {t(confirm === "owner" ? "groups.makeOwnerConfirm" : "groups.removeConfirm", { name })}
              </p>
              <button
                type="button"
                disabled={run.isPending}
                onClick={() => run.mutate(confirm)}
                className="h-12 w-full rounded-xl bg-destructive font-semibold text-destructive-foreground disabled:opacity-50"
              >
                {t(confirm === "owner" ? "groups.makeOwner" : "groups.remove")}
              </button>
              <button type="button" onClick={() => setConfirm(null)} className="h-12 w-full rounded-xl bg-secondary font-semibold">
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-2xl bg-group">
              {myRole === "owner" && member?.role === "member" && (
                <button type="button" disabled={run.isPending} className={row} onClick={() => run.mutate("admin")}>
                  {t("groups.makeAdmin")}
                </button>
              )}
              {myRole === "owner" && member?.role === "admin" && (
                <button type="button" disabled={run.isPending} className={row} onClick={() => run.mutate("member")}>
                  {t("groups.removeAdmin")}
                </button>
              )}
              {myRole === "owner" && (
                <button type="button" className={row} onClick={() => setConfirm("owner")}>
                  {t("groups.makeOwner")}
                </button>
              )}
              <button type="button" className={`${row} text-destructive`} onClick={() => setConfirm("remove")}>
                {t("groups.remove")}
              </button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
