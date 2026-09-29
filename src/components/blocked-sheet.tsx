import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { PersonRow, PillButton } from "@/components/friends/person-row";
import { friendKeys, listBlocked, rpcErrorKey, unblockUser } from "@/lib/friends";

/** Settings → Blocked accounts, with Unblock. */
export function BlockedSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: friendKeys.blocked, queryFn: listBlocked, enabled: open });
  const unblock = useMutation({
    mutationFn: unblockUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: friendKeys.all }),
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange} nested>
      <DrawerContent className="mx-auto h-[70vh] max-w-lg rounded-t-[28px] border-0 bg-surface-elevated">
        <DrawerTitle className="pt-4 text-center text-lg font-bold">{t("settings.blocked")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("settings.blocked")}</DrawerDescription>
        <ul className="safe-bottom flex-1 overflow-y-auto px-4 py-2">
          {list.data && !list.data.length && (
            <p className="py-12 text-center text-sm text-muted-foreground">{t("settings.noBlocked")}</p>
          )}
          {(list.data ?? []).map((p) => (
            <PersonRow key={p.id} person={p}>
              <PillButton disabled={unblock.isPending} onClick={() => unblock.mutate(p.id)}>
                {t("settings.unblock")}
              </PillButton>
            </PersonRow>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
