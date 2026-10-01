import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { useMyProfile } from "@/hooks/use-my-profile";
import { fetchFeed, postKeys, toView, voiceUrl, type PostView } from "@/lib/posts";
import { currentId, playQueue, useQueue } from "@/lib/queue";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const SEEN_KEY = "courtsie:storiesSeen";

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function writeSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-400)));
  } catch {
    /* private mode: rings just stay coloured */
  }
}

interface Story {
  authorId: string;
  name: string;
  username: string;
  avatar: string | null;
  voices: PostView[];
}

/**
 * "Stories" for a voice app: everyone you follow who spoke in the last 24 hours, one circle each (newest first),
 * with a thin indigo ring until you've heard them. Tap = their voices back to back (the ring spins while they play).
 * First circle = you: + records, a ring means you spoke today (tap to hear yourself).
 */
export function StoriesRow() {
  const { t } = useTranslation();
  const me = useMyProfile();
  const q = useQuery({ queryKey: [...postKeys.all, "stories"], queryFn: () => fetchFeed({ scope: "following" }), staleTime: 60_000 });
  const [seen, setSeen] = useState(readSeen);
  const queue = useQueue();
  const playingId = currentId(queue);

  const stories = useMemo(() => {
    const now = Date.now();
    const by = new Map<string, Story>();
    for (const row of q.data ?? []) {
      const v = toView(row);
      if (!v || v.deleted || v.repostedBy || now - Date.parse(v.createdAt) > DAY_MS) continue;
      const s = by.get(v.authorId) ?? { authorId: v.authorId, name: v.name, username: v.username, avatar: v.avatar, voices: [] };
      s.voices.push(v);
      by.set(v.authorId, s);
    }
    // Oldest first inside a story (like stories); people with unheard voices first.
    const list = [...by.values()].map((s) => ({ ...s, voices: [...s.voices].reverse() }));
    return list.sort((a, b) => Number(b.voices.some((v) => !seen.has(v.id))) - Number(a.voices.some((v) => !seen.has(v.id))));
  }, [q.data, seen]);

  const myId = me.data?.id;
  const mine = stories.find((s) => s.authorId === myId);
  const others = stories.filter((s) => s.authorId !== myId);

  const play = (s: Story) => {
    const unheard = s.voices.findIndex((v) => !seen.has(v.id));
    playQueue(
      s.voices.map((v) => ({ id: v.id, url: voiceUrl(v.path), durationMs: v.durationMs, title: v.title ?? v.name, author: v.name })),
      Math.max(0, unheard),
    );
    const next = new Set(seen);
    s.voices.forEach((v) => next.add(v.id));
    setSeen(next);
    writeSeen(next);
  };

  const name = me.data?.full_name || me.data?.username || "";
  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2 pt-3.5 stagger" role="list" aria-label={t("stories.title")}>
      <div role="listitem" className="flex w-[62px] shrink-0 flex-col items-center gap-1.5">
        <div className="relative">
          {mine ? (
            <button type="button" onClick={() => play(mine)} aria-label={t("stories.mine")} className={cn("story-ring block", isPlaying(mine, playingId) && "spin", mine.voices.every((v) => seen.has(v.id)) && !isPlaying(mine, playingId) && "seen")}>
              <UserAvatar name={name} path={me.data?.avatar_path ?? null} size={51} />
            </button>
          ) : (
            <Link to="/record" aria-label={t("stories.add")} className="block p-[3.5px]">
              <UserAvatar name={name} path={me.data?.avatar_path ?? null} size={51} />
            </Link>
          )}
          <Link
            to="/record"
            aria-label={t("stories.add")}
            className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-background bg-foreground text-background"
          >
            <Plus className="h-3 w-3" strokeWidth={3} />
          </Link>
        </div>
        <span className="w-full truncate text-center text-fine text-muted-foreground">{t("stories.yours")}</span>
      </div>
      {q.isLoading &&
        [0, 1, 2, 3].map((i) => (
          <div key={i} className="flex w-[62px] shrink-0 flex-col items-center gap-1.5">
            <span className="skeleton h-[76px] w-[62px] rounded-full" />
            <span className="skeleton h-3 w-12 rounded-full" />
          </div>
        ))}
      {others.map((s) => {
        const unheard = s.voices.some((v) => !seen.has(v.id));
        const spinning = isPlaying(s, playingId);
        return (
          <div key={s.authorId} role="listitem" className="flex w-[62px] shrink-0 flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => play(s)}
              aria-label={t("stories.play", { name: s.name, count: s.voices.length })}
              className={cn("story-ring block", spinning && "spin", !unheard && !spinning && "seen")}
            >
              <UserAvatar name={s.name} path={s.avatar} size={51} />
            </button>
            <span className={cn("w-full truncate text-center text-fine", unheard ? "text-foreground" : "text-muted-foreground")}>{s.name.split(" ")[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

function isPlaying(s: Story, playingId: string | null) {
  return !!playingId && s.voices.some((v) => v.id === playingId);
}
