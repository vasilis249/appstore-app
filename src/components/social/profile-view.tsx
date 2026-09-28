import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Grid3x3, Heart, Lock, MessageCircle, Star, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StarRating } from "@/components/star-rating";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { UserAvatar } from "@/components/social/user-avatar";
import { FollowButton } from "@/components/social/follow-button";
import { FollowListSheet, type FollowTab } from "@/components/social/follow-list-sheet";
import { getProfile, listProfilePosts, type ProfilePage } from "@/lib/api/social.functions";

/**
 * Instagram-style profile: avatar + counts (posts, followers, following, matches),
 * name / @username / bio, follow or edit actions, matches per sport and the post grid.
 * `username` "me" shows the signed-in user.
 */
export function ProfileView({
  username,
  ownActions,
  avatarOverlay,
}: {
  username: string;
  /** Buttons shown instead of Follow on your own profile (e.g. Edit profile). */
  ownActions?: ReactNode;
  /** Extra element over the avatar (e.g. change-photo button on your own profile). */
  avatarOverlay?: ReactNode;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const getProfileFn = useServerFn(getProfile);
  const [sheet, setSheet] = useState<FollowTab | null>(null);
  const [tab, setTab] = useState<"posts" | "reviews">("posts");

  const q = useQuery({
    queryKey: ["social-profile", username],
    queryFn: () => getProfileFn({ data: { username } }),
    retry: false,
  });

  if (q.isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (q.error || !q.data) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">{t("social.notFound")}</p>
    );
  }

  const { profile, counts, matchesBySport, relation, pendingRequests } = q.data;
  const name = profile.full_name ?? profile.username;

  return (
    <div>
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <UserAvatar name={name} photoUrl={profile.photo_url} size={88} />
          {avatarOverlay}
        </div>
        <div className="grid flex-1 grid-cols-4 gap-1 text-center">
          <Count value={counts.posts} label={t("social.posts")} />
          <Count
            value={counts.followers}
            label={t("social.followers")}
            onClick={relation.canView ? () => setSheet("followers") : undefined}
          />
          <Count
            value={counts.following}
            label={t("social.following")}
            onClick={relation.canView ? () => setSheet("following") : undefined}
          />
          <Count value={counts.matches} label={t("social.matches")} highlight />
        </div>
      </div>

      <div className="mt-4">
        <h1 className="flex items-center gap-1.5 font-display text-lg font-bold leading-tight">
          {name}
          {profile.is_private && (
            <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label={t("social.private")} />
          )}
        </h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span>@{profile.username}</span>
          {profile.level && <span>· {t(`levels.${profile.level}`, profile.level)}</span>}
          {profile.rating != null && Number(profile.rating) > 0 && (
            <span className="inline-flex items-center gap-1">
              · <Star className="h-3.5 w-3.5 fill-optic text-optic" />{" "}
              {Number(profile.rating).toFixed(1)}
            </span>
          )}
          {relation.followsMe && !relation.isMe && (
            <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium">
              {t("social.followsYou")}
            </span>
          )}
        </p>
        {profile.bio && (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{profile.bio}</p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {relation.isMe ? (
          <>
            {ownActions}
            {pendingRequests > 0 && (
              <button
                type="button"
                onClick={() => setSheet("requests")}
                className="h-10 rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary"
              >
                {t("social.requestsCount", { count: pendingRequests })}
              </button>
            )}
          </>
        ) : (
          <FollowButton
            key={relation.following}
            userId={profile.user_id}
            state={relation.following}
            followsMe={relation.followsMe}
            className="flex-1"
          />
        )}
      </div>

      {matchesBySport.length > 0 && <MatchStrip data={q.data} />}

      <div className="mt-6 flex border-b border-border">
        {(
          [
            ["posts", Grid3x3, t("social.posts")],
            ["reviews", Star, t("profile.reviews")],
          ] as const
        ).map(([key, Icon, label]) => (
          <button
            key={key}
            type="button"
            aria-label={label}
            onClick={() => setTab(key)}
            className={cn(
              "flex flex-1 justify-center border-b-2 pb-3 transition",
              tab === key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
      </div>

      {!relation.canView ? (
        <div className="flex flex-col items-center gap-2 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-foreground">
            <Lock className="h-6 w-6" />
          </span>
          <p className="font-semibold">{t("social.privateTitle")}</p>
          <p className="max-w-xs text-sm text-muted-foreground">{t("social.privateHint")}</p>
        </div>
      ) : tab === "posts" ? (
        <PostGrid userId={profile.user_id} isMe={relation.isMe} />
      ) : (
        <ReviewsList userId={profile.user_id} />
      )}

      <FollowListSheet
        userId={profile.user_id}
        meId={user?.id}
        tab={sheet}
        onTabChange={setSheet}
        onClose={() => setSheet(null)}
        showRequests={relation.isMe && profile.is_private}
      />
    </div>
  );
}

function Count({
  value,
  label,
  onClick,
  highlight = false,
}: {
  value: number;
  label: string;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const body = (
    <>
      <span className={`block font-display text-lg font-bold ${highlight ? "text-primary" : ""}`}>
        {value}
      </span>
      <span className="block truncate text-[11px] text-muted-foreground sm:text-xs">{label}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="rounded-xl py-1 transition hover:bg-muted">
      {body}
    </button>
  ) : (
    <div className="py-1">{body}</div>
  );
}

/** Matches per sport as one compact row (the total is already in the counts above). */
function MatchStrip({ data }: { data: ProfilePage }) {
  const { t } = useTranslation();
  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-2"
      aria-label={t("social.matchesPlayed", { count: data.counts.matches })}
    >
      <Trophy className="h-4 w-4 text-optic" />
      {data.matchesBySport.map((s) => (
        <span key={s.sport} className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium">
          {t(`sports.${s.sport}`)} <span className="font-bold text-primary">{s.matches}</span>
        </span>
      ))}
    </div>
  );
}

function PostGrid({ userId, isMe }: { userId: string; isMe: boolean }) {
  const { t } = useTranslation();
  const listFn = useServerFn(listProfilePosts);
  const q = useQuery({
    queryKey: ["profile-posts", userId],
    queryFn: () => listFn({ data: { userId } }),
  });

  if (q.isLoading)
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!q.data?.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-14 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-foreground">
          <Grid3x3 className="h-6 w-6" />
        </span>
        <p className="font-semibold">{t("social.noPostsTitle")}</p>
        {isMe && (
          <p className="max-w-xs text-sm text-muted-foreground">{t("social.noPostsMine")}</p>
        )}
      </div>
    );
  }
  return (
    <div className="mt-1 grid grid-cols-3 gap-1">
      {q.data.map((p) => (
        <div key={p.id} className="group relative aspect-square overflow-hidden bg-muted">
          {p.thumb ? (
            <img src={p.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary to-coral text-primary-foreground">
              <Trophy className="h-8 w-8" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 bg-black/40 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-4 w-4 fill-white" /> {p.like_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-4 w-4 fill-white" /> {p.comment_count}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsList({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";
  const q = useQuery({
    queryKey: ["profile-reviews", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer_id")
        .eq("target_player_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((r) => r.reviewer_id)));
      const { data: profs } = ids.length
        ? await supabase
            .from("profiles")
            .select("user_id, username, full_name, photo_url")
            .in("user_id", ids)
        : { data: [] };
      const byId = new Map((profs ?? []).map((p) => [p.user_id, p]));
      return (data ?? []).map((r) => ({ ...r, reviewer: byId.get(r.reviewer_id) ?? null }));
    },
  });

  if (q.isLoading)
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!q.data?.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-14 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-foreground">
          <Star className="h-6 w-6" />
        </span>
        <p className="font-semibold">{t("social.noReviews")}</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/70">
      {q.data.map((r) => (
        <li key={r.id} className="py-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={r.reviewer?.full_name} photoUrl={r.reviewer?.photo_url} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {r.reviewer?.username ?? t("openGames.player")}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString(locale)}
              </p>
            </div>
            <StarRating value={r.rating} readOnly size={14} />
          </div>
          {r.comment && <p className="mt-2 text-sm text-foreground/90">{r.comment}</p>}
        </li>
      ))}
    </ul>
  );
}
