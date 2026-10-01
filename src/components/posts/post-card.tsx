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
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const compact = new Intl.NumberFormat(undefined, { notation: "compact" });

/**
 * A public voice post (DESIGN.md, Quiet): avatar · name over "school · time" · ⋯, the indigo place line (campus /
 * group / section · topic; nothing for a personal voice), title, the voice tile (ink play, waveform that fills and
 * breathes while playing; double-tap = like with a heart burst), then 💬 ⟲ ♥ ✈ with counts and 🎧 listens.
 * `onPlay` starts the list's queue at this post (continuous playback).
 */
export function PostCard({
  post,
  onPlay,
  linkToPost = true,
  hideReplyTo = false,
  threadLine = false,
  focus = false,
}: {
  post: PostView;
  onPlay: () => void;
  linkToPost?: boolean;
  hideReplyTo?: boolean;
  /** Draw the thread line down to the next post (ancestors on a post page). */
  threadLine?: boolean;
  /** The voice a post page is about: bigger title and player. */
  focus?: boolean;
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
    haptic("light");
    if (!post.liked) setPop((n) => n + 1);
    like.mutate(!post.liked);
  };
  const tapTile = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      setBurst((n) => n + 1);
      haptic("light");
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
  const action = "flex min-h-11 items-center gap-1.5 text-caption tabular-nums text-muted-foreground";

  // Deleted by its author after others answered: a placeholder that keeps the conversation readable.
  if (post.deleted)
    return (
      <article className={cn("px-4 py-3", !threadLine && "border-b border-border")}>
        <div className="flex gap-3">
          <div className="flex shrink-0 flex-col items-center">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-muted-foreground" aria-hidden>
              <MicOff className="h-4 w-4" />
            </span>
            {threadLine && <span className="-mb-3 mt-1 w-0.5 flex-1 rounded-full bg-border" aria-hidden />}
          </div>
          <button
            type="button"
            onClick={open}
            disabled={!linkToPost}
            className="min-w-0 flex-1 rounded-xl bg-secondary px-4 py-3 text-left text-callout text-muted-foreground"
          >
            {t("posts.deletedVoice")}
          </button>
        </div>
      </article>
    );

  return (
    <article className={cn("px-4 pb-1 pt-3.5", !threadLine && "border-b border-border")}>
      {post.repostedBy && (
        <p className="mb-1 ml-[46px] flex items-center gap-1.5 text-fine font-medium text-muted-foreground">
          <Repeat2 className="h-3.5 w-3.5" />
          {post.repostedBy.mine ? t("posts.youReposted") : t("posts.reposted", { name: post.repostedBy.name })}
        </p>
      )}
      <div className="flex gap-2.5">
        <div className="flex shrink-0 flex-col items-center">
          <Link to="/u/$username" params={{ username: post.username }} aria-label={post.name}>
            <UserAvatar name={post.name} path={post.avatar} size={36} />
          </Link>
          {threadLine && <span className="-mb-3 mt-1 w-0.5 flex-1 rounded-full bg-border" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <header className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Link to="/u/$username" params={{ username: post.username }} className="block truncate text-callout font-semibold leading-5">
                {post.name}
              </Link>
              <p className="truncate text-caption text-muted-foreground">
                {[school, timeAgoShort(post.createdAt, i18n.language)].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t("friends.actions")}
              className="-mr-3 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground"
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
            <p className="mt-1.5 flex min-w-0 items-center gap-1 text-fine font-semibold text-muted-foreground">
              {post.campus ? (
                <Link
                  to="/"
                  search={post.sectionId ? { tab: "campus", s: post.sectionId } : { tab: "campus" }}
                  className="flex min-w-0 items-center gap-1 text-link"
                >
                  <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {campus.label({ university_id: post.campus })}
                    {post.sectionId && ` · ${sections.name(post.sectionId)}`}
                  </span>
                </Link>
              ) : post.groupId && post.groupName ? (
                <Link to="/g/$groupId" params={{ groupId: post.groupId }} className="flex min-w-0 items-center gap-1 text-link">
                  <Users className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{post.groupName}</span>
                </Link>
              ) : (
                post.sectionId && (
                  <Link to="/" search={{ s: post.sectionId }} className="shrink-0 text-link">
                    {sections.name(post.sectionId)}
                  </Link>
                )
              )}
              {post.topicId && post.topicTitle && (
                <>
                  <span aria-hidden>·</span>
                  <Link to="/t/$topicId" params={{ topicId: post.topicId }} className="truncate font-medium">
                    {post.topicTitle}
                  </Link>
                </>
              )}
            </p>
          )}

          {post.title && (
            <button
              type="button"
              onClick={open}
              className={cn("mt-0.5 block text-left", focus ? "text-[22px] font-[650] leading-[1.27] tracking-[-0.022em]" : "text-body font-medium leading-[1.38] tracking-[-0.012em]")}
            >
              {post.title}
            </button>
          )}

          <div
            onPointerUp={tapTile}
            className={cn("relative mt-2.5 flex select-none items-center gap-3 overflow-hidden bg-card", focus ? "rounded-3xl py-4 pl-4 pr-4" : "rounded-xl py-2 pl-2 pr-3")}
          >
            <button
              type="button"
              onClick={() => (isCurrent ? toggle() : onPlay())}
              aria-label={playing ? t("daily.pause") : t("daily.play")}
              className={cn("grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground", focus ? "h-14 w-14" : "h-9 w-9")}
            >
              {playing ? (
                <Pause className={focus ? "h-6 w-6" : "h-4 w-4"} fill="currentColor" strokeWidth={0} />
              ) : (
                <Play className={cn("ml-0.5", focus ? "h-6 w-6" : "h-4 w-4")} fill="currentColor" strokeWidth={0} />
              )}
            </button>
            <Waveform seed={post.id} progress={isCurrent ? q.progress : 0} live={playing} bars={focus ? 48 : 36} className={focus ? "h-12" : undefined} />
            <span className="shrink-0 text-caption tabular-nums text-muted-foreground">{formatClock(post.durationMs)}</span>
            {burst > 0 && (
              <span key={burst} className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
                <Heart className="h-16 w-16 animate-heart-burst text-live drop-shadow-lg" fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </div>

          {post.quote?.deleted && (
            <p className="mt-2 rounded-xl border border-border px-3 py-2 text-caption text-muted-foreground">{t("posts.quoteDeleted")}</p>
          )}
          {post.quote && !post.quote.deleted && (
            <Link
              to="/p/$postId"
              params={{ postId: post.quote.id }}
              className="mt-2 block rounded-xl border border-border px-3 py-2 text-caption"
            >
              <span className="font-semibold">{post.quote.name}</span>{" "}
              <span className="text-muted-foreground">@{post.quote.username} · {formatClock(post.quote.durationMs)}</span>
              {post.quote.title && <span className="mt-0.5 block truncate">{post.quote.title}</span>}
            </Link>
          )}

          <footer className="-ml-2 mt-0.5 flex items-center gap-1">
            <button type="button" onClick={open} className={cn(action, "px-2")} aria-label={t("posts.reply")}>
              <MessageCircle className="h-[18px] w-[18px] -scale-x-100" strokeWidth={1.7} /> {post.replies > 0 && compact.format(post.replies)}
            </button>
            {!post.groupId && !post.campus && (
              <button
                type="button"
                onClick={() => setRepostOpen(true)}
                className={cn(action, "px-2", post.reposted && "text-success")}
                aria-label={t("posts.repost")}
              >
                <Repeat2 className="h-[18px] w-[18px]" strokeWidth={1.7} /> {post.reposts > 0 && compact.format(post.reposts)}
              </button>
            )}
            <button
              type="button"
              onClick={toggleLike}
              disabled={like.isPending}
              className={cn(action, "px-2", post.liked && "text-live")}
              aria-label={post.liked ? t("posts.unlike") : t("posts.like")}
              aria-pressed={post.liked}
            >
              <Heart key={pop} className={cn("h-[18px] w-[18px]", pop > 0 && post.liked && "animate-like-pop")} strokeWidth={1.7} fill={post.liked ? "currentColor" : "none"} />
              {post.likes > 0 && <span key={post.likes} className="animate-tick">{compact.format(post.likes)}</span>}
            </button>
            <button type="button" onClick={() => void share()} className={cn(action, "px-2")} aria-label={t("posts.share")}>
              <Send className="h-[17px] w-[17px]" strokeWidth={1.7} />
            </button>
            {post.listens > 0 && (
              <span className="ml-auto flex items-center gap-1 text-caption tabular-nums text-muted-foreground" aria-label={t("posts.listens", { count: post.listens })}>
                <Headphones className="h-3.5 w-3.5" strokeWidth={1.7} /> {compact.format(post.listens)}
              </span>
            )}
          </footer>
        </div>
      </div>
      <RepostSheet post={repostOpen ? post : null} onOpenChange={setRepostOpen} />
      <PostMenu post={menuOpen ? post : null} onOpenChange={setMenuOpen} />
    </article>
  );
}
