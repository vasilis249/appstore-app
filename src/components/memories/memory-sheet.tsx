import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { ClipPlayer } from "@/components/voice/clip-player";
import { dailyKeys, deleteDaily, fetchPostAudio } from "@/lib/daily";
import { rpcErrorKey } from "@/lib/friends";
import { momentDate, type Memory } from "@/lib/memories";

/** Replay (or delete) one of your past daily voices. */
export function MemorySheet({ memory, onOpenChange }: { memory: Memory | null; onOpenChange: (o: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setConfirm(false), [memory?.id]);

  const del = useMutation({
    mutationFn: () => deleteDaily({ post_id: memory!.id, audio_path: memory!.audio_path }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: dailyKeys.all });
      onOpenChange(false);
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  const title = memory
    ? momentDate(memory.moment).toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";
  const time = memory
    ? new Date(memory.created_at).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <Drawer open={!!memory} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg rounded-t-[28px] border-0 bg-surface-elevated">
        <DrawerTitle className="pt-4 text-center text-lg font-bold first-letter:uppercase">{title}</DrawerTitle>
        <DrawerDescription className="text-center text-sm text-muted-foreground">
          {time}
          {memory?.late && ` · ${t("daily.late")}`}
        </DrawerDescription>
        {memory && (
          <div className="safe-bottom space-y-4 p-4">
            <ClipPlayer id={memory.id} durationMs={memory.duration_ms} load={() => fetchPostAudio(memory.audio_path)} />
            <button
              type="button"
              disabled={del.isPending}
              onClick={() => (confirm ? del.mutate() : setConfirm(true))}
              className="mx-auto block h-10 rounded-full px-5 text-sm font-semibold text-destructive disabled:opacity-50"
            >
              {confirm ? t("daily.deleteConfirm") : t("daily.delete")}
            </button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
