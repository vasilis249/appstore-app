import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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
  UserPlus,
  Check,
  X,
  Ban,
  Loader2,
  Search,
  UsersRound,
  Inbox,
  Send,
  ShieldAlert,
  Trash2,
  Star,
} from "lucide-react";

import { useRedirectOwnersAway } from "@/hooks/use-redirect-owners-away";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  getCommunityStatus,
  setDiscoverable,
  searchPlayers,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
  listBlockedUsers,
  suggestedPlayers,
  type PlayerSearchRow,
  type FriendshipStatus,
} from "@/lib/api/community.functions";

export const Route = createFileRoute("/_authenticated/community")({
  head: () => ({
    meta: [
      { title: "Κοινότητα — Courtsie" },
      { name: "description", content: "Βρες παίκτες και διαχειρίσου τους φίλους σου." },
    ],
  }),
  component: CommunityPage,
});

const statusQuery = () =>
  queryOptions({ queryKey: ["community", "status"], queryFn: () => getCommunityStatus() });
const friendsQuery = () =>
  queryOptions({ queryKey: ["community", "friends"], queryFn: () => listFriends() });
const incomingQuery = () =>
  queryOptions({ queryKey: ["community", "incoming"], queryFn: () => listIncomingRequests() });
const outgoingQuery = () =>
  queryOptions({ queryKey: ["community", "outgoing"], queryFn: () => listOutgoingRequests() });
const blockedQuery = () =>
  queryOptions({ queryKey: ["community", "blocked"], queryFn: () => listBlockedUsers() });

type Tab = "search" | "friends" | "requests" | "blocked";

function initials(name: string | null | undefined) {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}

function errorKey(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (msg === "blocked" || msg === "request_exists" || msg === "already_friends") return msg;
  return "generic";
}

