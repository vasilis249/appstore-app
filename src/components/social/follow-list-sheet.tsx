import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { UserAvatar } from "@/components/social/user-avatar";
import { FollowButton } from "@/components/social/follow-button";
import { cn } from "@/lib/utils";
import {
  acceptFollowRequest,
  listFollowers,
  listFollowing,
  listFollowRequests,
  removeFollower,
  type ProfileListItem,
} from "@/lib/api/social.functions";

export type FollowTab = "followers" | "following" | "requests";

export function FollowListSheet({
  userId,
  meId,
  tab,
  onTabChange,
  onClose,
  showRequests,
}: {
  userId: string;
  meId: string | undefined;
  tab: FollowTab | null;
  onTabChange: (t: FollowTab) => void;
  onClose: () => void;
  showRequests: boolean;
}) {
  const { t } = useTranslation();
  const followersFn = useServerFn(listFollowers);
  const followingFn = useServerFn(listFollowing);
  const requestsFn = useServerFn(listFollowRequests);

  const listQ = useQuery({
    queryKey: ["follow-list", userId, tab],
    enabled: !!tab,
    queryFn: () =>
      tab === "followers"
        ? followersFn({ data: { userId } })
        : tab === "following"
          ? followingFn({ data: { userId } })
          : requestsFn(),
  });

  const tabs: FollowTab[] = showRequests
    ? ["followers", "following", "requests"]
    : ["followers", "following"];

  return (
    <Drawer open={!!tab} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="mx-auto h-[80vh] max-w-lg rounded-t-[28px] border-0 bg-background">
        <DrawerTitle className="sr-only">{tab ? t(`social.${tab}`) : ""}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("social.listDescription")}</DrawerDescription>
        <div className="flex border-b border-border px-4 pt-3">
          {tabs.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => onTabChange(x)}
              className={cn(
                "flex-1 border-b-2 pb-3 text-sm font-semibold transition",
                tab === x
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {t(`social.${x}`)}
            </button>
          ))}
        </div>
        <div className="safe-bottom flex-1 overflow-y-auto px-4 py-3">
          {listQ.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : !listQ.data?.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {tab === "requests"
                ? t("social.noRequests")
                : tab === "followers"
                  ? t("social.noFollowers")
                  : t("social.noFollowing")}
            </p>
          ) : (
            <ul className="space-y-1">
              {listQ.data.map((p) => (
                <PersonRow
                  key={p.user_id}
                  person={p}
                  meId={meId}
                  isRequest={tab === "requests"}
                  // Everyone in your own followers list already follows you.
                  followsMe={tab === "followers" && userId === meId}
                  onNavigate={onClose}
                />
              ))}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function PersonRow({
  person,
  meId,
  isRequest,
  followsMe,
  onNavigate,
}: {
  person: ProfileListItem;
  meId: string | undefined;
  isRequest: boolean;
  followsMe: boolean;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const accept = useServerFn(acceptFollowRequest);
  const decline = useServerFn(removeFollower);

  async function respond(ok: boolean) {
    try {
      await (ok ? accept : decline)({ data: { userId: person.user_id } });
      void qc.invalidateQueries({ queryKey: ["follow-list"] });
      void qc.invalidateQueries({ queryKey: ["social-profile"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-2xl px-1 py-2">
      <Link
        to="/u/$username"
        params={{ username: person.username }}
        onClick={onNavigate}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <UserAvatar
          name={person.full_name ?? person.username}
          photoUrl={person.photo_url}
          size={44}
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{person.username}</span>
          <span className="block truncate text-xs text-muted-foreground">{person.full_name}</span>
        </span>
      </Link>
      {isRequest ? (
        <span className="flex gap-2">
          <button
            type="button"
            onClick={() => respond(true)}
            className="h-8 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"
          >
            {t("social.accept")}
          </button>
          <button
            type="button"
            onClick={() => respond(false)}
            className="h-8 rounded-xl bg-secondary px-3 text-xs font-semibold"
          >
            {t("social.decline")}
          </button>
        </span>
      ) : (
        person.user_id !== meId && (
          <FollowButton
            userId={person.user_id}
            state={person.following}
            followsMe={followsMe}
            size="sm"
          />
        )
      )}
    </li>
  );
}
