import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PTT_IDLE, PTT_LIVE, VoiceIcon } from "@/components/voice/voice-icon";
import { MIC_ERROR_KEY, useRecorder } from "@/hooks/use-recorder";
import { useMyProfile } from "@/hooks/use-my-profile";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { formatClock } from "@/lib/audio";
import { haptic } from "@/lib/haptics";
import { setPendingClip } from "@/lib/pending-clip";
import { POST_MAX_MS } from "@/lib/posts";
import { cn } from "@/lib/utils";

type RecordSearch = { section?: string; topic?: string; group?: string; campus?: 1 };

/**
 * Where a voice started from here belongs: the group / topic / campus (section) you're looking at,
 * else personal. Home without a tab is Campus for verified students.
 */
function targetFor(pathname: string, search: Record<string, unknown>, student: boolean): RecordSearch {
  const g = /^\/g\/([^/]+)\/?$/.exec(pathname);
  if (g) return { group: g[1] };
  const tp = /^\/t\/([^/]+)/.exec(pathname);
  if (tp) return { topic: tp[1] };
  const s = typeof search.s === "string" ? search.s : undefined;
  if (pathname === "/" && student && search.tab !== "following" && search.tab !== "groups") {
    return s ? { campus: 1, section: s } : { campus: 1 };
  }
  return {};
}

/**
 * The voice item in the middle of the tab bar. Tap → the composer. Hold → records right away (from any screen), let go →
 * the composer opens with the voice ready, placed where you were (group, topic, campus or personal).
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

  // a firm tap in the hand when the mic opens and when it stops
  useEffect(() => {
    if (live) haptic("medium");
  }, [live]);

  useEffect(() => {
    if (r.error) toast.error(t(MIC_ERROR_KEY[r.error]));
  }, [r.error, t]);

  // Recorded → hand it to the composer.
  useEffect(() => {
    if (r.state !== "recorded" || !r.clip) return;
    setPendingClip(r.clip);
    r.discard();
    void navigate({ to: "/record", search: target });
  }, [r.state, r.clip]); // eslint-disable-line react-hooks/exhaustive-deps

  // The voice drop beside the tab bar; while held it turns red, swells a little and breathes out a ring, and a red
  // glass capsule above shows the time.
  return (
    <>
      <button
        type="button"
        {...ptt.bind}
        aria-label={t("voice.navRecord")}
        style={{ viewTransitionName: "voicedrop" }}
        className={cn(
          "ease-spring grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full",
          live ? `scale-110 ${PTT_LIVE}` : PTT_IDLE,
        )}
      >
        <VoiceIcon className="h-7 w-7" strokeWidth={2} live={live} />
      </button>
      {live && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-50 flex justify-center px-4">
          <div className="glass flex items-center gap-3 rounded-full py-3 pl-5 pr-6 animate-slide-up">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-live" />
            <span className="text-body font-semibold tabular-nums">
              {formatClock(r.elapsedMs)} <span className="font-normal text-muted-foreground">/ {formatClock(POST_MAX_MS)}</span>
            </span>
            <span className="text-caption text-muted-foreground">{t("voice.releaseToContinue")}</span>
          </div>
        </div>
      )}
    </>
  );
}
