import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { GraduationCap, MessageCircle, Play, Plus, RadioTower, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FollowButton } from "@/components/friends/follow-button";
import { FeedList } from "@/components/posts/feed-list";
import { FollowListSheet, type FollowTab } from "@/components/people/follow-list-sheet";
import { GroupTile } from "@/components/groups/group-row";
import { UserAvatar } from "@/components/user-avatar";
import { VoiceIcon } from "@/components/voice/voice-icon";
import { friendKeys, profileStats, type Person } from "@/lib/friends";
import { groupKeys, myGroups } from "@/lib/groups";
import { useCampus } from "@/lib/campus";
import { formatClock } from "@/lib/audio";
import { fetchFeed, nextCursor, postKeys, toView, type FeedParams } from "@/lib/posts";
import { timeAgoShort } from "@/lib/time-ago";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const compact = new Intl.NumberFormat(undefined, { notation: "compact" });

/**
 * A profile (DESIGN.md, Quiet): photo + counts (tap → lists), name, the school as an indigo badge, the action buttons
 * (yours: Edit · Share · find people; theirs: Follow · Message · walkie-talkie), your groups as rounded tiles, then
 * text tabs Φωνές | Απαντήσεις with a gliding line: voices as compact rows, replies as the feed.
 */
export function ProfileView({ person, isMe, onEdit }: { person: Person; isMe: boolean; onEdit?: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FollowTab | null>(null);
  const [view, setView] = useState<"voices" | "replies">("voices");
  const stats = useQuery({ queryKey: friendKeys.stats(person.id), queryFn: () => profileStats(person.id) });
  const campus = useCampus();
  const school = campus.label(person);
  const s = stats.data;
  const name = person.full_name || person.username;
  const button = "flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 truncate whitespace-nowrap rounded-lg bg-secondary px-2 text-caption font-semibold";
  const square = "grid h-9 w-11 shrink-0 place-items-center rounded-lg bg-secondary";

  async function shareProfile() {
    const url = `${window.location.origin}/u/${person.username}`;
    try {
      if (navigator.share) await navigator.share({ url, title: name });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("friends.copied"));
      }
    } catch {
      /* cancelled */
    }
  }

  return (
    <>
      <section className="px-4 pt-3 animate-fade-in-up">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <UserAvatar name={name} path={person.avatar_path} size={80} />
            {isMe && (
              <Link
                to="/record"
                aria-label={t("stories.add")}
                className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-foreground text-background"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
              </Link>
            )}
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-3 text-center">
            <div className="py-1.5">
              <span className="block text-[19px] font-bold tabular-nums leading-tight tracking-[-0.02em]">{s ? compact.format(s.posts) : "–"}</span>
              <span className="block text-fine text-muted-foreground">{t("people.voices")}</span>
            </div>
            <button type="button" className="py-1.5" onClick={() => setTab("followers")}>
              <span className="block text-[19px] font-bold tabular-nums leading-tight tracking-[-0.02em]">{s ? compact.format(s.followers) : "–"}</span>
              <span className="block text-fine text-muted-foreground">{t("people.followers")}</span>
            </button>
            <button type="button" className="py-1.5" onClick={() => setTab("following")}>
              <span className="block text-[19px] font-bold tabular-nums leading-tight tracking-[-0.02em]">{s ? compact.format(s.following) : "–"}</span>
              <span className="block text-fine text-muted-foreground">{t("people.followingCount")}</span>
            </button>
          </div>
        </div>

        <h1 className="mt-3.5 truncate text-[17px] font-[650] tracking-[-0.015em]">{name}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {school ? (
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-link/10 px-2.5 text-caption font-semibold text-link">
              <GraduationCap className="h-3.5 w-3.5" /> {school}
            </span>
          ) : (
            isMe &&
            campus.loaded && (
              <Link to="/student" className="inline-flex items-center gap-1.5 text-caption font-semibold text-link">
                <GraduationCap className="h-4 w-4" /> {t("student.cta")}
              </Link>
            )
          )}
          {!isMe && s?.follows_me && <span className="rounded-md bg-secondary px-1.5 py-0.5 text-fine font-semibold">{t("people.followsYou")}</span>}
        </div>

        <div className="mt-4 flex gap-2">
          {isMe ? (
            <>
              <button type="button" onClick={onEdit} className={button}>
                {t("profile.edit")}
              </button>
              <button type="button" onClick={() => void shareProfile()} className={button}>
                {t("profile.share")}
              </button>
              <Link to="/search" aria-label={t("home.findPeople")} className={square}>
                <UserPlus className="h-[18px] w-[18px]" />
              </Link>
            </>
          ) : (
            s && (
              <>
                <div className="flex min-w-0 flex-1 [&>button]:h-9 [&>button]:w-full [&>button]:rounded-lg [&>button]:text-[14px]">
                  <FollowButton userId={person.id} following={s.i_follow} followsMe={s.follows_me} size="lg" />
                </div>
                {s.i_follow && s.follows_me && (
                  <Link to="/messages/$userId" params={{ userId: person.id }} className={button}>
                    {t("people.message")}
                  </Link>
                )}
                {s.i_follow && s.follows_me && (
                  <Link to="/talk/$userId" params={{ userId: person.id }} aria-label={t("walkie.title")} className={square}>
                    <RadioTower className="h-[18px] w-[18px]" />
                  </Link>
                )}
              </>
            )
          )}
        </div>
      </section>

      {isMe && <GroupHighlights />}

      <div role="tablist" className="relative mt-4 grid grid-cols-2 border-b border-border">
        {(["voices", "replies"] as const).map((k) => {
          const on = view === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                if (!on) haptic("light");
                setView(k);
              }}
              className={cn("h-11 text-callout", on ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}
            >
              {t(k === "voices" ? "people.voices" : "people.replies")}
            </button>
          );
        })}
        <span
          aria-hidden
          className="nav-pill pointer-events-none absolute -bottom-px left-0 flex h-0.5 w-1/2 justify-center"
          style={{ transform: `translateX(${view === "voices" ? 0 : 100}%)` }}
        >
          <span className="h-0.5 w-10 rounded-full bg-foreground" />
        </span>
      </div>
      {view === "voices" ? (
        <VoiceGrid key={person.id} params={{ scope: "author", author: person.id }} isMe={isMe} />
      ) : (
        <FeedList
          key={`${person.id}-replies`}
          params={{ scope: "author_replies", author: person.id }}
          empty={<EmptyState icon={MessageCircle} text={t("people.noReplies")} />}
        />
      )}
      <FollowListSheet userId={person.id} tab={tab} onTab={setTab} onOpenChange={(o) => !o && setTab(null)} />
    </>
  );
}

