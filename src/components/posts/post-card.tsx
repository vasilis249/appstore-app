import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GraduationCap, Headphones, Heart, MessageCircle, MicOff, MoreHorizontal, Pause, Play, Repeat2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { Waveform } from "@/components/voice/waveform";
import { RepostSheet } from "@/components/posts/repost-sheet";
import { PostMenu } from "@/components/posts/post-menu";
import { useSections } from "@/hooks/use-sections";
import { useCampus } from "@/lib/campus";
import { formatClock } from "@/lib/audio";
import { postKeys, setLiked, type PostView } from "@/lib/posts";
import { currentId, toggle, useQueue } from "@/lib/queue";
import { timeAgoShort } from "@/lib/time-ago";
import { rpcErrorKey } from "@/lib/friends";
import { cn } from "@/lib/utils";

const compact = new Intl.NumberFormat(undefined, { notation: "compact" });

/**
 * A public voice post, social-style: avatar · bold name · time · ⋯, section · topic (group; nothing for a personal
 * voice), title, the voice tile (double-tap = like with a heart burst), then ♥ 💬 ⟲ ✈ with counts.
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
  const campus = useCampus();
  // The author's school next to the name: just "ΗΜΜΥ" on campus, "ΕΜΠ · ΗΜΜΥ" elsewhere.
  const school = post.campus
    ? campus.label({ university_id: post.authorSchool.university, department_id: post.authorSchool.department }).split(" · ").pop()
    : campus.label({ university_id: post.authorSchool.university, department_id: post.authorSchool.department });
  const [repostOpen, setRepostOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isCurrent = currentId(q) === post.id;
  const playing = isCurrent && q.playing;

  const like = useMutation({
    mutationFn: (to: boolean) => setLiked(post.id, to),
    onSettled: () => qc.invalidateQueries({ queryKey: postKeys.all }),
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  // Instagram-style: the heart pops on like; a double tap on the voice likes it with a big heart burst.
  const [pop, setPop] = useState(0);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const toggleLike = () => {
    if (!post.liked) setPop((n) => n + 1);
    like.mutate(!post.liked);
  };
  const tapTile = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      setBurst((n) => n + 1);
      if (!post.liked && !like.isPending) {
        setPop((n) => n + 1);
        like.mutate(true);
      }
    } else lastTap.current = now;
  };

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
  const action = "flex min-h-9 items-center gap-1.5 text-[14px] font-semibold tabular-nums text-foreground";

  // Deleted by its author after others answered: a placeholder that keeps the conversation readable.
  if (post.deleted)
    return (
      <article className={cn("px-4 py-3", !threadLine && "border-b border-border")}>
        <div className="flex gap-3">
          <div className="flex shrink-0 flex-col items-center">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-muted-foreground" aria-hidden>
              <MicOff className="h-4 w-4" />
            </span>
            {threadLine && <span className="-mb-3 mt-1 w-0.5 flex-1 rounded-full bg-border" aria-hidden />}
          </div>
          <button
            type="button"
            onClick={open}
            disabled={!linkToPost}
            className="min-w-0 flex-1 rounded-2xl bg-secondary/60 px-4 py-3 text-left text-callout text-muted-foreground"
          >
            {t("posts.deletedVoice")}
          </button>
        </div>
      </article>
    );

  return (
    <article className={cn("px-4 py-3", !threadLine && "border-b border-border")}>
      {post.repostedBy && (
        <p className="mb-1 ml-12 flex items-center gap-1.5 text-fine font-semibold text-muted-foreground">
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
            <Link to="/u/$username" params={{ username: post.username }} className="min-w-0 truncate font-bold">
              {post.name}
            </Link>
            {school && <span className="min-w-0 shrink truncate text-caption text-muted-foreground">· {school}</span>}
            <span className="shrink-0 text-caption text-muted-foreground">· {timeAgoShort(post.createdAt, i18n.language)}</span>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t("friends.actions")}
              className="-mr-2 ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-foreground"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </header>

          {post.replyTo && post.replyToUsername && !hideReplyTo && (
            <p className="mt-0.5 text-fine text-muted-foreground">
              {t("posts.replyingToUser")}{" "}
              <Link to="/u/$username" params={{ username: post.replyToUsername }} className="font-normal text-link">
                @{post.replyToUsername}
              </Link>
            </p>
          )}

          {(post.groupId || post.sectionId || post.campus) && (
            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-caption text-muted-foreground">
              {post.campus ? (
                <Link
                  to="/"
                  search={post.sectionId ? { tab: "campus", s: post.sectionId } : { tab: "campus" }}
                  className="flex min-w-0 items-center gap-1 font-normal text-link"
                >
                  <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {campus.label({ university_id: post.campus })}
                    {post.sectionId && ` · ${sections.name(post.sectionId)}`}
                  </span>
                </Link>
              ) : post.groupId && post.groupName ? (
                <Link to="/g/$groupId" params={{ groupId: post.groupId }} className="flex min-w-0 items-center gap-1 font-normal text-link">
                  <Users className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{post.groupName}</span>
                </Link>
              ) : (
                post.sectionId && (
                  <Link to="/" search={{ s: post.sectionId }} className="shrink-0 font-normal text-link">
                    {sections.name(post.sectionId)}
                  </Link>
                )
              )}
              {post.topicId && post.topicTitle && (
                <>
                  <span aria-hidden>·</span>
                  <Link to="/t/$topicId" params={{ topicId: post.topicId }} className="truncate">
                    {post.topicTitle}
                  </Link>
                </>
              )}
            </p>
          )}

          {post.title && (
            <button type="button" onClick={open} className="mt-1 block text-left text-[15px] leading-snug">
              {post.title}
            </button>
          )}

          <div
            onPointerUp={tapTile}
            className="relative mt-2.5 flex select-none items-center gap-3 overflow-hidden rounded-2xl bg-card py-3 pl-3 pr-4 ring-1 ring-border/60"
          >
            <button
              type="button"
              onClick={() => (isCurrent ? toggle() : onPlay())}
              aria-label={playing ? t("daily.pause") : t("daily.play")}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-foreground text-background"
            >
              {playing ? <Pause className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} /> : <Play className="ml-0.5 h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />}
            </button>
            <Waveform seed={post.id} progress={isCurrent ? q.progress : 0} />
            <span className="shrink-0 text-right text-caption font-semibold tabular-nums text-muted-foreground">
              {formatClock(post.durationMs)}
              {post.listens > 0 && (
                <span className="block font-normal" aria-label={t("posts.listens", { count: post.listens })}>
                  <Headphones className="-mt-0.5 inline h-3 w-3" /> {compact.format(post.listens)}
                </span>
              )}
            </span>
            {burst > 0 && (
              <span key={burst} className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
                <Heart className="h-16 w-16 animate-heart-burst text-live drop-shadow-lg" fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </div>

          {post.quote?.deleted && (
            <p className="mt-2 rounded-2xl border border-border px-3 py-2 text-caption text-muted-foreground">{t("posts.quoteDeleted")}</p>
          )}
          {post.quote && !post.quote.deleted && (
            <Link
              to="/p/$postId"
              params={{ postId: post.quote.id }}
              className="mt-2 block rounded-2xl border border-border px-3 py-2 text-caption"
            >
              <span className="font-semibold">{post.quote.name}</span>{" "}
              <span className="text-muted-foreground">@{post.quote.username} · {formatClock(post.quote.durationMs)}</span>
              {post.quote.title && <span className="mt-0.5 block truncate">{post.quote.title}</span>}
            </Link>
          )}

          <footer className="-ml-1.5 mt-1.5 flex items-center gap-4">
            <button
              type="button"
              onClick={toggleLike}
              disabled={like.isPending}
              className={cn(action, "px-1.5", post.liked && "text-live")}
              aria-label={post.liked ? t("posts.unlike") : t("posts.like")}
              aria-pressed={post.liked}
            >
              <Heart key={pop} className={cn("h-[23px] w-[23px]", pop > 0 && post.liked && "animate-like-pop")} strokeWidth={1.9} fill={post.liked ? "currentColor" : "none"} />
              {post.likes > 0 && <span className="text-foreground">{compact.format(post.likes)}</span>}
            </button>
            <button type="button" onClick={open} className={cn(action, "px-1.5")} aria-label={t("posts.reply")}>
              <MessageCircle className="h-[23px] w-[23px] -scale-x-100" strokeWidth={1.9} /> {post.replies > 0 && compact.format(post.replies)}
            </button>
            {!post.groupId && !post.campus && (
              <button
                type="button"
                onClick={() => setRepostOpen(true)}
                className={cn(action, "px-1.5", post.reposted && "text-success")}
                aria-label={t("posts.repost")}
              >
                <Repeat2 className="h-[23px] w-[23px]" strokeWidth={1.9} /> {post.reposts > 0 && compact.format(post.reposts)}
              </button>
            )}
            <button type="button" onClick={() => void share()} className={cn(action, "px-1.5")} aria-label={t("posts.share")}>
              <Send className="h-[22px] w-[22px]" strokeWidth={1.9} />
            </button>
          </footer>
        </div>
      </div>
      <RepostSheet post={repostOpen ? post : null} onOpenChange={setRepostOpen} />
      <PostMenu post={menuOpen ? post : null} onOpenChange={setMenuOpen} />
    </article>
  );
}
