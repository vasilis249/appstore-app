import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Search, Users, X } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { GroupRow } from "@/components/groups/group-row";
import { useDebounced } from "@/hooks/use-debounced";
import { rpcErrorKey } from "@/lib/friends";
import { discoverGroups, groupKeys, joinGroup, leaveGroup, myGroupInvites, myGroups, type GroupCard } from "@/lib/groups";

export const Route = createFileRoute("/_authenticated/groups/")({
  component: GroupsPage,
});

/** Groups: search, your invites, your groups, then groups to discover. */
function GroupsPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim(), 250);
  const mine = useQuery({ queryKey: groupKeys.mine, queryFn: myGroups });
  const invites = useQuery({ queryKey: groupKeys.invites, queryFn: myGroupInvites });
  const found = useQuery({ queryKey: groupKeys.discover(query), queryFn: () => discoverGroups(query) });
  const mineIds = new Set((mine.data ?? []).map((g) => g.id));
  const suggested = (found.data ?? []).filter((g) => !mineIds.has(g.id) && g.my_pending !== "invite");
  const h2 = "px-4 pb-1 pt-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <>
      <AppHeader
        back
        title={t("groups.title")}
        right={
          <Link to="/groups/new" aria-label={t("groups.new")} className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
            <Plus className="h-5 w-5" />
          </Link>
        }
      />
      <div className="px-4 pt-1">
        <label className="flex h-11 items-center gap-2 rounded-full bg-secondary px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("groups.searchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label={t("common.cancel")}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </label>
      </div>

      {!query && !!invites.data?.length && (
        <section>
          <h2 className={h2}>{t("groups.invites")}</h2>
          <ul className="px-4">
            {invites.data.map((g) => (
              <InviteRow key={g.id} group={g} by={g.invited_by_name} />
            ))}
          </ul>
        </section>
      )}

      {!query && !!mine.data?.length && (
        <section>
          <h2 className={h2}>{t("groups.mine")}</h2>
          <ul className="px-4">
            {mine.data.map((g) => (
              <GroupRow key={g.id} group={g}>
                {g.pending_requests > 0 && (
                  <span className="min-w-5 rounded-full bg-badge px-1.5 text-center text-xs font-semibold leading-5 text-white">{g.pending_requests}</span>
                )}
              </GroupRow>
            ))}
          </ul>
        </section>
      )}

      <section className="pb-28">
        <h2 className={h2}>{t(query ? "groups.results" : "groups.discover")}</h2>
        {found.data && !suggested.length ? (
          query || mine.data?.length || invites.data?.length ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t(query ? "groups.noResults" : "groups.noOthers")}</p>
          ) : (
            <EmptyState icon={Users} text={t("groups.emptyDiscover")} action={<CreateCta />} />
          )
        ) : (
          <ul className="px-4">
            {suggested.map((g) => (
              <GroupRow key={g.id} group={g}>
                <Status group={g} />
              </GroupRow>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function CreateCta() {
  const { t } = useTranslation();
  return (
    <Link to="/groups/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground">
      <Plus className="h-4 w-4" /> {t("groups.new")}
    </Link>
  );
}

function Status({ group }: { group: GroupCard }) {
  const { t } = useTranslation();
  if (group.my_role) return <span className="text-xs text-muted-foreground">{t("groups.member")}</span>;
  if (group.my_pending === "request") return <span className="text-xs text-muted-foreground">{t("groups.requestSent")}</span>;
  return null;
}

function InviteRow({ group, by }: { group: { id: string; name: string; section_id: string; privacy: "public" | "private"; members_count: number }; by: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: (accept: boolean) => (accept ? joinGroup(group.id).then(() => undefined) : leaveGroup(group.id)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: groupKeys.all }),
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  return (
    <div>
      <GroupRow group={group}>
        <button
          type="button"
          disabled={act.isPending}
          onClick={() => act.mutate(true)}
          className="h-9 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {t("groups.accept")}
        </button>
        <button
          type="button"
          disabled={act.isPending}
          onClick={() => act.mutate(false)}
          aria-label={t("groups.decline")}
          className="grid h-9 w-9 place-items-center rounded-full bg-secondary disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </GroupRow>
      <p className="-mt-1 pb-2 pl-[3.75rem] text-xs text-muted-foreground">{t("groups.invitedBy", { name: by })}</p>
    </div>
  );
}