function CommunityPage() {
  useRedirectOwnersAway();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useAuth();

  const status = useQuery({ ...statusQuery(), enabled: !!user });
  const setDiscoverableFn = useServerFn(setDiscoverable);

  const join = useMutation({
    mutationFn: () => setDiscoverableFn({ data: { discoverable: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community"] });
      toast.success(t("community.toasts.joined"));
    },
    onError: () => toast.error(t("community.errors.generic")),
  });
  const leave = useMutation({
    mutationFn: () => setDiscoverableFn({ data: { discoverable: false } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community"] });
      toast.success(t("community.toasts.left"));
    },
    onError: () => toast.error(t("community.errors.generic")),
  });

  if (status.isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status.data?.discoverable) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold">{t("community.title")}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t("community.subtitle")}</p>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t("community.consentTitle")}</h2>
          </div>
          <p className="mb-5 text-sm text-muted-foreground">{t("community.consentBody")}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => join.mutate()} disabled={join.isPending}>
              {join.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("community.consentAccept")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <CommunityShell onLeave={() => leave.mutate()} leaving={leave.isPending} />;
}

function CommunityShell({ onLeave, leaving }: { onLeave: () => void; leaving: boolean }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("search");

  const incoming = useQuery({
    ...incomingQuery(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const incomingCount = incoming.data?.length ?? 0;

  const tabs: { id: Tab; label: string; icon: typeof Search; bold?: boolean }[] = [
    { id: "search", label: t("community.tabs.search"), icon: Search },
    { id: "friends", label: t("community.tabs.friends"), icon: UsersRound },
    {
      id: "requests",
      label:
        incomingCount > 0
          ? t("community.tabs.requestsWithCount", { count: incomingCount })
          : t("community.tabs.requests"),
      icon: Inbox,
      bold: incomingCount > 0,
    },
    { id: "blocked", label: t("community.tabs.blocked"), icon: ShieldAlert },
  ];


  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-24">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("community.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("community.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/community/messages">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Inbox className="h-4 w-4" />
              {t("community.messages.openMessages")}
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm(t("community.leaveConfirm"))) onLeave();
            }}
            disabled={leaving}
            className="text-muted-foreground"
          >
            {t("community.leave")}
          </Button>
        </div>
      </div>


      <div className="mb-6 flex flex-wrap gap-2 border-b border-border">
        {tabs.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={
                "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors " +
                (tb.bold ? "font-bold " : "font-medium ") +
                (active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              <Icon className="h-4 w-4" />
              {tb.label}
            </button>
          );
        })}
      </div>


      {tab === "search" && <SearchTab />}
      {tab === "friends" && <FriendsTab />}
      {tab === "requests" && <RequestsTab />}
      {tab === "blocked" && <BlockedTab />}
    </div>
  );
}

/* ---------- Search ---------- */

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function SearchTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const debounced = useDebounced(q, 300);
  const searchFn = useServerFn(searchPlayers);
  const suggestedFn = useServerFn(suggestedPlayers);
  const sendFn = useServerFn(sendFriendRequest);
  const blockFn = useServerFn(blockUser);

  const enabled = debounced.trim().length >= 2;
  const results = useQuery({
    queryKey: ["community", "search", debounced],
    queryFn: () => searchFn({ data: { q: debounced } }),
    enabled,
  });
  const suggestions = useQuery({
    queryKey: ["community", "suggested"],
    queryFn: () => suggestedFn(),
    enabled: !enabled,
  });


  const send = useMutation({
    mutationFn: (userId: string) => sendFn({ data: { userId } }),
    onSuccess: (res) => {
      const key =
        res?.status === "already_friends"
          ? "community.errors.already_friends"
          : res?.status === "request_exists"
            ? "community.errors.request_exists"
            : "community.toasts.requestSent";
      if (res?.status === "sent") toast.success(t(key));
      else toast.message(t(key));
      qc.invalidateQueries({ queryKey: ["community", "search"] });
      qc.invalidateQueries({ queryKey: ["community", "suggested"] });
      qc.invalidateQueries({ queryKey: ["community", "outgoing"] });
    },
    onError: (e) => toast.error(t(`community.errors.${errorKey(e)}`)),
  });

  const block = useMutation({
    mutationFn: (userId: string) => blockFn({ data: { userId } }),
    onSuccess: () => {
      toast.success(t("community.toasts.blocked"));
      qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: () => toast.error(t("community.errors.generic")),
  });

  return (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("community.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      {!enabled && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("community.suggestedHeading")}
          </h2>
          {suggestions.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : !suggestions.data || suggestions.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("community.noSuggestions")}</p>
          ) : (
            <ul className="space-y-2">
              {suggestions.data.map((p) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  onAdd={() => send.mutate(p.id)}
                  onBlock={() => block.mutate(p.id)}
                  sending={send.isPending && send.variables === p.id}
                />
              ))}
            </ul>
          )}
        </div>
      )}
      {enabled && results.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("community.searching")}
        </div>
      )}
      {enabled && results.data && results.data.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("community.noResults")}</p>
      )}

      {enabled && (
        <ul className="space-y-2">
          {(results.data ?? []).map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              onAdd={() => send.mutate(p.id)}
              onBlock={() => block.mutate(p.id)}
              sending={send.isPending && send.variables === p.id}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  onAdd,
  onBlock,
  sending,
}: {
  player: PlayerSearchRow;
  onAdd: () => void;
  onBlock: () => void;
  sending: boolean;
}) {
  const { t } = useTranslation();
  const status: FriendshipStatus = player.friendship_status;

  let action: React.ReactNode;
  if (status === "friends") {
    action = (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        <Check className="h-3.5 w-3.5" /> {t("community.friends")}
      </span>
    );
  } else if (status === "pending_outgoing") {
    action = (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        <Send className="h-3.5 w-3.5" /> {t("community.pending")}
      </span>
    );
  } else if (status === "pending_incoming") {
    action = (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        <Inbox className="h-3.5 w-3.5" /> {t("community.incoming")}
      </span>
    );
  } else {
    action = (
      <Button size="sm" onClick={onAdd} disabled={sending}>
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {t("community.add")}
      </Button>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <Avatar className="h-10 w-10">
        {player.photo_url ? <AvatarImage src={player.photo_url} alt="" /> : null}
        <AvatarFallback>{initials(player.full_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{player.full_name ?? "—"}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {player.level ? <span className="capitalize">{player.level}</span> : null}
          {player.rating != null ? (
            <span className="inline-flex items-center gap-0.5">
              <Star className="h-3 w-3" />
              {player.rating.toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {action}
        <Button
          variant="ghost"
          size="icon"
          onClick={onBlock}
          aria-label={t("community.block")}
          className="text-muted-foreground hover:text-destructive"
        >
          <Ban className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

/* ---------- Friends ---------- */

function FriendsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const friends = useQuery(friendsQuery());
  const removeFn = useServerFn(removeFriend);
  const blockFn = useServerFn(blockUser);

  const remove = useMutation({
    mutationFn: (userId: string) => removeFn({ data: { userId } }),
    onSuccess: () => {
      toast.success(t("community.toasts.removed"));
      qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: () => toast.error(t("community.errors.generic")),
  });
  const block = useMutation({
    mutationFn: (userId: string) => blockFn({ data: { userId } }),
    onSuccess: () => {
      toast.success(t("community.toasts.blocked"));
      qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: () => toast.error(t("community.errors.generic")),
  });

  if (friends.isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }
  if (!friends.data || friends.data.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("community.noFriends")}</p>;
  }

  return (
    <ul className="space-y-2">
      {friends.data.map((f) => (
        <li key={f.user_id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <Avatar className="h-10 w-10">
            {f.photo_url ? <AvatarImage src={f.photo_url} alt="" /> : null}
            <AvatarFallback>{initials(f.full_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{f.full_name ?? "—"}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {f.level ? <span className="capitalize">{f.level}</span> : null}
              {f.rating != null ? (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="h-3 w-3" />
                  {f.rating.toFixed(1)}
                </span>
              ) : null}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => remove.mutate(f.user_id)}
            className="text-muted-foreground"
          >
            <Trash2 className="h-4 w-4" /> {t("community.remove")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => block.mutate(f.user_id)}
            aria-label={t("community.block")}
            className="text-muted-foreground hover:text-destructive"
          >
            <Ban className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Requests ---------- */

function RequestsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const incoming = useQuery(incomingQuery());
  const outgoing = useQuery(outgoingQuery());
  const respondFn = useServerFn(respondFriendRequest);
  const removeFn = useServerFn(removeFriend);

  const respond = useMutation({
    mutationFn: (v: { requestId: string; accept: boolean }) =>
      respondFn({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.accept ? t("community.toasts.accepted") : t("community.toasts.declined"));
      qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: () => toast.error(t("community.errors.generic")),
  });
  const cancel = useMutation({
    mutationFn: (userId: string) => removeFn({ data: { userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: () => toast.error(t("community.errors.generic")),
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("community.incomingHeading")}
        </h2>
        {incoming.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : !incoming.data || incoming.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("community.noIncoming")}</p>
        ) : (
          <ul className="space-y-2">
            {incoming.data.map((r) => (
              <li key={r.request_id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <Avatar className="h-10 w-10">
                  {r.photo_url ? <AvatarImage src={r.photo_url} alt="" /> : null}
                  <AvatarFallback>{initials(r.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 truncate text-sm font-medium">
                  {r.full_name ?? "—"}
                </div>
                <Button
                  size="sm"
                  onClick={() => respond.mutate({ requestId: r.request_id, accept: true })}
                  disabled={respond.isPending}
                >
                  <Check className="h-4 w-4" /> {t("community.accept")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => respond.mutate({ requestId: r.request_id, accept: false })}
                  disabled={respond.isPending}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4" /> {t("community.decline")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("community.outgoingHeading")}
        </h2>
        {outgoing.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : !outgoing.data || outgoing.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("community.noOutgoing")}</p>
        ) : (
          <ul className="space-y-2">
            {outgoing.data.map((r) => (
              <li key={r.request_id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <Avatar className="h-10 w-10">
                  {r.photo_url ? <AvatarImage src={r.photo_url} alt="" /> : null}
                  <AvatarFallback>{initials(r.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 truncate text-sm font-medium">
                  {r.full_name ?? "—"}
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  <Send className="h-3.5 w-3.5" /> {t("community.pending")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => cancel.mutate(r.user_id)}
                  disabled={cancel.isPending}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------- Blocked ---------- */

function BlockedTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const blocked = useQuery(blockedQuery());
  const unblockFn = useServerFn(unblockUser);

  const unblock = useMutation({
    mutationFn: (userId: string) => unblockFn({ data: { userId } }),
    onSuccess: () => {
      toast.success(t("community.toasts.unblocked"));
      qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: () => toast.error(t("community.errors.generic")),
  });

  if (blocked.isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }
  if (!blocked.data || blocked.data.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("community.noBlocked")}</p>;
  }

  return (
    <ul className="space-y-2">
      {blocked.data.map((b) => (
        <li key={b.user_id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <Avatar className="h-10 w-10">
            {b.photo_url ? <AvatarImage src={b.photo_url} alt="" /> : null}
            <AvatarFallback>{initials(b.full_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 truncate text-sm font-medium">{b.full_name ?? "—"}</div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => unblock.mutate(b.user_id)}
            disabled={unblock.isPending}
          >
            {t("community.unblock")}
          </Button>
        </li>
      ))}
    </ul>
  );
}
