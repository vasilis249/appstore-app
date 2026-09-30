import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { GraduationCap, Play, Search } from "lucide-react";
import { AppHeader, HomeHeaderActions } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FeedList } from "@/components/posts/feed-list";
import { NewsCard } from "@/components/posts/news-card";
import { MyGroupsStrip } from "@/components/groups/my-groups-strip";
import { UserAvatar } from "@/components/user-avatar";
import { useMyProfile } from "@/hooks/use-my-profile";
import { useSections } from "@/hooks/use-sections";
import { campusTopics, NEWS_PAGE, newsTopics, postKeys, type FeedParams, type NewsTopic, type Section } from "@/lib/posts";
import { useCampus } from "@/lib/campus";
import { friendKeys, suggestedPeople } from "@/lib/friends";
import { FollowButton } from "@/components/friends/follow-button";
import { timeAgoShort } from "@/lib/time-ago";
import { dailyKeys, getToday } from "@/lib/daily";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { VoiceIcon } from "@/components/voice/voice-icon";

type Tab = "campus" | "following" | "groups" | "news";
const TABS: Tab[] = ["campus", "following", "groups", "news"];

export const Route = createFileRoute("/_authenticated/")({
  // ?tab=campus|following|groups|news, ?s=<section> inside Campus or News. No tab: Campus for verified students, else
  // News (?s alone = News, as old links; old ?tab=<section> still lands in that News section).
  validateSearch: (s: Record<string, unknown>): { tab?: Tab; s?: string } => {
    const tab = typeof s.tab === "string" ? s.tab : undefined;
    const section = typeof s.s === "string" && /^[a-z_-]{2,30}$/.test(s.s) ? s.s : undefined;
    if (tab === "following" || tab === "groups") return { tab };
    if (tab === "campus" || tab === "news") return section ? { tab, s: section } : { tab };
    if (tab && /^[a-z_-]{2,30}$/.test(tab) && tab !== "foryou") return { tab: "news", s: tab };
    return section ? { tab: "news", s: section } : {};
  },
  component: HomePage,
});

/**
 * Home in four parts: your Campus first (ΕΜΠ: its topic of the day, news, student sections and classmates' voices —
 * students only), then Following (personal voices of the people you follow), Groups and News (every section, ranked).
 * A round ▶ plays the list you're looking at.
 */
function HomePage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const me = useMyProfile();
  const campus = useCampus();
  const verified = !!me.data?.university_id;
  // No tab in the URL: Campus for verified students, News for everyone else (wait for the profile to know).
  const tab: Tab | null = search.tab ?? (me.data ? (verified ? "campus" : "news") : null);
  const section = tab === "news" || tab === "campus" ? search.s : undefined;
  const playAll = useRef<(() => void) | null>(null);

  const params: FeedParams = tab === "following" ? { scope: "personal" } : { scope: "groups" };
  const label = (x: Tab) => (x === "campus" ? campus.label({ university_id: me.data?.university_id }) || t("home.campus") : t(`home.${x}`));
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
                  search={{ tab: x }}
                  replace
                  className={cn("relative flex-1 py-3 text-center text-[15px] font-semibold transition-colors", on ? "text-foreground" : "text-muted-foreground")}
                >
                  {label(x)}
                  {on && <span className="absolute inset-x-1/4 bottom-0 h-[3px] rounded-full bg-primary" />}
                </Link>
              );
            })}
          </nav>
          {tab && tab !== "news" && !(tab === "campus" && !verified) && (
            <button
              type="button"
              onClick={() => playAll.current?.()}
              aria-label={t("posts.playAll")}
              className="mx-3 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground active:scale-95"
            >
              <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
            </button>
          )}
        </div>
        {tab === "news" && <SectionPills tab="news" active={section} />}
        {tab === "campus" && verified && <SectionPills tab="campus" active={section} />}
      </div>

      {tab === null ? null : tab === "campus" ? (
        verified ? (
          <CampusView key={section ?? "all"} section={section} playAllRef={playAll} />
        ) : (
          <EmptyState
            icon={GraduationCap}
            title={t("campus.lockedTitle")}
            text={t("campus.locked")}
            action={
              <Link to="/student" className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 font-semibold text-primary-foreground">
                {t("campus.verify")}
              </Link>
            }
          />
        )
      ) : tab === "news" ? (
        <NewsList key={section ?? "all"} section={section} />
      ) : (
        <>
          {tab === "following" && <SayYourOwn />}
          {tab === "groups" && <MyGroupsStrip />}
          <div className="pt-2">
            <FeedList key={tab} playAllRef={playAll} params={params} empty={<Empty tab={tab} />} />
          </div>
        </>
      )}
    </>
  );
}

