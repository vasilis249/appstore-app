import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Pause, Play, RotateCcw, Square } from "lucide-react";
import { toast } from "sonner";
import { useRecorder } from "@/hooks/use-recorder";
import { formatClock, player } from "@/lib/audio";

export type Clip = { blob: Blob; mime: string; durationMs: number };

/** Big round recorder with a progress ring: record → stop → listen back / retake. */
export function VoiceRecorder({ maxMs, onChange }: { maxMs: number; onChange: (clip: Clip | null) => void }) {
  const { t } = useTranslation();
  const r = useRecorder(maxMs);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (r.error) toast.error(t(r.error === "denied" ? "voice.micDenied" : "voice.unsupported"));
  }, [r.error, t]);
  useEffect(() => onChange(r.state === "recorded" ? r.clip : null), [r.state, r.clip, onChange]);
  useEffect(() => () => player.stop(), []);

  const ms = r.state === "recorded" && r.clip ? r.clip.durationMs : r.elapsedMs;
  const fraction = Math.min(1, ms / maxMs);
  const R = 76;
  const C = 2 * Math.PI * R;

  function main() {
    if (r.state === "idle") return void r.start();
    if (r.state === "recording") return r.stop();
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

  const Icon = r.state === "idle" ? Mic : r.state === "recording" ? Square : previewing ? Pause : Play;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative grid h-44 w-44 place-items-center">
        <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 176 176" aria-hidden>
          <circle cx="88" cy="88" r={R} fill="none" stroke="currentColor" strokeWidth="6" className="text-secondary" />
          <circle
            cx="88" cy="88" r={R} fill="none" strokeWidth="6" strokeLinecap="round" stroke="currentColor"
            className={r.state === "recording" ? "text-coral" : "text-foreground"}
            strokeDasharray={C} strokeDashoffset={C * (1 - fraction)}
          />
        </svg>
        <button
          type="button"
          onClick={main}
          aria-label={r.state === "idle" ? t("voice.record") : r.state === "recording" ? t("voice.stop") : t("daily.play")}
          className={"grid h-32 w-32 place-items-center rounded-full shadow-lg " + (r.state === "recording" ? "bg-coral text-white" : "bg-primary text-primary-foreground")}
        >
          <Icon className="h-12 w-12" fill={r.state === "idle" ? "none" : "currentColor"} />
        </button>
      </div>
      <p className="text-2xl font-bold tabular-nums">
        {formatClock(ms)} <span className="text-base font-medium text-muted-foreground">/ {formatClock(maxMs)}</span>
      </p>
      {r.state === "recorded" ? (
        <button
          type="button"
          onClick={() => {
            player.stop();
            setPreviewing(false);
            r.discard();
          }}
          className="flex h-10 items-center gap-2 rounded-full bg-secondary px-5 text-sm font-semibold"
        >
          <RotateCcw className="h-4 w-4" /> {t("daily.retake")}
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">{t(r.state === "recording" ? "daily.recordingHint" : "posts.recordHint")}</p>
      )}
    </div>
  );
}
