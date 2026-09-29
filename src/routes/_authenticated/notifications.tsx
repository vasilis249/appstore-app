import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bell, Heart, MessageCircle, Repeat2, UserPlus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FollowButton } from "@/components/friends/follow-button";
import { UserAvatar } from "@/components/user-avatar";
import { friendKeys, followList } from "@/lib/friends";
import { useAuth } from "@/hooks/use-auth";
import { listNotifications, markAllRead, notificationKeys, type AppNotification } from "@/lib/notifications";
import { timeAgo } from "@/lib/time-ago";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

const ICON = { follow: UserPlus, like: Heart, reply: MessageCircle, repost: Repeat2 } as const;
const COLOR = { follow: "text-sky-400", like: "text-rose-500", reply: "text-foreground", repost: "text-emerald-400" } as const;

/** New followers, likes, replies and reposts; opening the page marks everything read. */
function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const list = useQuery({ queryKey: notificationKeys.list, queryFn: listNotifications });
  const following = useQuery({
    queryKey: friendKeys.list(user?.id ?? "", "following"),
    queryFn: () => followList(user!.id, "following"),
    enabled: !!user,
  });
  const iFollow = new Set((following.data ?? []).map((p) => p.id));

  const hasUnread = !!list.data?.some((n) => !n.read_at);
  useEffect(() => {
    if (!hasUnread) return;
    void markAllRead().then(() => qc.invalidateQueries({ queryKey: notificationKeys.unread }));
  }, [hasUnread, qc]);

  function open(n: AppNotification) {
    if (n.post_id) void navigate({ to: "/p/$postId", params: { postId: n.post_id } });
    else if (n.actor) void navigate({ to: "/u/$username", params: { username: n.actor.username } });
  }

  const items = (list.data ?? []).filter((n) => n.actor);
  return (
    <>
      <AppHeader back title={t("tabs.notifications")} />
      {list.data && !items.length && <EmptyState icon={Bell} text={t("notificationsPage.empty")} />}
      <ul>
        {items.map((n) => {
          const Icon = ICON[n.kind];
          const a = n.actor!;
          return (
            <li key={n.id} className="flex items-start gap-3 border-b border-border px-4 py-3">
              <Icon className={`mt-1 h-5 w-5 shrink-0 ${COLOR[n.kind]}`} fill={n.kind === "like" ? "currentColor" : "none"} />
              <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                <UserAvatar name={a.full_name || a.username} path={a.avatar_path} size={32} />
                <p className="mt-1.5 text-sm">
                  <span className="font-semibold">{a.full_name || a.username}</span> {t(`notificationsPage.${n.kind}`)}
                  <span className="text-muted-foreground"> · {timeAgo(n.created_at, i18n.language)}</span>
                </p>
                {n.post?.title && <p className="mt-0.5 truncate text-sm text-muted-foreground">{n.post.title}</p>}
              </button>
              {n.kind === "follow" && following.data && !iFollow.has(a.id) && (
                <FollowButton userId={a.id} following={false} followsMe />
              )}
              {!n.read_at && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-badge" aria-hidden />}
            </li>
          );
        })}
      </ul>
    </>
  );
}
