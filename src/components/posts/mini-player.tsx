import { useTranslation } from "react-i18next";
import { Pause, Play, SkipForward, X } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { next, stop, toggle, useQueue } from "@/lib/queue";

/**
 * Now playing, floating above the tab bar (the queue keeps going across screens): it springs up from below, a thin
 * ink line shows the progress.
 */
export function MiniPlayer({ lifted }: { lifted: boolean }) {
  const { t } = useTranslation();
  const q = useQueue();
  const item = q.items[q.index];
  if (!item) return null;
  return (
    <div
      className="fixed inset-x-0 z-40 px-2"
      style={{ bottom: lifted ? "calc(env(safe-area-inset-bottom, 0px) + 3.75rem)" : "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)", viewTransitionName: "miniplayer" }}
    >
      <div className="animate-slide-up relative mx-auto flex h-[58px] max-w-lg items-center gap-2.5 overflow-hidden rounded-2xl border border-border bg-popover pl-2.5 pr-1 shadow-float">
        <span className="absolute inset-x-0 bottom-0 h-0.5">
          <span className="block h-full bg-foreground transition-[width] duration-150 ease-linear" style={{ width: `${q.progress * 100}%` }} />
        </span>
        <UserAvatar name={item.author ?? "?"} path={null} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-callout font-semibold leading-5">{item.title}</p>
          <p className="truncate text-fine text-muted-foreground tabular-nums">
            {item.author} · {q.index + 1}/{q.items.length}
          </p>
        </div>
        <button type="button" onClick={toggle} aria-label={q.playing ? t("daily.pause") : t("daily.play")} className="grid h-11 w-10 place-items-center">
          {q.playing ? <Pause className="h-5 w-5" fill="currentColor" strokeWidth={0} /> : <Play className="h-5 w-5" fill="currentColor" strokeWidth={0} />}
        </button>
        <button type="button" onClick={next} aria-label={t("posts.next")} className="grid h-11 w-9 place-items-center disabled:opacity-30" disabled={q.index + 1 >= q.items.length}>
          <SkipForward className="h-5 w-5" fill="currentColor" strokeWidth={0} />
        </button>
        <button type="button" onClick={stop} aria-label={t("common.close")} className="grid h-11 w-9 place-items-center text-muted-foreground">
          <X className="h-5 w-5" strokeWidth={1.7} />
        </button>
      </div>
    </div>
  );
}
