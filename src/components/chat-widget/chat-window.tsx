import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ChevronDown,
  Loader2,
  Minus,
  Send,
  Users,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  addGroupMember,
  getConversation,
  listConversations,
  listMessages,
  markRead,
  removeGroupMember,
  searchGroupAddableUsers,
  sendMessage,
  type ConversationDetail,
  type ConversationListItem,
  type GroupAddableUser,
  type MessageRow,
} from "@/lib/api/community.functions";

import { useChatWidget } from "./context";

function initials(name: string | null | undefined) {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(iso: string, t: (k: string, o?: any) => string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return t("community.messages.time.justNow");
  const min = Math.floor(diffSec / 60);
  if (min < 60) return t("community.messages.time.minute", { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("community.messages.time.hour", { count: hr });
  const day = Math.floor(hr / 24);
  if (day < 7) return t("community.messages.time.day", { count: day });
  return new Date(iso).toLocaleDateString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function errorKey(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (
    [
      "not_friends",
      "blocked",
      "forbidden",
      "not_found",
      "group_full",
      "invalid_target",
    ].includes(msg)
  )
    return msg;
  return "generic";
}

export function ChatWindow({
  conversationId,
  userId,
  offsetIndex,
  isMobile,
}: {
  conversationId: string;
  userId: string;
  offsetIndex: number;
  isMobile: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { closeConversation, minimizeConversation, minimized } = useChatWidget();
  const isMinimized = !!minimized[conversationId];

  const getConvFn = useServerFn(getConversation);
  const listMsgsFn = useServerFn(listMessages);
  const sendFn = useServerFn(sendMessage);
  const markFn = useServerFn(markRead);

  const convQ = useQuery({
    queryKey: ["messages", "detail", conversationId],
    queryFn: () => getConvFn({ data: { conversationId } }),
  });

  const msgsQ = useQuery({
    queryKey: ["messages", "thread", conversationId],
    queryFn: () => listMsgsFn({ data: { conversationId, limit: 50 } }),
  });

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMut = useMutation({
    mutationFn: (body: string) => sendFn({ data: { conversationId, body } }),
    onSuccess: (msg) => {
      qc.setQueryData<MessageRow[]>(["messages", "thread", conversationId], (prev) =>
        prev ? [...prev, msg] : [msg],
      );
      qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
      setDraft("");
    },
    onError: (e: any) => {
      const key = String(e?.message ?? "generic");
      toast.error(t(`community.messages.errors.${key}`, { defaultValue: t("community.messages.errors.generic") }));
    },
  });

  // Mark read whenever the window is open (not minimized) and has messages.
  useEffect(() => {
    if (isMinimized) return;
    markFn({ data: { conversationId } })
      .then(() => qc.invalidateQueries({ queryKey: ["messages", "conversations"] }))
      .catch(() => {});
  }, [conversationId, isMinimized, msgsQ.data?.length, markFn, qc]);

  // Realtime: append incoming messages live.
  useEffect(() => {
    const channel = supabase
      .channel(`chatwin-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          if (!row || row.sender_id === userId) return;
          qc.setQueryData<MessageRow[]>(["messages", "thread", conversationId], (prev) => {
            if (!prev) return [row];
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
          qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId, qc]);

  // Autoscroll to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && !isMinimized) el.scrollTop = el.scrollHeight;
  }, [msgsQ.data, isMinimized]);

  const conv = convQ.data as ConversationDetail | undefined;
  const header = useMemo(() => {
    if (!conv) return { title: "…", photo: null as string | null };
    if (conv.type === "group") {
      return { title: conv.title ?? t("community.messages.group"), photo: null as string | null };
    }
    const other = conv.members.find((m) => m.user_id !== userId);
    return { title: other?.full_name ?? "·", photo: other?.photo_url ?? null };
  }, [conv, userId, t]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sendMut.isPending) return;
    sendMut.mutate(body);
  }

  const membersSlot =
    conv?.type === "group" ? (
      <MembersDialog conversationId={conversationId} detail={conv} currentUserId={userId} />
    ) : null;

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <WindowHeader
          title={header.title}
          photo={header.photo}
          onClose={() => closeConversation(conversationId)}
          extra={membersSlot}
          mobile
        />
        <MessageList
          scrollRef={scrollRef}
          messages={msgsQ.data ?? []}
          loading={msgsQ.isLoading}
          userId={userId}
          conv={conv}
          t={t}
        />
        <Composer
          draft={draft}
          setDraft={setDraft}
          onSubmit={onSubmit}
          pending={sendMut.isPending}
          t={t}
        />
      </div>
    );
  }

  // Desktop: stack right-to-left from offsetIndex
  const right = 96 + offsetIndex * 336;
  const width = 320;

  return (
    <div
      className="fixed z-40 flex flex-col overflow-hidden rounded-t-lg border border-border bg-card shadow-2xl"
      style={{
        right,
        bottom: 0,
        width,
        height: isMinimized ? "auto" : "min(460px, 70vh)",
      }}
    >
      <WindowHeader
        title={header.title}
        photo={header.photo}
        onClose={() => closeConversation(conversationId)}
        onMinimize={() => minimizeConversation(conversationId)}
        minimized={isMinimized}
        extra={!isMinimized ? membersSlot : null}
      />
      {!isMinimized && (
        <>
          <MessageList
            scrollRef={scrollRef}
            messages={msgsQ.data ?? []}
            loading={msgsQ.isLoading}
            userId={userId}
            conv={conv}
            t={t}
          />
          <Composer
            draft={draft}
            setDraft={setDraft}
            onSubmit={onSubmit}
            pending={sendMut.isPending}
            t={t}
          />
        </>
      )}
    </div>
  );
}

function WindowHeader({
  title,
  photo,
  onClose,
  onMinimize,
  minimized,
  mobile,
  extra,
}: {
  title: string;
  photo: string | null;
  onClose: () => void;
  onMinimize?: () => void;
  minimized?: boolean;
  mobile?: boolean;
  extra?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-2 border-b border-border bg-primary px-3 py-2 text-primary-foreground"
      onClick={() => {
        if (onMinimize && minimized) onMinimize();
      }}
      role={onMinimize && minimized ? "button" : undefined}
    >
      <Avatar className="h-7 w-7">
        {photo ? <AvatarImage src={photo} alt="" /> : null}
        <AvatarFallback className="text-[10px]">{initials(title)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 truncate text-sm font-medium">{title}</div>
      {extra ? <div onClick={(e) => e.stopPropagation()}>{extra}</div> : null}
      {!mobile && onMinimize && (
        <button
          type="button"
          aria-label={t("community.messages.minimize", { defaultValue: "Minimize" })}
          onClick={(e) => {
            e.stopPropagation();
            onMinimize();
          }}
          className="rounded p-1 hover:bg-white/15"
        >
          {minimized ? <ChevronDown className="h-4 w-4 rotate-180" /> : <Minus className="h-4 w-4" />}
        </button>
      )}
      <button
        type="button"
        aria-label={t("community.messages.close", { defaultValue: "Close" })}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="rounded p-1 hover:bg-white/15"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function MessageList({
  scrollRef,
  messages,
  loading,
  userId,
  conv,
  t,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  messages: MessageRow[];
  loading: boolean;
  userId: string;
  conv: ConversationDetail | undefined;
  t: (k: string, o?: any) => string;
}) {
  const isGroup = conv?.type === "group";
  return (
    <div
      ref={scrollRef}
      className="flex-1 space-y-1 overflow-y-auto bg-muted/30 px-3 py-3 text-sm"
    >
      {loading ? (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
          {t("community.messages.noMessages")}
        </div>
      ) : (
        messages.map((m, idx, arr) => {
          const mine = m.sender_id === userId;
          const member = conv?.members.find((x) => x.user_id === m.sender_id);
          const senderName = member?.full_name ?? t("community.messages.deletedUser");
          const prev = idx > 0 ? arr[idx - 1] : null;
          const sameSenderAsPrev =
            prev != null &&
            prev.sender_id === m.sender_id &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
          const showHeader = !sameSenderAsPrev;
          return (
            <div
              key={m.id}
              className={
                (mine ? "flex justify-end" : "flex justify-start") + (showHeader ? " mt-2" : "")
              }
            >
              {!mine && isGroup ? (
                <div className="mr-1.5 w-6 shrink-0">
                  {showHeader ? (
                    <Avatar className="h-6 w-6">
                      {member?.photo_url ? (
                        <AvatarImage src={member.photo_url} alt={senderName} />
                      ) : null}
                      <AvatarFallback className="text-[9px]">
                        {member ? initials(senderName) : "?"}
                      </AvatarFallback>
                    </Avatar>
                  ) : null}
                </div>
              ) : null}
              <div
                className={
                  "max-w-[80%] rounded-2xl px-3 py-1.5 leading-snug " +
                  (mine
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground border border-border")
                }
              >
                {showHeader && !mine && isGroup ? (
                  <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">
                    {senderName}
                  </div>
                ) : null}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div
                  className={
                    "mt-0.5 text-[10px] " +
                    (mine ? "text-primary-foreground/70" : "text-muted-foreground")
                  }
                >
                  {isGroup ? formatRelative(m.created_at, t) : formatTime(m.created_at)}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function Composer({
  draft,
  setDraft,
  onSubmit,
  pending,
  t,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  pending: boolean;
  t: (k: string, o?: any) => string;
}) {
  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-border bg-background p-2">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t("community.messages.composerPlaceholder")}
        rows={1}
        className="min-h-[36px] resize-none text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e as any);
          }
        }}
      />
      <Button type="submit" size="icon" disabled={pending || !draft.trim()} aria-label={t("community.messages.send")}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </form>
  );
}

/* ------------------- Members dialog ------------------- */

function MembersDialog({
  conversationId,
  detail,
  currentUserId,
}: {
  conversationId: string;
  detail: ConversationDetail;
  currentUserId: string | null;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const isAdmin = detail.my_role === "admin";
  const removeFn = useServerFn(removeGroupMember);
  const remove = useMutation({
    mutationFn: (uid: string) => removeFn({ data: { conversationId, userId: uid } }),
    onSuccess: () => {
      toast.success(t("community.messages.memberRemoved"));
      qc.invalidateQueries({ queryKey: ["messages", "detail", conversationId] });
      qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
    },
    onError: (e) => toast.error(t(`community.messages.errors.${errorKey(e)}`)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t("community.messages.manageMembers")}
          className="rounded p-1 hover:bg-white/15"
        >
          <Users className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("community.messages.membersTitle")}</DialogTitle>
        </DialogHeader>
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded border border-border">
          {detail.members.map((m) => {
            const isSelf = m.user_id === currentUserId;
            const name = m.full_name ?? t("community.messages.deletedUser");
            const canRemove = isAdmin && !isSelf;
            return (
              <li key={m.user_id} className="flex items-center gap-3 p-2">
                <Avatar className="h-8 w-8">
                  {m.photo_url ? <AvatarImage src={m.photo_url} alt={name} /> : null}
                  <AvatarFallback className="text-[10px]">
                    {m.full_name ? initials(name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{name}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.role === "admin"
                      ? t("community.messages.adminBadge")
                      : t("community.messages.memberBadge")}
                  </div>
                </div>
                {canRemove ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-destructive"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(t("community.messages.removeConfirm", { name }))) {
                        remove.mutate(m.user_id);
                      }
                    }}
                  >
                    <UserMinus className="h-4 w-4" />
                    <span className="sr-only md:not-sr-only">
                      {t("community.messages.removeMember")}
                    </span>
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {isAdmin ? <AddMemberForm conversationId={conversationId} /> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("community.messages.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMemberForm({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const searchFn = useServerFn(searchGroupAddableUsers);
  const search = useQuery({
    queryKey: ["messages", "addable", conversationId, q],
    queryFn: () => searchFn({ data: { conversationId, q } }),
    enabled: q.trim().length >= 2,
    staleTime: 15_000,
  });
  const addFn = useServerFn(addGroupMember);
  const add = useMutation({
    mutationFn: (uid: string) => addFn({ data: { conversationId, userId: uid } }),
    onSuccess: () => {
      toast.success(t("community.messages.memberAdded"));
      setQ("");
      qc.invalidateQueries({ queryKey: ["messages", "detail", conversationId] });
      qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
      qc.invalidateQueries({ queryKey: ["messages", "addable", conversationId] });
    },
    onError: (e) => toast.error(t(`community.messages.errors.${errorKey(e)}`)),
  });
  const results = (search.data ?? []) as GroupAddableUser[];
  return (
    <div className="mt-3 border-t border-border pt-3">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        <UserPlus className="mr-1 inline h-3.5 w-3.5" />
        {t("community.messages.addMember")}
      </label>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("community.messages.searchUsersPlaceholder")}
        maxLength={80}
      />
      <div className="mt-2 max-h-48 overflow-y-auto">
        {q.trim().length < 2 ? (
          <p className="p-2 text-xs text-muted-foreground">
            {t("community.messages.searchHint")}
          </p>
        ) : search.isLoading ? (
          <div className="flex justify-center p-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">
            {t("community.messages.noSearchResults")}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded border border-border">
            {results.map((r) => (
              <li key={r.user_id}>
                <button
                  type="button"
                  onClick={() => add.mutate(r.user_id)}
                  disabled={add.isPending}
                  className="flex w-full items-center gap-2 p-2 text-left hover:bg-muted/60"
                >
                  <Avatar className="h-7 w-7">
                    {r.photo_url ? (
                      <AvatarImage src={r.photo_url} alt={r.full_name ?? ""} />
                    ) : null}
                    <AvatarFallback className="text-[10px]">
                      {initials(r.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-sm">{r.full_name ?? "—"}</span>
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {t("community.messages.add")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ChatWindowsLayer({
  userId,
  isMobile,
}: {
  userId: string;
  isMobile: boolean;
}) {
  const { openIds } = useChatWidget();
  if (openIds.length === 0) return null;
  if (isMobile) {
    const front = openIds[0];
    return <ChatWindow key={front} conversationId={front} userId={userId} offsetIndex={0} isMobile />;
  }
  return (
    <>
      {openIds.map((id, idx) => (
        <ChatWindow key={id} conversationId={id} userId={userId} offsetIndex={idx} isMobile={false} />
      ))}
    </>
  );
}

// Conversations panel
export function ConversationsPanel({
  conversations,
  loading,
  isMobile,
}: {
  conversations: ConversationListItem[];
  loading: boolean;
  isMobile: boolean;
}) {
  const { t } = useTranslation();
  const { openConversation, closePanel } = useChatWidget();
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      (c.title ?? c.other_full_name ?? "").toLowerCase().includes(q),
    );
  }, [filter, conversations]);

  const containerClass = isMobile
    ? "fixed inset-0 z-50 flex flex-col bg-background"
    : "fixed bottom-24 right-4 z-40 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl md:bottom-24 md:right-24";

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-2 border-b border-border bg-primary px-3 py-2 text-primary-foreground">
        <div className="flex-1 text-sm font-semibold">{t("community.messages.title")}</div>
        <button
          type="button"
          aria-label={t("community.messages.close", { defaultValue: "Close" })}
          onClick={closePanel}
          className="rounded p-1 hover:bg-white/15"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="border-b border-border p-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("community.messages.filterPlaceholder", { defaultValue: "Search conversations…" })}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {t("community.messages.noConversations")}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => {
              const title = c.type === "group" ? c.title ?? t("community.messages.group") : c.other_full_name ?? "·";
              const preview = c.last_message_deleted
                ? t("community.messages.lastMessageDeleted")
                : c.last_message_body ?? "";
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
                  >
                    <Avatar className="h-9 w-9">
                      {c.other_photo_url ? <AvatarImage src={c.other_photo_url} alt="" /> : null}
                      <AvatarFallback className="text-xs">{initials(title)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1 truncate text-sm font-medium">{title}</div>
                        {c.last_message_at && (
                          <div className="shrink-0 text-[10px] text-muted-foreground">
                            {formatTime(c.last_message_at)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {preview}
                        </div>
                        {c.unread_count > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                            {c.unread_count > 9 ? "9+" : c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