/**
 * News: headline cards (photo, title, who spoke), the topic of the day first; "More news" pages on; then the
 * voices filed in the section that aren't about a headline.
 */
function NewsList({ section }: { section?: string }) {
  const { t } = useTranslation();
  const q = useInfiniteQuery({
    queryKey: postKeys.news(section),
    queryFn: ({ pageParam }) => newsTopics(section, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length < NEWS_PAGE ? undefined : all.reduce((n, p) => n + p.length, 0)),
  });
  const today = useQuery({ queryKey: dailyKeys.today, queryFn: getToday });
  const dailyId = today.data?.topic_id ?? null;
  // Pages are by last activity, so a headline that got a voice meanwhile can come back on the next page: once each.
  const topics = useMemo(() => {
    const seen = new Set<string>();
    return (q.data?.pages.flat() ?? []).filter((x) => !seen.has(x.id) && !!seen.add(x.id));
  }, [q.data]);
  // The server puts the topic of the day first; this keeps it there while today() and the list refresh apart.
  const ordered = !section && dailyId ? [...topics.filter((x) => x.id === dailyId), ...topics.filter((x) => x.id !== dailyId)] : topics;

  return (
    <div className="pt-2">
      {q.data && !topics.length && <EmptyState title={t("news.emptyTitle")} text={t("news.empty")} />}
      {ordered.map((tp) => (
        <NewsCard key={tp.id} topic={tp} daily={tp.id === dailyId} />
      ))}
      {q.hasNextPage && (
        <div className="px-4 pb-4">
          <button
            type="button"
            disabled={q.isFetchingNextPage}
            onClick={() => void q.fetchNextPage()}
            className="h-11 w-full rounded-full bg-secondary text-[15px] font-semibold disabled:opacity-50"
          >
            {t("news.more")}
          </button>
        </div>
      )}
      {q.data && (
        <section className="border-t border-border pt-4">
          <h2 className="px-4 pb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("news.otherVoices")}</h2>
          <FeedList key={`loose-${section ?? ""}`} params={{ scope: "loose", section }} playAll={false} empty={<OtherVoicesEmpty section={section} />} />
        </section>
      )}
    </div>
  );
}

function OtherVoicesEmpty({ section }: { section?: string }) {
  const { t } = useTranslation();
  return (
    <Link to="/record" search={section ? { section } : { news: 1 }} className="mx-4 my-3 flex items-center gap-3 rounded-full bg-secondary py-1.5 pl-4 pr-2 text-[15px] text-muted-foreground">
      <span className="flex-1">{t("news.otherVoicesEmpty")}</span>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
        <VoiceIcon className="h-5 w-5" />
      </span>
    </Link>
  );
}

/**
 * Your campus: its topic of the day (big card), a few campus headlines (announcements, events), "Say something on
 * campus" and classmates' voices, newest first. Only students of the university see any of it.
 */
