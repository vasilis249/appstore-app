import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight, Flag, LogOut, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { REPORT_REASONS, reportContent, rpcErrorKey } from "@/lib/friends";
import { deleteGroup, groupKeys, leaveGroup, type GroupDetail } from "@/lib/groups";
import { postKeys } from "@/lib/posts";

type Step = "menu" | "leave" | "delete" | "reasons" | "reported";

/** ⋯ on a group: edit (admins), leave, delete (owner), report (everyone but the owner). */
export function GroupMenuSheet({ group, open, onOpenChange }: { group: GroupDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("menu");
  useEffect(() => {
    if (open) setStep("menu");
  }, [open]);
  const isAdmin = group.my_role === "owner" || group.my_role === "admin";
  const isOwner = group.my_role === "owner";
  const done = () => {
    void qc.invalidateQueries({ queryKey: groupKeys.all });
    void qc.invalidateQueries({ queryKey: postKeys.all });
  };

  const leave = useMutation({
    mutationFn: () => leaveGroup(group.id),
    onSuccess: () => {
      done();
      onOpenChange(false);
      toast.success(t("groups.left"));
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  const remove = useMutation({
    mutationFn: () => deleteGroup(group.id),
    onSuccess: () => {
      done();
      onOpenChange(false);
      toast.success(t("groups.deleted"));
      void navigate({ to: "/groups", replace: true });
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  const report = useMutation({
    mutationFn: (reason: string) => reportContent("group", group.id, reason),
    onSuccess: () => setStep("reported"),
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  const row = "flex w-full items-center gap-3 px-4 py-3.5 text-body font-normal disabled:opacity-50";
  const confirm = (text: string, label: string, run: () => void, busy: boolean) => (
    <div className="space-y-3 text-center">
      <p className="px-4 text-caption text-muted-foreground">{text}</p>
      <button type="button" disabled={busy} onClick={run} className="h-12 w-full rounded-xl bg-destructive font-semibold text-destructive-foreground disabled:opacity-50">
        {label}
      </button>
      <button type="button" onClick={() => setStep("menu")} className="h-12 w-full rounded-xl bg-secondary font-semibold">
        {t("common.cancel")}
      </button>
    </div>
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[85vh] max-w-lg">
        <DrawerTitle className="px-6 pt-4 text-center text-body font-semibold">{group.name}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("friends.actions")}</DrawerDescription>
        <div className="safe-bottom overflow-y-auto p-4">
          {step === "menu" && (
            <div className="divide-y divide-border overflow-hidden rounded-2xl bg-group">
              {isAdmin && (
                <button
                  type="button"
                  className={row}
                  onClick={() => {
                    onOpenChange(false);
                    void navigate({ to: "/g/$groupId/edit", params: { groupId: group.id } });
                  }}
                >
                  <Pencil className="h-5 w-5" /> {t("groups.edit")}
                </button>
              )}
              {group.my_role && (
                <button type="button" className={row} onClick={() => setStep("leave")}>
                  <LogOut className="h-5 w-5" /> {t("groups.leave")}
                </button>
              )}
              {isOwner && (
                <button type="button" className={`${row} text-destructive`} onClick={() => setStep("delete")}>
                  <Trash2 className="h-5 w-5" /> {t("groups.delete")}
                </button>
              )}
              {!isOwner && (
                <button type="button" className={`${row} text-destructive`} onClick={() => setStep("reasons")}>
                  <Flag className="h-5 w-5" /> {t("groups.report")}
                </button>
              )}
            </div>
          )}
          {step === "leave" &&
            confirm(t(isOwner ? "groups.leaveOwnerConfirm" : "groups.leaveConfirm"), t("groups.leave"), () => leave.mutate(), leave.isPending)}
          {step === "delete" && confirm(t("groups.deleteConfirm"), t("groups.delete"), () => remove.mutate(), remove.isPending)}
          {step === "reasons" && (
            <>
              <p className="mb-3 text-center text-caption font-semibold">{t("report.why")}</p>
              <div className="divide-y divide-border overflow-hidden rounded-2xl bg-group">
                {REPORT_REASONS.map((r) => (
                  <button key={r} type="button" disabled={report.isPending} className={`${row} justify-between`} onClick={() => report.mutate(r)}>
                    {t(`report.reasons.${r}`)}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </>
          )}
          {step === "reported" && (
            <div className="space-y-3 text-center">
              <p className="text-body font-semibold">{t("report.thanks")}</p>
              <p className="px-4 text-caption text-muted-foreground">{t("groups.reportReview")}</p>
              <button type="button" onClick={() => onOpenChange(false)} className="h-12 w-full rounded-xl bg-secondary font-semibold">
                {t("report.done")}
              </button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
