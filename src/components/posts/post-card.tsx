import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Headphones, Heart, MessageCircle, MoreHorizontal, Pause, Play, Repeat2, Share } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { Waveform } from "@/components/voice/waveform";
import { RepostSheet } from "@/components/posts/repost-sheet";
import { PostMenu } from "@/components/posts/post-menu";
import { useSections } from "@/hooks/use-sections";
import { formatClock } from "@/lib/audio";
import { postKeys, setLiked, type PostView } from "@/lib/posts";
import { currentId, toggle, useQueue } from "@/lib/queue";
import { timeAgoShort } from "@/lib/time-ago";
import { rpcErrorKey } from "@/lib/friends";
import { cn } from "@/lib/utils";

const compact = new Intl.NumberFormat(undefined, { notation: "compact" });

/**
 * A public voice post, kept light: name · time, section · topic, title, player (duration · listens), actions.
 * `onPlay` starts the list's queue at this post (continuous playback).
 */
export function PostCard({
  post,
  onPlay,
  linkToPost = true,
  hideReplyTo = false,
  threadLine = false,
}: {
  post: PostView;
  onPlay: () => void;
  linkToPost?: boolean;
  hideReplyTo?: boolean;
  /** Draw the thread line down to the next post (ancestors on a post page). */
  threadLine?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQueue();
  const sections = useSections();
  const [repostOpen, setRepostOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isCurrent = currentId(q) === post.id;
  const playing = isCurrent && q.playing;

  const like = useMutation({
    mutationFn: () => setLiked(post.id, !post.liked),
    onSettled: () => qc.invalidateQueries({ queryKey: postKeys.all }),
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  async function share() {
    const url = `${window.location.origin}/p/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: post.title ?? "Speak" });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("friends.copied"));
      }
    } catch {
      /* cancelled */
    }
  }

  const open = () => linkToPost && void navigate({ to: "/p/$postId", params: { postId: post.id } });
  const action = "flex min-h-8 items-center gap-1.5 text-[13px] tabular-nums text-muted-foreground";

  return (
    <article className={cn("px-4 py-3", !threadLine && "border-b border-border")}>
      {post.repostedBy && (
        <p className="mb-1 ml-12 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Repeat2 className="h-3.5 w-3.5" />
          {post.repostedBy.mine ? t("posts.youReposted") : t("posts.reposted", { name: post.repostedBy.name })}
        </p>
      )}
      <div className="flex gap-3">
        <div className="flex shrink-0 flex-col items-center">
          <Link to="/u/$username" params={{ username: post.username }} aria-label={post.name}>
            <UserAvatar name={post.name} path={post.avatar} size={40} />
          </Link>
          {threadLine && <span className="-mb-3 mt-1 w-0.5 flex-1 rounded-full bg-border" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <header className="flex items-center gap-1.5 text-[15px] leading-5">
            <Link to="/u/$username" params={{ username: post.username }} className="min-w-0 truncate font-semibold">
              {post.name}
            </Link>
            <span className="shrink-0 text-sm text-muted-foreground">· {timeAgoShort(post.createdAt, i18n.language)}</span>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t("friends.actions")}
              className="-mr-2 ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </header>

          {post.replyTo && post.replyToUsername && !hideReplyTo && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("posts.replyingToUser")}{" "}
              <Link to="/u/$username" params={{ username: post.replyToUsername }} className="font-medium text-sky-400">
                @{post.replyToUsername}
              </Link>
            </p>
          )}

          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[13px] text-muted-foreground">
            <Link to="/" search={{ tab: post.sectionId }} className="shrink-0 font-medium text-coral">
              {sections.name(post.sectionId)}
            </Link>
            {post.topicId && post.topicTitle && (
              <>
                <span aria-hidden>·</span>
                <Link to="/t/$topicId" params={{ topicId: post.topicId }} className="truncate">
                  {post.topicTitle}
                </Link>
              </>
            )}
          </p>

          {post.title && (
            <button type="button" onClick={open} className="mt-1.5 block text-left text-base font-semibold leading-snug">
              {post.title}
            </button>
          )}

          <div className="mt-2.5 flex items-center gap-3 rounded-full bg-secondary py-1.5 pl-1.5 pr-4">
            <button
              type="button"
              onClick={() => (isCurrent ? toggle() : onPlay())}
              aria-label={playing ? t("daily.pause") : t("daily.play")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground active:scale-95"
            >
              {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
            </button>
            <Waveform seed={post.id} progress={isCurrent ? q.progress : 0} />
            <span className="shrink-0 text-right text-[13px] tabular-nums text-muted-foreground">
              {formatClock(post.durationMs)}
              {post.listens > 0 && (
                <span aria-label={t("posts.listens", { count: post.listens })}>
                  {" "}· <Headphones className="-mt-0.5 inline h-3.5 w-3.5" /> {compact.format(post.listens)}
                </span>
              )}
            </span>
          </div>

          {post.quote && (
            <Link
              to="/p/$postId"
              params={{ postId: post.quote.id }}
              className="mt-2 block rounded-2xl border border-border px-3 py-2 text-sm"
            >
              <span className="font-semibold">{post.quote.name}</span>{" "}
              <span className="text-muted-foreground">@{post.quote.username} · {formatClock(post.quote.durationMs)}</span>
              {post.quote.title && <span className="mt-0.5 block truncate">{post.quote.title}</span>}
            </Link>
          )}

          <footer className="mt-2 flex items-center gap-7">
            <button type="button" onClick={open} className={action} aria-label={t("posts.reply")}>
              <MessageCircle className="h-[18px] w-[18px]" /> {post.replies > 0 && compact.format(post.replies)}
            </button>
            <button
              type="button"
              onClick={() => setRepostOpen(true)}
              className={cn(action, post.reposted && "text-emerald-400")}
              aria-label={t("posts.repost")}
            >
              <Repeat2 className="h-[18px] w-[18px]" /> {post.reposts > 0 && compact.format(post.reposts)}
            </button>
            <button
              type="button"
              onClick={() => like.mutate()}
              disabled={like.isPending}
              className={cn(action, post.liked && "text-rose-500")}
              aria-label={post.liked ? t("posts.unlike") : t("posts.like")}
              aria-pressed={post.liked}
            >
              <Heart className="h-[18px] w-[18px]" fill={post.liked ? "currentColor" : "none"} /> {post.likes > 0 && compact.format(post.likes)}
            </button>
            <button type="button" onClick={() => void share()} className={cn(action, "ml-auto")} aria-label={t("posts.share")}>
              <Share className="h-[18px] w-[18px]" />
            </button>
          </footer>
        </div>
      </div>
      <RepostSheet post={repostOpen ? post : null} onOpenChange={setRepostOpen} />
      <PostMenu post={menuOpen ? post : null} onOpenChange={setMenuOpen} />
    </article>
  );
}
