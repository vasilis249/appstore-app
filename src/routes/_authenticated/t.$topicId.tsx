import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FeedList } from "@/components/posts/feed-list";
import { useSections } from "@/hooks/use-sections";
import { getTopic, postKeys } from "@/lib/posts";
import { timeAgo } from "@/lib/time-ago";
import { VoiceIcon } from "@/components/voice/voice-icon";

export const Route = createFileRoute("/_authenticated/t/$topicId")({
  component: TopicPage,
});

/** A topic (news item / question) and everyone's voice takes on it. */
function TopicPage() {
  const { topicId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const { name, icon } = useSections();
  const topic = useQuery({ queryKey: postKeys.topic(topicId), queryFn: () => getTopic(topicId) });
  const tp = topic.data;
  const Icon = icon(tp?.section_id ?? "");

  return (
    <>
      <AppHeader back title={tp ? name(tp.section_id) : ""} />
      {topic.data === null && <EmptyState text={t("rpcErrors.notFound")} />}
      {tp && (
        <>
          <section className="border-b border-border px-4 pb-4 pt-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5" /> {name(tp.section_id)} · {timeAgo(tp.created_at, i18n.language)}
            </p>
            <h1 className="mt-1 text-xl font-bold leading-snug">{tp.title}</h1>
            {tp.summary && <p className="mt-2 text-sm text-muted-foreground">{tp.summary}</p>}
            {tp.source_url && (
              <a href={tp.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium underline">
                {tp.source_name ?? t("posts.source")} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <Link
              to="/record"
              search={{ topic: tp.id }}
              className="mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground"
            >
              <VoiceIcon className="h-5 w-5" /> {t("posts.giveYourTake")}
            </Link>
          </section>
          <FeedList params={{ scope: "topic", topic: tp.id }} empty={<EmptyState text={t("posts.emptyTopic")} />} />
        </>
      )}
    </>
  );
}
