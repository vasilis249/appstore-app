import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import { ClipPlayer } from "@/components/voice/clip-player";
import {
  adminKeys,
  adminReports,
  amIAdmin,
  reportKeys,
  resolveReport,
  setPostHidden,
  setUserDisabled,
  type AdminReport,
  type ReportAction,
} from "@/lib/admin";
import { rpcErrorKey } from "@/lib/friends";
import { notificationKeys } from "@/lib/notifications";
import { postKeys, voiceUrl } from "@/lib/posts";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: AdminReportsPage,
});

/** Admin: the report queue (oldest first, act within 24 h) and the history with undo. */
function AdminReportsPage() {
  const { t } = useTranslation();
  const isAdmin = useQuery({ queryKey: adminKeys.isAdmin, queryFn: amIAdmin });
  const [open, setOpen] = useState(true);
  const list = useQuery({ queryKey: reportKeys.list(open), queryFn: () => adminReports(open), enabled: !!isAdmin.data });
  if (isAdmin.data === false) return <Navigate to="/" replace />;

  return (
    <>
      <AppHeader back title={t("adminReports.title")} />
      <div className="flex border-b border-border">
        {([true, false] as const).map((k) => (
          <button
            key={String(k)}
            type="button"
            onClick={() => setOpen(k)}
            className={cn("relative flex-1 py-3 text-[15px] font-semibold", open === k ? "text-foreground" : "text-muted-foreground")}
          >
            {t(k ? "adminReports.open" : "adminReports.history")}
            {open === k && <span className="absolute inset-x-1/3 bottom-0 h-1 rounded-full bg-primary" />}
          </button>
        ))}
      </div>
      {list.data && !list.data.length && (
        <EmptyState icon={Flag} text={t(open ? "adminReports.empty" : "adminReports.emptyHistory")} />
      )}
      <ul className="pb-28">
        {groups(list.data ?? [], open).map((g) => (
          <ReportItem key={g[0].id} group={g} />
        ))}
      </ul>
    </>
  );
}

/** Open reports about the same post (or the same person) form one card; history stays one row per report. */
function groups(list: AdminReport[], open: boolean): AdminReport[][] {
  if (!open) return list.map((r) => [r]);
  const byTarget = new Map<string, AdminReport[]>();
  for (const r of list) {
    const key = r.kind === "post" || r.kind === "group" ? `${r.kind}:${r.target_id}` : `${r.kind}:${r.target_user_id}`;
    byTarget.set(key, [...(byTarget.get(key) ?? []), r]);
  }
  return [...byTarget.values()];
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: reportKeys.all });
    void qc.invalidateQueries({ queryKey: postKeys.all });
    void qc.invalidateQueries({ queryKey: notificationKeys.all });
  };
}

function ReportItem({ group }: { group: AdminReport[] }) {
  const { t, i18n } = useTranslation();
  const r = group[0];
  const reasons = [...new Set(group.map((x) => t(`report.reasons.${x.reason}`, { defaultValue: x.reason || t("report.reasons.other") })))];
  const reporters = [...new Set(group.map((x) => x.reporter_username).filter(Boolean))];
  const refresh = useRefresh();
  const [confirmBan, setConfirmBan] = useState(false);
  const resolve = useMutation({
    mutationFn: (action: ReportAction) => resolveReport(r.id, action),
    onSuccess: (n) => {
      toast.success(t("adminReports.resolved", { count: n }));
      refresh();
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  const undo = useMutation({
    mutationFn: (what: "post" | "user") =>
      what === "post" ? setPostHidden(r.target_id!, false) : setUserDisabled(r.target_user_id, false),
    onSuccess: refresh,
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  const busy = resolve.isPending || undo.isPending;
  const pill = "h-9 rounded-full px-4 text-sm font-semibold disabled:opacity-40";

  return (
    <li className="space-y-3 border-b border-border px-4 py-4">
      <p className="text-xs text-muted-foreground">
        {!r.resolved_at && group.length > 1 && (
          <span className="mr-1.5 inline-block whitespace-nowrap rounded-full bg-badge px-1.5 py-0.5 font-semibold text-white">
            {t("adminReports.count", { count: group.length })}
          </span>
        )}
        <span className="font-semibold text-coral">{t(`adminReports.kind.${r.kind}`)}</span> · {reasons.join(", ")} ·{" "}
        {timeAgo(r.created_at, i18n.language)}
        {!!reporters.length && ` · ${t("adminReports.by", { username: reporters.join(", @") })}`}
      </p>

      <Link to="/u/$username" params={{ username: r.target_username }} className="flex items-center gap-3">
        <UserAvatar name={r.target_name || r.target_username} path={r.target_avatar} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{r.target_name || r.target_username}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{r.target_username}
            {r.target_disabled && <span className="text-destructive"> · {t("adminReports.disabled")}</span>}
          </p>
        </div>
      </Link>

      {r.kind === "post" &&
        (r.post_exists && r.post_audio_path ? (
          <div className="space-y-2 rounded-2xl bg-secondary p-3">
            {r.post_title && <p className="text-sm font-semibold leading-snug">{r.post_title}</p>}
            <ClipPlayer
              id={`report-${r.id}`}
              durationMs={r.post_duration_ms ?? 0}
              load={() => fetch(voiceUrl(r.post_audio_path!)).then((res) => res.blob())}
            />
            {r.post_hidden && <p className="text-xs font-semibold text-muted-foreground">{t("adminReports.hidden")}</p>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("adminReports.postGone")}</p>
        ))}
      {r.kind === "voice_message" && <p className="text-xs text-muted-foreground">{t("adminReports.messageGone")}</p>}
      {r.kind === "group" &&
        (r.group_exists && r.target_id ? (
          <Link to="/g/$groupId" params={{ groupId: r.target_id }} className="block rounded-2xl bg-secondary p-3 text-sm font-semibold">
            {r.group_name}
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">{t("adminReports.groupGone")}</p>
        ))}

      {r.resolved_at ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t(`adminReports.action.${r.action ?? "dismiss"}`)} · {timeAgo(r.resolved_at, i18n.language)}
          </span>
          {r.kind === "post" && r.post_exists && r.post_hidden && (
            <button type="button" disabled={busy} onClick={() => undo.mutate("post")} className={cn(pill, "bg-secondary")}>
              {t("adminReports.showPost")}
            </button>
          )}
          {r.target_disabled && (
            <button type="button" disabled={busy} onClick={() => undo.mutate("user")} className={cn(pill, "bg-secondary")}>
              {t("adminReports.enableUser")}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {r.kind === "group" && r.group_exists && (
            <button type="button" disabled={busy} onClick={() => resolve.mutate("delete_group")} className={cn(pill, "bg-primary text-primary-foreground")}>
              {t("adminReports.deleteGroup")}
            </button>
          )}
          {r.kind === "post" && r.post_exists && (
            <button type="button" disabled={busy} onClick={() => resolve.mutate("hide_post")} className={cn(pill, "bg-primary text-primary-foreground")}>
              {t("adminReports.hidePost")}
            </button>
          )}
          {!r.target_is_admin && !r.target_disabled && (
            <button
              type="button"
              disabled={busy}
              onClick={() => (confirmBan ? resolve.mutate("disable_user") : setConfirmBan(true))}
              className={cn(pill, confirmBan ? "bg-destructive text-white" : "bg-secondary text-destructive")}
            >
              {t(confirmBan ? "adminReports.confirmDisable" : "adminReports.disableUser")}
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => resolve.mutate("dismiss")} className={cn(pill, "bg-secondary")}>
            {t("adminReports.dismiss")}
          </button>
        </div>
      )}
    </li>
  );
}
