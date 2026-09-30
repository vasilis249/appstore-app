import { GraduationCap, User } from "lucide-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { VoiceRecorder, type Clip } from "@/components/voice/voice-recorder";
import { useAuth } from "@/hooks/use-auth";
import { useSections } from "@/hooks/use-sections";
import { useMyProfile } from "@/hooks/use-my-profile";
import { useCampus } from "@/lib/campus";
import { formatClock } from "@/lib/audio";
import { rpcErrorKey } from "@/lib/friends";
import { createPost, fetchFeed, getTopic, POST_MAX_MS, postKeys, TITLE_MAX } from "@/lib/posts";
import { groupDetail, groupKeys } from "@/lib/groups";
import { takePendingClip } from "@/lib/pending-clip";
import { promptPermission, requestPromptPermission, syncDailyPrompts } from "@/lib/prompt-notifications";
import { cn } from "@/lib/utils";

type Search = { section?: string; topic?: string; reply?: string; quote?: string; group?: string; news?: 1; campus?: 1 };

export const Route = createFileRoute("/_authenticated/record")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
    return {
      section: str(s.section), topic: str(s.topic), reply: str(s.reply), quote: str(s.quote), group: str(s.group),
      news: s.news ? 1 : undefined, campus: s.campus ? 1 : undefined,
    };
  },
  component: ComposePage,
});

/**
 * New voice post (≤ 2 min): personal (shown under Following) or filed in a news section, on a topic, in a group,
 * on your campus (`?campus=1`: students of your university only, in a student section or none), as a reply or a quote.
 */
function ComposePage() {
  const search = Route.useSearch();
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { sections, campusSections, name, icon } = useSections();
  const me = useMyProfile();
  const campus = useCampus();
  const [clip, setClip] = useState<Clip | null>(null);
  // Held the nav button somewhere → the voice is already recorded.
  const [initialClip] = useState(() => takePendingClip());
  const [title, setTitle] = useState("");
  // "personal" or a section id; null = not chosen yet (came from News → must pick a section).
  const [place, setPlace] = useState<string | null>(search.section ?? (search.news ? null : "personal"));
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
  const needsPlace = !campusMode && !search.topic && !search.reply && !search.quote && !search.group;
  // On campus: "general" or a student section.
  const [campusPlace, setCampusPlace] = useState(search.section ?? "general");
  const verified = !!me.data?.university_id;

  const post = useMutation({
    mutationFn: () =>
      createPost(user!.id, clip!, {
        section: campusMode
          ? campusPlace === "general"
            ? undefined
            : campusPlace
          : needsPlace && place !== "personal"
            ? (place ?? undefined)
            : undefined,
        campus: campusMode,
        topic: search.topic,
        replyTo: search.reply,
        quoteOf: search.quote,
        title: search.reply ? undefined : title,
        group: search.reply ? undefined : search.group,
      }),
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: postKeys.all });
      void qc.invalidateQueries({ queryKey: groupKeys.all });
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
  const ready = !!clip && (!needsPlace || !!place) && (!campusMode || verified) && !post.isPending;

  return (
    <>
      <AppHeader back title={heading} />
      <div className="flex flex-1 flex-col gap-5 px-4 pt-2">
        {topic.data && (
          <div className="rounded-2xl bg-card p-3 ring-1 ring-border">
            <p className="text-fine text-muted-foreground">{name(topic.data.section_id)}</p>
            <p className="font-semibold leading-snug">{topic.data.title}</p>
          </div>
        )}
        {campusMode && (
          <div className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border">
            <GraduationCap className="h-5 w-5 shrink-0 text-link" />
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{t("campus.postingIn", { uni: campus.label({ university_id: me.data?.university_id }) || "…" })}</p>
              <p className="text-fine text-muted-foreground">{verified || !me.data ? t("campus.postingHint") : t("campus.locked")}</p>
            </div>
          </div>
        )}
        {group.data && (
          <div className="rounded-2xl bg-card p-3 ring-1 ring-border">
            <p className="text-fine text-muted-foreground">{t("groups.postingIn")}</p>
            <p className="font-semibold leading-snug">{group.data.name}</p>
          </div>
        )}
        {p && (
          <div className="rounded-2xl bg-card p-3 ring-1 ring-border">
            <p className="text-fine text-muted-foreground">
              {search.reply ? t("posts.replyingTo") : t("posts.quoting")} @{p.author_username} · {formatClock(p.duration_ms ?? 0)}
            </p>
            {p.title && <p className="font-semibold leading-snug">{p.title}</p>}
          </div>
        )}

        <VoiceRecorder maxMs={POST_MAX_MS} onChange={onChange} initialClip={initialClip} />

        {!search.reply && (
          <label className="block">
            <input
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("posts.titlePlaceholder")}
              className="h-12 w-full rounded-2xl bg-secondary px-4 text-body outline-none placeholder:text-muted-foreground"
            />
            <span className="mt-1 block text-right text-fine text-muted-foreground">{title.length}/{TITLE_MAX}</span>
          </label>
        )}

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

        {needsPlace && (
          <div>
            <p className="mb-2 text-caption font-semibold">{t("posts.where")}</p>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {[{ id: "personal" }, ...sections].map((s) => {
                const Icon = s.id === "personal" ? User : icon(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPlace(s.id)}
                    aria-pressed={place === s.id}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-caption font-semibold",
                      place === s.id ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                  >
                    <Icon className="h-4 w-4" /> {s.id === "personal" ? t("posts.personal") : name(s.id)}
                  </button>
                );
              })}
            </div>
            {place && (
              <p className="mt-2 text-fine text-muted-foreground">
                {place === "personal" ? t("posts.personalHint") : t("posts.newsHint", { section: name(place) })}
              </p>
            )}
          </div>
        )}

        <div className="safe-bottom sticky bottom-0 -mx-4 mt-auto bg-background px-4 pb-3 pt-2">
          <button
            type="button"
            disabled={!ready}
            onClick={() => post.mutate()}
            className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-40"
          >
            {post.isPending ? t("common.saving") : t("posts.publish")}
          </button>
        </div>
      </div>
    </>
  );
}
