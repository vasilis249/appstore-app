import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Mic, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { postKeys, repost, unrepost, type PostView } from "@/lib/posts";
import { rpcErrorKey } from "@/lib/friends";

/** Repost / undo, or quote with your own voice. */
export function RepostSheet({ post, onOpenChange }: { post: PostView | null; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const run = useMutation({
    mutationFn: () => (post!.reposted ? unrepost(post!.id) : repost(post!.id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: postKeys.all });
      onOpenChange(false);
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });
  const row = "flex w-full items-center gap-3 px-4 py-3.5 text-base font-medium disabled:opacity-50";
  return (
    <Drawer open={!!post} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg rounded-t-[28px] border-0 bg-surface-elevated">
        <DrawerTitle className="sr-only">{t("posts.repost")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("posts.repost")}</DrawerDescription>
        <div className="safe-bottom p-4">
          <div className="divide-y divide-border overflow-hidden rounded-2xl bg-secondary">
            <button type="button" className={row} disabled={run.isPending} onClick={() => run.mutate()}>
              <Repeat2 className="h-5 w-5" /> {post?.reposted ? t("posts.undoRepost") : t("posts.repost")}
            </button>
            <button
              type="button"
              className={row}
              onClick={() => {
                onOpenChange(false);
                void navigate({ to: "/record", search: { quote: post!.id } });
              }}
            >
              <Mic className="h-5 w-5" /> {t("posts.quote")}
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
