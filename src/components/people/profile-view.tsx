import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Mic, Send } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FollowButton } from "@/components/friends/follow-button";
import { FeedList } from "@/components/posts/feed-list";
import { FollowListSheet, type FollowTab } from "@/components/people/follow-list-sheet";
import { UserAvatar } from "@/components/user-avatar";
import { friendKeys, profileStats, type Person } from "@/lib/friends";

const compact = new Intl.NumberFormat(undefined, { notation: "compact" });

/** Avatar, name, @username, counts (tap → lists), Follow / Message or your own action, then their voices. */
export function ProfileView({ person, isMe, ownAction }: { person: Person; isMe: boolean; ownAction?: React.ReactNode }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FollowTab | null>(null);
  const stats = useQuery({ queryKey: friendKeys.stats(person.id), queryFn: () => profileStats(person.id) });
  const s = stats.data;
  const name = person.full_name || person.username;
  const count = "flex flex-col items-center";

  return (
    <>
      <section className="flex flex-col items-center px-4 pb-4 pt-4 text-center">
        <UserAvatar name={name} path={person.avatar_path} size={96} />
        <h1 className="mt-3 text-2xl font-bold">{name}</h1>
        <p className="text-muted-foreground">
          @{person.username}
          {!isMe && s?.follows_me && <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs">{t("people.followsYou")}</span>}
        </p>
        <div className="mt-4 flex gap-8">
          <div className={count}>
            <span className="text-lg font-bold tabular-nums">{s ? compact.format(s.posts) : "–"}</span>
            <span className="text-xs text-muted-foreground">{t("people.voices")}</span>
          </div>
          <button type="button" className={count} onClick={() => setTab("followers")}>
            <span className="text-lg font-bold tabular-nums">{s ? compact.format(s.followers) : "–"}</span>
            <span className="text-xs text-muted-foreground">{t("people.followers")}</span>
          </button>
          <button type="button" className={count} onClick={() => setTab("following")}>
            <span className="text-lg font-bold tabular-nums">{s ? compact.format(s.following) : "–"}</span>
            <span className="text-xs text-muted-foreground">{t("people.followingCount")}</span>
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          {isMe
            ? ownAction
            : s && (
                <>
                  <FollowButton userId={person.id} following={s.i_follow} followsMe={s.follows_me} size="lg" />
                  {s.i_follow && s.follows_me && (
                    <Link
                      to="/messages/$userId"
                      params={{ userId: person.id }}
                      className="flex h-10 items-center gap-2 rounded-full bg-secondary px-5 text-sm font-semibold"
                    >
                      <Send className="h-4 w-4" /> {t("people.message")}
                    </Link>
                  )}
                </>
              )}
        </div>
      </section>
      <div className="border-t border-border pt-2">
        <FeedList
          key={person.id}
          params={{ scope: "author", author: person.id }}
          empty={
            <EmptyState
              icon={Mic}
              text={isMe ? t("people.noVoicesMine") : t("people.noVoices")}
              action={
                isMe ? (
                  <Link to="/record" className="inline-flex h-12 items-center rounded-2xl bg-primary px-8 font-semibold text-primary-foreground">
                    {t("posts.speak")}
                  </Link>
                ) : undefined
              }
            />
          }
        />
      </div>
      <FollowListSheet userId={person.id} tab={tab} onTab={setTab} onOpenChange={(o) => !o && setTab(null)} />
    </>
  );
}
