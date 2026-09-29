import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Pause, Play, Send, Square, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useRecorder } from "@/hooks/use-recorder";
import { formatClock, player } from "@/lib/audio";

/**
 * Composer: tap to record, tap to stop (auto-stops at the limit), then listen back,
 * delete or send. `onSend` must throw on failure (the clip is kept for a retry).
 */
export function RecordBar({
  maxMs,
  onSend,
  disabled,
}: {
  maxMs: number;
  onSend: (clip: { blob: Blob; mime: string; durationMs: number }) => Promise<void>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const r = useRecorder(maxMs);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (r.error) toast.error(t(r.error === "denied" ? "voice.micDenied" : "voice.unsupported"));
  }, [r.error, t]);

  async function send() {
    if (!r.clip) return;
    player.stop();
    setSending(true);
    try {
      await onSend(r.clip);
      r.discard();
    } finally {
      setSending(false);
    }
  }

  function preview() {
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

  const round = "grid h-12 w-12 shrink-0 place-items-center rounded-full";

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-24 max-w-lg items-center gap-3 px-4">
        {r.state === "idle" && (
          <div className="flex w-full flex-col items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => void r.start()}
              aria-label={t("voice.record")}
              className="grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-md disabled:opacity-40"
            >
              <Mic className="h-7 w-7" />
            </button>
          </div>
        )}

        {r.state === "recording" && (
          <>
            <button type="button" onClick={r.discard} aria-label={t("common.cancel")} className={`${round} bg-secondary`}>
              <X className="h-5 w-5" />
            </button>
            <div className="flex flex-1 items-center justify-center gap-2 font-semibold tabular-nums">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-coral" />
              {formatClock(r.elapsedMs)} <span className="text-muted-foreground">/ {formatClock(maxMs)}</span>
            </div>
            <button
              type="button"
              onClick={r.stop}
              aria-label={t("voice.stop")}
              className="grid h-16 w-16 place-items-center rounded-full bg-coral text-white ring-4 ring-coral/30"
            >
              <Square className="h-6 w-6" fill="currentColor" />
            </button>
          </>
        )}

        {r.state === "recorded" && r.clip && (
          <>
            <button type="button" onClick={r.discard} aria-label={t("voice.delete")} className={`${round} bg-secondary`}>
              <Trash2 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={preview}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-secondary font-semibold tabular-nums"
            >
              {previewing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              {formatClock(r.clip.durationMs)}
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending}
              className="flex h-12 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-5 w-5" /> {t("voice.send")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
