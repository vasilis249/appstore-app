import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Ban, ChevronRight, Flag, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { UserAvatar } from "@/components/user-avatar";
import {
  blockUser,
  friendKeys,
  removeFriend,
  REPORT_REASONS,
  reportContent,
  rpcErrorKey,
  type Person,
  type ReportKind,
} from "@/lib/friends";
import { dailyKeys } from "@/lib/daily";
import { voiceKeys } from "@/lib/voice";

type Step = "menu" | "reasons" | "reported" | "confirmBlock" | "confirmRemove";

/**
 * Secondary actions for a person (App Store guideline 1.2): report with a reason — the
 * person, or a specific post / voice message via `report` — optionally block right after,
 * block, remove friend. Destructive steps are confirmed inside the sheet.
 */
export function PersonActionsSheet({
  person,
  report,
  onOpenChange,
  onBlocked,
}: {
  person: Pick<Person, "id" | "username" | "full_name" | "avatar_path" | "relation"> | null;
  /** What "Report" refers to; defaults to the person. */
  report?: { kind: ReportKind; id: string; label: string };
  onOpenChange: (open: boolean) => void;
  onBlocked?: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("menu");
  useEffect(() => setStep("menu"), [person?.id, report?.id]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: friendKeys.all });
    void qc.invalidateQueries({ queryKey: dailyKeys.all });
    void qc.invalidateQueries({ queryKey: voiceKeys.all });
  };

  const sendReport = useMutation({
    mutationFn: (reason: string) => reportContent(report?.kind ?? "user", report?.id ?? person!.id, reason),
    onSuccess: () => setStep("reported"),
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  const act = useMutation({
    mutationFn: async (action: "remove" | "block") => {
      if (!person) return action;
      if (action === "remove") await removeFriend(person.id);
      else await blockUser(person.id);
      return action;
    },
    onSuccess: (action) => {
      refresh();
      toast.success(t(`friends.done.${action}`));
      onOpenChange(false);
      if (action === "block") onBlocked?.();
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  const row = "flex w-full items-center gap-3 px-4 py-3.5 text-base font-medium disabled:opacity-50";
  const name = person ? person.full_name || person.username : "";
  const busy = sendReport.isPending || act.isPending;

  return (
    <Drawer open={!!person} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92vh] max-w-lg rounded-t-[28px] border-0 bg-surface-elevated">
        <DrawerTitle className="sr-only">{name}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("friends.actions")}</DrawerDescription>
        {person && (
          <div className="safe-bottom overflow-y-auto p-4">
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
              <UserAvatar name={name} path={person.avatar_path} size={72} />
              <p className="text-lg font-bold">{name}</p>
              <p className="-mt-2 text-sm text-muted-foreground">{person.username}</p>
            </div>

            {step === "menu" && (
              <div className="divide-y divide-border overflow-hidden rounded-2xl bg-secondary">
                {person.relation === "friends" && !report && (
                  <button type="button" className={row} onClick={() => setStep("confirmRemove")}>
                    <UserMinus className="h-5 w-5" /> {t("friends.remove")}
                  </button>
                )}
                <button type="button" className={row} onClick={() => setStep("reasons")}>
                  <Flag className="h-5 w-5" /> {report?.label ?? t("friends.report")}
                </button>
                <button type="button" className={`${row} text-destructive`} onClick={() => setStep("confirmBlock")}>
                  <Ban className="h-5 w-5" /> {t("friends.block")}
                </button>
              </div>
            )}

            {step === "reasons" && (
              <>
                <p className="mb-3 text-center text-sm font-semibold">{t("report.why")}</p>
                <div className="divide-y divide-border overflow-hidden rounded-2xl bg-secondary">
                  {REPORT_REASONS.map((r) => (
                    <button key={r} type="button" disabled={busy} className={`${row} justify-between`} onClick={() => sendReport.mutate(r)}>
                      {t(`report.reasons.${r}`)}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === "reported" && (
              <div className="space-y-3 text-center">
                <p className="text-base font-semibold">{t("report.thanks")}</p>
                <p className="px-4 text-sm text-muted-foreground">{t("report.review")}</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act.mutate("block")}
                  className="h-12 w-full rounded-full bg-destructive font-semibold text-destructive-foreground disabled:opacity-50"
                >
                  {t("report.alsoBlock")}
                </button>
                <button type="button" onClick={() => onOpenChange(false)} className="h-12 w-full rounded-full bg-secondary font-semibold">
                  {t("report.done")}
                </button>
              </div>
            )}

            {(step === "confirmBlock" || step === "confirmRemove") && (
              <div className="space-y-3 text-center">
                <p className="px-4 text-sm text-muted-foreground">
                  {t(step === "confirmBlock" ? "friends.blockConfirm" : "friends.removeConfirm")}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act.mutate(step === "confirmBlock" ? "block" : "remove")}
                  className="h-12 w-full rounded-full bg-destructive font-semibold text-destructive-foreground disabled:opacity-50"
                >
                  {t(step === "confirmBlock" ? "friends.block" : "friends.remove")}
                </button>
                <button type="button" onClick={() => setStep("menu")} className="h-12 w-full rounded-full bg-secondary font-semibold">
                  {t("common.cancel")}
                </button>
              </div>
            )}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
