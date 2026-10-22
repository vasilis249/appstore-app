import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bell, Download, FileText, Flag, HandHeart, Heart, MapPin, MessageCircle, RadioTower, Repeat2, UserPlus, Users } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FollowButton } from "@/components/friends/follow-button";
import { UserAvatar } from "@/components/user-avatar";
import { friendKeys, followList } from "@/lib/friends";
import { useAuth } from "@/hooks/use-auth";
import { listNotifications, markAllRead, notificationKeys, type AppNotification } from "@/lib/notifications";
import { timeAgo } from "@/lib/time-ago";
import { FEATURES } from "@/lib/features";
import { enablePush, pushPermission } from "@/lib/push";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

const ICON = { follow: UserPlus, like: Heart, reply: MessageCircle, repost: Repeat2, group_invite: Users, group_request: Users, group_accepted: Users, group_joined: Users, invite_joined: UserPlus, walkie: RadioTower, nearby: MapPin, file_thanks: HandHeart, files_helped: Download, course_file: FileText } as const;
const COLOR = { follow: "text-link", like: "text-live", reply: "text-foreground", repost: "text-success", group_invite: "text-live", group_request: "text-live", group_accepted: "text-live", group_joined: "text-live", invite_joined: "text-success", walkie: "text-live", nearby: "text-live", file_thanks: "text-live", files_helped: "text-link", course_file: "text-link" } as const;

/** New followers, likes, replies and reposts (admins also: reports to review); opening the page marks everything read. */
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
    if (n.kind === "walkie" && n.actor)
      void (FEATURES.walkie ? navigate({ to: "/talk/$userId", params: { userId: n.actor.id } }) : navigate({ to: "/messages/$userId", params: { userId: n.actor.id } }));
    else if (n.kind === "nearby" && n.actor) void navigate({ to: "/map", search: { u: n.actor.id } });
    else if (n.kind === "files_helped") void navigate({ to: "/profile" });
    else if (n.course_id) void navigate({ to: "/c/$courseId", params: { courseId: n.course_id } });
    else if (n.group_id) void navigate({ to: "/g/$groupId", params: { groupId: n.group_id } });
    else if (n.post_id) void navigate({ to: "/p/$postId", params: { postId: n.post_id } });
    else if (n.actor) void navigate({ to: "/u/$username", params: { username: n.actor.username } });
  }

  const text = (n: AppNotification) => {
    const vars = { group: n.group?.name ?? "", course: n.course?.name ?? "", file: n.file?.title ?? "", count: n.count ?? 1, others: (n.count ?? 1) - 1 };
    if (n.kind === "files_helped" && (n.count ?? 1) > 1) return t("notificationsPage.files_helped_many", vars);
    if (n.kind === "course_file" && (n.count ?? 1) > 1) return t("notificationsPage.course_file_many", vars);
    return t(`notificationsPage.${n.kind}`, vars);
  };
  const items = (list.data ?? []).filter((n) => n.actor && n.kind !== "report");
  // Admins: one row for the report queue (who reported stays on the review screen).
  const report = list.data?.find((n) => n.kind === "report");
  return (
    <>
      <AppHeader back title={t("tabs.notifications")} />
      <PushCard />
      {list.data && !items.length && !report && <EmptyState icon={Bell} text={t("notificationsPage.empty")} />}
      <ul>
        {report && (
          <li className="border-b border-border">
            <Link to="/admin/reports" className="flex items-center gap-3 px-4 py-3">
              <Flag className="h-5 w-5 shrink-0 text-live" />
              <p className="min-w-0 flex-1 text-caption font-semibold">
                {t("notificationsPage.report")}
                <span className="font-normal text-muted-foreground"> · {timeAgo(report.created_at, i18n.language)}</span>
              </p>
              {!report.read_at && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-badge" aria-hidden />}
            </Link>
          </li>
        )}
        {items.map((n) => {
          const Icon = ICON[n.kind as keyof typeof ICON];
          if (!Icon) return null;
          const a = n.actor!;
          return (
            <li key={n.id} className="flex items-center gap-3 border-b border-border px-4 py-3">
              <button type="button" onClick={() => open(n)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="relative shrink-0">
                  <UserAvatar name={a.full_name || a.username} path={a.avatar_path} size={44} />
                  <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-background">
                    <Icon className={`h-4 w-4 ${COLOR[n.kind as keyof typeof COLOR]}`} fill={n.kind === "like" ? "currentColor" : "none"} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-callout">
                    <span className="font-semibold">{a.full_name || a.username}</span> {text(n)}
                    <span className="text-muted-foreground"> · {timeAgo(n.created_at, i18n.language)}</span>
                  </span>
                  {n.post?.title && <span className="mt-0.5 block truncate text-caption text-muted-foreground">{n.post.title}</span>}
                </span>
              </button>
              {n.kind === "follow" && following.data && !iFollow.has(a.id) && (
                <FollowButton userId={a.id} following={false} followsMe />
              )}
              {!n.read_at && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-badge" aria-hidden />}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** In the app, until notifications are allowed (or refused): one tap shows the iOS dialog. */
function PushCard() {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const perm = useQuery({ queryKey: ["push", "permission"], queryFn: pushPermission });
  if (done || perm.data !== "prompt") return null;
  return (
    <div className="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
      <Bell className="h-6 w-6 shrink-0 text-link" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t("notificationsPage.pushTitle")}</span>
        <span className="block text-caption text-muted-foreground">{t("notificationsPage.pushText")}</span>
      </span>
      <button
        type="button"
        onClick={() => void enablePush(true).finally(() => setDone(true))}
        className="h-9 shrink-0 rounded-full bg-primary px-4 text-caption font-semibold text-primary-foreground"
      >
        {t("notificationsPage.pushOn")}
      </button>
    </div>
  );
}
