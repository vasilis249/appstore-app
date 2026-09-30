import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { PersonActionsSheet } from "@/components/friends/person-actions-sheet";
import { useAuth } from "@/hooks/use-auth";
import { deletePost, postKeys, type PostView } from "@/lib/posts";
import { rpcErrorKey } from "@/lib/friends";

/** ⋯ on a post: delete your own (confirmed), or report / block for others' posts. */
export function PostMenu({ post, onOpenChange }: { post: PostView | null; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setConfirm(false), [post?.id]);
  const mine = !!post && post.authorId === user?.id;

  const del = useMutation({
    mutationFn: () => deletePost({ post_id: post!.id, audio_path: post!.path }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: postKeys.all });
      onOpenChange(false);
      toast.success(t("posts.deleted"));
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  if (post && !mine) {
    return (
      <PersonActionsSheet
        person={{ id: post.authorId, username: post.username, full_name: post.name, avatar_path: post.avatar }}
        report={{ kind: "post", id: post.id, label: t("report.post") }}
        onOpenChange={onOpenChange}
      />
    );
  }
  return (
    <Drawer open={!!post} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerTitle className="sr-only">{t("friends.actions")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("friends.actions")}</DrawerDescription>
        <div className="safe-bottom p-4">
          <button
            type="button"
            disabled={del.isPending}
            onClick={() => (confirm ? del.mutate() : setConfirm(true))}
            className="h-12 w-full rounded-2xl bg-group text-body text-destructive disabled:opacity-50"
          >
            {confirm ? t("daily.deleteConfirm") : t("posts.delete")}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
