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
import { PhotoViewer } from "@/components/posts/photo-viewer";
import { useSections } from "@/hooks/use-sections";
import { useCampus } from "@/lib/campus";
import { formatClock } from "@/lib/audio";
import { postKeys, setLiked, voiceUrl, type PostView } from "@/lib/posts";
import { currentId, toggle, useQueue } from "@/lib/queue";
import { timeAgoShort } from "@/lib/time-ago";
import { rpcErrorKey } from "@/lib/friends";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const compact = new Intl.NumberFormat(undefined, { notation: "compact" });

/**
 * A post like X (compact so a screen holds several): avatar · one line "name school · time" · ⋯, the place line
 * (campus section / group / section · topic; nothing for a personal post), its text, up to 4 photos, a slim voice row
 * when it has a voice (play, waveform that fills and breathes while playing; double-tap = like with a heart burst),
 * then 💬 ⟲ ♥ ✈ with counts and 🎧 listens. `focus` (the post page) shows bigger text, photos and player.
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
  const [viewing, setViewing] = useState<number | null>(null);
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
    // The public page (a teaser + sign-up for anyone; signed-in students jump to the post).
    const url = `${window.location.origin}/v/${post.id}`;
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
  // Post page with photos and a voice: the player floats on the first photo as liquid glass (the photo bends through it).
  const hero = focus && post.images.length > 0 && !!post.path;
  const playerBody = (
    <>
      <button
        type="button"
        onClick={() => (isCurrent ? toggle() : onPlay())}
        aria-label={playing ? t("daily.pause") : t("daily.play")}
        className={cn("hit grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground", focus ? "h-14 w-14" : "h-7 w-7")}
      >
        {playing ? (
          <Pause className={focus ? "h-6 w-6" : "h-3.5 w-3.5"} fill="currentColor" strokeWidth={0} />
        ) : (
          <Play className={cn("ml-0.5", focus ? "h-6 w-6" : "h-3.5 w-3.5")} fill="currentColor" strokeWidth={0} />
        )}
      </button>
      <Waveform seed={post.id} progress={isCurrent ? q.progress : 0} live={playing} bars={focus ? 48 : 36} className={focus ? "h-12" : "h-5"} />
      <span className="shrink-0 text-caption tabular-nums text-muted-foreground">{formatClock(post.durationMs)}</span>
      {burst > 0 && (
        <span key={burst} className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
          <Heart className={cn("animate-heart-burst text-live drop-shadow-lg", focus ? "h-16 w-16" : "h-9 w-9")} fill="currentColor" strokeWidth={0} />
        </span>
      )}
    </>
  );
  // Compact look, 44 pt to the finger (`hit`).
  const action = "hit flex min-h-9 items-center gap-1.5 text-caption tabular-nums text-muted-foreground";

  // Deleted by its author after others answered: a placeholder that keeps the conversation readable.
  if (post.deleted)
    return (
      <article className={cn("px-4 py-2.5", !threadLine && "border-b border-border")}>
        <div className="flex gap-2.5">
          <div className="flex shrink-0 flex-col items-center">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground" aria-hidden>
              <MicOff className="h-4 w-4" />
            </span>
            {threadLine && <span className="-mb-3 mt-1 w-0.5 flex-1 rounded-full bg-border" aria-hidden />}
          </div>
          <button
            type="button"
            onClick={open}
            disabled={!linkToPost}
            className="min-w-0 flex-1 rounded-xl bg-secondary px-3 py-2 text-left text-caption text-muted-foreground"
          >
            {t("posts.deletedVoice")}
          </button>
        </div>
      </article>
    );

  return (
    <article className={cn("px-4 pt-2.5", !threadLine && "border-b border-border")}>
      {post.repostedBy && (
        <p className="mb-0.5 ml-[42px] flex items-center gap-1.5 text-fine font-medium text-muted-foreground">
          <Repeat2 className="h-3.5 w-3.5" />
          {post.repostedBy.mine ? t("posts.youReposted") : t("posts.reposted", { name: post.repostedBy.name })}
        </p>
      )}
      <div className="flex gap-2.5">
        <div className="flex shrink-0 flex-col items-center">
          <Link to="/u/$username" params={{ username: post.username }} aria-label={post.name}>
            <UserAvatar name={post.name} path={post.avatar} size={32} />
          </Link>
          {threadLine && <span className="-mb-3 mt-1 w-0.5 flex-1 rounded-full bg-border" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <header className="flex items-center gap-2">
            <p className="flex min-w-0 flex-1 items-baseline gap-1 whitespace-nowrap text-caption leading-5 text-muted-foreground">
              <Link to="/u/$username" params={{ username: post.username }} className="min-w-0 max-w-[65%] truncate text-callout font-semibold text-foreground">
                {post.name}
              </Link>
              {school && <span className="min-w-0 truncate">{school}</span>}
              <span className="shrink-0">· {timeAgoShort(post.createdAt, i18n.language)}</span>
            </p>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t("friends.actions")}
              className="hit -my-2 -mr-3 grid h-9 w-11 shrink-0 place-items-center rounded-full text-muted-foreground"
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

          {(post.groupId || post.sectionId || post.topicId) && (
            <p className="flex min-w-0 items-center gap-1 text-fine font-semibold text-muted-foreground">
              {post.campus ? (
                // Campus voices are only for that university's students: its name would repeat on every card.
                post.sectionId && (
                  <Link to="/" search={{ tab: "campus", s: post.sectionId }} className="flex shrink-0 items-center gap-1 text-link">
                    <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                    {sections.name(post.sectionId)}
                  </Link>
                )
              ) : post.groupId && post.groupName ? (
                <Link to="/g/$groupId" params={{ groupId: post.groupId }} className="flex min-w-0 items-center gap-1 text-link">
                  <Users className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{post.groupName}</span>
                </Link>
              ) : (
                // old general-news section (that feed is off): a label, not a link
                post.sectionId && <span className="shrink-0">{sections.name(post.sectionId)}</span>
              )}
              {post.topicId && post.topicTitle && (
                <>
                  {(post.sectionId || post.groupId) && <span aria-hidden>·</span>}
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
              className={cn(
                "mt-0.5 block whitespace-pre-line text-left [overflow-wrap:anywhere]",
                focus ? "text-[20px] font-medium leading-[1.35] tracking-[-0.01em]" : "text-body leading-[1.4]",
              )}
            >
              {post.title}
            </button>
          )}

          {post.images.length > 0 && (
            <Photos
              paths={post.images}
              alt={t("posts.photoAlt", { name: post.name })}
              onOpen={linkToPost ? open : undefined}
              onView={focus ? setViewing : undefined}
              focus={focus}
              player={hero ? <div onPointerUp={tapTile} className="relative flex h-full select-none items-center gap-3 pl-2.5 pr-5">{playerBody}</div> : undefined}
            />
          )}

          {post.path && !hero && (
          <div
            onPointerUp={tapTile}
            className={cn("relative flex select-none items-center bg-card", focus ? "mt-2.5 gap-3 overflow-hidden rounded-3xl p-4" : "mt-1.5 gap-2.5 rounded-full py-1 pl-1 pr-3")}
          >
            {playerBody}
          </div>
          )}
          {focus && <PhotoViewer urls={post.images.map(voiceUrl)} start={viewing} alt={t("posts.photoAlt", { name: post.name })} onClose={() => setViewing(null)} />}

          {post.quote?.deleted && (
            <p className="mt-2 rounded-xl border border-border px-3 py-2 text-caption text-muted-foreground">{t("posts.quoteDeleted")}</p>
          )}
          {post.quote && !post.quote.deleted && (
            <Link
              to="/p/$postId"
              params={{ postId: post.quote.id }}
              className="mt-2 block rounded-xl border border-border px-3 py-2 text-caption"
            >
              <span className="flex gap-3">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{post.quote.name}</span>{" "}
                  <span className="text-muted-foreground">
                    @{post.quote.username}
                    {post.quote.durationMs > 0 && ` · ${formatClock(post.quote.durationMs)}`}
                  </span>
                  {post.quote.title && <span className="mt-0.5 line-clamp-2 block">{post.quote.title}</span>}
                </span>
                {post.quote.image && <img src={voiceUrl(post.quote.image)} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
              </span>
            </Link>
          )}

          <footer className="-ml-2 flex items-center gap-1">
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

/**
 * 1–4 photos like X: one wide, two side by side, three = one tall + two, four = a 2×2 grid. Feed: a tap opens the post;
 * post page: a tap opens the photo full screen. `player` (post page with a voice): the first photo becomes a hero with
 * the player on it as liquid glass — a copy of the photo, bent by an SVG displacement filter, under a glass tint — and
 * the other photos sit in a row below.
 */
