import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight, Search } from "lucide-react";
import { GroupTile } from "@/components/groups/group-row";
import { groupKeys, myGroupInvites, myGroups } from "@/lib/groups";

/** Home → Groups: a row of your groups (plus "find groups") and a line for pending invites. */
export function MyGroupsStrip() {
  const { t } = useTranslation();
  const mine = useQuery({ queryKey: groupKeys.mine, queryFn: myGroups });
  const invites = useQuery({ queryKey: groupKeys.invites, queryFn: myGroupInvites });
  const tile = "flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 text-center";
  return (
    <div className="pt-3">
      {!!invites.data?.length && (
        <Link to="/groups" className="mx-4 mb-3 flex items-center justify-between rounded-2xl bg-secondary px-4 py-3 text-[15px] font-semibold">
          <span>{t("groups.invitesCount", { count: invites.data.length })}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}
      <nav className="no-scrollbar flex gap-3 overflow-x-auto px-4">
        <Link to="/groups" className={tile}>
          <span className="grid h-14 w-14 place-items-center rounded-2xl ring-1 ring-border">
            <Search className="h-6 w-6" />
          </span>
          <span className="w-full truncate text-xs font-medium">{t("groups.find")}</span>
        </Link>
        {(mine.data ?? []).map((g) => (
          <Link key={g.id} to="/g/$groupId" params={{ groupId: g.id }} className={tile}>
            <span className="relative">
              <GroupTile section={g.section_id} size={56} />
              {g.pending_requests > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-badge px-1 text-center text-[11px] font-semibold leading-5 text-white">
                  {g.pending_requests}
                </span>
              )}
            </span>
            <span className="w-full truncate text-xs font-medium">{g.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
