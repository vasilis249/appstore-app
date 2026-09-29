import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Mic, Pause, Play, RotateCcw, Square } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { PostCard } from "@/components/daily/post-card";
import { useAuth } from "@/hooks/use-auth";
import { useRecorder } from "@/hooks/use-recorder";
import { formatClock, player } from "@/lib/audio";
import { dailyKeys, deleteDaily, getFeed, getToday, POST_MAX_MS, publishDaily } from "@/lib/daily";
import { rpcErrorKey } from "@/lib/friends";
import { splitDuration, useNow } from "@/hooks/use-now";
import { promptPermission, requestPromptPermission, syncDailyPrompts } from "@/lib/prompt-notifications";

export const Route = createFileRoute("/_authenticated/record")({
  component: RecordPage,
});

function RecordPage() {
  const { t, i18n } = useTranslation();
  const today = useQuery({ queryKey: dailyKeys.today, queryFn: getToday });
  const feed = useQuery({ queryKey: dailyKeys.feed, queryFn: getFeed });
  const mine = feed.data?.find((p) => p.is_mine);
  const promptTime = today.data
    ? new Date(today.data.prompt_at).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <>
      <AppHeader back title={t("record.title")} />
      {today.data && (
        <p className="text-center text-xs text-muted-foreground">{t("daily.promptAt", { time: promptTime })}</p>
      )}
      {today.data?.my_post_id ? mine ? <Posted post={mine} nextPromptAt={today.data.next_prompt_at} /> : null : today.data ? <Recorder /> : null}
    </>
  );
}

function Posted({ post, nextPromptAt }: { post: NonNullable<Awaited<ReturnType<typeof getFeed>>[number]>; nextPromptAt: string }) {
  const { t } = useTranslation();
  const now = useNow();
  const next = splitDuration(new Date(nextPromptAt).getTime() - now);
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const del = useMutation({
    mutationFn: () => deleteDaily(post),
    onSuccess: () => qc.invalidateQueries({ queryKey: dailyKeys.all }),
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pt-6">
      <PostCard post={post} />
      <p className="text-center text-sm text-muted-foreground">{t("daily.postedHint")}</p>
      <p className="text-center text-sm font-semibold">
        {t("daily.nextIn", { time: next.h ? t("time.hm", next) : t("time.m", next) })}
      </p>
      <button
        type="button"
        disabled={del.isPending}
        onClick={() => (confirm ? del.mutate() : setConfirm(true))}
        className="mx-auto h-10 rounded-full px-5 text-sm font-semibold text-destructive disabled:opacity-50"
      >
        {confirm ? t("daily.deleteConfirm") : t("daily.delete")}
      </button>
    </div>
  );
}

/** Big round recorder with a 90-second progress ring. */
function Recorder() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const r = useRecorder(POST_MAX_MS);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (r.error) toast.error(t(r.error === "denied" ? "voice.micDenied" : "voice.unsupported"));
  }, [r.error, t]);

  const publish = useMutation({
    mutationFn: () => publishDaily(user!.id, r.clip!),
    onSuccess: async () => {
      player.stop();
      await qc.invalidateQueries({ queryKey: dailyKeys.all });
      toast.success(t("daily.published"));
      void navigate({ to: "/" });
      // Good moment to ask: they just used the feature the reminder is for.
      if ((await promptPermission()) === "prompt" && (await requestPromptPermission()) === "granted") {
        void syncDailyPrompts();
      }
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  const ms = r.state === "recorded" && r.clip ? r.clip.durationMs : r.elapsedMs;
  const fraction = Math.min(1, ms / POST_MAX_MS);
  const R = 76;
  const C = 2 * Math.PI * R;

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

  function main() {
    if (r.state === "idle") void r.start();
    else if (r.state === "recording") r.stop();
    else preview();
  }

  const Icon = r.state === "idle" ? Mic : r.state === "recording" ? Square : previewing ? Pause : Play;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 py-10 text-center">
      <div className="relative grid h-44 w-44 place-items-center">
        <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 176 176" aria-hidden>
          <circle cx="88" cy="88" r={R} fill="none" stroke="currentColor" strokeWidth="6" className="text-secondary" />
          <circle
            cx="88" cy="88" r={R} fill="none" strokeWidth="6" strokeLinecap="round"
            stroke="currentColor" className={r.state === "recording" ? "text-coral" : "text-foreground"}
            strokeDasharray={C} strokeDashoffset={C * (1 - fraction)}
          />
        </svg>
        <button
          type="button"
          onClick={main}
          aria-label={r.state === "idle" ? t("voice.record") : r.state === "recording" ? t("voice.stop") : t("daily.play")}
          className={
            "grid h-32 w-32 place-items-center rounded-full shadow-lg " +
            (r.state === "recording" ? "bg-coral text-white" : "bg-primary text-primary-foreground")
          }
        >
          <Icon className="h-12 w-12" fill={r.state === "idle" ? "none" : "currentColor"} />
        </button>
      </div>
      <p className="text-2xl font-bold tabular-nums">
        {formatClock(ms)} <span className="text-base font-medium text-muted-foreground">/ {formatClock(POST_MAX_MS)}</span>
      </p>
      <p className="text-base text-muted-foreground">
        {r.state === "idle" ? t("daily.recordHint") : r.state === "recording" ? t("daily.recordingHint") : t("daily.reviewHint")}
      </p>
      {r.state === "recorded" && (
        <div className="flex w-full max-w-xs gap-3">
          <button
            type="button"
            onClick={() => {
              player.stop();
              setPreviewing(false);
              r.discard();
            }}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-secondary font-semibold"
          >
            <RotateCcw className="h-4 w-4" /> {t("daily.retake")}
          </button>
          <button
            type="button"
            disabled={publish.isPending}
            onClick={() => publish.mutate()}
            className="h-12 flex-1 rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t("daily.post")}
          </button>
        </div>
      )}
    </div>
  );
}
