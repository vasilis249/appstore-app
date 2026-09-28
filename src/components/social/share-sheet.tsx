import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Link2, Loader2, Search, Share } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { UserAvatar } from "@/components/social/user-avatar";
import { cn } from "@/lib/utils";
import { dmErrorKey } from "@/lib/dm-errors";
import { sharePost, shareTargets } from "@/lib/api/inbox.functions";

/** Instagram-style "Send to…" sheet: pick people, add a note, send as DMs. */
export function ShareSheet({
  postId,
  open,
  onOpenChange,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const targetsFn = useServerFn(shareTargets);
  const shareFn = useServerFn(sharePost);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    if (open) {
      setQ("");
      setPicked([]);
      setNote("");
    }
  }, [open]);

  const people = useQuery({
    queryKey: ["share-targets", debounced.length >= 2 ? debounced : ""],
    enabled: open,
    queryFn: () => targetsFn({ data: { q: debounced.length >= 2 ? debounced : undefined } }),
  });

  const url = typeof window !== "undefined" ? `${window.location.origin}/p/${postId}` : "";

  function toggle(id: string) {
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 10 ? [...cur, id] : cur,
    );
  }

  async function send() {
    setSending(true);
    try {
      await shareFn({ data: { postId, userIds: picked, note: note.trim() || undefined } });
      toast.success(t("dm.sent"));
      void qc.invalidateQueries({ queryKey: ["inbox"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(t(dmErrorKey(e)));
    } finally {
      setSending(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success(t("posts.linkCopied"));
    onOpenChange(false);
  }

  async function nativeShare() {
    try {
      await navigator.share({ url });
      onOpenChange(false);
    } catch {
      // dismissed
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto h-[80vh] max-w-lg rounded-t-[28px] border-0 bg-background">
        <DrawerTitle className="sr-only">{t("posts.share")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("posts.share")}</DrawerDescription>
        <div className="px-4 pt-3">
          <label className="flex h-10 items-center gap-2 rounded-xl bg-secondary px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("dm.searchPh")}
              autoCapitalize="none"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>

        <div className="grid flex-1 grid-cols-3 content-start gap-x-2 gap-y-4 overflow-y-auto px-4 py-4">
          {people.isLoading && (
            <Loader2 className="col-span-3 mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          )}
          {(people.data ?? []).map((p) => {
            const on = picked.includes(p.user_id);
            return (
              <button
                key={p.user_id}
                type="button"
                onClick={() => toggle(p.user_id)}
                className="flex flex-col items-center gap-1.5"
              >
                <span className="relative">
                  <UserAvatar name={p.full_name ?? p.username} photoUrl={p.photo_url} size={60} />
                  {on && (
                    <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </span>
                <span className={cn("w-full truncate text-center text-xs", on && "font-semibold")}>
                  {p.full_name ?? p.username}
                </span>
              </button>
            );
          })}
        </div>

        <div className="safe-bottom border-t border-border/60 p-4">
          {picked.length ? (
            <div className="space-y-3">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                placeholder={t("dm.notePh")}
                className="h-10 w-full rounded-xl bg-secondary px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                disabled={sending}
                onClick={send}
                className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
              >
                {sending ? "…" : t("dm.send")}
              </button>
            </div>
          ) : (
            <div className="flex justify-center gap-8">
              <RoundAction label={t("posts.copyLink")} onClick={copy}>
                <Link2 className="h-5 w-5" />
              </RoundAction>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <RoundAction label={t("dm.more")} onClick={nativeShare}>
                  <Share className="h-5 w-5" />
                </RoundAction>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function RoundAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5 text-xs">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary">
        {children}
      </span>
      {label}
    </button>
  );
}
