import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AudioLines, ChevronLeft, ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { MemorySheet } from "@/components/memories/memory-sheet";
import { Waveform } from "@/components/voice/waveform";
import { useAuth } from "@/hooks/use-auth";
import { formatClock } from "@/lib/audio";
import { listMemories, memoryKeys, momentDate, monthKey, monthTitle, toMoment, type Memory } from "@/lib/memories";
import { cn } from "@/lib/utils";

type View = "list" | "calendar";

export const Route = createFileRoute("/_authenticated/memories")({
  validateSearch: (s: Record<string, unknown>): { view?: View } =>
    s.view === "calendar" ? { view: "calendar" } : {},
  component: MemoriesPage,
});

function MemoriesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { view = "list" } = Route.useSearch();
  const [open, setOpen] = useState<Memory[] | null>(null);
  const memories = useQuery({ queryKey: memoryKeys.list, queryFn: () => listMemories(user!.id), enabled: !!user });
  const seg = "rounded-full px-5 py-2 text-caption font-semibold transition-colors";

  return (
    <>
      <AppHeader
        back
        center={
          <div className="flex rounded-full bg-secondary p-1">
            <Link to="/memories" search={{}} className={cn(seg, view === "list" ? "bg-secondary" : "text-foreground/80")}>
              {t("memories.list")}
            </Link>
            <Link to="/memories" search={{ view: "calendar" }} className={cn(seg, view === "calendar" ? "bg-secondary" : "text-foreground/80")}>
              {t("memories.calendar")}
            </Link>
          </div>
        }
      />
      {memories.data && !memories.data.length && (
        <EmptyState
          icon={AudioLines}
          text={t("memories.empty")}
          action={
            <Link to="/record" className="inline-flex h-12 items-center rounded-2xl bg-primary px-8 font-semibold text-primary-foreground">
              {t("feed.recordCta")}
            </Link>
          }
        />
      )}
      {!!memories.data?.length &&
        (view === "list" ? (
          <MemoryList memories={memories.data} onOpen={setOpen} />
        ) : (
          <MemoryCalendar memories={memories.data} onOpen={setOpen} />
        ))}
      <MemorySheet memories={open} onOpenChange={(o) => !o && setOpen(null)} />
    </>
  );
}

/** Month sections with one tile per day (newest first), like BeReal Memories. */
function MemoryList({ memories, onOpen }: { memories: Memory[]; onOpen: (m: Memory[]) => void }) {
  const { i18n } = useTranslation();
  const months = useMemo(() => {
    const map = new Map<string, Memory[]>();
    for (const m of memories) map.set(monthKey(m.day), [...(map.get(monthKey(m.day)) ?? []), m]);
    return [...map.entries()];
  }, [memories]);

  return (
    <div className="px-4 pb-4">
      {months.map(([key, items]) => {
        const [y, mo] = key.split("-").map(Number);
        return (
          <section key={key} className="mt-4">
            <h2 className="mb-3 text-tagline font-semibold">{monthTitle(y, mo - 1, i18n.language)}</h2>
            <ul className="grid grid-cols-3 gap-2">
              {items.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onOpen([m])}
                    className="flex aspect-[3/4] w-full flex-col justify-between rounded-2xl bg-card p-2.5 text-left"
                  >
                    <span className="text-hero font-semibold leading-none">{momentDate(m.day).getDate()}</span>
                    {m.title ? (
                      <span className="line-clamp-2 text-fine font-semibold leading-snug">{m.title}</span>
                    ) : (
                      <Waveform seed={m.id} bars={14} className="h-8 flex-none" />
                    )}
                    <span className="text-fine tabular-nums text-muted-foreground">{formatClock(m.duration_ms)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Month grid (Monday first); days with a voice are filled. */
function MemoryCalendar({ memories, onOpen }: { memories: Memory[]; onOpen: (m: Memory[]) => void }) {
  const { t, i18n } = useTranslation();
  const byDay = useMemo(() => {
    const map = new Map<string, Memory[]>();
    for (const m of memories) map.set(m.day, [...(map.get(m.day) ?? []), m]);
    return map;
  }, [memories]);
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const oldest = momentDate(memories[memories.length - 1].day);
  const canBack = cursor > new Date(oldest.getFullYear(), oldest.getMonth(), 1);
  const canForward = cursor < new Date(today.getFullYear(), today.getMonth(), 1);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const days = new Date(year, month + 1, 0).getDate();
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: "narrow" }).format(new Date(2024, 0, 1 + i)),
  );
  const count = memories.filter((m) => monthKey(m.day) === toMoment(cursor).slice(0, 7)).length;
  const nav = "grid h-10 w-10 place-items-center rounded-full bg-secondary disabled:opacity-30";

  return (
    <div className="px-4 pt-2">
      <div className="flex items-center justify-between">
        <button type="button" className={nav} disabled={!canBack} onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label={t("memories.prev")}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-body font-semibold">{monthTitle(year, month, i18n.language)}</p>
          <p className="text-fine text-muted-foreground">{t("memories.count", { count })}</p>
        </div>
        <button type="button" className={nav} disabled={!canForward} onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label={t("memories.next")}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-y-2 text-center">
        {weekdays.map((w, i) => (
          <span key={i} className="text-fine font-semibold text-muted-foreground">{w}</span>
        ))}
        {Array.from({ length: lead }, (_, i) => <span key={`x${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = new Date(year, month, i + 1);
          const m = byDay.get(toMoment(d));
          const isToday = toMoment(d) === toMoment(today);
          return (
            <span key={i} className="flex justify-center">
              <button
                type="button"
                disabled={!m}
                onClick={() => m && onOpen(m)}
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-full text-caption font-semibold tabular-nums",
                  m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  isToday && !m && "ring-1 ring-foreground/60 text-foreground",
                )}
              >
                {i + 1}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
