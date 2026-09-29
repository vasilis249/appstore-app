import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { VoiceIcon } from "@/components/voice/voice-icon";
import { useRecorder } from "@/hooks/use-recorder";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { formatClock } from "@/lib/audio";
import { setPendingClip } from "@/lib/pending-clip";
import { POST_MAX_MS } from "@/lib/posts";
import { cn } from "@/lib/utils";

type RecordSearch = { section?: string; topic?: string; group?: string; news?: 1 };

/** Where a voice started from here belongs: the group / topic / news section you're looking at, else personal. */
function targetFor(pathname: string, search: Record<string, unknown>): RecordSearch {
  const g = /^\/g\/([^/]+)\/?$/.exec(pathname);
  if (g) return { group: g[1] };
  const tp = /^\/t\/([^/]+)/.exec(pathname);
  if (tp) return { topic: tp[1] };
  const s = /^\/s\/([^/]+)/.exec(pathname);
  if (s) return { section: s[1] };
  if (pathname === "/" && search.tab !== "following" && search.tab !== "groups") {
    return typeof search.s === "string" ? { section: search.s } : { news: 1 };
  }
  return {};
}

/**
 * The round button in the nav. Tap → the composer. Hold → records right away (from any screen), let go →
 * the composer opens with the voice ready, placed where you were (group, topic, news section or personal).
 */
export function NavRecordButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const loc = useRouterState({ select: (s) => ({ pathname: s.location.pathname, search: s.location.search as Record<string, unknown> }) });
  const r = useRecorder(POST_MAX_MS);
  const target = targetFor(loc.pathname, loc.search);
  const ptt = usePushToTalk(r, { minMs: 700, tapMs: 700, onTap: () => void navigate({ to: "/record", search: target }) });
  const live = r.state === "recording";

  useEffect(() => {
    if (r.error) toast.error(t(r.error === "denied" ? "voice.micDenied" : "voice.unsupported"));
  }, [r.error, t]);

  // Recorded → hand it to the composer.
  useEffect(() => {
    if (r.state !== "recorded" || !r.clip) return;
    setPendingClip(r.clip);
    r.discard();
    void navigate({ to: "/record", search: target });
  }, [r.state, r.clip]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = "grid h-14 w-14 place-items-center rounded-full shadow-md transition-transform duration-150";
  return (
    <>
      <button
        type="button"
        {...ptt.bind}
        aria-label={t("voice.navRecord")}
        className={cn(base, live ? "scale-110 bg-coral text-white" : "bg-primary text-primary-foreground")}
      >
        <VoiceIcon className="h-7 w-7" strokeWidth={2} live={live} />
      </button>
      {live && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full bg-secondary/95 py-2.5 pl-4 pr-5 shadow-xl backdrop-blur animate-scale-in">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-coral" />
            <span className="text-[15px] font-semibold tabular-nums">
              {formatClock(r.elapsedMs)} <span className="font-normal text-muted-foreground">/ {formatClock(POST_MAX_MS)}</span>
            </span>
            <span className="text-sm text-muted-foreground">· {t("voice.releaseToContinue")}</span>
          </div>
        </div>
      )}
    </>
  );
}
