import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Search, Share, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { PersonRow, PillButton } from "@/components/friends/person-row";
import { PersonActionsSheet } from "@/components/friends/person-actions-sheet";
import { useMyProfile } from "@/hooks/use-my-profile";
import {
  acceptFriendRequest,
  friendKeys,
  listFriends,
  removeFriend,
  rpcErrorKey,
  searchUsers,
  sendFriendRequest,
  type Person,
} from "@/lib/friends";

export const Route = createFileRoute("/_authenticated/friends")({
  component: FriendsPage,
});

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Live updates: someone sends/accepts a request → refresh the lists. */
function useFriendshipsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("friendships-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        void qc.invalidateQueries({ queryKey: friendKeys.all });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}

function FriendsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim().toLowerCase(), 300);
  const searching = q.length >= 2;
  const [selected, setSelected] = useState<Person | null>(null);
  useFriendshipsRealtime();

  const list = useQuery({ queryKey: friendKeys.list, queryFn: listFriends });
  const results = useQuery({ queryKey: friendKeys.search(q), queryFn: () => searchUsers(q), enabled: searching });

  const act = useMutation({
    mutationFn: async ({ kind, id }: { kind: "add" | "accept" | "remove"; id: string }) => {
      if (kind === "add") await sendFriendRequest(id);
      if (kind === "accept") await acceptFriendRequest(id);
      if (kind === "remove") await removeFriend(id);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: friendKeys.all }),
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  const busy = (id: string) => act.isPending && act.variables?.id === id;

  const people = list.data ?? [];
  const incoming = people.filter((p) => p.relation === "incoming");
  const friends = people.filter((p) => p.relation === "friends");
  const outgoing = people.filter((p) => p.relation === "outgoing");

  function actionFor(p: Person) {
    switch (p.relation) {
      case "incoming":
        return (
          <>
            <PillButton disabled={busy(p.id)} onClick={() => act.mutate({ kind: "accept", id: p.id })}>
              {t("friends.accept")}
            </PillButton>
            <button
              type="button"
              aria-label={t("friends.decline")}
              disabled={busy(p.id)}
              onClick={() => act.mutate({ kind: "remove", id: p.id })}
              className="grid h-10 w-8 place-items-center text-muted-foreground"
            >
              <X className="h-6 w-6" />
            </button>
          </>
        );
      case "outgoing":
        return (
          <PillButton disabled={busy(p.id)} onClick={() => act.mutate({ kind: "remove", id: p.id })}>
            {t("friends.cancelRequest")}
          </PillButton>
        );
      case "none":
        return (
          <PillButton variant="primary" disabled={busy(p.id)} onClick={() => act.mutate({ kind: "add", id: p.id })}>
            {t("friends.add")}
          </PillButton>
        );
      default:
        return null;
    }
  }

  const section = "mt-6 mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <>
      <AppHeader />
      <div className="px-4 pt-2">
        <label className="flex h-12 items-center gap-2 rounded-2xl bg-secondary px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("friends.searchPlaceholder")}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:shadow-none"
          />
          {query && (
            <button type="button" aria-label={t("common.clear")} onClick={() => setQuery("")} className="text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
          )}
        </label>

        {searching ? (
          <>
            <ul className="mt-3">
              {(results.data ?? []).map((p) => (
                <PersonRow key={p.id} person={p} onOpen={() => setSelected(p)}
                  subtitle={p.relation === "friends" ? t("friends.alreadyFriends") : undefined}>
                  {actionFor(p)}
                </PersonRow>
              ))}
            </ul>
            {results.data && !results.data.length && (
              <p className="py-12 text-center text-sm text-muted-foreground">{t("friends.noResults")}</p>
            )}
          </>
        ) : (
          <>
            {incoming.length > 0 && (
              <>
                <h2 className={section}>{t("friends.requests")}</h2>
                <ul>
                  {incoming.map((p) => (
                    <PersonRow key={p.id} person={p} subtitle={t("friends.sentYouRequest")}>{actionFor(p)}</PersonRow>
                  ))}
                </ul>
              </>
            )}
            {friends.length > 0 && (
              <>
                <h2 className={section}>{t("friends.myFriendsCount", { count: friends.length })}</h2>
                <ul>
                  {friends.map((p) => (
                    <PersonRow key={p.id} person={p} onOpen={() => setSelected(p)} />
                  ))}
                </ul>
              </>
            )}
            {outgoing.length > 0 && (
              <>
                <h2 className={section}>{t("friends.sent")}</h2>
                <ul>
                  {outgoing.map((p) => (
                    <PersonRow key={p.id} person={p}>{actionFor(p)}</PersonRow>
                  ))}
                </ul>
              </>
            )}
            {list.data && !people.length && <EmptyState icon={Users} text={t("friends.empty")} />}
            <ShareUsername />
          </>
        )}
      </div>
      <PersonActionsSheet person={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
}

/** One line to tell friends your username (native share sheet, clipboard as fallback). */
function ShareUsername() {
  const { t } = useTranslation();
  const me = useMyProfile();
  if (!me.data) return null;
  const username = me.data.username;
  async function share() {
    const text = t("friends.shareText", { username });
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(username);
        toast.success(t("friends.copied"));
      }
    } catch {
      /* cancelled */
    }
  }
  return (
    <button
      type="button"
      onClick={share}
      className="mt-8 flex w-full items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{t("friends.yourUsername")}</span>
        <span className="block truncate font-semibold">{username}</span>
      </span>
      <Share className="h-5 w-5 shrink-0" />
    </button>
  );
}
