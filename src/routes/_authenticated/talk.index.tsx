import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { RadioTower } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import { Switch } from "@/components/ui/switch";
import { useWalkieList } from "@/components/walkie/walkie-hub";
import { isNativeApp } from "@/lib/native";
import { requestPromptPermission } from "@/lib/prompt-notifications";
import { timeAgoShort } from "@/lib/time-ago";
import { walkieHub } from "@/lib/walkie/hub";
import { backgroundWanted, setBackgroundWanted } from "@/lib/walkie/keepalive";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/talk/")({
  component: WalkieListPage,
});

/**
 * Walkie-talkie friends: their channels are always open (you hear them live anywhere in the app); see who is here and
 * what you haven't heard (24 h). Tap a friend to talk.
 */
function WalkieListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const list = useWalkieList();
  useSyncExternalStore(walkieHub.subscribe, walkieHub.version, walkieHub.version);
  const online = new Set(walkieHub.peers().filter((p) => p.kind === "walkie" && p.snap.peerOnline).map((p) => p.peer));
  const [background, setBackground] = useState(backgroundWanted);

  return (
    <>
      <AppHeader back title={t("walkie.title")} />
      {list.data && !list.data.length ? (
        <EmptyState
          icon={RadioTower}
          title={t("walkie.emptyTitle")}
          text={t("walkie.empty")}
          action={
            <Link to="/search" className="inline-flex h-12 items-center rounded-xl bg-primary px-8 font-semibold text-primary-foreground">
              {t("home.findPeople")}
            </Link>
          }
        />
      ) : (
        <div className="px-4 pb-6">
          <p className="pb-2 pt-1 text-caption text-muted-foreground">{t("walkie.listHint")}</p>
          <ul>
            {(list.data ?? []).map((c) => {
              const name = c.full_name || c.username;
              const sub = c.unheard
                ? t("walkie.unheard", { count: c.unheard })
                : c.last_at
                  ? timeAgoShort(c.last_at, i18n.language)
                  : online.has(c.user_id)
                    ? t("walkie.here")
                    : "";
              return (
                <li key={c.user_id} className="py-2.5">
                  <button
                    type="button"
                    onClick={() => void navigate({ to: "/talk/$userId", params: { userId: c.user_id } })}
                    className="flex w-full min-w-0 items-center gap-3 text-left"
                  >
                    <span className={cn("rounded-full p-0.5 ring-2", online.has(c.user_id) ? "ring-success/80" : "ring-transparent")}>
                      <UserAvatar name={name} path={c.avatar_path} size={52} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold">{name}</span>
                      {sub && <span className={cn("block truncate text-caption", c.unheard ? "font-semibold text-live" : "text-muted-foreground")}>{sub}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {isNativeApp() && !!list.data?.length && (
            <label className="mt-4 flex items-start justify-between gap-3 rounded-2xl bg-card px-4 py-3">
              <span>
                <span className="block text-callout font-semibold">{t("walkie.background")}</span>
                <span className="block text-caption text-muted-foreground">{t("walkie.backgroundHint")}</span>
              </span>
              <Switch
                checked={background}
                onCheckedChange={(on) => {
                  // in the tap: ask once for the notice when a friend talks while the app is in the background
                  if (on) void requestPromptPermission();
                  setBackgroundWanted(on);
                  setBackground(on);
                }}
              />
            </label>
          )}
        </div>
      )}
    </>
  );
}
