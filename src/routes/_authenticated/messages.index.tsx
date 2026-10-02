import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Search, Send, SquarePen } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import { FriendPickerSheet } from "@/components/voice/friend-picker-sheet";
import { useWalkieList } from "@/components/walkie/walkie-hub";
import { useMyProfile } from "@/hooks/use-my-profile";
import { useThreads } from "@/hooks/use-threads";
import { timeAgoShort } from "@/lib/time-ago";
import { walkieHub } from "@/lib/walkie/hub";
import { cn } from "@/lib/utils";
import type { Thread } from "@/lib/voice";

export const Route = createFileRoute("/_authenticated/messages/")({
  component: MessagesPage,
});

/**
 * Messages: your username + compose on top, a search field, «Μηνύματα» + the Walkie-talkie link (unheard badge),
 * then the voice conversations — unread ones in bold with a dot, green dot = here.
 */
function MessagesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const me = useMyProfile();
  const threads = useThreads();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const walkie = useWalkieList();
  useSyncExternalStore(walkieHub.subscribe, walkieHub.version, walkieHub.version);
  const peers = walkieHub.peers().filter((p) => p.kind === "walkie");
  const online = new Set(peers.filter((p) => p.snap.peerOnline).map((p) => p.peer));

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const all = threads.data ?? [];
    return q ? all.filter((th) => `${th.full_name} ${th.username}`.toLocaleLowerCase().includes(q)) : all;
  }, [threads.data, query]);

  function subtitle(th: Thread) {
    const when = timeAgoShort(th.last_at, i18n.language);
    if (th.unheard > 0) return `${t("voice.unheardCount", { count: th.unheard })} · ${when}`;
    const state = th.last_from_me
      ? { delivered: t("voice.delivered"), opened: t("voice.opened"), expired: t("voice.expired") }[th.last_state]
      : th.last_state === "expired" ? t("voice.expired") : t("voice.heard");
    return `${state} · ${when}`;
  }

  const walkieUnheard = (walkie.data ?? []).reduce((n, c) => n + c.unheard, 0);
  return (
    <>
      <AppHeader
        back
        center={<h1 className="max-w-[55vw] truncate text-[20px] font-extrabold tracking-[-0.02em]">{me.data?.username ?? t("tabs.messages")}</h1>}
        right={
          <button type="button" onClick={() => setPickerOpen(true)} aria-label={t("voice.newMessage")} className="grid h-11 w-11 place-items-center rounded-full">
            <SquarePen className="h-[25px] w-[25px]" strokeWidth={1.9} />
          </button>
        }
      />
      <div className="px-4 pb-1 pt-1">
        <label className="flex h-10 items-center gap-2.5 rounded-xl bg-secondary px-3.5">
          <Search className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("messages.search")}
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <h2 className="text-[17px] font-bold tracking-normal">{t("tabs.messages")}</h2>
        <Link to="/talk" className="flex items-center gap-1.5 text-[15px] font-semibold text-muted-foreground">
          {t("walkie.title")}
          {walkieUnheard > 0 && (
            <span className="min-w-5 rounded-full bg-live px-1.5 text-center text-[11px] font-bold leading-5 text-destructive-foreground animate-scale-in">
              {walkieUnheard}
            </span>
          )}
        </Link>
      </div>

      {threads.data && !threads.data.length ? (
        <EmptyState
          icon={Send}
          text={t("messages.empty")}
          action={
            <button type="button" onClick={() => setPickerOpen(true)} className="h-11 rounded-lg bg-primary px-6 text-[15px] font-semibold text-primary-foreground">
              {t("voice.newMessage")}
            </button>
          }
        />
      ) : (
        <ul className="pb-28 stagger">
          {list.map((th) => {
            const name = th.full_name || th.username;
            const unread = th.unheard > 0;
            return (
              <li key={th.other_id}>
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/messages/$userId", params: { userId: th.other_id } })}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left active:bg-secondary/60"
                >
                  <span className="relative shrink-0">
                    <UserAvatar name={name} path={th.avatar_path} size={56} />
                    {online.has(th.other_id) && <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-[3px] border-background bg-success" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[15px]", unread ? "font-bold" : "font-normal")}>{name}</span>
                    <span className={cn("block truncate text-[14px]", unread ? "font-semibold text-foreground" : "text-muted-foreground")}>{subtitle(th)}</span>
                  </span>
                  {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-link" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <FriendPickerSheet open={pickerOpen} onOpenChange={setPickerOpen} />
    </>
  );
}
