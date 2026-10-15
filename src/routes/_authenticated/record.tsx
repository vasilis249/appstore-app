import { Camera, GraduationCap, ImagePlus, X } from "lucide-react";
import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { VoiceRecorder, type Clip } from "@/components/voice/voice-recorder";
import { useAuth } from "@/hooks/use-auth";
import { useSections } from "@/hooks/use-sections";
import { useMyProfile } from "@/hooks/use-my-profile";
import { useCampus } from "@/lib/campus";
import { formatClock } from "@/lib/audio";
import { rpcErrorKey } from "@/lib/friends";
import { createPost, fetchFeed, getTopic, PHOTOS_MAX, POST_MAX_MS, postKeys, TEXT_MAX } from "@/lib/posts";
import { compressImage } from "@/lib/image";
import { UserAvatar } from "@/components/user-avatar";
import { groupDetail, groupKeys } from "@/lib/groups";
import { takePendingClip } from "@/lib/pending-clip";
import { promptPermission, requestPromptPermission, syncDailyPrompts } from "@/lib/prompt-notifications";
import { cn } from "@/lib/utils";

type Search = { section?: string; topic?: string; reply?: string; quote?: string; group?: string; campus?: 1 };

export const Route = createFileRoute("/_authenticated/record")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
    return {
      section: str(s.section), topic: str(s.topic), reply: str(s.reply), quote: str(s.quote), group: str(s.group),
      campus: s.campus ? 1 : undefined,
    };
  },
  component: ComposePage,
});

/**
 * New post, like X: text (≤ 280), up to 4 photos (resized on the phone) and / or a voice (≤ 2 min, hold the drop).
 * Personal (shown under Following), on a topic, in a group, on your campus (`?campus=1`:
 * students of your university only, in a student section or none), as a reply or a quote.
 */
