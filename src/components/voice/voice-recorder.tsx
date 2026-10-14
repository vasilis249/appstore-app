import { useEffect, useState, type ReactNode } from "react";
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

const LIVE_BARS = [8, 14, 22, 28, 18, 10, 24, 30, 20, 12, 16, 26, 30, 22, 14, 8, 18, 26, 20, 12];

/**
 * The composer's bottom (Glass): `children` (photo / camera / counter) in a glass capsule and, beside it, the voice
 * drop — hold and speak: it turns red and a red glass capsule above shows the time with live bars; let go to stop.
 * Then a voice chip plays it back and "Again" starts over. `initialClip` = already recorded (from the nav button).
 */
export function VoiceRecorder({
  maxMs,
  onChange,
  initialClip,
  children,
}: {
  maxMs: number;
  onChange: (clip: Clip | null) => void;
  initialClip?: Clip | null;
  children?: ReactNode;
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
    <div className="flex select-none flex-col gap-2.5">
      {live && (
        <div role="status" className="glass flex h-16 items-center gap-3 rounded-full pl-5 pr-5 animate-slide-up">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-live" aria-hidden />
          <span className="shrink-0 text-tagline font-semibold tabular-nums">{formatClock(r.elapsedMs)}</span>
          <span className="wave-live flex h-8 flex-1 items-center justify-between" aria-hidden>
            {LIVE_BARS.map((h, i) => (
              <span key={i} className="block w-[3px] rounded-full bg-live" style={{ height: h }} />
            ))}
          </span>
        </div>
      )}
      {live && <p className="-mt-1 text-center text-caption text-muted-foreground">{t("voice.releaseToStop")} · {formatClock(maxMs)}</p>}

      {recorded && (
        <div className="flex h-14 items-center gap-3 rounded-full bg-card pl-1.5 pr-2 animate-scale-in">
          <button
            type="button"
            onClick={playBack}
            aria-label={previewing ? t("daily.pause") : t("daily.play")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
          >
            {previewing ? <Pause className="h-4 w-4" fill="currentColor" strokeWidth={0} /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" strokeWidth={0} />}
          </button>
          <span className={cn("flex h-6 flex-1 items-center justify-between", previewing && "wave-live")} aria-hidden>
            {LIVE_BARS.map((h, i) => (
              <span key={i} className="block w-[3px] rounded-full bg-wave" style={{ height: Math.max(4, h * 0.75) }} />
            ))}
          </span>
          <span className="shrink-0 text-caption tabular-nums text-muted-foreground">{formatClock(r.clip!.durationMs)}</span>
          <button
            type="button"
            onClick={() => {
              player.stop();
              setPreviewing(false);
              r.discard();
            }}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-caption font-semibold text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" /> {t("daily.retake")}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <div className="glass flex h-14 min-w-0 flex-1 items-center gap-1 rounded-full px-2">{children}</div>
        {!recorded && (
          <button
            type="button"
            {...ptt.bind}
            aria-label={t("voice.holdToTalk")}
            className={cn(
              "ease-spring grid h-14 w-14 shrink-0 place-items-center rounded-full",
              live || ptt.holding ? "scale-110 bg-live text-destructive-foreground animate-rec-pulse" : "glass text-link",
            )}
          >
            <VoiceIcon className="h-7 w-7" strokeWidth={2} live={live} />
          </button>
        )}
      </div>
    </div>
  );
}
