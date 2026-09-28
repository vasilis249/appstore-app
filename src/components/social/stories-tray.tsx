import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { compressImage } from "@/lib/image";
import { UserAvatar } from "@/components/social/user-avatar";
import { StoryViewer } from "@/components/social/story-viewer";
import { createStory, getStoryTray } from "@/lib/api/stories.functions";

/** Row of story circles at the top of the feed; "Your story" first. */
export function StoriesTray({
  me,
}: {
  me: { username: string; full_name: string | null; photo_url: string | null };
}) {
  const { t } = useTranslation();
  const trayFn = useServerFn(getStoryTray);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const q = useQuery({ queryKey: ["story-tray"], queryFn: () => trayFn(), staleTime: 30_000 });
  const items = q.data?.items ?? [];
  const others = items.filter((i) => !i.isMe);
  const mine = items.find((i) => i.isMe);

  return (
    <>
      <div className="flex gap-4 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <YourStory
          me={me}
          hasStory={!!mine}
          onOpen={() => setViewerAt(items.findIndex((i) => i.isMe))}
        />
        {others.map((p) => (
          <button
            key={p.user_id}
            type="button"
            onClick={() => setViewerAt(items.indexOf(p))}
            className="flex w-[72px] shrink-0 flex-col items-center gap-1"
          >
            <UserAvatar
              name={p.full_name ?? p.username}
              photoUrl={p.photo_url}
              size={64}
              ring={p.has_unseen}
              className={p.has_unseen ? "" : "rounded-full p-[2.5px] ring-2 ring-border"}
            />
            <span className="w-full truncate text-center text-[11px]">{p.username}</span>
          </button>
        ))}
        {!q.isLoading && !others.length && (
          <p className="self-center pl-1 text-xs text-muted-foreground">{t("stories.emptyTray")}</p>
        )}
      </div>
      {viewerAt !== null && viewerAt >= 0 && (
        <StoryViewer people={items} startIndex={viewerAt} onClose={() => setViewerAt(null)} />
      )}
    </>
  );
}

/** Upload one photo as a 24h story. */
export function useStoryUpload() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const createFn = useServerFn(createStory);
  const [busy, setBusy] = useState(false);

  async function upload(file: File | undefined) {
    if (!file || !user) return;
    setBusy(true);
    try {
      const path = `${user.id}/stories/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from("social-media")
        .upload(path, await compressImage(file, 1440), { contentType: "image/jpeg" });
      if (error) throw error;
      await createFn({ data: { mediaPath: path, caption: null } });
      toast.success(t("stories.published"));
      void qc.invalidateQueries({ queryKey: ["story-tray"] });
      void qc.invalidateQueries({ queryKey: ["stories", user.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { upload, busy };
}

function YourStory({
  me,
  hasStory,
  onOpen,
}: {
  me: { username: string; full_name: string | null; photo_url: string | null };
  hasStory: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, busy } = useStoryUpload();

  return (
    <div className="flex w-[72px] shrink-0 flex-col items-center gap-1">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="relative">
        <button
          type="button"
          onClick={() => (hasStory ? onOpen() : fileRef.current?.click())}
          aria-label={t("stories.yours")}
        >
          <UserAvatar
            name={me.full_name ?? me.username}
            photoUrl={me.photo_url}
            size={64}
            ring={hasStory}
          />
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={t("stories.add")}
          className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>
      <span className="w-full truncate text-center text-[11px] text-muted-foreground">
        {t("stories.yours")}
      </span>
    </div>
  );
}
