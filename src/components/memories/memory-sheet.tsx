import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { ClipPlayer } from "@/components/voice/clip-player";
import { useSections } from "@/hooks/use-sections";
import { rpcErrorKey } from "@/lib/friends";
import { momentDate, type Memory } from "@/lib/memories";
import { deletePost, postKeys, voiceUrl } from "@/lib/posts";

/** Replay (or delete) your voices of one day. */
export function MemorySheet({ memories, onOpenChange }: { memories: Memory[] | null; onOpenChange: (o: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { name } = useSections();
  const [confirm, setConfirm] = useState<string | null>(null);

  const del = useMutation({
    mutationFn: (m: Memory) => deletePost({ post_id: m.id, audio_path: m.audio_path }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: postKeys.all });
      onOpenChange(false);
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  const first = memories?.[0];
  const title = first
    ? momentDate(first.day).toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <Drawer open={!!memories?.length} onOpenChange={(o) => { setConfirm(null); onOpenChange(o); }}>
      <DrawerContent className="mx-auto max-h-[85vh] max-w-lg">
        <DrawerTitle className="pt-4 text-center text-body font-semibold first-letter:uppercase">{title}</DrawerTitle>
        <DrawerDescription className="sr-only">{title}</DrawerDescription>
        <ul className="safe-bottom space-y-4 overflow-y-auto p-4">
          {(memories ?? []).map((m) => (
            <li key={m.id} className="space-y-2">
              <p className="text-caption">
                <span className="font-semibold">{m.title ?? (m.section_id ? name(m.section_id) : t("posts.personal"))}</span>{" "}
                <span className="text-muted-foreground">
                  · {new Date(m.created_at).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </p>
              <ClipPlayer id={m.id} durationMs={m.duration_ms} load={() => fetch(voiceUrl(m.audio_path)).then((r) => r.blob())} />
              <button
                type="button"
                disabled={del.isPending}
                onClick={() => (confirm === m.id ? del.mutate(m) : setConfirm(m.id))}
                className="mx-auto block h-9 rounded-full px-4 text-caption font-semibold text-destructive disabled:opacity-50"
              >
                {confirm === m.id ? t("daily.deleteConfirm") : t("daily.delete")}
              </button>
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
