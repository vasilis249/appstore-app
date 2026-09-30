import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { PersonRow } from "@/components/friends/person-row";
import { useAuth } from "@/hooks/use-auth";
import { friendKeys, mutualFollows, rpcErrorKey } from "@/lib/friends";
import { groupKeys, groupMembers, inviteToGroup } from "@/lib/groups";

/** Invite friends (people you follow who follow you back) who aren't in the group yet. */
export function InviteSheet({ groupId, open, onOpenChange }: { groupId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [sent, setSent] = useState<Set<string>>(new Set());
  const friends = useQuery({ queryKey: [...friendKeys.all, "mutual"], queryFn: () => mutualFollows(user!.id), enabled: open && !!user });
  const members = useQuery({ queryKey: groupKeys.members(groupId), queryFn: () => groupMembers(groupId), enabled: open });
  const inGroup = new Set((members.data ?? []).map((m) => m.user_id));
  const list = (friends.data ?? []).filter((f) => !inGroup.has(f.id));

  const invite = useMutation({
    mutationFn: (id: string) => inviteToGroup(groupId, id),
    onSuccess: (_, id) => {
      setSent((s) => new Set(s).add(id));
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[80vh] max-w-lg">
        <DrawerTitle className="pt-4 text-center text-body font-semibold">{t("groups.inviteFriends")}</DrawerTitle>
        <DrawerDescription className="px-6 pt-1 text-center text-caption text-muted-foreground">{t("groups.inviteHint")}</DrawerDescription>
        <ul className="safe-bottom overflow-y-auto px-4 pb-4">
          {list.map((p) => (
            <PersonRow key={p.id} person={p}>
              <button
                type="button"
                disabled={sent.has(p.id) || invite.isPending}
                onClick={() => invite.mutate(p.id)}
                className="h-9 rounded-full bg-primary px-4 text-caption font-semibold text-primary-foreground disabled:bg-secondary disabled:text-muted-foreground"
              >
                {t(sent.has(p.id) ? "groups.invited" : "groups.invite")}
              </button>
            </PersonRow>
          ))}
          {friends.data && members.data && !list.length && (
            <p className="py-10 text-center text-caption text-muted-foreground">{t("groups.noFriendsToInvite")}</p>
          )}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
