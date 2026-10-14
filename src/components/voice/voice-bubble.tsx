import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AudioLines, Check, CheckCheck, Clock, Play } from "lucide-react";
import { toast } from "sonner";
import { base64ToBlob, formatClock, player } from "@/lib/audio";
import { timeAgo } from "@/lib/time-ago";
import { consumeVoice, voiceKeys, type VoiceMessage } from "@/lib/voice";
import { rpcErrorKey } from "@/lib/friends";
import { cn } from "@/lib/utils";
import { PhotoViewer } from "@/components/posts/photo-viewer";

/** One DM. A voice: unheard incoming ones play once, everything else shows its state. A text or a photo: a bubble
 * (the photo opens full screen) with the time and, on yours, whether it was read. */
export function VoiceBubble({ msg, mine }: { msg: VoiceMessage; mine: boolean }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<"idle" | "loading" | "playing" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [viewing, setViewing] = useState(false);

  const unheard = !mine && !msg.opened_at && !msg.expired_at && phase !== "done";
  const when = timeAgo(msg.created_at, i18n.language);

  async function listen() {
    if (phase !== "idle") return;
    player.prime(); // must run inside the tap (iOS)
    setPhase("loading");
    try {
      const clip = await consumeVoice(msg.id);
      setPhase("playing");
      await player.play(base64ToBlob(clip.audio_b64, clip.mime), {
        durationMs: clip.duration_ms,
        onProgress: setProgress,
        onEnd: () => {
          setPhase("done");
          void qc.invalidateQueries({ queryKey: voiceKeys.all });
        },
      });
    } catch (e) {
      setPhase("done");
      void qc.invalidateQueries({ queryKey: voiceKeys.all });
      toast.error(t(e instanceof Error && e.name === "NotAllowedError" ? "voice.playFailed" : rpcErrorKey(e)));
    }
  }

  if (msg.duration_ms === null)
    return (
      <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
        <div className={cn("flex max-w-[78%] flex-col gap-1", mine ? "items-end" : "items-start")}>
          {msg.image_path &&
            (msg.image_url ? (
              <button type="button" onClick={() => setViewing(true)} aria-label={t("dm.openPhoto")} className="overflow-hidden rounded-3xl">
                <img src={msg.image_url} alt="" className="max-h-80 w-auto max-w-full bg-secondary object-cover" />
              </button>
            ) : (
              <span className="grid h-40 w-56 place-items-center rounded-3xl bg-secondary text-caption text-muted-foreground">{t("dm.photoGone")}</span>
            ))}
          {msg.body && (
            <p
              className={cn(
                "whitespace-pre-line rounded-3xl px-4 py-2.5 text-body leading-snug [overflow-wrap:anywhere]",
                mine ? "bg-primary text-primary-foreground" : "bg-card",
              )}
            >
              {msg.body}
            </p>
          )}
          <span className="px-2 text-fine text-muted-foreground">
            {mine ? `${msg.opened_at ? t("dm.read") : t("voice.delivered")} · ${when}` : when}
          </span>
        </div>
        {msg.image_url && <PhotoViewer urls={[msg.image_url]} start={viewing ? 0 : null} alt={t("dm.photo")} onClose={() => setViewing(false)} />}
      </div>
    );

  let status: string;
  let Icon = Check;
  if (mine) {
    if (msg.opened_at) [status, Icon] = [t("voice.opened"), CheckCheck];
    else if (msg.expired_at) [status, Icon] = [t("voice.expired"), Clock];
    else status = t("voice.delivered");
  } else if (msg.expired_at) [status, Icon] = [t("voice.expired"), Clock];
  else status = t("voice.heard");

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      {unheard || phase === "playing" || phase === "loading" ? (
        <button
          type="button"
          onClick={() => void listen()}
          className="relative w-60 overflow-hidden rounded-3xl bg-primary px-4 py-3 text-left text-primary-foreground"
        >
          <span
            className="absolute inset-y-0 left-0 bg-primary-foreground/20 transition-[width] duration-100"
            style={{ width: `${progress * 100}%` }}
          />
          <span className="relative flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-foreground text-primary">
              {phase === "idle" ? <Play className="h-5 w-5" fill="currentColor" /> : <AudioLines className="h-5 w-5 animate-pulse" />}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{phase === "idle" ? t("voice.tapToListen") : t("voice.playing")}</span>
              <span className="block text-fine text-primary-foreground/80">
                {formatClock(msg.duration_ms ?? 0)} · {t("voice.onceOnly")}
              </span>
            </span>
          </span>
        </button>
      ) : (
        <div className={cn("w-52 rounded-3xl px-4 py-3", mine ? "bg-secondary" : "bg-muted")}>
          <div className="flex items-center gap-2 font-semibold tabular-nums">
            <AudioLines className="h-5 w-5 text-muted-foreground" /> {formatClock(msg.duration_ms ?? 0)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-fine text-muted-foreground">
            <Icon className="h-3.5 w-3.5" /> {status} · {when}
          </div>
        </div>
      )}
    </div>
  );
}
