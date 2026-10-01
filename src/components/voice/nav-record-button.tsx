import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { VoiceIcon } from "@/components/voice/voice-icon";
import { useRecorder } from "@/hooks/use-recorder";
import { useMyProfile } from "@/hooks/use-my-profile";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { formatClock } from "@/lib/audio";
import { setPendingClip } from "@/lib/pending-clip";
import { POST_MAX_MS } from "@/lib/posts";
import { cn } from "@/lib/utils";

type RecordSearch = { section?: string; topic?: string; group?: string; news?: 1; campus?: 1 };

/**
 * Where a voice started from here belongs: the group / topic / campus (section) / news section you're looking at,
 * else personal. Home without a tab is Campus for verified students.
 */
function targetFor(pathname: string, search: Record<string, unknown>, student: boolean): RecordSearch {
  const g = /^\/g\/([^/]+)\/?$/.exec(pathname);
  if (g) return { group: g[1] };
  const tp = /^\/t\/([^/]+)/.exec(pathname);
  if (tp) return { topic: tp[1] };
  const sec = /^\/s\/([^/]+)/.exec(pathname);
  if (sec) return { section: sec[1] };
  const s = typeof search.s === "string" ? search.s : undefined;
  if (pathname === "/" && (search.tab === "campus" || (!search.tab && !s && student))) {
    return student ? (s ? { campus: 1, section: s } : { campus: 1 }) : {};
  }
  if (pathname === "/" && search.tab !== "following" && search.tab !== "groups") {
    return s ? { section: s } : { news: 1 };
  }
  return {};
}

/**
 * The voice item in the middle of the tab bar. Tap → the composer. Hold → records right away (from any screen), let go →
 * the composer opens with the voice ready, placed where you were (group, topic, news section or personal).
 */
export function NavRecordButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const loc = useRouterState({ select: (s) => ({ pathname: s.location.pathname, search: s.location.search as Record<string, unknown> }) });
  const r = useRecorder(POST_MAX_MS);
  const me = useMyProfile();
  const target = targetFor(loc.pathname, loc.search, !!me.data?.university_id);
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

  // A tab-bar item like the others (the voice mark); while held it turns red and breathes.
  return (
    <>
      <button
        type="button"
        {...ptt.bind}
        aria-label={t("voice.navRecord")}
        className={cn(
          "relative z-10 grid h-12 w-full place-items-center rounded-full transition-[transform,background-color,color] duration-200",
          live ? "scale-110 bg-live text-destructive-foreground" : "text-foreground",
        )}
      >
        <VoiceIcon className="h-7 w-7" strokeWidth={2} live={live} />
      </button>
      {live && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full bg-popover py-2.5 pl-4 pr-5 shadow-float animate-scale-in">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-live" />
            <span className="text-callout font-semibold tabular-nums">
              {formatClock(r.elapsedMs)} <span className="font-normal text-muted-foreground">/ {formatClock(POST_MAX_MS)}</span>
            </span>
            <span className="text-caption text-muted-foreground">· {t("voice.releaseToContinue")}</span>
          </div>
        </div>
      )}
    </>
  );
}
