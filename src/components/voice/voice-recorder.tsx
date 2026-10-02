import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { VoiceIcon } from "@/components/voice/voice-icon";
import { MIC_ERROR_KEY, useRecorder } from "@/hooks/use-recorder";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { formatClock, player } from "@/lib/audio";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type Clip = { blob: Blob; mime: string; durationMs: number };

/**
 * Push to talk (Quiet): the clock on top, a red button inside a thin ring — hold and speak: it morphs into a rounded
 * square, breathes out a pulse and the ring fills up to the limit; let go to stop.
 * Then the same button plays it back; "Again" starts over. `initialClip` = already recorded (from the nav button).
 */
export function VoiceRecorder({
  maxMs,
  onChange,
  initialClip,
}: {
  maxMs: number;
  onChange: (clip: Clip | null) => void;
  initialClip?: Clip | null;
}) {
  const { t } = useTranslation();
  const r = useRecorder(maxMs, initialClip);
  const [previewing, setPreviewing] = useState(false);
  const ptt = usePushToTalk(r, { onTooShort: () => toast(t("voice.holdToTalk")) });

  useEffect(() => {
    if (r.error) toast.error(t(MIC_ERROR_KEY[r.error]));
  }, [r.error, t]);
  useEffect(() => onChange(r.state === "recorded" ? r.clip : null), [r.state, r.clip, onChange]);
  useEffect(() => () => player.stop(), []);
  // a firm tap when the mic opens and when it stops
  useEffect(() => {
    if (r.state === "recording" || r.state === "recorded") haptic("medium");
  }, [r.state]);

  const recorded = r.state === "recorded" && !!r.clip;
  const live = r.state === "recording";
  const ms = recorded ? r.clip!.durationMs : r.elapsedMs;
  const R = 57;
  const C = 2 * Math.PI * R;

  function playBack() {
    if (!r.clip) return;
    if (previewing) {
      player.stop();
      setPreviewing(false);
      return;
    }
    player.prime();
    setPreviewing(true);
    void player
      .play(r.clip.blob, { durationMs: r.clip.durationMs, onEnd: () => setPreviewing(false) })
      .catch(() => setPreviewing(false));
  }

  return (
    <div className="flex select-none flex-col items-center gap-5 py-2">
      <p className="text-[44px] font-light leading-none tracking-[-0.02em] tabular-nums">
        {formatClock(ms)}
        <span className="text-tagline font-normal text-muted-foreground"> / {formatClock(maxMs)}</span>
      </p>

      <div className="relative grid h-[120px] w-[120px] place-items-center">
        <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 120 120" aria-hidden>
          <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
          {(live || recorded) && (
            <circle
              cx="60" cy="60" r={R} fill="none" strokeWidth="3" strokeLinecap="round" stroke="currentColor"
              className={cn("transition-[stroke-dashoffset] duration-300 ease-linear", live ? "text-live" : "text-foreground")}
              strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, ms / maxMs))}
            />
          )}
        </svg>
        {recorded ? (
          <button
            type="button"
            onClick={playBack}
            aria-label={previewing ? t("daily.pause") : t("daily.play")}
            className="grid h-24 w-24 place-items-center rounded-full bg-primary text-primary-foreground animate-scale-in"
          >
            {previewing ? <Pause className="h-9 w-9" fill="currentColor" strokeWidth={0} /> : <Play className="ml-1 h-9 w-9" fill="currentColor" strokeWidth={0} />}
          </button>
        ) : (
          <button
            type="button"
            {...ptt.bind}
            aria-label={t("voice.holdToTalk")}
            className={cn("grid h-24 w-24 place-items-center rounded-full", live && "animate-rec-pulse")}
          >
            <span
              className={cn(
                "ease-spring grid place-items-center bg-live text-destructive-foreground",
                live || ptt.holding ? "h-9 w-9 rounded-[10px]" : "h-[76px] w-[76px] rounded-full",
              )}
            >
              {!live && !ptt.holding && <VoiceIcon className="h-8 w-8" strokeWidth={1.8} />}
            </span>
          </button>
        )}
      </div>

      {recorded ? (
        <button
          type="button"
          onClick={() => {
            player.stop();
            setPreviewing(false);
            r.discard();
          }}
          className="flex h-9 items-center gap-1.5 text-caption font-semibold text-muted-foreground"
        >
          <RotateCcw className="h-4 w-4" /> {t("daily.retake")}
        </button>
      ) : (
        <p className="text-caption text-muted-foreground">
          {live ? t("voice.releaseToStop") : t("voice.holdToTalkLimit", { max: formatClock(maxMs) })}
        </p>
      )}
    </div>
  );
}
