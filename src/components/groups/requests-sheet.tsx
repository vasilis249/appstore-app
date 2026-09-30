import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { PersonRow } from "@/components/friends/person-row";
import { rpcErrorKey } from "@/lib/friends";
import { groupKeys, groupRequests, respondRequest } from "@/lib/groups";

/** Admins: people asking to join a private group — Accept or ✕. */
export function RequestsSheet({ groupId, open, onOpenChange }: { groupId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: groupKeys.requests(groupId), queryFn: () => groupRequests(groupId), enabled: open });
  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => respondRequest(groupId, id, accept),
    onSuccess: () => void qc.invalidateQueries({ queryKey: groupKeys.all }),
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[80vh] max-w-lg">
        <DrawerTitle className="pt-4 text-center text-body font-semibold">{t("groups.requests")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("groups.requests")}</DrawerDescription>
        <ul className="safe-bottom overflow-y-auto px-4 pb-4">
          {(list.data ?? []).map((p) => (
            <PersonRow key={p.user_id} person={p}>
              <button
                type="button"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ id: p.user_id, accept: true })}
                className="h-9 rounded-full bg-primary px-4 text-caption font-semibold text-primary-foreground disabled:opacity-50"
              >
                {t("groups.accept")}
              </button>
              <button
                type="button"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ id: p.user_id, accept: false })}
                aria-label={t("groups.decline")}
                className="grid h-9 w-9 place-items-center rounded-full bg-secondary disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </PersonRow>
          ))}
          {list.data && !list.data.length && <p className="py-10 text-center text-caption text-muted-foreground">{t("groups.noRequests")}</p>}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
