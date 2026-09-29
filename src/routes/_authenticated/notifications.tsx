import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { PersonRow, PillButton } from "@/components/friends/person-row";
import { acceptFriendRequest, friendKeys, listFriends, rpcErrorKey } from "@/lib/friends";
import { listNotifications, markAllRead, notificationKeys } from "@/lib/notifications";
import { timeAgo } from "@/lib/time-ago";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

/** Friend requests and acceptances; opening the page marks everything read. */
function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useQuery({ queryKey: notificationKeys.list, queryFn: listNotifications });
  const friends = useQuery({ queryKey: friendKeys.list, queryFn: listFriends });
  const incoming = new Set((friends.data ?? []).filter((p) => p.relation === "incoming").map((p) => p.id));

  const hasUnread = !!list.data?.some((n) => !n.read_at);
  useEffect(() => {
    if (!hasUnread) return;
    void markAllRead().then(() => qc.invalidateQueries({ queryKey: notificationKeys.unread }));
  }, [hasUnread, qc]);

  const accept = useMutation({
    mutationFn: (id: string) => acceptFriendRequest(id),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: friendKeys.all });
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  const items = (list.data ?? []).filter((n) => n.actor);
  return (
    <>
      <AppHeader back title={t("tabs.notifications")} />
      {list.data && !items.length && <EmptyState icon={Bell} text={t("notificationsPage.empty")} />}
      <ul className="px-4 pt-2">
        {items.map((n) => (
          <PersonRow
            key={n.id}
            person={n.actor!}
            subtitle={`${t(`notificationsPage.${n.kind}`)} · ${timeAgo(n.created_at, i18n.language)}`}
            onOpen={() => void navigate({ to: "/friends" })}
          >
            {n.kind === "friend_request" && incoming.has(n.actor!.id) && (
              <PillButton disabled={accept.isPending} onClick={() => accept.mutate(n.actor!.id)}>
                {t("friends.accept")}
              </PillButton>
            )}
            {!n.read_at && <span className="h-2.5 w-2.5 rounded-full bg-badge" aria-hidden />}
          </PersonRow>
        ))}
      </ul>
    </>
  );
}
