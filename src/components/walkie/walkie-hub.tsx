import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/components/user-avatar";
import { VoiceIcon } from "@/components/voice/voice-icon";
import { useAuth } from "@/hooks/use-auth";
import { isNativeApp } from "@/lib/native";
import { resumeWalkieAudio, unlockWalkieAudio, walkieAudioRunning } from "@/lib/walkie/engine";
import { walkieKeys, walkieList, type WalkieContact } from "@/lib/walkie/history";
import { walkieHub } from "@/lib/walkie/hub";
import { arm, onVisibility } from "@/lib/walkie/keepalive";

/** Your walkie friends (shared by the hub, the banner and the walkie screens). */
export function useWalkieList(enabled = true) {
  const { user } = useAuth();
  return useQuery({ queryKey: walkieKeys.list, queryFn: walkieList, enabled: enabled && !!user, staleTime: 60_000 });
}

function useHubPeers() {
  useSyncExternalStore(walkieHub.subscribe, walkieHub.version, walkieHub.version);
  return walkieHub.peers();
}

/**
 * Keeps "channel on" friends connected while you use the app, unlocks sound with your first tap (iOS), plays the
 * silent keep-alive in the background when you turned it on, and shows a local notice when a friend starts talking
 * while the app is in the background (app only; permission from the daily reminder).
 */
export function WalkieHubSync() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const list = useWalkieList();

  useEffect(() => {
    walkieHub.setUser(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    if (!user || !list.data) return;
    walkieHub.setPinned(list.data.filter((c) => c.channel_on).map((c) => c.user_id));
  }, [user, list.data]);

  useEffect(() => {
    const tap = () => {
      if (!walkieHub.pinnedCount()) return;
      if (!walkieAudioRunning()) void unlockWalkieAudio();
      arm();
    };
    const vis = () => {
      onVisibility(walkieHub.pinnedCount() > 0);
      if (document.visibilityState === "visible") {
        resumeWalkieAudio();
        walkieHub.refresh();
      }
    };
    const online = () => walkieHub.refresh();
    document.addEventListener("pointerdown", tap, { capture: true, passive: true });
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("online", online);
    return () => {
      document.removeEventListener("pointerdown", tap, { capture: true });
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("online", online);
    };
  }, []);

  const contacts = list.data;
  useEffect(
    () =>
      walkieHub.onPeerStart((peer) => {
        if (document.visibilityState !== "hidden" || !isNativeApp()) return;
        const c = contacts?.find((x) => x.user_id === peer);
        void notifyTalking(c ? c.full_name || c.username : "", t("walkie.notifyBody"), peer);
      }),
    [contacts, t],
  );
  return null;
}

async function notifyTalking(title: string, body: string, peer: string) {
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    if ((await LocalNotifications.checkPermissions()).display !== "granted") return;
    await LocalNotifications.schedule({
      notifications: [{ id: 40_000_000 + Math.floor(Math.random() * 1_000_000), title: title || "Speak", body, extra: { route: `/talk/${peer}` } }],
    });
  } catch {
    /* best effort */
  }
}

/** "Νίκος σου μιλάει" over every screen except that friend's walkie; tap opens it (and turns sound on). */
export function WalkieBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const peers = useHubPeers();
  const list = useWalkieList();
  const talking = peers.find((p) => p.snap.peerTalking && path !== `/talk/${p.peer}`);
  if (!talking) return null;
  const c: Pick<WalkieContact, "full_name" | "username" | "avatar_path"> | undefined = list.data?.find((x) => x.user_id === talking.peer);
  const name = c ? c.full_name || c.username : "";
  return (
    <button
      type="button"
      onClick={() => {
        void unlockWalkieAudio();
        void navigate({ to: "/talk/$userId", params: { userId: talking.peer } });
      }}
      className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 mx-auto flex max-w-md items-center gap-3 rounded-full bg-coral px-3 py-2 text-left text-white shadow-lg"
    >
      <UserAvatar name={name} path={c?.avatar_path ?? null} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{t("walkie.bannerTalking", { name: name.split(" ")[0] })}</span>
        {talking.snap.audioLocked && <span className="block text-xs text-white/85">{t("walkie.bannerTap")}</span>}
      </span>
      <VoiceIcon className="h-6 w-6 shrink-0" live />
    </button>
  );
}
