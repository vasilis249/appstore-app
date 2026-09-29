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
import { timeAgo } from "@/lib/time-ago";
import { rpcErrorKey } from "@/lib/friends";
import { cn } from "@/lib/utils";

const compact = new Intl.NumberFormat(undefined, { notation: "compact" });

/**
 * A public voice post (X-style row): author, section › topic, title, player, actions.
 * `onPlay` starts the list's queue at this post (continuous playback).
 */
export function PostCard({ post, onPlay, linkToPost = true }: { post: PostView; onPlay: () => void; linkToPost?: boolean }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQueue();
  const sections = useSections();
  const [repostOpen, setRepostOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isCurrent = currentId(q) === post.id;
  const playing = isCurrent && q.playing;
  const SectionIcon = sections.icon(post.sectionId);

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
  const action = "flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground";

  return (
    <article className="border-b border-border px-4 py-3">
      {post.repostedBy && (
        <p className="mb-1 ml-12 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Repeat2 className="h-3.5 w-3.5" />
          {post.repostedBy.mine ? t("posts.youReposted") : t("posts.reposted", { name: post.repostedBy.name })}
        </p>
      )}
      <div className="flex gap-3">
        <UserAvatar name={post.name} path={post.avatar} size={40} />
        <div className="min-w-0 flex-1">
          <header className="flex items-center gap-1 text-sm">
            <span className="truncate font-semibold">{post.name}</span>
            <span className="truncate text-muted-foreground">@{post.username}</span>
            <span className="shrink-0 text-muted-foreground">· {timeAgo(post.createdAt, i18n.language)}</span>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t("friends.actions")}
              className="-mr-2 ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </header>

          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/s/$sectionId" params={{ sectionId: post.sectionId }} className="flex shrink-0 items-center gap-1 font-medium text-foreground/80">
              <SectionIcon className="h-3.5 w-3.5" /> {sections.name(post.sectionId)}
            </Link>
            {post.topicId && post.topicTitle && (
              <>
                <span>›</span>
                <Link to="/t/$topicId" params={{ topicId: post.topicId }} className="truncate">
                  {post.topicTitle}
                </Link>
              </>
            )}
          </div>

          {post.title && (
            <button type="button" onClick={open} className="mt-1.5 block text-left text-[15px] font-semibold leading-snug">
              {post.title}
            </button>
          )}

          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-secondary px-3 py-2.5">
            <button
              type="button"
              onClick={() => (isCurrent ? toggle() : onPlay())}
              aria-label={playing ? t("daily.pause") : t("daily.play")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
            >
              {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
            </button>
            <Waveform seed={post.id} progress={isCurrent ? q.progress : 0} />
            <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{formatClock(post.durationMs)}</span>
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

          <footer className="mt-2.5 flex items-center justify-between pr-2">
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
            <span className={action} aria-label={t("posts.listens", { count: post.listens })}>
              <Headphones className="h-[18px] w-[18px]" /> {post.listens > 0 && compact.format(post.listens)}
            </span>
            <button type="button" onClick={() => void share()} className={action} aria-label={t("posts.share")}>
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
