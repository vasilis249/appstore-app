import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trophy, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { compressImage } from "@/lib/image";
import { cn } from "@/lib/utils";
import { createPost, listMyRecentMatches, type RecentMatch } from "@/lib/api/posts.functions";

const MAX_PHOTOS = 5;

/** New post: up to 5 photos + caption, optionally tagged with a recent match. */
export function CreatePostSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";
  const { user } = useAuth();
  const qc = useQueryClient();
  const createFn = useServerFn(createPost);
  const matchesFn = useServerFn(listMyRecentMatches);
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [match, setMatch] = useState<RecentMatch | null>(null);
  const [busy, setBusy] = useState(false);

  const matchesQ = useQuery({
    queryKey: ["recent-matches"],
    enabled: open,
    queryFn: () => matchesFn(),
  });

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function reset() {
    setFiles([]);
    setCaption("");
    setMatch(null);
  }

  function pick(list: FileList | null) {
    if (!list) return;
    setFiles((cur) => [...cur, ...Array.from(list)].slice(0, MAX_PHOTOS));
  }

  async function share() {
    if (!user || (!files.length && !match)) return;
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const media: string[] = [];
      for (const [i, f] of files.entries()) {
        const path = `${user.id}/${id}/${i}.jpg`;
        const { error } = await supabase.storage
          .from("social-media")
          .upload(path, await compressImage(f), { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        media.push(path);
      }
      await createFn({
        data: {
          id,
          media,
          caption: caption.trim() || null,
          venueId: match?.venueId ?? null,
          bookingId: match?.bookingId ?? null,
          openGameId: match?.openGameId ?? null,
        },
      });
      toast.success(t("posts.published"));
      reset();
      onOpenChange(false);
      void qc.invalidateQueries({ queryKey: ["feed"] });
      void qc.invalidateQueries({ queryKey: ["profile-posts"] });
      void qc.invalidateQueries({ queryKey: ["social-profile"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canShare = (files.length > 0 || !!match) && !busy;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[94vh] max-w-lg rounded-t-[28px] border-0 bg-background">
        <div className="flex items-center justify-between px-4 pt-3">
          <DrawerTitle className="font-display text-lg font-bold">{t("posts.new")}</DrawerTitle>
          <button
            type="button"
            disabled={!canShare}
            onClick={share}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("posts.publish")}
          </button>
        </div>
        <DrawerDescription className="sr-only">{t("posts.new")}</DrawerDescription>

        <div className="safe-bottom space-y-4 overflow-y-auto p-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = "";
            }}
          />
          {previews.length === 0 ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              <ImagePlus className="h-10 w-10" />
              <span className="text-sm font-semibold">{t("posts.pickPhotos")}</span>
              <span className="text-xs">{t("posts.pickHint", { max: MAX_PHOTOS })}</span>
            </button>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {previews.map((u, i) => (
                <div key={u} className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl">
                  <img src={u} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label={t("posts.removePhoto")}
                    onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {previews.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label={t("posts.pickPhotos")}
                  className="grid h-28 w-24 shrink-0 place-items-center rounded-xl border-2 border-dashed border-border text-muted-foreground"
                >
                  <ImagePlus className="h-6 w-6" />
                </button>
              )}
            </div>
          )}

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2200}
            rows={3}
            placeholder={t("posts.captionPh")}
            className="w-full resize-none rounded-2xl border border-border bg-card px-3 py-3 text-sm"
          />

          {(matchesQ.data?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Trophy className="h-4 w-4 text-optic" /> {t("posts.tagMatch")}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {matchesQ.data!.map((m) => {
                  const on = match?.key === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMatch(on ? null : m)}
                      className={cn(
                        "shrink-0 rounded-[14px] px-3 py-2 text-left text-xs transition",
                        on
                          ? "bg-primary text-primary-foreground shadow-glow"
                          : "bg-card shadow-sm ring-1 ring-border/60",
                      )}
                    >
                      <span className="block font-semibold">{m.venueName}</span>
                      <span className={on ? "opacity-90" : "text-muted-foreground"}>
                        {t(`sports.${m.sport}`)} ·{" "}
                        {new Date(m.date).toLocaleDateString(locale, {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!files.length && match && (
                <p className="mt-2 text-xs text-muted-foreground">{t("posts.matchOnlyHint")}</p>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
