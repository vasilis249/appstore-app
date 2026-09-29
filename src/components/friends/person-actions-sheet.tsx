import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Ban, Flag, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { UserAvatar } from "@/components/user-avatar";
import { blockUser, friendKeys, removeFriend, reportUser, rpcErrorKey, type Person } from "@/lib/friends";

type Step = "menu" | "confirmBlock" | "confirmRemove";

/** Secondary actions for a person: remove friend, block, report (each destructive one confirmed). */
export function PersonActionsSheet({
  person,
  onOpenChange,
}: {
  person: Person | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("menu");
  useEffect(() => setStep("menu"), [person?.id]);

  const run = useMutation({
    mutationFn: async (action: "remove" | "block" | "report") => {
      if (!person) return;
      if (action === "remove") await removeFriend(person.id);
      if (action === "block") await blockUser(person.id);
      if (action === "report") await reportUser(person.id);
      return action;
    },
    onSuccess: (action) => {
      void qc.invalidateQueries({ queryKey: friendKeys.all });
      toast.success(t(`friends.done.${action}`));
      onOpenChange(false);
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  const row = "flex w-full items-center gap-3 px-4 py-3.5 text-base font-medium disabled:opacity-50";
  const name = person ? person.full_name || person.username : "";

  return (
    <Drawer open={!!person} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg rounded-t-[28px] border-0 bg-surface-elevated">
        <DrawerTitle className="sr-only">{name}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("friends.actions")}</DrawerDescription>
        {person && (
          <div className="safe-bottom p-4">
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
              <UserAvatar name={name} path={person.avatar_path} size={72} />
              <p className="text-lg font-bold">{name}</p>
              <p className="-mt-2 text-sm text-muted-foreground">{person.username}</p>
            </div>

            {step === "menu" && (
              <div className="divide-y divide-border overflow-hidden rounded-2xl bg-secondary">
                {person.relation === "friends" && (
                  <button type="button" className={row} onClick={() => setStep("confirmRemove")}>
                    <UserMinus className="h-5 w-5" /> {t("friends.remove")}
                  </button>
                )}
                <button type="button" className={row} disabled={run.isPending} onClick={() => run.mutate("report")}>
                  <Flag className="h-5 w-5" /> {t("friends.report")}
                </button>
                <button type="button" className={`${row} text-destructive`} onClick={() => setStep("confirmBlock")}>
                  <Ban className="h-5 w-5" /> {t("friends.block")}
                </button>
              </div>
            )}

            {step !== "menu" && (
              <div className="space-y-3 text-center">
                <p className="px-4 text-sm text-muted-foreground">
                  {t(step === "confirmBlock" ? "friends.blockConfirm" : "friends.removeConfirm")}
                </p>
                <button
                  type="button"
                  disabled={run.isPending}
                  onClick={() => run.mutate(step === "confirmBlock" ? "block" : "remove")}
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
