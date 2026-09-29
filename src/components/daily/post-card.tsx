import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/components/user-avatar";
import { ClipPlayer } from "@/components/voice/clip-player";
import { splitDuration, useNow } from "@/hooks/use-now";
import { fetchPostAudio, type FeedPost } from "@/lib/daily";
import { timeAgo } from "@/lib/time-ago";

const DAY_MS = 24 * 3600_000;

/** A daily voice post: blurred and locked until you post yours, otherwise playable. */
export function PostCard({ post }: { post: FeedPost }) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const name = post.is_mine ? t("daily.yourVoice") : post.full_name || post.username;
  const left = splitDuration(new Date(post.created_at).getTime() + DAY_MS - now);
  const leftLabel = left.h ? t("time.hLeft", { h: left.h }) : t("time.mLeft", { m: left.m });

  return (
    <article className="rounded-3xl bg-card p-4 ring-1 ring-border">
      <header className="flex items-center gap-3">
        <UserAvatar name={post.full_name || post.username} path={post.avatar_path} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">
            {timeAgo(post.created_at, i18n.language)}
            {post.late && ` · ${t("daily.late")}`}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {leftLabel}
        </span>
      </header>
      <ClipPlayer
        className="mt-3"
        id={post.post_id}
        durationMs={post.duration_ms}
        locked={!post.audio_path}
        load={() => fetchPostAudio(post.audio_path!)}
      />
    </article>
  );
}
