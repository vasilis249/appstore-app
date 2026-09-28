import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Bookmark,
  Flag,
  Heart,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Send,
  Trash2,
  Trophy,
  UserRound,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { UserAvatar } from "@/components/social/user-avatar";
import { FollowButton } from "@/components/social/follow-button";
import { MediaCarousel } from "@/components/social/media-carousel";
import { RichText } from "@/components/social/rich-text";
import { ShareSheet } from "@/components/social/share-sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/time-ago";
import {
  deletePost,
  listLikers,
  reportContent,
  setLike,
  setSave,
  type FeedPost,
} from "@/lib/api/posts.functions";

export function PostCard({
  post,
  showAllComments = false,
}: {
  post: FeedPost;
  showAllComments?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-GB" : "el-GR";
  const likeFn = useServerFn(setLike);
  const saveFn = useServerFn(setSave);
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.like_count);
  const [saved, setSaved] = useState(post.saved);
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [likersOpen, setLikersOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  async function toggleLike(force?: boolean) {
    const on = force ?? !liked;
    if (on === liked) return;
    setLiked(on);
    setLikes((n) => n + (on ? 1 : -1));
    try {
      await likeFn({ data: { postId: post.id, on } });
    } catch {
      setLiked(!on);
      setLikes((n) => n + (on ? -1 : 1));
    }
  }

  async function toggleSave() {
    const on = !saved;
    setSaved(on);
    try {
      await saveFn({ data: { postId: post.id, on } });
      toast.success(on ? t("posts.saved") : t("posts.unsaved"));
    } catch {
      setSaved(!on);
    }
  }

  const caption = post.caption ?? "";
  const long = caption.length > 120;

  return (
    <article className="border-b border-border/60 pb-3 sm:rounded-2xl sm:border sm:bg-card sm:pb-4">
      <header className="flex items-center gap-3 px-3 py-2.5">
        <Link
          to="/u/$username"
          params={{ username: post.author.username }}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <UserAvatar
            name={post.author.full_name ?? post.author.username}
            photoUrl={post.author.photo_url}
            size={34}
          />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">{post.author.username}</span>
            {post.venue && (
              <span className="block truncate text-xs text-muted-foreground">
                {post.venue.name}
              </span>
            )}
          </span>
        </Link>
        <button
          type="button"
          aria-label={t("posts.more")}
          onClick={() => setMenuOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </header>

      {post.media.length ? (
        <MediaCarousel urls={post.media} onDoubleTap={() => toggleLike(true)} alt={caption} />
      ) : (
        <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-primary to-coral px-6 text-center text-primary-foreground">
          <div>
            <Trophy className="mx-auto h-12 w-12" />
            <p className="mt-3 font-display text-xl font-bold">{t("posts.matchPlayed")}</p>
            {post.venue && (
              <p className="mt-1 text-sm opacity-90">
                {t(`sports.${post.venue.sport}`)} · {post.venue.name}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 px-2 pt-2">
        <IconBtn label={liked ? t("posts.unlike") : t("posts.like")} onClick={() => toggleLike()}>
          <Heart
            className={cn("h-6 w-6 transition", liked && "scale-110 fill-primary text-primary")}
          />
        </IconBtn>
        <Link
          to="/p/$postId"
          params={{ postId: post.id }}
          aria-label={t("posts.comments")}
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
        >
          <MessageCircle className="h-6 w-6" />
        </Link>
        <IconBtn label={t("posts.share")} onClick={() => setShareOpen(true)}>
          <Send className="h-6 w-6" />
        </IconBtn>
        <span className="flex-1" />
        <IconBtn label={saved ? t("posts.unsave") : t("posts.save")} onClick={toggleSave}>
          <Bookmark className={cn("h-6 w-6", saved && "fill-foreground")} />
        </IconBtn>
      </div>

      <div className="space-y-1 px-3 text-sm">
        {likes > 0 && (
          <button type="button" onClick={() => setLikersOpen(true)} className="font-semibold">
            {t("posts.likes", { count: likes })}
          </button>
        )}
        {caption && (
          <p className="whitespace-pre-line">
            <Link
              to="/u/$username"
              params={{ username: post.author.username }}
              className="mr-1.5 font-semibold"
            >
              {post.author.username}
            </Link>
            <RichText text={long && !expanded ? `${caption.slice(0, 120)}…` : caption} />
            {long && !expanded && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="ml-1 text-muted-foreground"
              >
                {t("posts.more")}
              </button>
            )}
          </p>
        )}
        {!showAllComments && post.comment_count > 0 && (
          <Link
            to="/p/$postId"
            params={{ postId: post.id }}
            className="block text-muted-foreground"
          >
            {t("posts.viewComments", { count: post.comment_count })}
          </Link>
        )}
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {timeAgo(post.created_at, locale)}
        </p>
      </div>

      <PostMenu post={post} open={menuOpen} onOpenChange={setMenuOpen} />
      <LikersSheet postId={post.id} open={likersOpen} onOpenChange={setLikersOpen} />
      <ShareSheet postId={post.id} open={shareOpen} onOpenChange={setShareOpen} />
    </article>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-full transition active:scale-90 hover:bg-muted"
    >
      {children}
    </button>
  );
}

function PostMenu({
  post,
  open,
  onOpenChange,
}: {
  post: FeedPost;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const deleteFn = useServerFn(deletePost);
  const reportFn = useServerFn(reportContent);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const row = "flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium";

  async function remove() {
    try {
      await deleteFn({ data: { postId: post.id } });
      toast.success(t("posts.deleted"));
      onOpenChange(false);
      void qc.invalidateQueries({ queryKey: ["feed"] });
      void qc.invalidateQueries({ queryKey: ["profile-posts"] });
      void qc.invalidateQueries({ queryKey: ["social-profile"] });
      if (window.location.pathname.startsWith("/p/")) navigate({ to: "/profile" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function report() {
    await reportFn({ data: { targetType: "post", targetId: post.id } });
    toast.success(t("posts.reported"));
    onOpenChange(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/p/${post.id}`).catch(() => {});
    toast.success(t("posts.linkCopied"));
    onOpenChange(false);
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setConfirmDelete(false);
      }}
    >
      <DrawerContent className="mx-auto max-w-lg rounded-t-[28px] border-0 bg-background">
        <DrawerTitle className="sr-only">{t("posts.more")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("posts.more")}</DrawerDescription>
        <div className="safe-bottom p-4">
          <div className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/60">
            {post.isMine ? (
              confirmDelete ? (
                <button
                  type="button"
                  onClick={remove}
                  className={cn(row, "justify-center font-semibold text-destructive")}
                >
                  {t("posts.confirmDelete")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className={cn(row, "text-destructive")}
                >
                  <Trash2 className="h-4 w-4" /> {t("posts.delete")}
                </button>
              )
            ) : (
              <>
                <button type="button" onClick={report} className={cn(row, "text-destructive")}>
                  <Flag className="h-4 w-4" /> {t("posts.report")}
                </button>
                <Link
                  to="/u/$username"
                  params={{ username: post.author.username }}
                  onClick={() => onOpenChange(false)}
                  className={row}
                >
                  <UserRound className="h-4 w-4" /> {t("posts.aboutAccount")}
                </Link>
              </>
            )}
            <button type="button" onClick={copyLink} className={row}>
              <Link2 className="h-4 w-4" /> {t("posts.copyLink")}
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function LikersSheet({
  postId,
  open,
  onOpenChange,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const likersFn = useServerFn(listLikers);
  const q = useQuery({
    queryKey: ["likers", postId],
    enabled: open,
    queryFn: () => likersFn({ data: { postId } }),
  });
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto h-[70vh] max-w-lg rounded-t-[28px] border-0 bg-background">
        <DrawerTitle className="py-3 text-center font-display text-base font-bold">
          {t("posts.likesTitle")}
        </DrawerTitle>
        <DrawerDescription className="sr-only">{t("posts.likesTitle")}</DrawerDescription>
        <ul className="safe-bottom flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          {(q.data ?? []).map((p) => (
            <li key={p.user_id} className="flex items-center gap-3 py-2">
              <Link
                to="/u/$username"
                params={{ username: p.username }}
                onClick={() => onOpenChange(false)}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <UserAvatar name={p.full_name ?? p.username} photoUrl={p.photo_url} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.username}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.full_name}
                  </span>
                </span>
              </Link>
              {p.user_id !== user?.id && (
                <FollowButton userId={p.user_id} state={p.following} size="sm" />
              )}
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
