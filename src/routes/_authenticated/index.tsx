import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Mic } from "lucide-react";
import { AppHeader, HomeHeaderActions } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FeedList } from "@/components/posts/feed-list";
import { SectionChips } from "@/components/posts/section-chips";
import { TopicStrip } from "@/components/posts/topic-strip";
import { DailyTopicCard } from "@/components/posts/daily-topic-card";
import { cn } from "@/lib/utils";

type Tab = "foryou" | "following";

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => (s.tab === "following" ? { tab: "following" } : {}),
  component: HomePage,
});

function RecordCta() {
  const { t } = useTranslation();
  return (
    <Link to="/record" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-8 font-semibold text-primary-foreground">
      <Mic className="h-5 w-5" /> {t("posts.speak")}
    </Link>
  );
}

/** Home: For you | Following, section chips, trending topics, then the feed. */
function HomePage() {
  const { t } = useTranslation();
  const { tab = "foryou" } = Route.useSearch();
  const tabCls = (on: boolean) =>
    cn("relative flex-1 py-3 text-center text-[15px] font-semibold", on ? "text-foreground" : "text-muted-foreground");
  const bar = <span className="absolute inset-x-1/3 bottom-0 h-1 rounded-full bg-primary" />;

  return (
    <>
      <AppHeader right={<HomeHeaderActions />} />
      <div className="sticky top-[calc(env(safe-area-inset-top,0px)+4rem)] z-20 flex border-b border-border bg-background/90 backdrop-blur">
        <Link to="/" search={{}} className={tabCls(tab === "foryou")}>
          {t("posts.forYou")}
          {tab === "foryou" && bar}
        </Link>
        <Link to="/" search={{ tab: "following" }} className={tabCls(tab === "following")}>
          {t("posts.following")}
          {tab === "following" && bar}
        </Link>
      </div>
      <div className="pt-3">
        {tab === "foryou" && (
          <>
            <DailyTopicCard />
            <SectionChips />
            <TopicStrip />
          </>
        )}
        <FeedList
          key={tab}
          params={{ scope: tab === "following" ? "following" : "foryou" }}
          empty={
            <EmptyState
              title={t(tab === "following" ? "posts.emptyFollowingTitle" : "posts.emptyTitle")}
              text={t(tab === "following" ? "posts.emptyFollowing" : "posts.empty")}
              action={<RecordCta />}
            />
          }
        />
      </div>
    </>
  );
}
