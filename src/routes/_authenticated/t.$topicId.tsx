import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Play } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FeedList } from "@/components/posts/feed-list";
import { NewsCover } from "@/components/posts/news-card";
import { VoiceIcon } from "@/components/voice/voice-icon";
import { useSections } from "@/hooks/use-sections";
import { getTopic, postKeys } from "@/lib/posts";
import { timeAgoShort } from "@/lib/time-ago";

export const Route = createFileRoute("/_authenticated/t/$topicId")({
  component: TopicPage,
});

/** A headline (cover, title, source) and then everyone's voices on it, one after the other. */
function TopicPage() {
  const { topicId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const { name } = useSections();
  const topic = useQuery({ queryKey: postKeys.topic(topicId), queryFn: () => getTopic(topicId) });
  const playAll = useRef<(() => void) | null>(null);
  const tp = topic.data;

  return (
    <>
      <AppHeader back title={tp ? name(tp.section_id) : ""} />
      {topic.data === null && <EmptyState text={t("rpcErrors.notFound")} />}
      {tp && (
        <>
          <section className="px-4 pb-4">
            <NewsCover src={tp.image_url} section={tp.section_id} />
            <p className="mt-3 text-fine text-muted-foreground">
              <span className="font-normal text-foreground/80">{name(tp.section_id)}</span>
              {tp.source_name && ` · ${tp.source_name}`} · {timeAgoShort(tp.created_at, i18n.language)}
            </p>
            <h1 className="mt-1 text-display font-semibold">{tp.title}</h1>
            {tp.summary && <p className="mt-2 text-callout text-muted-foreground">{tp.summary}</p>}
            {tp.source_url && (
              <a
                href={tp.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-caption font-normal text-muted-foreground underline"
              >
                {t("news.readAt", { source: tp.source_name ?? t("posts.source") })} <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            )}
            <div className="mt-4 flex gap-2">
              <Link
                to="/record"
                search={{ topic: tp.id }}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground"
              >
                <VoiceIcon className="h-5 w-5" /> {t("posts.giveYourTake")}
              </Link>
              {tp.posts_count > 0 && (
                <button
                  type="button"
                  onClick={() => playAll.current?.()}
                  className="flex h-12 items-center gap-2 rounded-full bg-secondary px-5 font-semibold"
                >
                  <Play className="h-4 w-4" fill="currentColor" /> {t("news.listenAll")}
                </button>
              )}
            </div>
          </section>
          <h2 className="border-t border-border px-4 pb-1 pt-4 text-callout font-semibold text-muted-foreground">
            {t("posts.voicesCount", { count: tp.posts_count })}
          </h2>
          <FeedList params={{ scope: "topic", topic: tp.id }} playAllRef={playAll} empty={<EmptyState text={t("posts.emptyTopic")} />} />
        </>
      )}
    </>
  );
}
