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

/** One voice message. Unheard incoming ones play once; everything else shows its state. */
export function VoiceBubble({ msg, mine }: { msg: VoiceMessage; mine: boolean }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<"idle" | "loading" | "playing" | "done">("idle");
  const [progress, setProgress] = useState(0);

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
          className="relative w-60 overflow-hidden rounded-3xl bg-coral px-4 py-3 text-left text-white"
        >
          <span
            className="absolute inset-y-0 left-0 bg-white/20 transition-[width] duration-100"
            style={{ width: `${progress * 100}%` }}
          />
          <span className="relative flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-coral">
              {phase === "idle" ? <Play className="h-5 w-5" fill="currentColor" /> : <AudioLines className="h-5 w-5 animate-pulse" />}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{phase === "idle" ? t("voice.tapToListen") : t("voice.playing")}</span>
              <span className="block text-xs text-white/80">
                {formatClock(msg.duration_ms)} · {t("voice.onceOnly")}
              </span>
            </span>
          </span>
        </button>
      ) : (
        <div className={cn("w-52 rounded-3xl px-4 py-3", mine ? "bg-secondary" : "bg-muted")}>
          <div className="flex items-center gap-2 font-semibold tabular-nums">
            <AudioLines className="h-5 w-5 text-muted-foreground" /> {formatClock(msg.duration_ms)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5" /> {status} · {when}
          </div>
        </div>
      )}
    </div>
  );
}
