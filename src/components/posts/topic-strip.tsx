import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Flame, Newspaper } from "lucide-react";
import { useSections } from "@/hooks/use-sections";
import { postKeys, trendingTopics } from "@/lib/posts";

/**
 * "Trending" topics (optionally for one section): horizontal cards, or one quiet row of pills (Home).
 */
export function TopicStrip({ section, variant = "cards" }: { section?: string; variant?: "cards" | "pills" }) {
  const { t } = useTranslation();
  const { name } = useSections();
  const q = useQuery({ queryKey: postKeys.trending(section), queryFn: () => trendingTopics(section, 10) });
  if (!q.data?.length) return null;
  if (variant === "pills")
    return (
      <nav aria-label={t("posts.trending")} className="no-scrollbar flex items-center gap-2 overflow-x-auto px-4 pt-3">
        <Flame className="h-4 w-4 shrink-0 text-link" aria-hidden />
        {q.data.map((tp) => (
          <Link
            key={tp.id}
            to="/t/$topicId"
            params={{ topicId: tp.id }}
            className="h-8 max-w-[15rem] shrink-0 truncate rounded-full px-3 text-caption font-normal leading-8 ring-1 ring-border"
          >
            {tp.title}
          </Link>
        ))}
      </nav>
    );
  return (
    <section className="pb-3">
      <h2 className="flex items-center gap-1.5 px-4 pb-2 text-callout font-semibold text-muted-foreground">
        <Flame className="h-4 w-4" /> {t("posts.trending")}
      </h2>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
        {q.data.map((tp) => (
          <Link
            key={tp.id}
            to="/t/$topicId"
            params={{ topicId: tp.id }}
            className="flex w-60 shrink-0 flex-col justify-between rounded-2xl bg-card p-3"
          >
            <span className="flex items-center gap-1 text-fine text-muted-foreground">
              {tp.kind === "news" && <Newspaper className="h-3.5 w-3.5" />}
              {name(tp.section_id)}
              {tp.source_name && ` · ${tp.source_name}`}
            </span>
            <span className="mt-1 line-clamp-2 text-caption font-semibold leading-snug">{tp.title}</span>
            <span className="mt-2 text-fine text-muted-foreground">{t("posts.voicesCount", { count: tp.posts_count })}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
