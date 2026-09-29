import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { VoiceRecorder, type Clip } from "@/components/voice/voice-recorder";
import { useAuth } from "@/hooks/use-auth";
import { useSections } from "@/hooks/use-sections";
import { formatClock } from "@/lib/audio";
import { rpcErrorKey } from "@/lib/friends";
import { createPost, fetchFeed, getTopic, POST_MAX_MS, postKeys, TITLE_MAX } from "@/lib/posts";
import { promptPermission, requestPromptPermission, syncDailyPrompts } from "@/lib/prompt-notifications";
import { cn } from "@/lib/utils";

type Search = { section?: string; topic?: string; reply?: string; quote?: string };

export const Route = createFileRoute("/_authenticated/record")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
    return { section: str(s.section), topic: str(s.topic), reply: str(s.reply), quote: str(s.quote) };
  },
  component: ComposePage,
});

/** New voice post (≤ 2 min): in a section, on a topic, as a reply or as a quote. */
function ComposePage() {
  const search = Route.useSearch();
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { sections, name, icon } = useSections();
  const [clip, setClip] = useState<Clip | null>(null);
  const [title, setTitle] = useState("");
  const [section, setSection] = useState<string | undefined>(search.section);
  const onChange = useCallback((c: Clip | null) => setClip(c), []);

  const topic = useQuery({ queryKey: postKeys.topic(search.topic ?? ""), queryFn: () => getTopic(search.topic!), enabled: !!search.topic });
  const parentId = search.reply ?? search.quote;
  const parent = useQuery({
    queryKey: postKeys.feed({ scope: "one", parent: parentId }),
    queryFn: () => fetchFeed({ scope: "one", parent: parentId }),
    enabled: !!parentId,
  });
  const p = parent.data?.[0];
  const needsSection = !search.topic && !search.reply && !search.quote;

  const post = useMutation({
    mutationFn: () =>
      createPost(user!.id, clip!, {
        section: needsSection ? section : undefined,
        topic: search.topic,
        replyTo: search.reply,
        quoteOf: search.quote,
        title: search.reply ? undefined : title,
      }),
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: postKeys.all });
      toast.success(t("posts.published"));
      if (search.reply) void navigate({ to: "/p/$postId", params: { postId: search.reply }, replace: true });
      else if (search.topic) void navigate({ to: "/t/$topicId", params: { topicId: search.topic }, replace: true });
      else void navigate({ to: "/p/$postId", params: { postId: id }, replace: true });
      // Good moment to offer the daily-topic reminder.
      if ((await promptPermission()) === "prompt" && (await requestPromptPermission()) === "granted") void syncDailyPrompts();
    },
    onError: (e) => toast.error(t(rpcErrorKey(e))),
  });

  const heading = search.reply ? t("posts.reply") : search.quote ? t("posts.quote") : t("posts.newPost");
  const ready = !!clip && (!needsSection || !!section) && !post.isPending;

  return (
    <>
      <AppHeader back title={heading} />
      <div className="flex flex-1 flex-col gap-5 px-4 pb-8 pt-2">
        {topic.data && (
          <div className="rounded-2xl bg-card p-3 ring-1 ring-border">
            <p className="text-xs text-muted-foreground">{name(topic.data.section_id)}</p>
            <p className="font-semibold leading-snug">{topic.data.title}</p>
          </div>
        )}
        {p && (
          <div className="rounded-2xl bg-card p-3 ring-1 ring-border">
            <p className="text-xs text-muted-foreground">
              {search.reply ? t("posts.replyingTo") : t("posts.quoting")} @{p.author_username} · {formatClock(p.duration_ms ?? 0)}
            </p>
            {p.title && <p className="font-semibold leading-snug">{p.title}</p>}
          </div>
        )}

        <VoiceRecorder maxMs={POST_MAX_MS} onChange={onChange} />

        {!search.reply && (
          <label className="block">
            <input
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("posts.titlePlaceholder")}
              className="h-12 w-full rounded-2xl bg-secondary px-4 text-base outline-none placeholder:text-muted-foreground"
            />
            <span className="mt-1 block text-right text-xs text-muted-foreground">{title.length}/{TITLE_MAX}</span>
          </label>
        )}

        {needsSection && (
          <div>
            <p className="mb-2 text-sm font-semibold">{t("posts.chooseSection")}</p>
            <div className="flex flex-wrap gap-2">
              {sections.map((s) => {
                const Icon = icon(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    aria-pressed={section === s.id}
                    className={cn(
                      "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold",
                      section === s.id ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                  >
                    <Icon className="h-4 w-4" /> {name(s.id)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={!ready}
          onClick={() => post.mutate()}
          className="mt-auto h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-40"
        >
          {post.isPending ? t("common.saving") : t("posts.publish")}
        </button>
      </div>
    </>
  );
}
