import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { PersonRow } from "@/components/friends/person-row";
import { FollowButton } from "@/components/friends/follow-button";
import { useAuth } from "@/hooks/use-auth";
import { followList, friendKeys } from "@/lib/friends";
import { cn } from "@/lib/utils";

export type FollowTab = "followers" | "following";

/** Followers / Following of a user, with Follow buttons. */
export function FollowListSheet({
  userId,
  tab,
  onTab,
  onOpenChange,
}: {
  userId: string;
  tab: FollowTab | null;
  onTab: (t: FollowTab) => void;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const list = useQuery({
    queryKey: friendKeys.list(userId, tab ?? "followers"),
    queryFn: () => followList(userId, tab!),
    enabled: !!tab,
  });
  const seg = "flex-1 rounded-full py-2 text-sm font-semibold";
  return (
    <Drawer open={!!tab} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto h-[80vh] max-w-lg rounded-t-[28px] border-0 bg-surface-elevated">
        <DrawerTitle className="sr-only">{t(tab === "following" ? "people.followingCount" : "people.followers")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t(tab === "following" ? "people.followingCount" : "people.followers")}</DrawerDescription>
        <div className="mx-4 mt-3 flex rounded-full bg-secondary p-1">
          {(["followers", "following"] as const).map((k) => (
            <button key={k} type="button" onClick={() => onTab(k)} className={cn(seg, tab === k ? "bg-secondary" : "text-foreground/80")}>
              {t(k === "following" ? "people.followingCount" : "people.followers")}
            </button>
          ))}
        </div>
        <ul className="safe-bottom flex-1 overflow-y-auto px-4 py-2">
          {list.data && !list.data.length && <p className="py-12 text-center text-sm text-muted-foreground">{t("people.nobody")}</p>}
          {(list.data ?? []).map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              onOpen={() => {
                onOpenChange(false);
                void navigate({ to: "/u/$username", params: { username: p.username } });
              }}
            >
              {p.id !== user?.id && <FollowButton userId={p.id} following={!!p.i_follow} followsMe={p.follows_me} />}
            </PersonRow>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
