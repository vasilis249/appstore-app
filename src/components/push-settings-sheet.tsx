import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { rpcErrorKey } from "@/lib/friends";
import { pushSettings, pushSettingsKey, setPushSetting, type PushCategory } from "@/lib/push";

/** Which notifications reach the phone, per category. The list in the app keeps everything either way. */
export function PushSettingsSheet({
  open,
  onOpenChange,
  nested = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  nested?: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: pushSettingsKey, queryFn: pushSettings, enabled: open });
  const change = useMutation({
    mutationFn: ({ category, on }: { category: PushCategory; on: boolean }) =>
      setPushSetting(category, on),
    onMutate: ({ category, on }) =>
      qc.setQueryData(
        pushSettingsKey,
        (old: { category: PushCategory; push: boolean }[] | undefined) =>
          old?.map((x) => (x.category === category ? { ...x, push: on } : x)),
      ),
    onError: (e) => {
      void qc.invalidateQueries({ queryKey: pushSettingsKey });
      toast.error(t(rpcErrorKey(e)));
    },
  });
  return (
    <Drawer open={open} onOpenChange={onOpenChange} nested={nested}>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerTitle className="pt-4 text-center text-body font-semibold">
          {t("pushSettings.title")}
        </DrawerTitle>
        <DrawerDescription className="px-6 pt-1 text-center text-caption text-muted-foreground">
          {t("pushSettings.hint")}
        </DrawerDescription>
        <div className="safe-bottom p-4">
          <ul className="divide-y divide-border rounded-2xl bg-group">
            {(list.data ?? []).map((x) => (
              <li key={x.category}>
                <label className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-body">{t(`pushSettings.${x.category}`)}</span>
                    <span className="block text-caption text-muted-foreground">
                      {t(`pushSettings.${x.category}Hint`)}
                    </span>
                  </span>
                  <Switch
                    checked={x.push}
                    onCheckedChange={(on) => change.mutate({ category: x.category, on })}
                  />
                </label>
              </li>
            ))}
          </ul>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
