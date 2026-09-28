import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Compass, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { StoriesTray } from "@/components/social/stories-tray";
import { PostCard } from "@/components/social/post-card";
import { listFeed } from "@/lib/api/posts.functions";

/** Home for signed-in players: stories on top, then posts from people you follow. */
export function HomeFeed() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const feedFn = useServerFn(listFeed);
  const sentinel = useRef<HTMLDivElement>(null);

  const meQ = useQuery({
    queryKey: ["me-mini", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username,full_name,photo_url")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const feed = useInfiniteQuery({
    queryKey: ["feed"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => feedFn({ data: { before: pageParam } }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  // Load the next page when the bottom of the list comes into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage)
        void feed.fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [feed]);

  return (
    <div className="mx-auto max-w-xl pb-24 sm:pt-4">
      {meQ.data && <StoriesTray me={meQ.data} />}
      <div className="border-t border-border/60 sm:space-y-4 sm:border-0">
        {feed.isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : posts.length ? (
          posts.map((p) => <PostCard key={p.id} post={p} />)
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Compass className="h-12 w-12 text-primary" />
            <p className="font-display text-lg font-bold">{t("feed.emptyTitle")}</p>
            <p className="max-w-xs text-sm text-muted-foreground">{t("feed.emptyBody")}</p>
            <Link
              to="/explore"
              className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              {t("feed.explore")}
            </Link>
          </div>
        )}
      </div>
      <div ref={sentinel} className="h-10" />
      {feed.isFetchingNextPage && (
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
