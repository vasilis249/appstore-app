import { useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { AtSign, Bell, CalendarCheck, Heart, MessageCircle, Trophy, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { UserAvatar } from "@/components/social/user-avatar";
import { FollowButton } from "@/components/social/follow-button";
import { timeAgo } from "@/lib/time-ago";
import { acceptFollowRequest, removeFollower } from "@/lib/api/social.functions";
import { getPostThumbs } from "@/lib/api/posts.functions";
import {
  listMyNotifications,
  markNotificationsRead,
  type NotificationRow,
} from "@/lib/api/owner-management.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Δραστηριότητα — Courtsie" }] }),
  component: NotificationsPage,
});

type Actor = {
  user_id: string;
  username: string;
  full_name: string | null;
  photo_url: string | null;
  following?: "none" | "pending" | "accepted";
};

type Group = { n: NotificationRow; actorIds: string[]; unread: boolean };

const dataOf = (n: NotificationRow) => (n.data ?? {}) as Record<string, string | undefined>;

/** Likes on the same post collapse into one row ("maria and 2 others liked…"), like Instagram. */
function groupNotifications(items: NotificationRow[]): Group[] {
  const groups: Group[] = [];
  const byPost = new Map<string, Group>();
  for (const n of items) {
    const d = dataOf(n);
    const existing = n.type === "post_like" && d.post_id ? byPost.get(d.post_id) : undefined;
    if (existing) {
      if (d.user_id && !existing.actorIds.includes(d.user_id)) existing.actorIds.push(d.user_id);
      existing.unread ||= !n.read_at;
      continue;
    }
    const g: Group = { n, actorIds: d.user_id ? [d.user_id] : [], unread: !n.read_at };
    if (n.type === "post_like" && d.post_id) byPost.set(d.post_id, g);
    groups.push(g);
  }
  return groups;
}

const SOCIAL_ICON: Record<string, typeof Heart> = {
  post_like: Heart,
  post_comment: MessageCircle,
  mention: AtSign,
  new_follower: UserPlus,
  follow_request: UserPlus,
  follow_accepted: UserPlus,
};

function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";
  const qc = useQueryClient();
  const { user } = useAuth();
  const listFn = useServerFn(listMyNotifications);
  const markFn = useServerFn(markNotificationsRead);
  const thumbsFn = useServerFn(getPostThumbs);

  // Same cache entry as the bell, so its badge clears too.
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => listFn() });
  const items = useMemo(() => q.data ?? [], [q.data]);
  const groups = useMemo(() => groupNotifications(items), [items]);

  const actorIds = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((n) => (n.data as Record<string, unknown> | null)?.user_id)
            .filter((x): x is string => typeof x === "string"),
        ),
      ),
    [items],
  );
  const actorsQ = useQuery({
    queryKey: ["notification-actors", actorIds],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const [{ data }, { data: follows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id,username,full_name,photo_url")
          .in("user_id", actorIds),
        supabase
          .from("follows")
          .select("following_id,status")
          .eq("follower_id", user!.id)
          .in("following_id", actorIds),
      ]);
      const following = new Map(
        (follows ?? []).map((f) => [f.following_id, f.status as "pending" | "accepted"]),
      );
      return new Map(
        (data ?? []).map((p) => [
          p.user_id,
          { ...p, following: following.get(p.user_id) ?? "none" } as Actor,
        ]),
      );
    },
  });

  const postIds = useMemo(
    () =>
      Array.from(
        new Set(items.map((n) => dataOf(n).post_id).filter((x): x is string => !!x)),
      ).slice(0, 100),
    [items],
  );
  const thumbsQ = useQuery({
    queryKey: ["notification-thumbs", postIds],
    enabled: postIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () => thumbsFn({ data: { ids: postIds } }),
  });

  const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
  useEffect(() => {
    if (!unreadIds.length) return;
    const timer = setTimeout(() => {
      void markFn({ data: { ids: unreadIds } }).then(() =>
        qc.invalidateQueries({ queryKey: ["notifications"] }),
      );
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIds.join(",")]);

  if (q.isLoading)
    return <p className="py-16 text-center text-sm text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-5">
      <h1 className="mb-4 font-display text-2xl font-bold">{t("activity.title")}</h1>
      {!items.length ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Bell className="h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">{t("activity.empty")}</p>
        </div>
      ) : (
        <ul className="space-y-1">
          {groups.map((g) => {
            const postId = dataOf(g.n).post_id;
            return (
              <NotificationItem
                key={g.n.id}
                group={g}
                actor={actorsQ.data?.get(g.actorIds[0] ?? "")}
                thumb={
                  postId && thumbsQ.data && postId in thumbsQ.data
                    ? thumbsQ.data[postId]
                    : undefined
                }
                locale={locale}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NotificationItem({
  group,
  actor,
  thumb,
  locale,
}: {
  group: Group;
  actor: Actor | undefined;
  /** Post thumbnail; null = post without photo (match card); undefined = no post / not loaded. */
  thumb: string | null | undefined;
  locale: string;
}) {
  const n = group.n;
  const { t } = useTranslation();
  const qc = useQueryClient();
  const acceptFn = useServerFn(acceptFollowRequest);
  const declineFn = useServerFn(removeFollower);
  const d = dataOf(n);
  const others = group.actorIds.length - 1;
  const text =
    others > 0 && actor
      ? t("activity.likedMany", { name: actor.username, count: others })
      : (n.body ?? n.title);
  const Icon = SOCIAL_ICON[n.type] ?? CalendarCheck;

  async function respond(ok: boolean) {
    if (!d.user_id) return;
    await (ok ? acceptFn : declineFn)({ data: { userId: d.user_id } });
    void qc.invalidateQueries({ queryKey: ["social-profile"] });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  const target = d.post_id
    ? { to: "/p/$postId", params: { postId: d.post_id } }
    : actor
      ? { to: "/u/$username", params: { username: actor.username } }
      : d.booking_id
        ? { to: "/booking/$bookingId", params: { bookingId: d.booking_id } }
        : null;

  const body = (
    <>
      {actor ? (
        <UserAvatar name={actor.full_name ?? actor.username} photoUrl={actor.photo_url} size={44} />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1 text-sm">
        <span className="line-clamp-2">
          {text} <span className="text-muted-foreground">{timeAgo(n.created_at, locale)}</span>
        </span>
      </span>
    </>
  );

  return (
    <li
      className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${group.unread ? "bg-primary/5" : ""}`}
    >
      {target ? (
        <Link
          to={target.to}
          params={target.params as never}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {n.type === "follow_request" && d.user_id ? (
        <span className="flex gap-1.5">
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
      ) : n.type === "new_follower" && d.user_id ? (
        <FollowButton userId={d.user_id} state={actor?.following ?? "none"} followsMe size="sm" />
      ) : d.post_id && thumb !== undefined && target ? (
        <Link
          to={target.to}
          params={target.params as never}
          className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted"
        >
          {thumb ? (
            <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center bg-gradient-to-br from-primary to-coral text-primary-foreground">
              <Trophy className="h-4 w-4" />
            </span>
          )}
        </Link>
      ) : null}
    </li>
  );
}
