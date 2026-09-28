import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { listAllUsers, setUserDisabled } from "@/lib/api/admin.functions";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Ban, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

type RoleFilter = "all" | "player" | "owner" | "coach" | "admin";

function AdminUsers() {
  const { t } = useTranslation();
  const fetchUsers = useServerFn(listAllUsers);
  const toggle = useServerFn(setUserDisabled);
  const qc = useQueryClient();
  const [role, setRole] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["admin-users", role],
    queryFn: () => fetchUsers({ data: role === "all" ? {} : { role } }),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { userId: string; disabled: boolean }) => toggle({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success(t("admin.users.updated")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((u) => (u.full_name ?? "").toLowerCase().includes(s));
  }, [q.data, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "player", "owner", "coach", "admin"] as RoleFilter[]).map((r) => (
          <button key={r} onClick={() => setRole(r)} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", role === r ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
            {t(`admin.users.${r}`)}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.users.searchPh")}
          className="ml-auto w-56 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("admin.users.loading")}</p>
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">{t("admin.users.empty")}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("admin.users.colName")}</th>
                <th className="px-4 py-3">{t("admin.users.colRole")}</th>
                <th className="px-4 py-3">{t("admin.users.colLevel")}</th>
                <th className="px-4 py-3">{t("admin.users.colGames")}</th>
                <th className="px-4 py-3">{t("admin.users.colRating")}</th>
                <th className="px-4 py-3">{t("admin.users.colStatus")}</th>
                <th className="px-4 py-3 text-right">{t("admin.users.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.user_id} className="border-t border-border/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold">
                        {u.photo_url ? <img src={u.photo_url} alt="" className="h-full w-full object-cover" /> : (u.full_name ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{u.full_name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{u.roles.join(", ")}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{u.level ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.games_played}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.rating ? Number(u.rating).toFixed(1) : "—"}</td>
                  <td className="px-4 py-3">
                    {u.disabled ? (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{t("admin.users.inactive")}</span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">{t("admin.users.active")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.disabled ? (
                      <button onClick={() => toggleMut.mutate({ userId: u.user_id, disabled: false })} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                        <RotateCcw className="h-3 w-3" /> {t("admin.users.reenable")}
                      </button>
                    ) : (
                      <button onClick={() => { if (confirm(t("admin.users.confirmDisable", { name: u.full_name ?? t("admin.users.userFallback") }))) toggleMut.mutate({ userId: u.user_id, disabled: true }); }} className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                        <Ban className="h-3 w-3" /> {t("admin.users.disable")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
