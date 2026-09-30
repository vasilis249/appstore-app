import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { PostCard } from "@/components/posts/post-card";
import { fetchFeed, nextCursor, postKeys, toView, voiceUrl, type FeedParams, type PostView } from "@/lib/posts";
import { playQueue, type QueueItem } from "@/lib/queue";

/** Queue from the list, without playing the same voice twice (a repost next to its original). */
function toQueue(views: PostView[], from: PostView): { items: QueueItem[]; index: number } {
  const seen = new Set<string>();
  const items: QueueItem[] = [];
  for (const v of views) {
    if (v.deleted || seen.has(v.id)) continue;
    seen.add(v.id);
    items.push({ id: v.id, url: voiceUrl(v.path), durationMs: v.durationMs, title: v.title ?? v.name, author: v.name });
  }
  return { items, index: Math.max(0, items.findIndex((i) => i.id === from.id)) };
}

function play(views: PostView[], from: PostView) {
  const { items, index } = toQueue(views, from);
  playQueue(items, index);
}

/**
 * Infinite list of posts for one feed scope. Tapping play on a card plays from there to the end of
 * the loaded list; "Play all" starts at the top.
 */
export function FeedList({
  params,
  empty,
  playAll = true,
  hideReplyTo = false,
  playAllRef,
}: {
  params: FeedParams;
  empty: ReactNode;
  playAll?: boolean;
  /** Replies listed right under their parent don't need "Replying to @x". */
  hideReplyTo?: boolean;
  /** The page shows its own "play all" button (Home's tab bar); the list only fills in what it plays. */
  playAllRef?: MutableRefObject<(() => void) | null>;
}) {
  const { t } = useTranslation();
  const q = useInfiniteQuery({
    queryKey: postKeys.feed(params),
    queryFn: ({ pageParam }) => fetchFeed(params, pageParam),
    initialPageParam: undefined as string | number | undefined,
    getNextPageParam: (last, all) => nextCursor(params.scope, last, all),
  });
  // Each voice once per list: a plain repost next to its original (or two people reposting it) shows only the first.
  const views = useMemo(() => {
    const seen = new Set<string>();
    return (q.data?.pages.flat() ?? [])
      .map(toView)
      .filter((v): v is PostView => !!v && !seen.has(v.id) && !!seen.add(v.id));
  }, [q.data]);

  useEffect(() => {
    if (!playAllRef) return;
    playAllRef.current = views.some((v) => !v.deleted) ? () => play(views, views.find((v) => !v.deleted)!) : null;
    return () => {
      playAllRef.current = null;
    };
  }, [playAllRef, views]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [q]);

  if (q.data && !views.length) return <>{empty}</>;
  return (
    <div>
      {playAll && !playAllRef && views.filter((v) => !v.deleted).length > 1 && (
        <div className="flex justify-end px-4 pb-1">
          <button
            type="button"
            onClick={() => play(views, views.find((v) => !v.deleted)!)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-secondary px-4 text-caption font-semibold"
          >
            <Play className="h-4 w-4" fill="currentColor" /> {t("posts.playAll")}
          </button>
        </div>
      )}
      {views.map((v) => (
        <PostCard key={v.row.post_id} post={v} onPlay={() => play(views, v)} hideReplyTo={hideReplyTo} />
      ))}
      <div ref={sentinel} />
      {q.isFetchingNextPage && <p className="py-4 text-center text-caption text-muted-foreground">{t("common.loading")}</p>}
    </div>
  );
}
