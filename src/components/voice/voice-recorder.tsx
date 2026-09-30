import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { VoiceIcon } from "@/components/voice/voice-icon";
import { useRecorder } from "@/hooks/use-recorder";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { formatClock, player } from "@/lib/audio";
import { cn } from "@/lib/utils";

export type Clip = { blob: Blob; mime: string; durationMs: number };

/**
 * Push to talk: hold the round button and speak, let go to stop (a coral ring fills up to the limit).
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
    if (r.error) toast.error(t(r.error === "denied" ? "voice.micDenied" : "voice.unsupported"));
  }, [r.error, t]);
  useEffect(() => onChange(r.state === "recorded" ? r.clip : null), [r.state, r.clip, onChange]);
  useEffect(() => () => player.stop(), []);

  const recorded = r.state === "recorded" && !!r.clip;
  const live = r.state === "recording";
  const ms = recorded ? r.clip!.durationMs : r.elapsedMs;
  const R = 80;
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
    <div className="flex select-none flex-col items-center gap-4 py-2">
      <div className="relative grid h-[184px] w-[184px] place-items-center">
        <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 184 184" aria-hidden>
          <circle cx="92" cy="92" r={R} fill="none" stroke="currentColor" strokeWidth="4" className="text-secondary" />
          {(live || recorded) && (
            <circle
              cx="92" cy="92" r={R} fill="none" strokeWidth="4" strokeLinecap="round" stroke="currentColor"
              className={live ? "text-live" : "text-foreground/60"}
              strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, ms / maxMs))}
            />
          )}
        </svg>
        {recorded ? (
          <button
            type="button"
            onClick={playBack}
            aria-label={previewing ? t("daily.pause") : t("daily.play")}
            className="grid h-32 w-32 place-items-center rounded-full bg-primary text-primary-foreground active:scale-95"
          >
            {previewing ? <Pause className="h-11 w-11" fill="currentColor" /> : <Play className="ml-1 h-11 w-11" fill="currentColor" />}
          </button>
        ) : (
          <button
            type="button"
            {...ptt.bind}
            aria-label={t("voice.holdToTalk")}
            className={cn(
              "grid h-32 w-32 place-items-center rounded-full transition-transform duration-150",
              live || ptt.holding ? "scale-110 bg-live text-white" : "bg-primary text-primary-foreground",
            )}
          >
            <VoiceIcon className="h-14 w-14" strokeWidth={1.8} live={live} />
          </button>
        )}
      </div>

      <p className={cn("text-3xl font-bold tabular-nums", !live && !recorded && "text-muted-foreground")}>{formatClock(ms)}</p>

      {recorded ? (
        <button
          type="button"
          onClick={() => {
            player.stop();
            setPreviewing(false);
            r.discard();
          }}
          className="flex h-9 items-center gap-1.5 text-sm font-semibold text-muted-foreground"
        >
          <RotateCcw className="h-4 w-4" /> {t("daily.retake")}
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">
          {live ? t("voice.releaseToStop") : t("voice.holdToTalkLimit", { max: formatClock(maxMs) })}
        </p>
      )}
    </div>
  );
}
