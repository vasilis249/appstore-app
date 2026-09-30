import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FeedList } from "@/components/posts/feed-list";
import { PostCard } from "@/components/posts/post-card";
import { fetchAncestors, fetchFeed, postKeys, toView, voiceUrl, type PostView } from "@/lib/posts";
import { playQueue, type QueueItem } from "@/lib/queue";
import { VoiceIcon } from "@/components/voice/voice-icon";

export const Route = createFileRoute("/_authenticated/p/$postId")({
  component: PostPage,
});

const item = (v: PostView): QueueItem => ({ id: v.id, url: voiceUrl(v.path), durationMs: v.durationMs, title: v.title ?? v.name, author: v.name });

/** A post with the conversation above it (root first, joined by a thread line), then its voice replies. */
function PostPage() {
  const { postId } = Route.useParams();
  const { t } = useTranslation();
  const one = useQuery({ queryKey: postKeys.feed({ scope: "one", parent: postId }), queryFn: () => fetchFeed({ scope: "one", parent: postId }) });
  const view = useMemo(() => (one.data?.[0] ? toView(one.data[0]) : null), [one.data]);
  const ancestors = useQuery({
    queryKey: [...postKeys.all, "ancestors", postId],
    queryFn: () => fetchAncestors(postId),
    enabled: !!view?.replyTo,
  });
  const above = useMemo(() => (ancestors.data ?? []).map(toView).filter((v): v is PostView => !!v), [ancestors.data]);
  // Playing anything in the thread plays the conversation from there down to this post.
  const thread = useMemo(() => (view ? [...above, view] : above), [above, view]);
  const playFrom = (v: PostView) => {
    const voices = thread.filter((x) => !x.deleted); // a deleted voice in the chain has nothing to play
    playQueue(voices.map(item), Math.max(0, voices.indexOf(v)));
  };

  return (
    <>
      <AppHeader back title={view?.replyTo ? t("posts.thread") : t("posts.post")} />
      {one.data && !view && <EmptyState text={t("rpcErrors.notFound")} />}
      {view && (
        <>
          {above.map((a, i) => (
            <PostCard key={a.row.post_id} post={a} threadLine hideReplyTo={i > 0} onPlay={() => playFrom(a)} />
          ))}
          <PostCard post={view} linkToPost={false} hideReplyTo={above.length > 0} onPlay={() => playFrom(view)} />
          {!view.deleted && (
          <div className="border-b border-border px-4 py-3">
            <Link
              to="/record"
              search={{ reply: view.id }}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-secondary font-semibold"
            >
              <VoiceIcon className="h-5 w-5" /> {t("posts.replyWithVoice")}
            </Link>
          </div>
          )}
          <FeedList
            key={view.id}
            params={{ scope: "replies", parent: view.id }}
            hideReplyTo
            empty={<p className="py-10 text-center text-sm text-muted-foreground">{t("posts.noReplies")}</p>}
          />
        </>
      )}
    </>
  );
}
