import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Mic } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FeedList } from "@/components/posts/feed-list";
import { PostCard } from "@/components/posts/post-card";
import { fetchFeed, postKeys, toView, voiceUrl } from "@/lib/posts";
import { playQueue } from "@/lib/queue";

export const Route = createFileRoute("/_authenticated/p/$postId")({
  component: PostPage,
});

/** A post, its voice replies (oldest first) and "Reply with your voice". */
function PostPage() {
  const { postId } = Route.useParams();
  const { t } = useTranslation();
  const one = useQuery({ queryKey: postKeys.feed({ scope: "one", parent: postId }), queryFn: () => fetchFeed({ scope: "one", parent: postId }) });
  const view = useMemo(() => (one.data?.[0] ? toView(one.data[0]) : null), [one.data]);

  return (
    <>
      <AppHeader back title={t("posts.post")} />
      {one.data && !view && <EmptyState text={t("rpcErrors.notFound")} />}
      {view && (
        <>
          {view.replyTo && (
            <Link to="/p/$postId" params={{ postId: view.replyTo }} className="block px-4 pt-1 text-sm text-muted-foreground">
              ↑ {t("posts.inReplyTo")}
            </Link>
          )}
          <PostCard
            post={view}
            linkToPost={false}
            onPlay={() => playQueue([{ id: view.id, url: voiceUrl(view.path), durationMs: view.durationMs, title: view.title ?? view.name, author: view.name }])}
          />
          <div className="border-b border-border px-4 py-3">
            <Link
              to="/record"
              search={{ reply: view.id }}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-secondary font-semibold"
            >
              <Mic className="h-5 w-5" /> {t("posts.replyWithVoice")}
            </Link>
          </div>
          <FeedList
            key={view.id}
            params={{ scope: "replies", parent: view.id }}
            empty={<p className="py-10 text-center text-sm text-muted-foreground">{t("posts.noReplies")}</p>}
          />
        </>
      )}
    </>
  );
}