/** Your groups as round "highlights" (+ New group), like story highlights. */
function GroupHighlights() {
  const { t } = useTranslation();
  const mine = useQuery({ queryKey: groupKeys.mine, queryFn: myGroups });
  const item = "flex w-[62px] shrink-0 flex-col items-center gap-1.5";
  return (
    <div className="no-scrollbar mt-5 flex gap-4 overflow-x-auto px-4 stagger">
      <Link to="/groups/new" className={item}>
        <span className="grid h-[58px] w-[58px] place-items-center rounded-[18px] border border-dashed border-border text-muted-foreground">
          <Plus className="h-6 w-6" strokeWidth={1.6} />
        </span>
        <span className="w-full truncate text-center text-fine text-muted-foreground">{t("profile.newGroup")}</span>
      </Link>
      {(mine.data ?? []).map((g) => (
        <Link key={g.id} to="/g/$groupId" params={{ groupId: g.id }} className={item}>
          <span className="grid h-[58px] w-[58px] place-items-center overflow-hidden rounded-[18px] [&>span]:rounded-[18px]">
            <GroupTile section={g.section_id} size={58} />
          </span>
          <span className="w-full truncate text-center text-fine text-muted-foreground">{g.name}</span>
        </Link>
      ))}
    </div>
  );
}

/** Voices as compact rows (play mark, title, when, length); a tap opens the voice. */
function VoiceGrid({ params, isMe }: { params: FeedParams; isMe: boolean }) {
  const { t, i18n } = useTranslation();
  const q = useInfiniteQuery({
    queryKey: postKeys.feed(params),
    queryFn: ({ pageParam }) => fetchFeed(params, pageParam),
    initialPageParam: undefined as string | number | undefined,
    getNextPageParam: (last, all) => (last.length ? nextCursor(params.scope, last, all) : undefined),
  });
  const views = (q.data?.pages.flat() ?? []).map(toView).filter((v): v is NonNullable<typeof v> => !!v && !v.deleted && !v.repostedBy);
  if (q.isLoading)
    return (
      <div className="space-y-3 px-4 py-4">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="skeleton block h-12 rounded-xl" />
        ))}
      </div>
    );
  if (!views.length)
    return (
      <EmptyState
        icon={VoiceIcon}
        text={isMe ? t("people.noVoicesMine") : t("people.noVoices")}
        action={
          isMe ? (
            <Link to="/record" className="inline-flex h-11 items-center rounded-xl bg-primary px-6 text-callout font-semibold text-primary-foreground">
              {t("posts.speak")}
            </Link>
          ) : undefined
        }
      />
    );
  return (
    <>
      <ul className="stagger">
        {views.map((v) => (
          <li key={v.id}>
            <Link to="/p/$postId" params={{ postId: v.id }} className="flex items-center gap-3 border-b border-border px-4 py-3 active:bg-secondary/60">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary">
                <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-callout font-medium">{v.title || t("posts.untitled")}</span>
                <span className="block truncate text-caption tabular-nums text-muted-foreground">
                  {[timeAgoShort(v.createdAt, i18n.language), v.likes > 0 ? `${compact.format(v.likes)} ♥` : null, v.listens > 0 ? t("posts.listens", { count: v.listens }) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-caption tabular-nums text-muted-foreground">{formatClock(v.durationMs)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {q.hasNextPage && (
        <button type="button" onClick={() => void q.fetchNextPage()} className="mx-auto my-4 block text-caption font-semibold text-link">
          {t("news.more")}
        </button>
      )}
    </>
  );
}
