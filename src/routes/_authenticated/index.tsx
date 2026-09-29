import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Play, Search } from "lucide-react";
import { AppHeader, HomeHeaderActions } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FeedList } from "@/components/posts/feed-list";
import { TopicStrip } from "@/components/posts/topic-strip";
import { DailyTopicCard } from "@/components/posts/daily-topic-card";
import { MyGroupsStrip } from "@/components/groups/my-groups-strip";
import { UserAvatar } from "@/components/user-avatar";
import { useMyProfile } from "@/hooks/use-my-profile";
import { useSections } from "@/hooks/use-sections";
import type { FeedParams } from "@/lib/posts";
import { cn } from "@/lib/utils";

type Tab = "news" | "following" | "groups";
const TABS: Tab[] = ["news", "following", "groups"];

export const Route = createFileRoute("/_authenticated/")({
  // ?tab=following|groups, ?s=<section> inside News. Old links ?tab=<section> still land in that section.
  validateSearch: (s: Record<string, unknown>): { tab?: Tab; s?: string } => {
    const tab = typeof s.tab === "string" ? s.tab : undefined;
    const section = typeof s.s === "string" && /^[a-z_-]{2,30}$/.test(s.s) ? s.s : undefined;
    if (tab === "following" || tab === "groups") return { tab };
    if (tab && tab !== "news" && /^[a-z_-]{2,30}$/.test(tab) && tab !== "foryou") return { s: tab };
    return section ? { s: section } : {};
  },
  component: HomePage,
});

/**
 * Home in three parts: News (every section, ranked; chips for one section, the topic of the day, trends),
 * Following (personal voices of the people you follow) and Groups. A round ▶ plays the list you're looking at.
 */
function HomePage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  // Anything unknown in ?tab (e.g. an old ?tab=<section> link) means News.
  const tab: Tab = TABS.includes(search.tab as Tab) ? (search.tab as Tab) : "news";
  const section = tab === "news" ? search.s : undefined;
  const playAll = useRef<(() => void) | null>(null);

  const params: FeedParams =
    tab === "following"
      ? { scope: "personal" }
      : tab === "groups"
        ? { scope: "groups" }
        : section
          ? { scope: "section", section }
          : { scope: "news" };

  return (
    <>
      <AppHeader right={<HomeHeaderActions />} />
      <div className="sticky top-[calc(env(safe-area-inset-top,0px)+4rem)] z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="flex items-center">
          <nav className="flex flex-1">
            {TABS.map((x) => {
              const on = x === tab;
              return (
                <Link
                  key={x}
                  to="/"
                  search={x === "news" ? {} : { tab: x }}
                  replace
                  className={cn("relative flex-1 py-3 text-center text-base font-semibold transition-colors", on ? "text-foreground" : "text-muted-foreground")}
                >
                  {t(`home.${x}`)}
                  {on && <span className="absolute inset-x-1/4 bottom-0 h-[3px] rounded-full bg-primary" />}
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
        {tab === "news" && <SectionPills active={section} />}
      </div>

      {tab === "news" && !section && <DailyTopicCard />}
      {tab === "news" && <TopicStrip variant="pills" section={section} />}
      {tab === "following" && <SayYourOwn />}
      {tab === "groups" && <MyGroupsStrip />}

      <div className="pt-2">
        <FeedList key={`${tab}-${section ?? ""}`} playAllRef={playAll} params={params} empty={<Empty tab={tab} section={section} />} />
      </div>
    </>
  );
}

/** News → All · Επικαιρότητα · Tech · … (small pills, the chosen one white). */
function SectionPills({ active }: { active?: string }) {
  const { t } = useTranslation();
  const { sections, name } = useSections();
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bar.current?.querySelector<HTMLElement>("[data-active=true]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active, sections.length]);
  const pill = (on: boolean) =>
    cn("h-8 shrink-0 rounded-full px-3.5 text-sm font-semibold leading-8 transition-colors", on ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground");
  return (
    <nav ref={bar} className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5">
      <Link to="/" search={{}} replace data-active={!active} className={pill(!active)}>
        {t("home.all")}
      </Link>
      {sections.map((x) => (
        <Link key={x.id} to="/" search={{ s: x.id }} replace data-active={x.id === active} className={pill(x.id === active)}>
          {name(x.id)}
        </Link>
      ))}
    </nav>
  );
}

/** Following: a one-line prompt to post something personal. */
function SayYourOwn() {
  const { t } = useTranslation();
  const me = useMyProfile();
  const name = me.data?.full_name || me.data?.username || "";
  return (
    <Link to="/record" className="mx-4 mt-3 flex items-center gap-3 rounded-full bg-secondary py-1.5 pl-1.5 pr-2">
      <UserAvatar name={name} path={me.data?.avatar_path ?? null} size={36} />
      <span className="flex-1 text-[15px] text-muted-foreground">{t("home.sayYourOwn")}</span>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
        <Mic className="h-4 w-4" />
      </span>
    </Link>
  );
}

function Empty({ tab, section }: { tab: Tab; section?: string }) {
  const { t } = useTranslation();
  const pill = "inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 font-semibold text-primary-foreground";
  if (tab === "groups")
    return (
      <EmptyState
        title={t("groups.emptyHomeTitle")}
        text={t("groups.emptyHome")}
        action={
          <Link to="/groups" className={pill}>
            {t("groups.find")}
          </Link>
        }
      />
    );
  if (tab === "following")
    return (
      <EmptyState
        title={t("home.emptyFollowingTitle")}
        text={t("home.emptyFollowing")}
        action={
          <Link to="/search" className={pill}>
            <Search className="h-5 w-5" /> {t("home.findPeople")}
          </Link>
        }
      />
    );
  return (
    <EmptyState
      title={t("posts.emptyTitle")}
      text={t("posts.empty")}
      action={
        <Link to="/record" search={section ? { section } : { news: 1 }} className={pill}>
          <Mic className="h-5 w-5" /> {t("posts.speak")}
        </Link>
      }
    />
  );
}