function ComposePage() {
  const search = Route.useSearch();
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { campusSections, name, icon } = useSections();
  const me = useMyProfile();
  const campus = useCampus();
  const [clip, setClip] = useState<Clip | null>(null);
  // Held the nav button somewhere → the voice is already recorded.
  const [initialClip] = useState(() => takePendingClip());
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const pick = useRef<HTMLInputElement>(null);
  const shoot = useRef<HTMLInputElement>(null);
  // the previews' object URLs go with the screen
  const urls = useRef<string[]>([]);
  urls.current = photos.map((x) => x.url);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  async function addPhotos(files: FileList | null) {
    const room = PHOTOS_MAX - photos.length;
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room));
    try {
      const blobs = await Promise.all(list.map((f) => compressImage(f)));
      setPhotos((cur) => [...cur, ...blobs.map((blob) => ({ blob, url: URL.createObjectURL(blob) }))].slice(0, PHOTOS_MAX));
    } catch {
      toast.error(t("posts.photoFailed"));
    }
  }
  function removePhoto(i: number) {
    setPhotos((cur) => {
      URL.revokeObjectURL(cur[i].url);
      return cur.filter((_, j) => j !== i);
    });
  }
  const onChange = useCallback((c: Clip | null) => setClip(c), []);

  const topic = useQuery({ queryKey: postKeys.topic(search.topic ?? ""), queryFn: () => getTopic(search.topic!), enabled: !!search.topic });
  const parentId = search.reply ?? search.quote;
  const parent = useQuery({
    queryKey: postKeys.feed({ scope: "one", parent: parentId }),
    queryFn: () => fetchFeed({ scope: "one", parent: parentId }),
    enabled: !!parentId,
  });
  const p = parent.data?.[0];
  const group = useQuery({ queryKey: groupKeys.detail(search.group ?? ""), queryFn: () => groupDetail(search.group!), enabled: !!search.group });
  const campusMode = !!search.campus && !search.topic && !search.reply && !search.quote && !search.group;
  // On campus: "general" or a student section.
  const [campusPlace, setCampusPlace] = useState(search.section ?? "general");
  const verified = !!me.data?.university_id;

  const post = useMutation({
    mutationFn: () =>
      createPost(user!.id, { clip, text, photos: photos.map((x) => x.blob) }, {
        // General news sections are off for the launch: anything not on campus / a topic / a group is personal.
        section: campusMode && campusPlace !== "general" ? campusPlace : undefined,
        campus: campusMode,
        topic: search.topic,
        replyTo: search.reply,
        quoteOf: search.quote,
        group: search.reply ? undefined : search.group,
      }),
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: postKeys.all });
      void qc.invalidateQueries({ queryKey: groupKeys.all });
      published.current = true;
      toast.success(t("posts.published"));
      if (search.reply) void navigate({ to: "/p/$postId", params: { postId: search.reply }, replace: true });
      else if (search.topic) void navigate({ to: "/t/$topicId", params: { topicId: search.topic }, replace: true });
      else if (search.group) void navigate({ to: "/g/$groupId", params: { groupId: search.group }, replace: true });
      else void navigate({ to: "/p/$postId", params: { postId: id }, replace: true });
      // Good moment to offer the daily-topic reminder.
      if ((await promptPermission()) === "prompt" && (await requestPromptPermission()) === "granted") void syncDailyPrompts();
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  const heading = search.reply ? t("posts.reply") : search.quote ? t("posts.quote") : t("posts.newPost");
  const left = TEXT_MAX - text.length;
  const hasContent = !!clip || !!text.trim() || photos.length > 0;
  const ready = hasContent && left >= 0 && (!campusMode || verified) && !post.isPending;
  const myName = me.data?.full_name || me.data?.username || "";
  // Leaving with text, photos or a voice asks first: back (or a tab) used to throw the draft away without a word.
  const published = useRef(false);
  const dirty = useRef(false);
  dirty.current = hasContent;
  const blocks = () => dirty.current && !published.current;
  const leave = useBlocker({ shouldBlockFn: blocks, enableBeforeUnload: blocks, withResolver: true });

  return (
    <>
      <AppHeader
        back
        title={heading}
        right={
          <button
            type="button"
            disabled={!ready}
            onClick={() => post.mutate()}
            className="h-10 rounded-full bg-primary px-4 text-callout font-semibold text-primary-foreground disabled:opacity-40"
          >
            {post.isPending ? t("common.saving") : t("posts.publish")}
          </button>
        }
      />
      <div className="flex flex-1 flex-col gap-4 px-4 pt-2">
        {topic.data && (
          <div className="rounded-2xl bg-card p-3">
            <p className="text-fine text-muted-foreground">{name(topic.data.section_id)}</p>
            <p className="font-semibold leading-snug">{topic.data.title}</p>
          </div>
        )}
        {campusMode && (
          <div className="flex items-center gap-3 rounded-2xl bg-card p-3">
            <GraduationCap className="h-5 w-5 shrink-0 text-link" />
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{t("campus.postingIn", { uni: campus.label({ university_id: me.data?.university_id }) || "…" })}</p>
              <p className="text-fine text-muted-foreground">{verified || !me.data ? t("campus.postingHint") : t("campus.locked")}</p>
            </div>
          </div>
        )}
        {group.data && (
          <div className="rounded-2xl bg-card p-3">
            <p className="text-fine text-muted-foreground">{t("groups.postingIn")}</p>
            <p className="font-semibold leading-snug">{group.data.name}</p>
          </div>
        )}
        {p && (
          <div className="rounded-2xl bg-card p-3">
            <p className="text-fine text-muted-foreground">
              {search.reply ? t("posts.replyingTo") : t("posts.quoting")} @{p.author_username}
              {p.duration_ms ? ` · ${formatClock(p.duration_ms)}` : ""}
            </p>
            {p.title && <p className="line-clamp-3 font-semibold leading-snug">{p.title}</p>}
          </div>
        )}

        <div className="flex gap-3">
          <UserAvatar name={myName} path={me.data?.avatar_path ?? null} size={40} />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <label className="block">
              <span className="sr-only">{search.reply ? t("posts.replyPlaceholder") : t("posts.textPlaceholder")}</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder={search.reply ? t("posts.replyPlaceholder") : t("posts.textPlaceholder")}
                className="min-h-24 w-full resize-none border-0 bg-transparent pt-2 text-tagline font-normal leading-snug outline-none placeholder:text-muted-foreground focus-visible:shadow-none"
              />
            </label>
            {photos.length > 0 && (
              <div className="no-scrollbar -mr-4 flex gap-2 overflow-x-auto pr-4">
                {photos.map((ph, i) => (
                  <div key={ph.url} className="relative h-44 w-36 shrink-0 overflow-hidden rounded-2xl bg-secondary animate-scale-in">
                    <img src={ph.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label={t("posts.removePhoto")}
                      className="glass absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full"
                    >
                      <X className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                  </div>
                ))}
                {photos.length < PHOTOS_MAX && (
                  <button
                    type="button"
                    onClick={() => pick.current?.click()}
                    aria-label={t("posts.addPhoto")}
                    className="flex h-44 w-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-input text-caption text-muted-foreground"
                  >
                    <ImagePlus className="h-6 w-6" strokeWidth={1.8} />
                    {t("posts.photoCount", { n: photos.length, max: PHOTOS_MAX })}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {campusMode && (
          <div>
            <p className="mb-2 text-caption font-semibold">{t("posts.where")}</p>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {[{ id: "general" }, ...campusSections].map((s) => {
                const Icon = s.id === "general" ? GraduationCap : icon(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCampusPlace(s.id)}
                    aria-pressed={campusPlace === s.id}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-caption font-semibold",
                      campusPlace === s.id ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                  >
                    <Icon className="h-4 w-4" /> {s.id === "general" ? t("campus.general") : name(s.id)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 mt-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2">
          <VoiceRecorder maxMs={POST_MAX_MS} onChange={onChange} initialClip={initialClip}>
            <button type="button" onClick={() => pick.current?.click()} disabled={photos.length >= PHOTOS_MAX} aria-label={t("posts.photos")} className="grid h-11 w-11 place-items-center rounded-full text-link disabled:opacity-40">
              <ImagePlus className="h-[22px] w-[22px]" strokeWidth={1.8} />
            </button>
            <button type="button" onClick={() => shoot.current?.click()} disabled={photos.length >= PHOTOS_MAX} aria-label={t("posts.camera")} className="grid h-11 w-11 place-items-center rounded-full text-link disabled:opacity-40">
              <Camera className="h-[22px] w-[22px]" strokeWidth={1.8} />
            </button>
            <span className="ml-auto flex items-center gap-2 pr-2 text-caption tabular-nums text-muted-foreground" aria-label={t("posts.charsLeft", { count: left })}>
              <svg viewBox="0 0 28 28" className="h-6 w-6 -rotate-90" aria-hidden>
                <circle cx="14" cy="14" r="11" fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
                <circle
                  cx="14" cy="14" r="11" fill="none" strokeWidth="3" strokeLinecap="round" stroke="currentColor"
                  className={left < 0 ? "text-live" : left <= 20 ? "text-link" : "text-foreground"}
                  strokeDasharray={69.11} strokeDashoffset={69.11 * (1 - Math.min(1, text.length / TEXT_MAX))}
                />
              </svg>
              {left <= 20 && <span className={left < 0 ? "text-live" : undefined}>{left}</span>}
            </span>
          </VoiceRecorder>
          <input ref={pick} type="file" accept="image/*" multiple hidden onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
          <input ref={shoot} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
        </div>
      </div>
      <Drawer open={leave.status === "blocked"} onOpenChange={(o) => !o && leave.reset?.()}>
        <DrawerContent className="mx-auto max-w-lg">
          <DrawerTitle className="px-4 pt-2 text-center text-tagline font-semibold">{t("posts.discardTitle")}</DrawerTitle>
          <DrawerDescription className="px-6 pt-1 text-center text-caption text-muted-foreground">{t("posts.discardText")}</DrawerDescription>
          <div className="safe-bottom flex flex-col gap-2 p-4">
            <button type="button" onClick={() => leave.proceed?.()} className="h-12 w-full rounded-2xl bg-group text-body font-semibold text-destructive">
              {t("posts.discard")}
            </button>
            <button type="button" onClick={() => leave.reset?.()} className="h-12 w-full rounded-2xl bg-secondary text-body font-semibold">
              {t("posts.keepEditing")}
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
