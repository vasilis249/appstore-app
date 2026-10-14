import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp, ImagePlus, Pause, Play, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { VoiceIcon } from "@/components/voice/voice-icon";
import { MIC_ERROR_KEY, useRecorder } from "@/hooks/use-recorder";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { formatClock, player } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/image";

/**
 * Message composer: a photo button, a text field and the voice drop — hold it and speak, let go to stop (auto-stops
 * at the limit), then listen back, delete or send. With text typed, the drop becomes ↑ Send. `onSend*` must throw on
 * failure (the clip / text is kept for a retry).
 */
export function RecordBar({
  maxMs,
  onSend,
  onSendText,
  onSendPhoto,
  textMax = 1000,
  disabled,
}: {
  maxMs: number;
  onSend: (clip: { blob: Blob; mime: string; durationMs: number }) => Promise<void>;
  onSendText?: (text: string) => Promise<void>;
  onSendPhoto?: (photo: Blob) => Promise<void>;
  textMax?: number;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const r = useRecorder(maxMs);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const ptt = usePushToTalk(r, { onTooShort: () => toast(t("voice.holdToTalk")) });
  const [text, setText] = useState("");
  const pick = useRef<HTMLInputElement>(null);

  async function sendText() {
    if (!onSendText || !text.trim() || sending) return;
    setSending(true);
    try {
      await onSendText(text.trim());
      setText("");
    } catch {
      /* kept for a retry */
    } finally {
      setSending(false);
    }
  }

  async function sendPhoto(file: File | undefined) {
    if (!onSendPhoto || !file) return;
    setSending(true);
    try {
      await onSendPhoto(await compressImage(file));
    } catch {
      /* onSendPhoto already said why */
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (r.error) toast.error(t(MIC_ERROR_KEY[r.error]));
  }, [r.error, t]);

  async function send() {
    if (!r.clip) return;
    player.stop();
    setSending(true);
    try {
      await onSend(r.clip);
      r.discard();
    } catch {
      /* kept for a retry; onSend already said why */
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
  const drop = (
    <button
      type="button"
      disabled={disabled}
      {...ptt.bind}
      aria-label={t("voice.holdToTalk")}
      className={cn(
        "grid h-14 w-14 shrink-0 place-items-center rounded-full transition-transform duration-150 disabled:opacity-40",
        live || ptt.holding ? "scale-110 bg-live text-primary-foreground" : "bg-primary text-primary-foreground",
      )}
    >
      <VoiceIcon className="h-7 w-7" strokeWidth={1.8} live={live} />
    </button>
  );

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-30">
      <div aria-hidden className="scroll-edge pointer-events-none absolute inset-x-0 -top-6 bottom-0 rotate-180" />
      <div className="relative mx-auto flex h-20 max-w-lg select-none items-center gap-2 px-3">
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
        ) : live ? (
          <>
            <p className="flex flex-1 items-center gap-2 text-callout tabular-nums text-muted-foreground">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-live" />
              <span className="font-semibold text-foreground">{formatClock(r.elapsedMs)}</span> / {formatClock(maxMs)}
            </p>
            {drop}
          </>
        ) : (
          <>
            {onSendPhoto && (
              <>
                <button
                  type="button"
                  disabled={disabled || sending}
                  onClick={() => pick.current?.click()}
                  aria-label={t("dm.sendPhoto")}
                  className="glass grid h-12 w-12 shrink-0 place-items-center rounded-full text-link disabled:opacity-40"
                >
                  <ImagePlus className="h-5 w-5" />
                </button>
                <input
                  ref={pick}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    void sendPhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </>
            )}
            {onSendText ? (
              <form
                className="flex min-w-0 flex-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendText();
                }}
              >
                <label className="glass flex h-12 min-w-0 flex-1 items-center rounded-full pl-4 pr-1.5">
                  <span className="sr-only">{t("dm.placeholder")}</span>
                  <input
                    value={text}
                    maxLength={textMax}
                    disabled={disabled}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t("dm.placeholder")}
                    enterKeyHint="send"
                    className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground focus-visible:shadow-none"
                  />
                  {text.trim() && (
                    <button
                      type="submit"
                      disabled={sending}
                      aria-label={t("voice.send")}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 animate-scale-in"
                    >
                      <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
                    </button>
                  )}
                </label>
              </form>
            ) : (
              <p className="flex-1 text-callout text-muted-foreground">{t("voice.holdToTalk")}</p>
            )}
            {!text.trim() && drop}
          </>
        )}
      </div>
    </div>
  );
}
