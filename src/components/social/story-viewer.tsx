import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Eye, Trash2, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { UserAvatar } from "@/components/social/user-avatar";
import { timeAgo } from "@/lib/time-ago";
import {
  deleteStory,
  listStoryViewers,
  listUserStories,
  markStoryViewed,
  type TrayItem,
} from "@/lib/api/stories.functions";

const DURATION_MS = 5000;

/**
 * Full-screen story player. Plays every story of `people[startIndex]`, then moves
 * on to the next person. Tap right/left to skip, hold to pause.
 */
export function StoryViewer({
  people,
  startIndex,
  onClose,
}: {
  people: TrayItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";
  const qc = useQueryClient();
  const listFn = useServerFn(listUserStories);
  const viewFn = useServerFn(markStoryViewed);
  const deleteFn = useServerFn(deleteStory);
  const [personIdx, setPersonIdx] = useState(startIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const person = people[personIdx];

  const q = useQuery({
    queryKey: ["stories", person?.user_id],
    enabled: !!person,
    queryFn: () => listFn({ data: { userId: person.user_id } }),
  });
  const stories = q.data ?? [];
  const story = stories[storyIdx];

  // Start at the first unseen story of each person.
  useEffect(() => {
    if (!q.data) return;
    const firstUnseen = q.data.findIndex((s) => !s.seen);
    setStoryIdx(firstUnseen >= 0 ? firstUnseen : 0);
    setProgress(0);
  }, [q.data]);

  useEffect(() => {
    if (story && !story.seen && !person.isMe) void viewFn({ data: { storyId: story.id } });
  }, [story, person, viewFn]);

  function next() {
    setProgress(0);
    if (storyIdx < stories.length - 1) setStoryIdx((i) => i + 1);
    else if (personIdx < people.length - 1) {
      setPersonIdx((i) => i + 1);
      setStoryIdx(0);
    } else close();
  }
  function prev() {
    setProgress(0);
    if (storyIdx > 0) setStoryIdx((i) => i - 1);
    else if (personIdx > 0) setPersonIdx((i) => i - 1);
  }
  function close() {
    void qc.invalidateQueries({ queryKey: ["story-tray"] });
    onClose();
  }

  // Timer
  const holding = paused || viewersOpen || !story;
  const last = useRef(performance.now());
  useEffect(() => {
    if (holding) return;
    last.current = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = now - last.current;
      last.current = now;
      setProgress((p) => {
        const np = p + dt / DURATION_MS;
        if (np >= 1) {
          queueMicrotask(next);
          return 1;
        }
        return np;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding, storyIdx, personIdx]);

  async function remove() {
    if (!story) return;
    await deleteFn({ data: { storyId: story.id } });
    void qc.invalidateQueries({ queryKey: ["stories", person.user_id] });
    void qc.invalidateQueries({ queryKey: ["story-tray"] });
    if (stories.length <= 1) close();
  }

  if (!person) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
      <div className="relative h-full w-full max-w-md overflow-hidden sm:h-[92vh] sm:rounded-2xl">
        {story ? (
          <img
            src={story.url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-sm text-white/70">
            {t("common.loading")}
          </div>
        )}

        <div
          className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-3 pb-6"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
        >
          <div className="flex gap-1">
            {stories.map((s, i) => (
              <span key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
                <span
                  className="block h-full bg-white"
                  style={{ width: `${i < storyIdx ? 100 : i === storyIdx ? progress * 100 : 0}%` }}
                />
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-white">
            <Link
              to="/u/$username"
              params={{ username: person.username }}
              onClick={close}
              className="flex min-w-0 items-center gap-2"
            >
              <UserAvatar
                name={person.full_name ?? person.username}
                photoUrl={person.photo_url}
                size={32}
              />
              <span className="truncate text-sm font-semibold">{person.username}</span>
            </Link>
            {story && (
              <span className="text-xs text-white/70">{timeAgo(story.created_at, locale)}</span>
            )}
            <span className="flex-1" />
            <button
              type="button"
              aria-label={t("common.close", "Κλείσιμο")}
              onClick={close}
              className="grid h-9 w-9 place-items-center"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Tap zones: left third = back, rest = next; hold anywhere = pause */}
        <button
          type="button"
          aria-label={t("stories.prev")}
          className="absolute bottom-24 left-0 top-24 w-1/3"
          onClick={prev}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
        />
        <button
          type="button"
          aria-label={t("stories.next")}
          className="absolute bottom-24 right-0 top-24 w-2/3"
          onClick={next}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
        />

        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pt-10"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        >
          {story?.caption && (
            <p className="mb-3 text-center text-base font-medium text-white drop-shadow">
              {story.caption}
            </p>
          )}
          {person.isMe && story && (
            <div className="flex items-center justify-between text-white">
              <button
                type="button"
                onClick={() => setViewersOpen(true)}
                className="inline-flex items-center gap-2 text-sm font-semibold"
              >
                <Eye className="h-5 w-5" /> {story.viewCount ?? 0}
              </button>
              <button
                type="button"
                aria-label={t("stories.delete")}
                onClick={remove}
                className="grid h-9 w-9 place-items-center"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {story && person.isMe && (
        <ViewersSheet storyId={story.id} open={viewersOpen} onOpenChange={setViewersOpen} />
      )}
    </div>
  );
}

function ViewersSheet({
  storyId,
  open,
  onOpenChange,
}: {
  storyId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const viewersFn = useServerFn(listStoryViewers);
  const q = useQuery({
    queryKey: ["story-viewers", storyId],
    enabled: open,
    queryFn: () => viewersFn({ data: { storyId } }),
  });
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto h-[60vh] max-w-lg rounded-t-[28px] border-0 bg-background">
        <DrawerTitle className="py-3 text-center font-display text-base font-bold">
          {t("stories.viewers")}
        </DrawerTitle>
        <DrawerDescription className="sr-only">{t("stories.viewers")}</DrawerDescription>
        <ul className="safe-bottom flex-1 overflow-y-auto px-4">
          {!q.data?.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("stories.noViewers")}
            </p>
          )}
          {(q.data ?? []).map((p) => (
            <li key={p.user_id} className="flex items-center gap-3 py-2">
              <UserAvatar name={p.full_name ?? p.username} photoUrl={p.photo_url} size={40} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{p.username}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.full_name}</span>
              </span>
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