function CampusView({ section, playAllRef }: { section?: string; playAllRef: React.MutableRefObject<(() => void) | null> }) {
  const { t } = useTranslation();
  const topics = useQuery({ queryKey: postKeys.campusTopics(section), queryFn: () => campusTopics(section, 4) });
  const daily = topics.data?.find((x) => x.is_daily);
  const rest = (topics.data ?? []).filter((x) => !x.is_daily).slice(0, 3);
  return (
    <div className="pt-2">
      {daily && <NewsCard topic={daily} daily />}
      {rest.length > 0 && (
        <ul className="mx-4 mb-3 divide-y divide-border rounded-2xl bg-secondary/60">
          {rest.map((tp) => (
            <CampusTopicRow key={tp.id} topic={tp} />
          ))}
        </ul>
      )}
      {!section && <ClassmatesStrip />}
      <Link
        to="/record"
        search={section ? { campus: 1, section } : { campus: 1 }}
        className="mx-4 mb-2 flex items-center gap-3 rounded-full bg-secondary py-1.5 pl-4 pr-2 text-[15px] text-muted-foreground"
      >
        <span className="flex-1">{t("campus.say")}</span>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
          <VoiceIcon className="h-4 w-4" />
        </span>
      </Link>
      <FeedList
        key={`campus-${section ?? ""}`}
        params={{ scope: "campus", section }}
        playAllRef={playAllRef}
        empty={<EmptyState title={t("campus.emptyTitle")} text={t("campus.empty")} />}
      />
    </div>
  );
}

/** Classmates to follow (same school and year first): friends make DMs and the walkie-talkie possible. */
function ClassmatesStrip() {
  const { t } = useTranslation();
  const campus = useCampus();
  const q = useQuery({ queryKey: friendKeys.suggested, queryFn: () => suggestedPeople(15) });
  const people = (q.data ?? []).filter((p) => p.reason === "classmate" || p.reason === "school").slice(0, 10);
  if (!people.length) return null;
  return (
    <section className="mb-3">
      <h2 className="px-4 pb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("people.classmates")}</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4">
        {people.map((p) => (
          <div key={p.id} className="flex w-32 shrink-0 flex-col items-center rounded-2xl bg-secondary/60 p-3 text-center">
            <Link to="/u/$username" params={{ username: p.username }} className="flex w-full flex-col items-center">
              <UserAvatar name={p.full_name || p.username} path={p.avatar_path} size={56} />
              <span className="mt-2 w-full truncate text-sm font-semibold">{(p.full_name || p.username).split(" ")[0]}</span>
              <span className="w-full truncate text-xs text-muted-foreground">
                {[campus.label(p).split(" · ").pop(), p.study_year ? t(`student.years.${p.study_year}`) : null].filter(Boolean).join(" · ")}
              </span>
            </Link>
            <div className="mt-2">
              <FollowButton userId={p.id} following={false} followsMe={p.follows_me} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CampusTopicRow({ topic }: { topic: NewsTopic }) {
  const { t, i18n } = useTranslation();
  return (
    <li>
      <Link to="/t/$topicId" params={{ topicId: topic.id }} className="block px-4 py-3 active:opacity-70">
        <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{topic.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[topic.source_name, timeAgoShort(topic.created_at, i18n.language), topic.posts_count > 0 ? t("posts.voicesCount", { count: topic.posts_count }) : t("news.beFirst")]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </Link>
    </li>
  );
}

/** News or Campus → Όλα · <sections> (small pills, the chosen one white). */
function SectionPills({ tab, active }: { tab: "news" | "campus"; active?: string }) {
  const { t } = useTranslation();
  const all = useSections();
  const sections: Section[] = tab === "campus" ? all.campusSections : all.sections;
  const name = all.name;
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bar.current?.querySelector<HTMLElement>("[data-active=true]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active, sections.length]);
  const pill = (on: boolean) =>
    cn("h-8 shrink-0 rounded-full px-3.5 text-sm font-semibold leading-8 transition-colors", on ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground");
  return (
    <nav ref={bar} className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5">
      <Link to="/" search={{ tab }} replace data-active={!active} className={pill(!active)}>
        {t("home.all")}
      </Link>
      {sections.map((x) => (
        <Link key={x.id} to="/" search={{ tab, s: x.id }} replace data-active={x.id === active} className={pill(x.id === active)}>
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
        <VoiceIcon className="h-4 w-4" />
      </span>
    </Link>
  );
}

function Empty({ tab }: { tab: Tab }) {
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
  return null;
}
