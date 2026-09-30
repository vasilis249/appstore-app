import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RadioTower, Send, SquarePen } from "lucide-react";
import { AppHeader, HeaderIconLink, HeaderPill } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { PersonRow } from "@/components/friends/person-row";
import { FriendPickerSheet } from "@/components/voice/friend-picker-sheet";
import { useWalkieList } from "@/components/walkie/walkie-hub";
import { useThreads } from "@/hooks/use-threads";
import { timeAgo } from "@/lib/time-ago";
import type { Thread } from "@/lib/voice";

export const Route = createFileRoute("/_authenticated/messages/")({
  component: MessagesPage,
});

function MessagesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const threads = useThreads();
  const [pickerOpen, setPickerOpen] = useState(false);
  const walkie = useWalkieList();
  const walkieUnheard = (walkie.data ?? []).reduce((n, c) => n + c.unheard, 0);

  function subtitle(th: Thread) {
    const when = timeAgo(th.last_at, i18n.language);
    if (th.unheard > 0) return t("voice.unheardCount", { count: th.unheard });
    const state = th.last_from_me
      ? { delivered: t("voice.delivered"), opened: t("voice.opened"), expired: t("voice.expired") }[th.last_state]
      : th.last_state === "expired" ? t("voice.expired") : t("voice.heard");
    return `${state} · ${when}`;
  }

  return (
    <>
      <AppHeader
        back
        title={t("tabs.messages")}
        right={
          <HeaderPill>
            <HeaderIconLink to="/talk" label={t("walkie.title")} badge={walkieUnheard}>
              <RadioTower className="h-5 w-5" />
            </HeaderIconLink>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-label={t("voice.newMessage")}
              className="grid h-9 w-10 place-items-center rounded-full"
            >
              <SquarePen className="h-5 w-5" />
            </button>
          </HeaderPill>
        }
      />
      {threads.data && !threads.data.length ? (
        <EmptyState
          icon={Send}
          text={t("messages.empty")}
          action={
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="h-12 rounded-2xl bg-primary px-8 font-semibold text-primary-foreground"
            >
              {t("voice.newMessage")}
            </button>
          }
        />
      ) : (
        <ul className="px-4 pt-2">
          {(threads.data ?? []).map((th) => (
            <PersonRow
              key={th.other_id}
              person={th}
              subtitle={subtitle(th)}
              onOpen={() => void navigate({ to: "/messages/$userId", params: { userId: th.other_id } })}
            >
              {th.unheard > 0 && <span className="h-3 w-3 rounded-full bg-live" aria-hidden />}
            </PersonRow>
          ))}
        </ul>
      )}
      <FriendPickerSheet open={pickerOpen} onOpenChange={setPickerOpen} />
    </>
  );
}
