import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Ban, Flag, Info, LogOut, Trash2, UserRound } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { UserAvatar } from "@/components/social/user-avatar";
import { ConversationAvatar, conversationName } from "@/components/social/conversation-avatar";
import { RichText } from "@/components/social/rich-text";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { dmErrorKey } from "@/lib/dm-errors";
import {
  acceptRequest,
  deleteConversation,
  getThread,
  listThreadMessages,
  sendDm,
  type DmMessage,
  type Thread,
} from "@/lib/api/inbox.functions";
import { blockUser, markRead, reportConversation } from "@/lib/api/community.functions";

export const Route = createFileRoute("/_authenticated/inbox/$conversationId")({
  head: () => ({ meta: [{ title: "Μηνύματα — Courtsie" }] }),
  component: ThreadPage,
});

const GAP_MS = 60 * 60 * 1000;

function ThreadPage() {
  const { conversationId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";
  const { user } = useAuth();
  const me = user?.id;
  const qc = useQueryClient();
  const threadFn = useServerFn(getThread);
  const msgsFn = useServerFn(listThreadMessages);
  const sendFn = useServerFn(sendDm);
  const markFn = useServerFn(markRead);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const thread = useQuery({
    queryKey: ["thread", conversationId],
    queryFn: () => threadFn({ data: { conversationId } }),
    retry: false,
  });
  const msgs = useInfiniteQuery({
    queryKey: ["thread-msgs", conversationId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => msgsFn({ data: { conversationId, before: pageParam } }),
    getNextPageParam: (last) => (last.hasMore ? last.messages[0]?.created_at : undefined),
  });
  const messages = useMemo(
    () =>
      (msgs.data?.pages ?? [])
        .slice()
        .reverse()
        .flatMap((p) => p.messages),
    [msgs.data],
  );
  const accepted = thread.data?.accepted ?? true;

  // Realtime: refetch on new messages in this conversation.
  useEffect(() => {
    const ch = supabase
      .channel(`dm-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          stickToBottom.current = true;
          void qc.invalidateQueries({ queryKey: ["thread-msgs", conversationId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_members",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => void qc.invalidateQueries({ queryKey: ["thread", conversationId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [conversationId, qc]);

  // Mark as read (not for pending requests: the sender shouldn't see "Seen" yet).
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!lastId || !accepted) return;
    void markFn({ data: { conversationId } }).then(() =>
      qc.invalidateQueries({ queryKey: ["inbox"] }),
    );
  }, [lastId, accepted, conversationId, markFn, qc]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      await sendFn({ data: { conversationId, body } });
      setText("");
      stickToBottom.current = true;
      void qc.invalidateQueries({ queryKey: ["thread-msgs", conversationId] });
      void qc.invalidateQueries({ queryKey: ["inbox"] });
    } catch (e) {
      toast.error(t(dmErrorKey(e)));
    } finally {
      setSending(false);
    }
  }

  if (thread.isError) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">{t("dm.errors.notFound")}</p>
    );
  }

  const th = thread.data;
  const peer = th?.type === "direct" ? th.members[0] : undefined;
  // "Seen" under my last message when the other person read past it (1:1 only).
  const myLast = [...messages].reverse().find((m) => m.sender_id === me);
  const seen =
    !!peer?.last_read_at && !!myLast && new Date(peer.last_read_at) >= new Date(myLast.created_at);
  const byId = new Map((th?.members ?? []).map((m) => [m.user_id, m]));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background md:static md:z-auto md:mx-auto md:my-6 md:h-[78vh] md:max-w-xl md:overflow-hidden md:rounded-2xl md:border md:border-border">
      <header className="safe-top flex items-center gap-2 border-b border-border/60 px-2 py-2">
        <Link
          to="/inbox"
          aria-label={t("common.back", "Πίσω")}
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {th && <HeaderIdentity thread={th} />}
        <span className="flex-1" />
        <button
          type="button"
          aria-label={t("posts.more")}
          onClick={() => setMenu(true)}
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
        >
          <Info className="h-5 w-5" />
        </button>
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto px-3 py-3"
      >
        {msgs.hasNextPage && (
          <button
            type="button"
            onClick={() => {
              stickToBottom.current = false;
              void msgs.fetchNextPage();
            }}
            className="mx-auto mb-3 block rounded-full bg-secondary px-3 py-1 text-xs font-semibold"
          >
            {t("dm.loadOlder")}
          </button>
        )}
        {th && peer && messages.length < 40 && <IntroCard thread={th} />}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const mine = m.sender_id === me;
          const gap =
            !prev ||
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > GAP_MS;
          const lastOfGroup =
            !next ||
            next.sender_id !== m.sender_id ||
            new Date(next.created_at).getTime() - new Date(m.created_at).getTime() > GAP_MS;
          const sender = m.sender_id ? byId.get(m.sender_id) : undefined;
          return (
            <div key={m.id}>
              {gap && (
                <p className="my-3 text-center text-[11px] font-medium text-muted-foreground">
                  {new Date(m.created_at).toLocaleString(locale, {
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
              <MessageRow
                m={m}
                mine={mine}
                showAvatar={!mine && lastOfGroup}
                sender={sender}
                showName={th?.type === "group" && !mine && (gap || prev?.sender_id !== m.sender_id)}
                tight={!lastOfGroup}
              />
              {mine && m.id === myLast?.id && seen && (
                <p className="mt-0.5 pr-1 text-right text-[11px] text-muted-foreground">
                  {t("dm.seen")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {th && !accepted ? (
        <RequestBar thread={th} />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="safe-bottom flex items-center gap-2 border-t border-border/60 px-3 py-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder={t("dm.messagePh")}
            className="h-11 flex-1 rounded-full bg-secondary px-4 text-sm outline-none placeholder:text-muted-foreground"
          />
          {text.trim() && (
            <button
              type="submit"
              disabled={sending}
              className="px-2 text-sm font-semibold text-primary disabled:opacity-50"
            >
              {t("dm.send")}
            </button>
          )}
        </form>
      )}

      {th && <ThreadMenu thread={th} open={menu} onOpenChange={setMenu} />}
    </div>
  );
}

function HeaderIdentity({ thread }: { thread: Thread }) {
  const { t } = useTranslation();
  const peer = thread.type === "direct" ? thread.members[0] : undefined;
  const conv = { type: thread.type, title: thread.title, people: thread.members.slice(0, 2) };
  const inner = (
    <>
      <ConversationAvatar c={conv} size={36} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold">{conversationName(conv)}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {peer ? peer.username : t("dm.members", { count: thread.members.length + 1 })}
        </span>
      </span>
    </>
  );
  return peer ? (
    <Link
      to="/u/$username"
      params={{ username: peer.username }}
      className="flex min-w-0 items-center gap-2.5"
    >
      {inner}
    </Link>
  ) : (
    <div className="flex min-w-0 items-center gap-2.5">{inner}</div>
  );
}

/** Top of a 1:1 thread: who you're talking to (IG shows this above the first message). */
function IntroCard({ thread }: { thread: Thread }) {
  const { t } = useTranslation();
  const p = thread.members[0];
  return (
    <div className="mb-6 mt-2 flex flex-col items-center gap-1 text-center">
      <UserAvatar name={p.full_name ?? p.username} photoUrl={p.photo_url} size={80} />
      <p className="mt-2 font-display text-base font-bold">{p.full_name ?? p.username}</p>
      <p className="text-xs text-muted-foreground">{p.username}</p>
      <Link
        to="/u/$username"
        params={{ username: p.username }}
        className="mt-2 rounded-xl bg-secondary px-4 py-1.5 text-xs font-semibold"
      >
        {t("dm.viewProfile")}
      </Link>
    </div>
  );
}

function MessageRow({
  m,
  mine,
  showAvatar,
  sender,
  showName,
  tight,
}: {
  m: DmMessage;
  mine: boolean;
  showAvatar: boolean;
  sender: { username: string; full_name: string | null; photo_url: string | null } | undefined;
  showName: boolean;
  tight: boolean;
}) {
  const { t } = useTranslation();
  const bubble = cn(
    "whitespace-pre-wrap break-words rounded-3xl px-3.5 py-2 text-[15px] leading-snug",
    mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
  );

  return (
    <div
      className={cn(
        "flex items-end gap-2",
        mine ? "justify-end" : "justify-start",
        tight ? "mb-0.5" : "mb-2",
      )}
    >
      {!mine && (
        <span className="w-7 shrink-0">
          {showAvatar && sender && (
            <UserAvatar
              name={sender.full_name ?? sender.username}
              photoUrl={sender.photo_url}
              size={28}
            />
          )}
        </span>
      )}
      <div
        className={cn(
          "flex min-w-0 max-w-[78%] flex-col gap-1",
          mine ? "items-end" : "items-start",
        )}
      >
        {showName && sender && (
          <span className="px-3 text-[11px] text-muted-foreground">{sender.username}</span>
        )}
        {m.story !== undefined && (
          <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
            <span className="px-1 text-[11px] text-muted-foreground">{t("dm.storyReply")}</span>
            {m.story ? (
              <img
                src={m.story.url}
                alt=""
                className="h-40 w-24 rounded-2xl object-cover opacity-90"
              />
            ) : (
              <span className="rounded-2xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                {t("dm.storyGone")}
              </span>
            )}
          </div>
        )}
        {m.post !== undefined &&
          (m.post ? (
            <Link
              to="/p/$postId"
              params={{ postId: m.post.id }}
              className="block w-56 overflow-hidden rounded-2xl bg-secondary"
            >
              {m.post.author && (
                <span className="flex items-center gap-2 px-3 py-2">
                  <UserAvatar
                    name={m.post.author.full_name ?? m.post.author.username}
                    photoUrl={m.post.author.photo_url}
                    size={24}
                  />
                  <span className="truncate text-xs font-semibold">{m.post.author.username}</span>
                </span>
              )}
              {m.post.thumb ? (
                <img src={m.post.thumb} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <span className="grid aspect-square w-full place-items-center bg-gradient-to-br from-primary to-coral" />
              )}
              {m.post.caption && (
                <span className="block px-3 py-2 text-xs">
                  <span className="line-clamp-2">{m.post.caption}</span>
                </span>
              )}
            </Link>
          ) : (
            <span className="rounded-2xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              {t("dm.postGone")}
            </span>
          ))}
        {m.body.trim() && (
          <p className={bubble}>
            <RichText text={m.body} />
          </p>
        )}
      </div>
    </div>
  );
}

function RequestBar({ thread }: { thread: Thread }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const acceptFn = useServerFn(acceptRequest);
  const deleteFn = useServerFn(deleteConversation);
  const blockFn = useServerFn(blockUser);
  const peer = thread.type === "direct" ? thread.members[0] : undefined;

  async function run(action: "accept" | "delete" | "block") {
    try {
      if (action === "accept") await acceptFn({ data: { conversationId: thread.id } });
      else {
        if (action === "block" && peer) await blockFn({ data: { userId: peer.user_id } });
        await deleteFn({ data: { conversationId: thread.id } });
      }
      void qc.invalidateQueries({ queryKey: ["inbox"] });
      void qc.invalidateQueries({ queryKey: ["thread", thread.id] });
      if (action !== "accept") navigate({ to: "/inbox", search: { tab: "requests" } });
    } catch (e) {
      toast.error(t(dmErrorKey(e)));
    }
  }

  return (
    <div className="safe-bottom space-y-3 border-t border-border/60 px-4 py-3 text-center">
      <p className="text-xs text-muted-foreground">
        {t("dm.requestBanner", { name: peer?.username ?? thread.title ?? "" })}
      </p>
      <div className="flex gap-2">
        {peer && (
          <button
            type="button"
            onClick={() => run("block")}
            className="h-10 flex-1 rounded-xl text-sm font-semibold text-destructive"
          >
            {t("dm.block")}
          </button>
        )}
        <button
          type="button"
          onClick={() => run("delete")}
          className="h-10 flex-1 rounded-xl bg-secondary text-sm font-semibold"
        >
          {t("dm.delete")}
        </button>
        <button
          type="button"
          onClick={() => run("accept")}
          className="h-10 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
        >
          {t("dm.accept")}
        </button>
      </div>
    </div>
  );
}

function ThreadMenu({
  thread,
  open,
  onOpenChange,
}: {
  thread: Thread;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const deleteFn = useServerFn(deleteConversation);
  const reportFn = useServerFn(reportConversation);
  const blockFn = useServerFn(blockUser);
  const [confirm, setConfirm] = useState<"block" | "delete" | null>(null);
  const peer = thread.type === "direct" ? thread.members[0] : undefined;
  const row = "flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium";

  async function leave(block: boolean) {
    try {
      if (block && peer) await blockFn({ data: { userId: peer.user_id } });
      await deleteFn({ data: { conversationId: thread.id } });
      void qc.invalidateQueries({ queryKey: ["inbox"] });
      onOpenChange(false);
      navigate({ to: "/inbox" });
    } catch (e) {
      toast.error(t(dmErrorKey(e)));
    }
  }

  async function report() {
    await reportFn({ data: { conversationId: thread.id } }).catch(() => {});
    toast.success(t("dm.reported"));
    onOpenChange(false);
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setConfirm(null);
      }}
    >
      <DrawerContent className="mx-auto max-h-[85vh] max-w-lg rounded-t-[28px] border-0 bg-background">
        <DrawerTitle className="sr-only">{t("posts.more")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("posts.more")}</DrawerDescription>
        <div className="safe-bottom space-y-3 overflow-y-auto p-4">
          {thread.type === "group" && (
            <ul className="rounded-2xl bg-card px-4 py-2 shadow-sm ring-1 ring-border/60">
              {thread.members.map((m) => (
                <li key={m.user_id}>
                  <Link
                    to="/u/$username"
                    params={{ username: m.username }}
                    className="flex items-center gap-3 py-2"
                  >
                    <UserAvatar name={m.full_name ?? m.username} photoUrl={m.photo_url} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{m.username}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.full_name}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {confirm ? (
            <div className="space-y-3 rounded-2xl bg-card p-4 text-center shadow-sm ring-1 ring-border/60">
              <p className="text-sm">
                {confirm === "block"
                  ? t("dm.confirmBlock", { name: peer?.username ?? "" })
                  : t("dm.confirmDelete")}
              </p>
              <button
                type="button"
                onClick={() => leave(confirm === "block")}
                className="h-11 w-full rounded-xl bg-destructive text-sm font-semibold text-destructive-foreground"
              >
                {confirm === "block" ? t("dm.block") : t("dm.delete")}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/60">
              {peer && (
                <Link
                  to="/u/$username"
                  params={{ username: peer.username }}
                  onClick={() => onOpenChange(false)}
                  className={row}
                >
                  <UserRound className="h-4 w-4" /> {t("dm.viewProfile")}
                </Link>
              )}
              <button type="button" onClick={report} className={cn(row, "text-destructive")}>
                <Flag className="h-4 w-4" /> {t("dm.report")}
              </button>
              {peer && (
                <button
                  type="button"
                  onClick={() => setConfirm("block")}
                  className={cn(row, "text-destructive")}
                >
                  <Ban className="h-4 w-4" /> {t("dm.block")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirm("delete")}
                className={cn(row, "text-destructive")}
              >
                {thread.type === "group" ? (
                  <>
                    <LogOut className="h-4 w-4" /> {t("dm.leaveGroup")}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" /> {t("dm.deleteChat")}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
