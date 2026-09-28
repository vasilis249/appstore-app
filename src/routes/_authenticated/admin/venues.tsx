import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { listAllVenues, setVenueApproved, deleteVenue, rejectVenue } from "@/lib/api/admin.functions";
import { toast } from "sonner";
import { Check, Trash2, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/venues")({
  component: AdminVenues,
});

function AdminVenues() {
  const { t } = useTranslation();
  const fetchVenues = useServerFn(listAllVenues);
  const approve = useServerFn(setVenueApproved);
  const reject = useServerFn(rejectVenue);
  const del = useServerFn(deleteVenue);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const q = useQuery({ queryKey: ["admin-venues"], queryFn: () => fetchVenues() });

  const approveMut = useMutation({
    mutationFn: (v: { venueId: string; approved: boolean }) => approve({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-venues"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); toast.success(t("admin.venues.updated")); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: (v: { venueId: string; reason: string }) => reject({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-venues"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); toast.success(t("admin.venues.rejected")); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (venueId: string) => del({ data: { venueId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-venues"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); toast.success(t("admin.venues.deleted")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const venues = (q.data ?? []).filter((v) => tab === "all" || !v.approved);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["pending", "all"] as const).map((tk) => (
          <button key={tk} onClick={() => setTab(tk)} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", tab === tk ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
            {tk === "pending" ? t("admin.venues.pending") : t("admin.venues.all")}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("admin.venues.loading")}</p>
      ) : !venues.length ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">{t("admin.venues.empty")}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("admin.venues.colName")}</th>
                <th className="px-4 py-3">{t("admin.venues.colSport")}</th>
                <th className="px-4 py-3">{t("admin.venues.colArea")}</th>
                <th className="px-4 py-3">{t("admin.venues.colOwner")}</th>
                <th className="px-4 py-3">{t("admin.venues.colStatus")}</th>
                <th className="px-4 py-3 text-right">{t("admin.venues.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id} className="border-t border-border/40">
                  <td className="px-4 py-3 font-medium">{v.name}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{t(`sports.${v.sport}`, v.sport)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.area}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.owner_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {v.approved ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">{t("admin.venues.approved")}</span>
                    ) : (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">{t("admin.venues.pendingBadge")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {!v.approved ? (
                        <>
                          <button onClick={() => approveMut.mutate({ venueId: v.id, approved: true })} className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">
                            <Check className="h-3 w-3" /> {t("admin.venues.approve")}
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt(t("admin.venues.rejectReasonPrompt"));
                              if (reason && reason.trim()) rejectMut.mutate({ venueId: v.id, reason: reason.trim() });
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <X className="h-3 w-3" /> {t("admin.venues.reject")}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => approveMut.mutate({ venueId: v.id, approved: false })} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                          <X className="h-3 w-3" /> {t("admin.venues.revoke")}
                        </button>
                      )}

                      <button onClick={() => { if (confirm(t("admin.venues.deleteConfirm", { name: v.name }))) deleteMut.mutate(v.id); }} className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
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
