import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Ban, Flag, Link2, MoreHorizontal } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { dmErrorKey } from "@/lib/dm-errors";
import { openDirect } from "@/lib/api/inbox.functions";
import { reportContent } from "@/lib/api/posts.functions";
import { blockUser } from "@/lib/api/community.functions";

/** "Message" button + ⋯ sheet (report, block, copy link) shown on other people's profiles. */
export function ProfileActions({
  userId,
  username,
  name,
}: {
  userId: string;
  username: string;
  name: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const openFn = useServerFn(openDirect);
  const reportFn = useServerFn(reportContent);
  const blockFn = useServerFn(blockUser);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const row = "flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium";

  async function message() {
    setBusy(true);
    try {
      const { id } = await openFn({ data: { userId } });
      navigate({ to: "/inbox/$conversationId", params: { conversationId: id } });
    } catch (e) {
      toast.error(t(dmErrorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    await reportFn({ data: { targetType: "profile", targetId: userId } });
    toast.success(t("dm.reported"));
    setMenu(false);
  }

  async function block() {
    try {
      await blockFn({ data: { userId } });
      toast.success(t("dm.blocked"));
      setMenu(false);
      void qc.invalidateQueries({ queryKey: ["social-profile"] });
      void qc.invalidateQueries({ queryKey: ["feed"] });
      void qc.invalidateQueries({ queryKey: ["inbox"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}/u/${username}`).catch(() => {});
    toast.success(t("posts.linkCopied"));
    setMenu(false);
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={message}
        className="h-10 flex-1 rounded-xl bg-secondary text-sm font-semibold transition hover:bg-muted disabled:opacity-60"
      >
        {t("dm.message")}
      </button>
      <button
        type="button"
        aria-label={t("posts.more")}
        onClick={() => setMenu(true)}
        className="grid h-10 w-10 place-items-center rounded-xl bg-secondary transition hover:bg-muted"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      <Drawer
        open={menu}
        onOpenChange={(o) => {
          setMenu(o);
          if (!o) setConfirmBlock(false);
        }}
      >
        <DrawerContent className="mx-auto max-w-lg rounded-t-[28px] border-0 bg-background">
          <DrawerTitle className="sr-only">{t("posts.more")}</DrawerTitle>
          <DrawerDescription className="sr-only">{t("posts.more")}</DrawerDescription>
          <div className="safe-bottom p-4">
            {confirmBlock ? (
              <div className="space-y-3 rounded-2xl bg-card p-4 text-center shadow-sm ring-1 ring-border/60">
                <p className="text-sm">{t("dm.confirmBlock", { name })}</p>
                <button
                  type="button"
                  onClick={block}
                  className="h-11 w-full rounded-xl bg-destructive text-sm font-semibold text-destructive-foreground"
                >
                  {t("dm.block")}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/60">
                <button type="button" onClick={report} className={cn(row, "text-destructive")}>
                  <Flag className="h-4 w-4" /> {t("dm.report")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBlock(true)}
                  className={cn(row, "text-destructive")}
                >
                  <Ban className="h-4 w-4" /> {t("dm.block")}
                </button>
                <button type="button" onClick={copy} className={row}>
                  <Link2 className="h-4 w-4" /> {t("posts.copyLink")}
                </button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
