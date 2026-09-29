import { useTranslation } from "react-i18next";
import { Pause, Play, SkipForward, X } from "lucide-react";
import { next, stop, toggle, useQueue } from "@/lib/queue";

/** Now playing, above the bottom nav (the queue keeps going across screens). */
export function MiniPlayer({ lifted }: { lifted: boolean }) {
  const { t } = useTranslation();
  const q = useQueue();
  const item = q.items[q.index];
  if (!item) return null;
  return (
    <div
      className="fixed inset-x-0 z-40 px-3"
      style={{ bottom: lifted ? "calc(max(env(safe-area-inset-bottom, 0px), 0.75rem) + 4.5rem)" : "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <div className="relative mx-auto flex max-w-lg items-center gap-3 overflow-hidden rounded-2xl bg-surface-elevated px-3 py-2 shadow-lg ring-1 ring-border">
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground/20">
          <span className="block h-full bg-foreground" style={{ width: `${q.progress * 100}%` }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.author} · {q.index + 1}/{q.items.length}
          </p>
        </div>
        <button type="button" onClick={toggle} aria-label={q.playing ? t("daily.pause") : t("daily.play")} className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
          {q.playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
        </button>
        <button type="button" onClick={next} aria-label={t("posts.next")} className="grid h-10 w-9 place-items-center" disabled={q.index + 1 >= q.items.length}>
          <SkipForward className="h-5 w-5" fill="currentColor" />
        </button>
        <button type="button" onClick={stop} aria-label={t("common.close")} className="grid h-10 w-8 place-items-center text-muted-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
