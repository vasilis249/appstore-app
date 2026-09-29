import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AppHeader, HomeHeaderActions } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { PostCard } from "@/components/daily/post-card";
import { dailyKeys, getFeed, getToday } from "@/lib/daily";

export const Route = createFileRoute("/_authenticated/")({
  component: FeedPage,
});

function RecordCta() {
  const { t } = useTranslation();
  return (
    <Link to="/record" className="inline-flex h-12 items-center rounded-2xl bg-primary px-8 font-semibold text-primary-foreground">
      {t("feed.recordCta")}
    </Link>
  );
}

/** Home: your post first, then friends' posts from the last 24 h (locked until you post). */
function FeedPage() {
  const { t } = useTranslation();
  const today = useQuery({ queryKey: dailyKeys.today, queryFn: getToday });
  // Posts older than 24 h drop out; a light refresh keeps the list honest.
  const feed = useQuery({ queryKey: dailyKeys.feed, queryFn: getFeed, refetchInterval: 5 * 60_000 });
  const posts = feed.data ?? [];
  const friendsPosts = posts.filter((p) => !p.is_mine);
  const unlocked = !!today.data?.unlocked;
  const ready = today.data && feed.data;

  return (
    <>
      <AppHeader right={<HomeHeaderActions />} />
      {ready && !posts.length && (
        <EmptyState title={t("feed.emptyTitle")} text={t("feed.emptyText")} action={<RecordCta />} />
      )}
      {ready && posts.length > 0 && (
        <div className="flex flex-col gap-3 px-4 pt-2">
          {!unlocked && (
            <section className="rounded-3xl bg-secondary p-5 text-center">
              <h2 className="text-lg font-bold">{t("daily.lockedTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("daily.lockedText")}</p>
              <div className="mt-4">
                <RecordCta />
              </div>
            </section>
          )}
          {posts.map((p) => (
            <PostCard key={p.post_id} post={p} />
          ))}
          {unlocked && !friendsPosts.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("daily.noFriendsYet")}</p>
          )}
        </div>
      )}
    </>
  );
}
