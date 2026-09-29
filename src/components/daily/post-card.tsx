import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { Waveform } from "@/components/voice/waveform";
import { formatClock, player } from "@/lib/audio";
import { fetchPostAudio, type FeedPost } from "@/lib/daily";
import { timeAgo } from "@/lib/time-ago";

// Only one card plays at a time.
let current: { id: string; stop: () => void } | null = null;

/** A daily voice post: blurred and locked until you post yours, otherwise playable. */
export function PostCard({ post }: { post: FeedPost }) {
  const { t, i18n } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const locked = !post.audio_path;
  const name = post.is_mine ? t("daily.yourVoice") : post.full_name || post.username;

  useEffect(
    () => () => {
      if (current?.id === post.post_id) {
        player.stop();
        current = null;
      }
    },
    [post.post_id],
  );

  function stop() {
    setPlaying(false);
    setProgress(0);
  }

  async function toggle() {
    if (locked) return;
    if (playing) {
      player.stop();
      stop();
      return;
    }
    if (current && current.id !== post.post_id) current.stop();
    current = { id: post.post_id, stop };
    player.prime(); // inside the tap (iOS)
    setPlaying(true);
    try {
      const blob = await fetchPostAudio(post.audio_path!);
      await player.play(blob, { durationMs: post.duration_ms, onProgress: setProgress, onEnd: stop });
    } catch {
      stop();
      toast.error(t("voice.playFailed"));
    }
  }

  return (
    <article className="rounded-3xl bg-card p-4 ring-1 ring-border">
      <header className="flex items-center gap-3">
        <UserAvatar name={post.full_name || post.username} path={post.avatar_path} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">
            {timeAgo(post.created_at, i18n.language)}
            {post.late && ` · ${t("daily.late")}`}
          </p>
        </div>
      </header>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={locked}
        aria-label={locked ? t("daily.locked") : playing ? t("daily.pause") : t("daily.play")}
        className="relative mt-3 flex w-full items-center gap-3 rounded-2xl bg-secondary px-3 py-3 text-left"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
        </span>
        <Waveform seed={post.post_id} progress={progress} className={locked ? "blur-[3px]" : undefined} />
        <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
          {formatClock(post.duration_ms)}
        </span>
        {locked && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl bg-background/50 text-sm font-semibold backdrop-blur-[2px]">
            <Lock className="h-4 w-4" /> {t("daily.locked")}
          </span>
        )}
      </button>
    </article>
  );
}
