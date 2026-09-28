import { createFileRoute, Link } from "@tanstack/react-router";
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
import { cn } from "@/lib/utils";
import {
  listContentReports,
  resolveContentReports,
  type ContentReportGroup,
} from "@/lib/api/moderation.functions";
import { ShieldAlert, Trash2, UserX, CheckCircle2, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: AdminReports,
});

function AdminReports() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<"content" | "messages">("content");
  const seg = "flex-1 rounded-[12px] py-2 text-center text-sm font-semibold transition";
  const on = "bg-background text-foreground shadow-sm";
  return (
    <div className="space-y-4">
      <nav className="flex max-w-sm rounded-[14px] bg-secondary p-1 text-muted-foreground">
        <button
          type="button"
          onClick={() => setKind("content")}
          className={cn(seg, kind === "content" && on)}
        >
          {t("moderation.content")}
        </button>
        <button
          type="button"
          onClick={() => setKind("messages")}
          className={cn(seg, kind === "messages" && on)}
        >
          {t("moderation.messages")}
        </button>
      </nav>
      {kind === "content" ? <ContentReports /> : <MessageReports />}
    </div>
  );
}

function ContentReports() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const listFn = useServerFn(listContentReports);
  const resolveFn = useServerFn(resolveContentReports);
  const q = useQuery({
    queryKey: ["admin-content-reports", filter],
    queryFn: () => listFn({ data: { status: filter } }),
  });
  const m = useMutation({
    mutationFn: (v: {
      targetType: ContentReportGroup["targetType"];
      targetId: string;
      action: "remove" | "dismiss";
    }) => resolveFn({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(
        v.action === "remove" ? t("moderation.removed") : t("admin.reports.toastDismissed"),
      );
      void qc.invalidateQueries({ queryKey: ["admin-content-reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={filter === "open" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("open")}
        >
          {t("admin.reports.filterOpen")}
        </Button>
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          {t("admin.reports.filterAll")}
        </Button>
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {!q.isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("admin.reports.empty")}</p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((g) => (
          <li
            key={`${g.targetType}:${g.targetId}`}
            className="rounded-2xl border border-border/60 bg-card p-4"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold">
                {t(`moderation.type.${g.targetType}`)}
              </span>
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-600">
                {t("moderation.count", { count: g.count })}
              </span>
              {g.status !== "open" && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                  {t(`moderation.status.${g.status}`)}
                </span>
              )}
              <span className="ml-auto text-muted-foreground">
                {new Date(g.lastAt).toLocaleDateString()}
              </span>
            </div>
            <div className="mt-3 flex gap-3">
              {g.preview?.image && (
                <img
                  src={g.preview.image}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-xl object-cover"
                />
              )}
              <div className="min-w-0 text-sm">
                {g.author ? (
                  <Link
                    to="/u/$username"
                    params={{ username: g.author.username }}
                    className="font-semibold hover:underline"
                  >
                    @{g.author.username}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{t("moderation.gone")}</span>
                )}
                {g.author?.disabled && (
                  <span className="ml-2 text-xs text-rose-600">{t("moderation.disabled")}</span>
                )}
                {g.preview?.text && (
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{g.preview.text}</p>
                )}
                {g.preview?.postId && g.targetType !== "profile" && (
                  <Link
                    to="/p/$postId"
                    params={{ postId: g.preview.postId }}
                    className="mt-1 block text-xs text-primary"
                  >
                    {t("moderation.open")}
                  </Link>
                )}
              </div>
            </div>
            {g.reasons.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {g.reasons.slice(0, 3).map((r, i) => (
                  <li key={i}>“{r}”</li>
                ))}
              </ul>
            )}
            {g.status === "open" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={m.isPending}
                  onClick={() =>
                    m.mutate({ targetType: g.targetType, targetId: g.targetId, action: "dismiss" })
                  }
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" /> {t("admin.reports.dismiss")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={m.isPending || (!g.author && g.targetType === "profile")}
                  onClick={() =>
                    m.mutate({ targetType: g.targetType, targetId: g.targetId, action: "remove" })
                  }
                >
                  {g.targetType === "profile" ? (
                    <>
                      <UserX className="mr-1 h-4 w-4" /> {t("admin.reports.disableUser")}
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-1 h-4 w-4" /> {t("moderation.remove")}
                    </>
                  )}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessageReports() {
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
    onSuccess: () => {
      toast.success(t("admin.reports.toastDismissed"));
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (reportId: string) => delMsg({ data: { reportId } }),
    onSuccess: () => {
      toast.success(t("admin.reports.toastDeleted"));
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const mDisable = useMutation({
    mutationFn: (userId: string) => disable({ data: { userId, disabled: true } }),
    onSuccess: () => {
      toast.success(t("admin.reports.toastDisabled"));
      invalidate();
    },
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
          <Button
            variant={filter === "open" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("open")}
          >
            {t("admin.reports.filterOpen")}
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
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
  r,
  onDismiss,
  onDelete,
  onDisable,
  busy,
}: {
  r: AdminReportRow;
  onDismiss: () => void;
  onDelete: () => void;
  onDisable: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const statusColor =
    r.status === "open"
      ? "bg-amber-500/15 text-amber-600"
      : r.status === "dismissed"
        ? "bg-muted text-muted-foreground"
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
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("admin.reports.reporter")}
          </div>
          <div className="font-medium">{r.reporter?.full_name ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("admin.reports.reportedUser")}
          </div>
          <div className="font-medium">{r.reported_user?.full_name ?? "—"}</div>
        </div>
      </div>

      {r.reason && (
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("admin.reports.reason")}
          </div>
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
