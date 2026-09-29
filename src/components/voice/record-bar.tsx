import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { VoiceIcon } from "@/components/voice/voice-icon";
import { useRecorder } from "@/hooks/use-recorder";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { formatClock, player } from "@/lib/audio";
import { cn } from "@/lib/utils";

/**
 * Message composer, push to talk: hold the round button and speak, let go to stop (auto-stops at the limit),
 * then listen back, delete or send. `onSend` must throw on failure (the clip is kept for a retry).
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
  const ptt = usePushToTalk(r, { onTooShort: () => toast(t("voice.holdToTalk")) });

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

  const live = r.state === "recording";
  const round = "grid h-12 w-12 shrink-0 place-items-center rounded-full";

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-24 max-w-lg select-none items-center gap-3 px-4">
        {r.state === "recorded" && r.clip ? (
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
              aria-label={t("voice.send")}
              className={`${round} bg-primary text-primary-foreground disabled:opacity-50`}
            >
              <Send className="h-5 w-5" />
            </button>
          </>
        ) : (
          <>
            <p className="flex flex-1 items-center gap-2 text-[15px] tabular-nums text-muted-foreground">
              {live ? (
                <>
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-coral" />
                  <span className="font-semibold text-foreground">{formatClock(r.elapsedMs)}</span> / {formatClock(maxMs)}
                </>
              ) : (
                t("voice.holdToTalk")
              )}
            </p>
            <button
              type="button"
              disabled={disabled}
              {...ptt.bind}
              aria-label={t("voice.holdToTalk")}
              className={cn(
                "grid h-16 w-16 place-items-center rounded-full transition-transform duration-150 disabled:opacity-40",
                live || ptt.holding ? "scale-110 bg-coral text-white" : "bg-primary text-primary-foreground",
              )}
            >
              <VoiceIcon className="h-8 w-8" strokeWidth={1.8} live={live} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
