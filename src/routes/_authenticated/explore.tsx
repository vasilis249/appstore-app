import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Copy, Search, Trophy, X } from "lucide-react";
import { UserAvatar } from "@/components/social/user-avatar";
import { FollowButton } from "@/components/social/follow-button";
import { listExplore } from "@/lib/api/posts.functions";
import {
  getCommunityStatus,
  searchPlayers,
  setDiscoverable,
  suggestedPlayers,
} from "@/lib/api/community.functions";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({ meta: [{ title: "Εξερεύνηση — Courtsie" }] }),
  component: ExplorePage,
});

function ExplorePage() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const exploreFn = useServerFn(listExplore);
  const searchFn = useServerFn(searchPlayers);
  const suggestedFn = useServerFn(suggestedPlayers);
  const statusFn = useServerFn(getCommunityStatus);
  const discoverFn = useServerFn(setDiscoverable);
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["community-status"], queryFn: () => statusFn() });

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const searching = debounced.length >= 2;
  const people = useQuery({
    queryKey: ["explore-people", debounced],
    enabled: searching,
    queryFn: () => searchFn({ data: { q: debounced } }),
  });
  const grid = useQuery({ queryKey: ["explore"], queryFn: () => exploreFn({ data: {} }) });
  const suggested = useQuery({
    queryKey: ["explore-suggested"],
    staleTime: 60_000,
    queryFn: () => suggestedFn(),
  });

  return (
    <div className="mx-auto max-w-xl pb-24 pt-3">
      <div className="px-3 pb-3">
        <label className="flex h-11 items-center gap-2 rounded-2xl bg-secondary px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("explore.searchPh")}
            autoCapitalize="none"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button
              type="button"
              aria-label={t("common.clear", "Καθαρισμός")}
              onClick={() => setQ("")}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </label>
      </div>

      {status.data && !status.data.discoverable && !searching && (
        <div className="mx-3 mb-3 flex items-center gap-3 rounded-2xl bg-primary/10 px-3 py-2.5 text-sm">
          <span className="flex-1">{t("explore.discoverPrompt")}</span>
          <button
            type="button"
            onClick={async () => {
              await discoverFn({ data: { discoverable: true } });
              void qc.invalidateQueries({ queryKey: ["community-status"] });
            }}
            className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            {t("explore.discoverOn")}
          </button>
        </div>
      )}

      {searching ? (
        <ul className="px-3">
          {people.isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {!people.isLoading && !people.data?.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("explore.noPeople")}
            </p>
          )}
          {(people.data ?? []).map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <Link
                to="/u/$username"
                params={{ username: p.username }}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <UserAvatar name={p.full_name ?? p.username} photoUrl={p.photo_url} size={44} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.username}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.full_name}
                  </span>
                </span>
              </Link>
              <FollowButton userId={p.id} state={p.follow_status} size="sm" />
            </li>
          ))}
        </ul>
      ) : (
        <>
          {!!suggested.data?.length && (
            <section className="pb-3">
              <h2 className="px-3 pb-2 text-sm font-semibold">{t("explore.suggested")}</h2>
              <div className="flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {suggested.data.map((p) => (
                  <div
                    key={p.id}
                    className="flex w-32 shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-border/70 p-3"
                  >
                    <Link
                      to="/u/$username"
                      params={{ username: p.username }}
                      className="flex w-full flex-col items-center gap-1"
                    >
                      <UserAvatar
                        name={p.full_name ?? p.username}
                        photoUrl={p.photo_url}
                        size={56}
                      />
                      <span className="w-full truncate text-center text-xs font-semibold">
                        {p.username}
                      </span>
                      <span className="w-full truncate text-center text-[11px] text-muted-foreground">
                        {p.full_name}
                      </span>
                    </Link>
                    <FollowButton
                      userId={p.id}
                      state={p.follow_status}
                      size="sm"
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
          {grid.isLoading ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : !grid.data?.posts.length ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{t("explore.empty")}</p>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {grid.data.posts.map((p) => (
                <Link
                  key={p.id}
                  to="/p/$postId"
                  params={{ postId: p.id }}
                  className="relative aspect-square overflow-hidden bg-muted"
                >
                  {p.thumb ? (
                    <img
                      src={p.thumb}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center bg-gradient-to-br from-primary to-coral text-primary-foreground">
                      <Trophy className="h-7 w-7" />
                    </span>
                  )}
                  {p.mediaCount > 1 && (
                    <Copy className="absolute right-1.5 top-1.5 h-4 w-4 text-white drop-shadow" />
                  )}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