function Photos({
  paths,
  alt,
  onOpen,
  onView,
  focus,
  player,
}: {
  paths: string[];
  alt: string;
  onOpen?: () => void;
  onView?: (i: number) => void;
  focus: boolean;
  player?: React.ReactNode;
}) {
  const n = paths.length;
  const tap = (i: number) => (onView ? () => onView(i) : onOpen);
  const img = (path: string, i: number, cls: string) => (
    <img
      key={path}
      src={voiceUrl(path)}
      alt={`${alt} (${i + 1}/${n})`}
      loading="lazy"
      onClick={tap(i)}
      className={cn("h-full w-full bg-secondary object-cover", (onOpen || onView) && "cursor-pointer", cls)}
    />
  );
  if (player)
    return (
      <>
        <div className="relative mt-2 h-[420px] overflow-hidden rounded-2xl">
          {img(paths[0], 0, "")}
          <svg width="0" height="0" className="absolute" aria-hidden>
            <filter id="liquid-lens" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="7" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>
          <div className="absolute inset-x-3 bottom-3 h-[76px] overflow-hidden rounded-full shadow-float">
            <img
              src={voiceUrl(paths[0])}
              alt=""
              aria-hidden
              className="liquid-lens pointer-events-none absolute -bottom-3 -left-3 h-[420px] w-[calc(100%+1.5rem)] max-w-none object-cover"
            />
            <div className="liquid-tint absolute inset-0 rounded-full" />
            {player}
          </div>
        </div>
        {n > 1 && (
          <div className={cn("mt-0.5 grid h-28 gap-0.5 overflow-hidden rounded-2xl", n === 2 ? "grid-cols-1" : n === 3 ? "grid-cols-2" : "grid-cols-3")}>
            {paths.slice(1).map((p, i) => img(p, i + 1, ""))}
          </div>
        )}
      </>
    );
  const box = "mt-2 overflow-hidden rounded-2xl";
  const H = focus ? "h-[420px]" : "h-64";
  if (n === 1) return <div className={box}>{img(paths[0], 0, focus ? "max-h-[520px] h-auto" : H)}</div>;
  return (
    <div className={cn(box, "grid grid-cols-2 gap-0.5", H, n > 2 && "grid-rows-2")}>
      {paths.map((p, i) => img(p, i, n === 3 && i === 0 ? "row-span-2" : ""))}
    </div>
  );
}
