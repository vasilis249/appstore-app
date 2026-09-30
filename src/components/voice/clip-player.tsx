import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Waveform } from "@/components/voice/waveform";
import { formatClock, player } from "@/lib/audio";
import { cn } from "@/lib/utils";

// Only one clip plays at a time across the app.
let current: { id: string; stop: () => void } | null = null;

/**
 * Play button + waveform + duration for a stored clip. `load` fetches the audio when
 * tapped (after `player.prime()`, so iOS allows it). `locked` blurs it and disables play.
 */
export function ClipPlayer({
  id,
  durationMs,
  load,
  locked,
  className,
}: {
  id: string;
  durationMs: number;
  load: () => Promise<Blob>;
  locked?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(
    () => () => {
      if (current?.id === id) {
        player.stop();
        current = null;
      }
    },
    [id],
  );

  function reset() {
    setPlaying(false);
    setProgress(0);
  }

  async function toggle() {
    if (locked) return;
    if (playing) {
      player.stop();
      reset();
      return;
    }
    if (current && current.id !== id) current.stop();
    current = { id, stop: reset };
    player.prime(); // inside the tap (iOS)
    setPlaying(true);
    try {
      const blob = await load();
      await player.play(blob, { durationMs, onProgress: setProgress, onEnd: reset });
    } catch {
      reset();
      toast.error(t("voice.playFailed"));
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={locked}
      aria-label={locked ? t("daily.locked") : playing ? t("daily.pause") : t("daily.play")}
      className={cn("relative flex w-full items-center gap-3 rounded-2xl bg-secondary px-3 py-3 text-left", className)}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
      </span>
      <Waveform seed={id} progress={progress} className={locked ? "blur-[3px]" : undefined} />
      <span className="w-10 shrink-0 text-right text-caption tabular-nums text-muted-foreground">{formatClock(durationMs)}</span>
      {locked && (
        <span className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl bg-background/50 text-caption font-semibold backdrop-blur-[2px]">
          <Lock className="h-4 w-4" /> {t("daily.locked")}
        </span>
      )}
    </button>
  );
}
