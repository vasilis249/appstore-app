import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  queryOptions,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowLeft,
  Inbox,
  Loader2,
  LogOut,
  MessageSquarePlus,
  Plus,
  Send,
  ShieldAlert,
  Users,
  UserPlus,
  UserMinus,
  X,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  listConversations,
  listMessages,
  sendMessage,
  markRead,
  getConversation,
  getOrCreateDirectConversation,
  createGroupConversation,
  leaveConversation,
  listFriends,
  reportMessage,
  reportConversation,
  blockUser,
  addGroupMember,
  removeGroupMember,
  searchGroupAddableUsers,
  type ConversationListItem,
  type MessageRow,
  type ConversationDetail,
  type FriendRow,
  type GroupAddableUser,
} from "@/lib/api/community.functions";

const searchSchema = z.object({ c: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/community_/messages")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Μηνύματα — Courtsie" }] }),
  component: MessagesPage,
});

function initials(name: string | null | undefined) {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
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

const conversationsQ = () =>
  queryOptions({
    queryKey: ["messages", "conversations"],
    queryFn: () => listConversations(),
  });

function MessagesPage() {
  const { c } = Route.useSearch();
  const router = useRouter();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useAuth();

  const list = useQuery({ ...conversationsQ(), enabled: !!user });

  // global realtime: any new message → refresh list (and active thread if matches)
  useEffect(() => {
    const channel = supabase
      .channel("messages-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: any) => {
          qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
          const convId = payload?.new?.conversation_id;
          if (convId) {
            qc.invalidateQueries({ queryKey: ["messages", "thread", convId] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const selectConv = (id: string | null) => {
    router.navigate({
      to: "/community/messages",
      search: id ? { c: id } : {},
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/community" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">{t("community.messages.title")}</h1>
      </div>

      <p className="mb-4 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        {t("community.messages.privacyNotice")}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
        <aside className={c ? "hidden md:block" : "block"}>
          <ConversationsPane
            items={list.data ?? []}
            isLoading={list.isLoading}
            selectedId={c ?? null}
            onSelect={selectConv}
          />
        </aside>
        <section className={c ? "block" : "hidden md:block"}>
          {c ? (
            <ThreadPane
              key={c}
              conversationId={c}
              onBack={() => selectConv(null)}
            />
          ) : (
            <div className="flex h-[60vh] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              {t("community.messages.selectConversation")}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------- conversations list ------------------- */

function ConversationsPane({
  items,
  isLoading,
  selectedId,
  onSelect,
}: {
  items: ConversationListItem[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <span className="text-sm font-medium">{t("community.messages.title")}</span>
        <div className="flex gap-1.5">
          <NewChatDialog onCreated={onSelect} />
          <NewGroupDialog onCreated={onSelect} />
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          {t("community.messages.noConversations")}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => {
            const isActive = it.id === selectedId;
            const name =
              it.type === "group"
                ? it.title ?? t("community.messages.group")
                : it.other_full_name ?? "—";
            const preview = it.last_message_deleted
              ? t("community.messages.lastMessageDeleted")
              : it.last_message_body ?? "";
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onSelect(it.id)}
                  className={
                    "flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50 " +
                    (isActive ? "bg-muted/50" : "")
                  }
                >
                  <Avatar className="h-10 w-10">
                    {it.type === "direct" && it.other_photo_url ? (
                      <AvatarImage src={it.other_photo_url} alt={name} />
                    ) : null}
                    <AvatarFallback>
                      {it.type === "group" ? <Users className="h-4 w-4" /> : initials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatTime(it.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">{preview}</span>
                      {it.unread_count > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                          {it.unread_count}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------- New chat dialog ------------------- */

function NewChatDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const friends = useQuery({
    queryKey: ["community", "friends"],
    queryFn: () => listFriends(),
    enabled: open,
  });
  const startFn = useServerFn(getOrCreateDirectConversation);
  const start = useMutation({
    mutationFn: (otherUserId: string) => startFn({ data: { otherUserId } }),
    onSuccess: (res) => {
      setOpen(false);
      onCreated(res.id);
    },
    onError: (e) => toast.error(t(`community.messages.errors.${errorKey(e)}`)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <MessageSquarePlus className="h-4 w-4" />
          <span className="sr-only md:not-sr-only">
            {t("community.messages.newChat")}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("community.messages.pickFriend")}</DialogTitle>
        </DialogHeader>
        {friends.isLoading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (friends.data ?? []).length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">
            {t("community.messages.noFriendsHint")}
          </p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {(friends.data as FriendRow[]).map((f) => (
              <li key={f.user_id}>
                <button
                  type="button"
                  onClick={() => start.mutate(f.user_id)}
                  disabled={start.isPending}
                  className="flex w-full items-center gap-3 p-2 text-left hover:bg-muted/60"
                >
                  <Avatar className="h-8 w-8">
                    {f.photo_url ? <AvatarImage src={f.photo_url} alt={f.full_name ?? ""} /> : null}
                    <AvatarFallback>{initials(f.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{f.full_name ?? "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------- New group dialog ------------------- */

function NewGroupDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const friends = useQuery({
    queryKey: ["community", "friends"],
    queryFn: () => listFriends(),
    enabled: open,
  });
  const createFn = useServerFn(createGroupConversation);
  const create = useMutation({
    mutationFn: () =>
      createFn({ data: { title: title.trim(), memberIds: Array.from(selected) } }),
    onSuccess: (res) => {
      setOpen(false);
      setTitle("");
      setSelected(new Set());
      onCreated(res.id);
    },
    onError: (e) => toast.error(t(`community.messages.errors.${errorKey(e)}`)),
  });
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="sr-only md:not-sr-only">
            {t("community.messages.newGroup")}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("community.messages.newGroup")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {t("community.messages.groupTitle")}
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("community.messages.groupTitlePlaceholder")}
              maxLength={80}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {t("community.messages.pickFriends")}
            </label>
            {friends.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (friends.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("community.messages.noFriendsHint")}
              </p>
            ) : (
              <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded border border-border">
                {(friends.data as FriendRow[]).map((f) => {
                  const checked = selected.has(f.user_id);
                  return (
                    <li key={f.user_id}>
                      <label className="flex cursor-pointer items-center gap-3 p-2 hover:bg-muted/60">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(f.user_id)}
                        />
                        <Avatar className="h-7 w-7">
                          {f.photo_url ? (
                            <AvatarImage src={f.photo_url} alt={f.full_name ?? ""} />
                          ) : null}
                          <AvatarFallback>{initials(f.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{f.full_name ?? "—"}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("community.messages.cancel")}
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || selected.size === 0 || title.trim().length === 0}
          >
            {create.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {t("community.messages.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------- Thread ------------------- */

function ThreadPane({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const detail = useQuery({
    queryKey: ["messages", "detail", conversationId],
    queryFn: () => getConversation({ data: { conversationId } }),
  });
  const thread = useQuery({
    queryKey: ["messages", "thread", conversationId],
    queryFn: () => listMessages({ data: { conversationId } }),
  });

  const sendFn = useServerFn(sendMessage);
  const markFn = useServerFn(markRead);
  const leaveFn = useServerFn(leaveConversation);
  const reportConvFn = useServerFn(reportConversation);
  const blockFn = useServerFn(blockUser);

  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // mark read on open and on new messages
  useEffect(() => {
    markFn({ data: { conversationId } }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
  }, [conversationId, markFn, qc]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.data]);

  const send = useMutation({
    mutationFn: () => sendFn({ data: { conversationId, body: body.trim() } }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["messages", "thread", conversationId] });
      qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
    },
    onError: (e) => toast.error(t(`community.messages.errors.${errorKey(e)}`)),
  });

  const doLeave = useMutation({
    mutationFn: () => leaveFn({ data: { conversationId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
      onBack();
    },
    onError: () => toast.error(t("community.messages.errors.generic")),
  });

  const reportConv = useMutation({
    mutationFn: (reason: string) =>
      reportConvFn({ data: { conversationId, reason: reason || undefined } }),
    onSuccess: () => toast.success(t("community.messages.reportSent")),
    onError: () => toast.error(t("community.messages.errors.generic")),
  });

  const headerName = useMemo(() => {
    if (!detail.data) return "";
    if (detail.data.type === "group") return detail.data.title ?? t("community.messages.group");
    const other = detail.data.members.find((m) => m.user_id !== userId);
    return other?.full_name ?? "—";
  }, [detail.data, userId, t]);

  const otherUserId =
    detail.data?.type === "direct"
      ? detail.data.members.find((m) => m.user_id !== userId)?.user_id ?? null
      : null;

  return (
    <div className="flex h-[70vh] flex-col rounded-xl border border-border bg-card">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-border p-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{headerName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {detail.data?.type === "group"
              ? `${detail.data.members.length} ${t("community.messages.members").toLowerCase()}`
              : null}
          </div>
        </div>
        {detail.data?.type === "group" ? (
          <MembersDialog
            conversationId={conversationId}
            detail={detail.data}
            currentUserId={userId}
          />
        ) : null}
        <ReportDialog
          title={t("community.messages.reportConversation")}
          onSubmit={(r) => reportConv.mutate(r)}
        />
        {otherUserId ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={() => {
              if (window.confirm(t("community.leaveConfirm"))) {
                blockFn({ data: { userId: otherUserId } })
                  .then(() => {
                    toast.success(t("community.toasts.blocked"));
                    onBack();
                  })
                  .catch(() => toast.error(t("community.errors.generic")));
              }
            }}
          >
            <ShieldAlert className="h-4 w-4" />
            {t("community.messages.block")}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={() => {
            if (window.confirm(t("community.messages.leaveConfirm"))) doLeave.mutate();
          }}
          disabled={doLeave.isPending}
        >
          <LogOut className="h-4 w-4" />
          {t("community.messages.leave")}
        </Button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {thread.isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (thread.data ?? []).length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            {t("community.messages.noMessages")}
          </p>
        ) : (
          <ul className="space-y-1">
            {(thread.data as MessageRow[]).map((m, idx, arr) => {
              const mine = m.sender_id === userId;
              const member = detail.data?.members.find((x) => x.user_id === m.sender_id);
              const senderName = member?.full_name ?? t("community.messages.deletedUser");
              const prev = idx > 0 ? arr[idx - 1] : null;
              const sameSenderAsPrev =
                prev != null &&
                prev.sender_id === m.sender_id &&
                new Date(m.created_at).getTime() -
                  new Date(prev.created_at).getTime() <
                  5 * 60 * 1000;
              const showHeader = !sameSenderAsPrev;
              return (
                <li
                  key={m.id}
                  className={
                    (mine ? "flex justify-end" : "flex justify-start") +
                    (showHeader ? " mt-3" : "")
                  }
                >
                  {!mine ? (
                    <div className="mr-2 w-8 shrink-0">
                      {showHeader ? (
                        <Avatar className="h-8 w-8">
                          {member?.photo_url ? (
                            <AvatarImage src={member.photo_url} alt={senderName} />
                          ) : null}
                          <AvatarFallback className="text-[10px]">
                            {member ? initials(senderName) : "?"}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                    </div>
                  ) : null}
                  <div
                    className={
                      "max-w-[75%] rounded-2xl px-3 py-2 text-sm " +
                      (mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground")
                    }
                  >
                    {showHeader ? (
                      <div
                        className={
                          "mb-0.5 flex items-baseline gap-2 text-xs " +
                          (mine
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground")
                        }
                      >
                        <span className="font-medium">
                          {mine ? t("community.messages.you") : senderName}
                        </span>
                        <span className="text-[10px] opacity-80">
                          {formatRelative(m.created_at, t)}
                        </span>
                      </div>
                    ) : null}
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    {!mine ? (
                      <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
                        <ReportMessageInline messageId={m.id} />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* composer */}
      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim().length === 0 || send.isPending) return;
          send.mutate();
        }}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("community.messages.composerPlaceholder")}
          rows={1}
          maxLength={2000}
          className="min-h-10 flex-1 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (body.trim().length > 0 && !send.isPending) send.mutate();
            }
          }}
        />
        <Button type="submit" disabled={send.isPending || body.trim().length === 0}>
          {send.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="sr-only">{t("community.messages.send")}</span>
        </Button>
      </form>
    </div>
  );
}

function ReportMessageInline({ messageId }: { messageId: string }) {
  const { t } = useTranslation();
  const reportFn = useServerFn(reportMessage);
  const report = useMutation({
    mutationFn: (reason: string) =>
      reportFn({ data: { messageId, reason: reason || undefined } }),
    onSuccess: () => toast.success(t("community.messages.reportSent")),
    onError: () => toast.error(t("community.messages.errors.generic")),
  });
  return (
    <ReportDialog
      title={t("community.messages.reportMessage")}
      trigger={
        <button type="button" className="underline-offset-2 hover:underline">
          {t("community.messages.report")}
        </button>
      }
      onSubmit={(r) => report.mutate(r)}
    />
  );
}

function ReportDialog({
  title,
  trigger,
  onSubmit,
}: {
  title: string;
  trigger?: React.ReactNode;
  onSubmit: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <ShieldAlert className="h-4 w-4" />
            {t("community.messages.report")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("community.messages.reportReasonPlaceholder")}
          maxLength={500}
          rows={4}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("community.messages.cancel")}
          </Button>
          <Button
            onClick={() => {
              onSubmit(reason);
              setReason("");
              setOpen(false);
            }}
          >
            {t("community.messages.reportSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    mutationFn: (uid: string) =>
      removeFn({ data: { conversationId, userId: uid } }),
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
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          aria-label={t("community.messages.manageMembers")}
        >
          <Users className="h-4 w-4" />
          <span className="sr-only md:not-sr-only">
            {t("community.messages.membersTitle")}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("community.messages.membersTitle")}</DialogTitle>
        </DialogHeader>
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded border border-border">
          {detail.members.map((m) => {
            const isSelf = m.user_id === currentUserId;
            const name =
              m.full_name ?? t("community.messages.deletedUser");
            const canRemove = isAdmin && !isSelf;
            return (
              <li
                key={m.user_id}
                className="flex items-center gap-3 p-2"
              >
                <Avatar className="h-8 w-8">
                  {m.photo_url ? (
                    <AvatarImage src={m.photo_url} alt={name} />
                  ) : null}
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
        {isAdmin ? (
          <AddMemberForm conversationId={conversationId} />
        ) : null}
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

