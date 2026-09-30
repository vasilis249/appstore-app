import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pause, Play, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { Switch } from "@/components/ui/switch";
import { useWalkieList } from "@/components/walkie/walkie-hub";
import { UserAvatar } from "@/components/user-avatar";
import { VoiceIcon } from "@/components/voice/voice-icon";
import { useAuth } from "@/hooks/use-auth";
import { useWalkie } from "@/hooks/use-walkie";
import { base64ToBlob, formatClock, player } from "@/lib/audio";
import { friendKeys, profileStats } from "@/lib/friends";
import { timeAgoShort } from "@/lib/time-ago";
import { WALKIE_MAX_MS } from "@/lib/walkie/engine";
import { notificationKeys } from "@/lib/notifications";
import { setWalkieChannel, walkieAudio, walkieHistory, walkieKeys, walkieSeen, type WalkieItem } from "@/lib/walkie/history";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/talk/$userId")({
  component: TalkPage,
});

/**
 * Walkie-talkie with one friend (like Zello): hold the big button and speak — they hear you live while you talk.
 * One speaker at a time. The last 24 h can be replayed below.
 */
function TalkPage() {
  const { userId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const other = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, username, full_name, avatar_path").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const stats = useQuery({ queryKey: friendKeys.stats(userId), queryFn: () => profileStats(userId) });
  const friends = !!stats.data?.i_follow && !!stats.data?.follows_me;
  const history = useQuery({ queryKey: walkieKeys.history(userId), queryFn: () => walkieHistory(userId), enabled: friends });

  // Opening the screen (and every new transmission while it is open) counts as heard.
  const seen = () =>
    void walkieSeen(userId).then(() => {
      void qc.invalidateQueries({ queryKey: walkieKeys.list });
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    });
  useEffect(() => {
    if (friends) seen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends, userId]);
  const w = useWalkie(friends ? user?.id : undefined, userId, {
    onSaved: () => {
      void qc.invalidateQueries({ queryKey: walkieKeys.history(userId) });
      seen();
    },
    onYield: () => toast(t("walkie.yielded", { name: first })),
  });
  const list = useWalkieList(friends);
  const channelOn = !!list.data?.find((c) => c.user_id === userId)?.channel_on;
  const channel = useMutation({
    mutationFn: (on: boolean) => setWalkieChannel(userId, on),
    onError: (e) => toast.error(e instanceof Error && e.message.includes("too_many") ? t("walkie.tooMany") : t("errors.generic")),
    onSettled: () => void qc.invalidateQueries({ queryKey: walkieKeys.list }),
  });
  const s = w.snap;
  const name = other.data ? other.data.full_name || other.data.username : "";
  const first = name.split(" ")[0];

  // Press → talk, release → stop; a release that comes while the mic is still starting stops it right after.
  const held = useRef(false);
  const [denied, setDenied] = useState(false);
  async function down(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 || held.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    held.current = true;
    if (s?.peerTalking) {
      setDenied(true);
      setTimeout(() => setDenied(false), 900);
      return;
    }
    const ok = await w.press();
    if (ok && !held.current) w.release();
  }
  function up() {
    if (!held.current) return;
    held.current = false;
    w.release();
  }

  const status = !friends
    ? stats.data
      ? t("walkie.friendsOnly")
      : ""
    : !s || !s.connected
      ? s?.error === "channel"
        ? t("walkie.cantConnect")
        : t("walkie.connecting")
      : s.talking
        ? t("walkie.onAir")
        : s.starting
          ? t("walkie.starting")
          : s.peerTalking
            ? t("walkie.peerTalking", { name: first })
            : s.peerOnline
              ? t("walkie.peerHere", { name: first })
              : t("walkie.peerAway", { name: first });

  const disabled = !friends || !s?.connected;
  return (
    <>
      <AppHeader back title={t("walkie.title")} />
      <div className="flex flex-1 select-none flex-col items-center px-4 pb-8 pt-4">
        <div className="relative">
          <span
            className={cn(
              "block rounded-full p-1 ring-4 transition-colors",
              s?.peerTalking ? "animate-pulse ring-coral" : s?.peerOnline ? "ring-emerald-500/70" : "ring-transparent",
            )}
          >
            <UserAvatar name={name} path={other.data?.avatar_path ?? null} size={96} />
          </span>
          {s?.peerTalking && (
            <span className="absolute -bottom-2 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full bg-coral text-white">
              <VoiceIcon className="h-4 w-4" live />
            </span>
          )}
        </div>
        <h1 className="mt-4 text-2xl font-bold">{name}</h1>
        <p className={cn("mt-1 h-5 text-sm", s?.peerTalking || s?.talking ? "font-semibold text-coral" : "text-muted-foreground")}>{status}</p>

        {friends && s?.audioLocked && (
          <button
            type="button"
            onClick={w.unlockAudio}
            className="mt-4 flex h-10 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-semibold"
          >
            <Volume2 className="h-4 w-4" /> {t("walkie.enableSound")}
          </button>
        )}

        <div className="relative mt-10 grid h-52 w-52 place-items-center">
          {s?.talking && (
            <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 208 208" aria-hidden>
              <circle
                cx="104" cy="104" r="100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="text-coral"
                strokeDasharray={2 * Math.PI * 100} strokeDashoffset={2 * Math.PI * 100 * (1 - Math.min(1, s.elapsedMs / WALKIE_MAX_MS))}
              />
            </svg>
          )}
          <button
            type="button"
            disabled={disabled}
            onPointerDown={(e) => void down(e)}
            onPointerUp={up}
            onPointerCancel={up}
            onLostPointerCapture={up}
            onContextMenu={(e) => e.preventDefault()}
            style={{ WebkitTouchCallout: "none", touchAction: "none" }}
            aria-label={t("walkie.hold")}
            className={cn(
              "grid h-44 w-44 place-items-center rounded-full shadow-lg transition-transform duration-150 disabled:opacity-40",
              s?.talking || s?.starting
                ? "scale-105 bg-coral text-white"
                : s?.peerTalking
                  ? "bg-secondary text-muted-foreground"
                  : "bg-primary text-primary-foreground",
              denied && "animate-shake",
            )}
          >
            <VoiceIcon className="h-16 w-16" strokeWidth={1.8} live={!!s?.talking} />
          </button>
        </div>
        <p className="mt-4 h-5 text-sm tabular-nums text-muted-foreground">
          {s?.talking ? `${formatClock(s.elapsedMs)} / ${formatClock(WALKIE_MAX_MS)}` : friends ? t("walkie.hold") : ""}
        </p>

        {friends && (
          <label className="mt-8 flex w-full items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3">
            <span>
              <span className="block text-[15px] font-semibold">{t("walkie.channelOn")}</span>
              <span className="block text-sm text-muted-foreground">{t("walkie.channelOnHint")}</span>
            </span>
            <Switch checked={channelOn} disabled={channel.isPending} onCheckedChange={(on) => channel.mutate(on)} />
          </label>
        )}

        {friends && (
          <section className="mt-6 w-full">
            <h2 className="pb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("walkie.last24h")}</h2>
            {history.data && !history.data.length && <p className="py-4 text-sm text-muted-foreground">{t("walkie.noHistory")}</p>}
            <ul className="divide-y divide-border">
              {(history.data ?? []).map((m) => (
                <HistoryRow key={m.id} item={m} mine={m.sender_id === user?.id} name={first} locale={i18n.language} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

function HistoryRow({ item, mine, name, locale }: { item: WalkieItem; mine: boolean; name: string; locale: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  async function toggle() {
    if (state !== "idle") {
      player.stop();
      setState("idle");
      return;
    }
    player.prime(); // inside the tap (iOS)
    setState("loading");
    try {
      const a = await walkieAudio(item.id);
      setState("playing");
      await player.play(base64ToBlob(a.audio_b64, a.mime), { durationMs: item.duration_ms, onEnd: () => setState("idle") });
    } catch {
      setState("idle");
      toast.error(t("voice.playFailed"));
    }
  }
  return (
    <li className="flex items-center gap-3 py-2.5">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={state === "playing" ? t("daily.pause") : t("daily.play")}
        className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", mine ? "bg-secondary" : "bg-primary text-primary-foreground")}
      >
        {state === "playing" ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
      </button>
      <span className="flex-1 text-[15px] font-medium">{mine ? t("walkie.you") : name}</span>
      <span className="text-sm tabular-nums text-muted-foreground">
        {formatClock(item.duration_ms)} · {timeAgoShort(item.created_at, locale)}
      </span>
    </li>
  );
}
