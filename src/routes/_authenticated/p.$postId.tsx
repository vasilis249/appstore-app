import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { PostCard } from "@/components/social/post-card";
import { UserAvatar } from "@/components/social/user-avatar";
import { RichText } from "@/components/social/rich-text";
import { timeAgo } from "@/lib/time-ago";
import { addComment, deleteComment, getPost, listComments } from "@/lib/api/posts.functions";

export const Route = createFileRoute("/_authenticated/p/$postId")({
  head: () => ({ meta: [{ title: "Courtsie" }] }),
  component: PostPage,
});

function PostPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";
  const { postId } = Route.useParams();
  const qc = useQueryClient();
  const getPostFn = useServerFn(getPost);
  const listCommentsFn = useServerFn(listComments);
  const addFn = useServerFn(addComment);
  const deleteFn = useServerFn(deleteComment);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const postQ = useQuery({
    queryKey: ["post", postId],
    queryFn: () => getPostFn({ data: { postId } }),
    retry: false,
  });
  const commentsQ = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => listCommentsFn({ data: { postId } }),
  });

  async function send() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await addFn({ data: { postId, body: text } });
      setBody("");
      void qc.invalidateQueries({ queryKey: ["comments", postId] });
      void qc.invalidateQueries({ queryKey: ["feed"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function remove(commentId: string) {
    await deleteFn({ data: { commentId } });
    void qc.invalidateQueries({ queryKey: ["comments", postId] });
  }

  if (postQ.isLoading)
    return <p className="py-16 text-center text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!postQ.data)
    return <p className="py-16 text-center text-sm text-muted-foreground">{t("posts.notFound")}</p>;

  return (
    <div className="mx-auto max-w-xl pb-40 sm:pt-6">
      <PostCard post={postQ.data} showAllComments />

      <ul className="space-y-4 px-3 py-4">
        {(commentsQ.data ?? []).map((c) => (
          <li key={c.id} className="flex gap-3">
            <Link to="/u/$username" params={{ username: c.author.username }}>
              <UserAvatar
                name={c.author.full_name ?? c.author.username}
                photoUrl={c.author.photo_url}
                size={32}
              />
            </Link>
            <div className="min-w-0 flex-1 text-sm">
              <p className="whitespace-pre-line break-words">
                <Link
                  to="/u/$username"
                  params={{ username: c.author.username }}
                  className="mr-1.5 font-semibold"
                >
                  {c.author.username}
                </Link>
                <RichText text={c.body} />
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {timeAgo(c.created_at, locale)}
              </p>
            </div>
            {c.canDelete && (
              <button
                type="button"
                aria-label={t("posts.deleteComment")}
                onClick={() => remove(c.id)}
                className="self-start p-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-30 border-t border-border bg-background/95 px-3 py-2 backdrop-blur md:bottom-0"
      >
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            placeholder={t("posts.addComment")}
            className="h-11 flex-1 rounded-full border border-border bg-card px-4 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={!body.trim() || sending}
            className="px-2 text-sm font-semibold text-primary disabled:opacity-40"
          >
            {t("posts.post")}
          </button>
        </div>
      </form>
    </div>
  );
}
