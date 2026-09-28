import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/api/account.functions";

/** In-app account deletion (required by the App Store when sign-up exists). */
export function DeleteAccountButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const deleteFn = useServerFn(deleteMyAccount);
  const [pending, setPending] = useState(false);

  async function onConfirm() {
    setPending(true);
    try {
      await deleteFn();
      await qc.cancelQueries();
      qc.clear();
      // The user no longer exists; drop the local session without calling the API.
      await supabase.auth.signOut({ scope: "local" });
      toast.success(t("account.deleted"));
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error((err as Error).message || t("account.deleteFailed"));
      setPending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-destructive transition hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" /> {t("account.delete")}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("account.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("account.deleteDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("account.deleteCancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? t("account.deleting") : t("account.deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
