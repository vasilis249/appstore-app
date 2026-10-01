import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AudioLines, GraduationCap, Headphones, MessageCircle, Play, Plus, RadioTower, UserPlus } from "lucide-react";
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
import { cn } from "@/lib/utils";

const compact = new Intl.NumberFormat(undefined, { notation: "compact" });

/**
 * A profile laid out like Instagram: photo + name + counts (tap → lists), school, the action buttons (yours: Edit ·
 * Share · find people; theirs: Follow · Message · walkie-talkie), your groups as round "highlights", then two icon
 * tabs: voices (a 3-column grid of voice tiles) and replies (a list).
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
  const button = "flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 truncate whitespace-nowrap rounded-lg bg-secondary px-2 text-[13.5px] font-semibold";
  const square = "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary";

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
      <section className="px-4 pt-2 animate-fade-in-up">
        <div className="flex items-center gap-6">
          <div className="relative shrink-0">
            <UserAvatar name={name} path={person.avatar_path} size={86} />
            {isMe && (
              <Link
                to="/record"
                aria-label={t("stories.add")}
                className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full border-[3px] border-background bg-foreground text-background"
              >
                <Plus className="h-4 w-4" strokeWidth={3} />
              </Link>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold tracking-normal">{name}</h1>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <div className="flex flex-col">
                <span className="text-[17px] font-bold tabular-nums leading-tight">{s ? compact.format(s.posts) : "–"}</span>
                <span className="text-[14px] leading-tight">{t("people.voices").toLowerCase()}</span>
              </div>
              <button type="button" className="flex flex-col text-left" onClick={() => setTab("followers")}>
                <span className="text-[17px] font-bold tabular-nums leading-tight">{s ? compact.format(s.followers) : "–"}</span>
                <span className="text-[14px] leading-tight">{t("people.followers").toLowerCase()}</span>
              </button>
              <button type="button" className="flex flex-col text-left" onClick={() => setTab("following")}>
                <span className="text-[17px] font-bold tabular-nums leading-tight">{s ? compact.format(s.following) : "–"}</span>
                <span className="text-[14px] leading-tight">{t("people.followingCount").toLowerCase()}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
          {school ? (
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <GraduationCap className="h-4 w-4" /> {school}
            </span>
          ) : (
            isMe &&
            campus.loaded && (
              <Link to="/student" className="inline-flex items-center gap-1.5 font-semibold text-link">
                <GraduationCap className="h-4 w-4" /> {t("student.cta")}
              </Link>
            )
          )}
          {!isMe && s?.follows_me && <span className="rounded-md bg-secondary px-1.5 py-0.5 text-fine font-semibold">{t("people.followsYou")}</span>}
        </div>

        <div className="mt-3 flex gap-1.5">
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

      <div role="tablist" className="mt-3 grid grid-cols-2 border-b border-border">
        {(["voices", "replies"] as const).map((k) => {
          const Icon = k === "voices" ? AudioLines : MessageCircle;
          const on = view === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={t(k === "voices" ? "people.voices" : "people.replies")}
              onClick={() => setView(k)}
              className={cn("relative grid h-12 place-items-center", on ? "text-foreground" : "text-muted-foreground")}
            >
              <Icon className="h-6 w-6" strokeWidth={on ? 2.2 : 1.8} />
              <span className={cn("absolute inset-x-6 bottom-0 h-[1.5px] bg-foreground transition-transform duration-300", on ? "scale-x-100" : "scale-x-0")} />
            </button>
          );
        })}
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
  const item = "flex w-[72px] shrink-0 flex-col items-center gap-1.5";
  return (
    <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto px-4 stagger">
      <Link to="/groups/new" className={item}>
        <span className="grid h-16 w-16 place-items-center rounded-full ring-1 ring-border">
          <Plus className="h-7 w-7" strokeWidth={1.6} />
        </span>
        <span className="w-full truncate text-center text-fine">{t("profile.newGroup")}</span>
      </Link>
      {(mine.data ?? []).map((g) => (
        <Link key={g.id} to="/g/$groupId" params={{ groupId: g.id }} className={item}>
          <span className="grid h-16 w-16 place-items-center rounded-full p-[3px] ring-1 ring-border">
            <span className="grid h-full w-full place-items-center overflow-hidden rounded-full [&>span]:rounded-full">
              <GroupTile section={g.section_id} size={58} />
            </span>
          </span>
          <span className="w-full truncate text-center text-fine">{g.name}</span>
        </Link>
      ))}
    </div>
  );
}

/** Voices as a 3-column grid of tiles (title, length, listens); a tap opens the voice. */
function VoiceGrid({ params, isMe }: { params: FeedParams; isMe: boolean }) {
  const { t } = useTranslation();
  const q = useInfiniteQuery({
    queryKey: postKeys.feed(params),
    queryFn: ({ pageParam }) => fetchFeed(params, pageParam),
    initialPageParam: undefined as string | number | undefined,
    getNextPageParam: (last, all) => (last.length ? nextCursor(params.scope, last, all) : undefined),
  });
  const views = (q.data?.pages.flat() ?? []).map(toView).filter((v): v is NonNullable<typeof v> => !!v && !v.deleted && !v.repostedBy);
  if (q.isLoading)
    return (
      <div className="grid grid-cols-3 gap-[2px]">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="skeleton aspect-[3/4]" />
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
            <Link to="/record" className="inline-flex h-11 items-center rounded-lg bg-primary px-6 text-[15px] font-semibold text-primary-foreground">
              {t("posts.speak")}
            </Link>
          ) : undefined
        }
      />
    );
  return (
    <>
      <div className="grid grid-cols-3 gap-[2px] stagger">
        {views.map((v) => (
          <Link
            key={v.id}
            to="/p/$postId"
            params={{ postId: v.id }}
            className="relative flex aspect-[3/4] flex-col justify-between overflow-hidden bg-secondary p-2.5 active:opacity-80"
          >
            <VoiceIcon className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
            <span className="line-clamp-4 text-[13px] font-semibold leading-snug">{v.title || t("posts.untitled")}</span>
            <span className="flex items-center justify-between text-fine font-semibold text-muted-foreground">
              <span className="flex items-center gap-1">
                <Play className="h-3 w-3" fill="currentColor" strokeWidth={0} /> {formatClock(v.durationMs)}
              </span>
              {v.listens > 0 && (
                <span className="flex items-center gap-0.5">
                  <Headphones className="h-3 w-3" /> {compact.format(v.listens)}
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>
      {q.hasNextPage && (
        <button type="button" onClick={() => void q.fetchNextPage()} className="mx-auto my-4 block text-caption font-semibold text-link">
          {t("news.more")}
        </button>
      )}
    </>
  );
}
