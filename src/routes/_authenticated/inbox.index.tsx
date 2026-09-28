import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { Check, Loader2, MessageCircle, Search, SquarePen } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { UserAvatar } from "@/components/social/user-avatar";
import { ConversationAvatar, conversationName } from "@/components/social/conversation-avatar";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time-ago";
import { dmErrorKey } from "@/lib/dm-errors";
import { listInbox, openDirect, shareTargets, type InboxItem } from "@/lib/api/inbox.functions";
import { createGroupConversation } from "@/lib/api/community.functions";

export const Route = createFileRoute("/_authenticated/inbox/")({
  validateSearch: z.object({ tab: z.enum(["primary", "requests"]).optional() }),
  head: () => ({ meta: [{ title: "Μηνύματα — Courtsie" }] }),
  component: InboxPage,
});

function InboxPage() {
  const { t } = useTranslation();
  const { tab = "primary" } = Route.useSearch();
  const navigate = useNavigate();
  const listFn = useServerFn(listInbox);
  const [composeOpen, setComposeOpen] = useState(false);
  const q = useQuery({ queryKey: ["inbox"], queryFn: () => listFn() });
  const all = q.data ?? [];
  const primary = all.filter((c) => c.accepted);
  const requests = all.filter((c) => !c.accepted);
  const items = tab === "requests" ? requests : primary;

  const seg = "flex-1 rounded-[12px] py-2 text-center text-sm font-semibold transition";
  const on = "bg-background text-foreground shadow-sm";

  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <nav className="flex flex-1 rounded-[14px] bg-secondary p-1 text-muted-foreground">
          <Link to="/inbox" search={{}} className={cn(seg, tab === "primary" && on)}>
            {t("dm.primary")}
          </Link>
          <Link
            to="/inbox"
            search={{ tab: "requests" }}
            className={cn(seg, tab === "requests" && on)}
          >
            {requests.length ? t("dm.requestsCount", { count: requests.length }) : t("dm.requests")}
          </Link>
        </nav>
        <button
          type="button"
          aria-label={t("dm.new")}
          onClick={() => setComposeOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted"
        >
          <SquarePen className="h-5 w-5" />
        </button>
      </div>

      {tab === "requests" && requests.length > 0 && (
        <p className="mb-3 text-xs text-muted-foreground">{t("dm.requestsHint")}</p>
      )}

      {q.isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !items.length ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <MessageCircle className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {tab === "requests" ? t("dm.emptyRequests") : t("dm.empty")}
          </p>
        </div>
      ) : (
        <ul className="-mx-2">
          {items.map((c) => (
            <InboxRow key={c.id} c={c} />
          ))}
        </ul>
      )}

      <ComposeSheet
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onOpen={(id) => navigate({ to: "/inbox/$conversationId", params: { conversationId: id } })}
      />
    </div>
  );
}

function InboxRow({ c }: { c: InboxItem }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";
  const unread = c.unread > 0;
  const preview =
    c.lastKind === "post"
      ? t("dm.sharedPost")
      : c.lastKind === "story"
        ? t("dm.storyReply")
        : (c.lastBody ?? "");

  return (
    <li>
      <Link
        to="/inbox/$conversationId"
        params={{ conversationId: c.id }}
        className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-muted/60"
      >
        <ConversationAvatar c={c} size={52} />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm", unread ? "font-bold" : "font-medium")}>
            {conversationName(c)}
          </span>
          <span
            className={cn(
              "flex gap-1 text-[13px]",
              unread ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            <span className="truncate">
              {c.lastFromMe && `${t("dm.you")}: `}
              {preview}
            </span>
            <span className="shrink-0 text-muted-foreground">· {timeAgo(c.lastAt, locale)}</span>
          </span>
        </span>
        {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
      </Link>
    </li>
  );
}

/** New message: pick one person (1:1) or several (group). */
function ComposeSheet({
  open,
  onOpenChange,
  onOpen,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onOpen: (conversationId: string) => void;
}) {
  const { t } = useTranslation();
  const targetsFn = useServerFn(shareTargets);
  const openFn = useServerFn(openDirect);
  const groupFn = useServerFn(createGroupConversation);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<{ id: string; username: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    if (open) {
      setQ("");
      setPicked([]);
    }
  }, [open]);

  const people = useQuery({
    queryKey: ["share-targets", debounced.length >= 2 ? debounced : ""],
    enabled: open,
    queryFn: () => targetsFn({ data: { q: debounced.length >= 2 ? debounced : undefined } }),
  });

  async function start() {
    setBusy(true);
    try {
      const { id } =
        picked.length === 1
          ? await openFn({ data: { userId: picked[0].id } })
          : await groupFn({
              data: {
                title: picked
                  .map((p) => p.username)
                  .join(", ")
                  .slice(0, 80),
                memberIds: picked.map((p) => p.id),
              },
            });
      onOpenChange(false);
      onOpen(id);
    } catch (e) {
      toast.error(t(dmErrorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto h-[85vh] max-w-lg rounded-t-[28px] border-0 bg-background">
        <DrawerTitle className="pt-3 text-center font-display text-base font-bold">
          {t("dm.new")}
        </DrawerTitle>
        <DrawerDescription className="sr-only">{t("dm.new")}</DrawerDescription>
        <div className="px-4 pt-3">
          <label className="flex h-10 items-center gap-2 rounded-xl bg-secondary px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("dm.searchPh")}
              autoCapitalize="none"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
        <ul className="flex-1 overflow-y-auto px-4 py-2">
          {people.isLoading && (
            <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />
          )}
          {(people.data ?? []).map((p) => {
            const on = picked.some((x) => x.id === p.user_id);
            return (
              <li key={p.user_id}>
                <button
                  type="button"
                  onClick={() =>
                    setPicked((cur) =>
                      on
                        ? cur.filter((x) => x.id !== p.user_id)
                        : cur.length < 20
                          ? [...cur, { id: p.user_id, username: p.username }]
                          : cur,
                    )
                  }
                  className="flex w-full items-center gap-3 py-2 text-left"
                >
                  <UserAvatar name={p.full_name ?? p.username} photoUrl={p.photo_url} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {p.full_name ?? p.username}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.username}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-full border-2",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="safe-bottom border-t border-border/60 p-4">
          <button
            type="button"
            disabled={!picked.length || busy}
            onClick={start}
            className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            {busy ? "…" : t("dm.chat")}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
