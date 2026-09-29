import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Play } from "lucide-react";
import { AppHeader, HomeHeaderActions } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FeedList } from "@/components/posts/feed-list";
import { TopicStrip } from "@/components/posts/topic-strip";
import { DailyTopicCard } from "@/components/posts/daily-topic-card";
import { MyGroupsStrip } from "@/components/groups/my-groups-strip";
import { useSections } from "@/hooks/use-sections";
import { cn } from "@/lib/utils";

/** "foryou" | "following" | "groups" | a section id (the feed filtered in place). */
type Tab = string;

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } =>
    typeof s.tab === "string" && /^[a-z_-]{2,30}$/.test(s.tab) && s.tab !== "foryou" ? { tab: s.tab } : {},
  component: HomePage,
});

function RecordCta({ section }: { section?: string }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/record"
      search={section ? { section } : {}}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 font-semibold text-primary-foreground"
    >
      <Mic className="h-5 w-5" /> {t("posts.speak")}
    </Link>
  );
}

/**
 * Home, kept quiet: one row of categories (For you · Following · every section) that filters the feed in
 * place, a round "play all" button, then the topic of the day and trending topics as a single line, then voices.
 */
function HomePage() {
  const { t } = useTranslation();
  const { tab = "foryou" } = Route.useSearch();
  const { sections, name } = useSections();
  const playAll = useRef<(() => void) | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const isSection = tab !== "foryou" && tab !== "following" && tab !== "groups";

  // Keep the chosen category in view when the row is scrolled.
  useEffect(() => {
    bar.current?.querySelector<HTMLElement>("[data-active=true]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [tab, sections.length]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "foryou", label: t("posts.forYou") },
    { id: "following", label: t("posts.following") },
    { id: "groups", label: t("groups.title") },
    ...sections.map((s) => ({ id: s.id, label: name(s.id) })),
  ];

  return (
    <>
      <AppHeader right={<HomeHeaderActions />} />
      <div className="sticky top-[calc(env(safe-area-inset-top,0px)+4rem)] z-20 flex items-center border-b border-border bg-background/90 backdrop-blur">
        <nav
          ref={bar}
          className="no-scrollbar flex flex-1 gap-5 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_85%,transparent)]"
        >
          {tabs.map((x) => {
            const on = x.id === tab;
            return (
              <Link
                key={x.id}
                to="/"
                search={x.id === "foryou" ? {} : { tab: x.id }}
                replace
                data-active={on}
                className={cn(
                  "relative shrink-0 py-3 text-[15px] font-semibold transition-colors",
                  on ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {x.label}
                {on && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => playAll.current?.()}
          aria-label={t("posts.playAll")}
          className="mx-3 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground active:scale-95"
        >
          <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
        </button>
      </div>

      {tab === "foryou" && <DailyTopicCard />}
      {(tab === "foryou" || isSection) && <TopicStrip variant="pills" section={isSection ? tab : undefined} />}
      {tab === "groups" && <MyGroupsStrip />}

      <div className="pt-2">
        <FeedList
          key={tab}
          playAllRef={playAll}
          params={isSection ? { scope: "section", section: tab } : { scope: tab === "following" || tab === "groups" ? tab : "foryou" }}
          empty={
            tab === "groups" ? (
              <EmptyState
                title={t("groups.emptyHomeTitle")}
                text={t("groups.emptyHome")}
                action={
                  <Link to="/groups" className="inline-flex h-12 items-center rounded-full bg-primary px-8 font-semibold text-primary-foreground">
                    {t("groups.find")}
                  </Link>
                }
              />
            ) : (
            <EmptyState
              title={t(tab === "following" ? "posts.emptyFollowingTitle" : "posts.emptyTitle")}
              text={t(tab === "following" ? "posts.emptyFollowing" : "posts.empty")}
              action={<RecordCta section={isSection ? tab : undefined} />}
            />
            )
          }
        />
      </div>
    </>
  );
}
