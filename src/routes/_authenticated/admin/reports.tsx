import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import {
  listMessageReports,
  dismissReport,
  deleteReportedMessage,
  setUserDisabled,
  type AdminReportRow,
} from "@/lib/api/admin.functions";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Trash2, UserX, CheckCircle2, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: AdminReports,
});

function AdminReports() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"open" | "all">("open");

  const fetchReports = useServerFn(listMessageReports);
  const q = useQuery({
    queryKey: ["admin-reports", filter],
    queryFn: () => fetchReports({ data: { status: filter === "open" ? "open" : "all" } }),
  });

  const dismiss = useServerFn(dismissReport);
  const delMsg = useServerFn(deleteReportedMessage);
  const disable = useServerFn(setUserDisabled);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-reports"] });

  const mDismiss = useMutation({
    mutationFn: (reportId: string) => dismiss({ data: { reportId } }),
    onSuccess: () => { toast.success(t("admin.reports.toastDismissed")); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (reportId: string) => delMsg({ data: { reportId } }),
    onSuccess: () => { toast.success(t("admin.reports.toastDeleted")); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mDisable = useMutation({
    mutationFn: (userId: string) => disable({ data: { userId, disabled: true } }),
    onSuccess: () => { toast.success(t("admin.reports.toastDisabled")); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" /> {t("admin.reports.title")}
        </h2>
        <div className="flex gap-2">
          <Button variant={filter === "open" ? "default" : "outline"} size="sm" onClick={() => setFilter("open")}>
            {t("admin.reports.filterOpen")}
          </Button>
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            {t("admin.reports.filterAll")}
          </Button>
        </div>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {!q.isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("admin.reports.empty")}</p>
      )}

      <ul className="space-y-3">
        {rows.map((r) => (
          <ReportCard
            key={r.id}
            r={r}
            onDismiss={() => mDismiss.mutate(r.id)}
            onDelete={() => mDelete.mutate(r.id)}
            onDisable={() => r.reported_user && mDisable.mutate(r.reported_user.user_id)}
            busy={mDismiss.isPending || mDelete.isPending || mDisable.isPending}
          />
        ))}
      </ul>
    </div>
  );
}

function ReportCard({
  r, onDismiss, onDelete, onDisable, busy,
}: {
  r: AdminReportRow;
  onDismiss: () => void;
  onDelete: () => void;
  onDisable: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const statusColor =
    r.status === "open" ? "bg-amber-500/15 text-amber-600"
    : r.status === "dismissed" ? "bg-muted text-muted-foreground"
    : "bg-emerald-500/15 text-emerald-600";

  return (
    <li className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-medium ${statusColor}`}>
            {t(`admin.reports.status.${r.status}`)}
          </span>
          <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("admin.reports.reporter")}</div>
          <div className="font-medium">{r.reporter?.full_name ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("admin.reports.reportedUser")}</div>
          <div className="font-medium">{r.reported_user?.full_name ?? "—"}</div>
        </div>
      </div>

      {r.reason && (
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("admin.reports.reason")}</div>
          <p className="text-sm">{r.reason}</p>
        </div>
      )}

      {r.message && (
        <div className="mt-3 rounded-xl border border-border/50 bg-muted/30 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" /> {t("admin.reports.messageBody")}
            {r.message.deleted_at && (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-600">
                {t("admin.reports.alreadyDeleted")}
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm">{r.message.body}</p>
        </div>
      )}

      {r.action && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("admin.reports.actionTaken")}: {r.action}
        </p>
      )}

      {r.status === "open" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onDismiss} disabled={busy}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> {t("admin.reports.dismiss")}
          </Button>
          {r.message && !r.message.deleted_at && (
            <Button size="sm" variant="outline" onClick={onDelete} disabled={busy}>
              <Trash2 className="mr-1 h-4 w-4" /> {t("admin.reports.deleteMessage")}
            </Button>
          )}
          {r.reported_user && (
            <Button size="sm" variant="destructive" onClick={onDisable} disabled={busy}>
              <UserX className="mr-1 h-4 w-4" /> {t("admin.reports.disableUser")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
