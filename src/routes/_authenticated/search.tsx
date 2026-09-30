import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Search, Share, X } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { FollowButton } from "@/components/friends/follow-button";
import { PersonRow } from "@/components/friends/person-row";
import { useMyProfile } from "@/hooks/use-my-profile";
import { friendKeys, searchUsers, suggestedPeople, type Person } from "@/lib/friends";
import { useCampus } from "@/lib/campus";
import { InviteShare } from "@/components/invite-share";
import { useDebounced } from "@/hooks/use-debounced";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
});

/** Find people by name or username; suggestions when the box is empty. */
function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 300);
  const searching = q.length >= 2;
  const results = useQuery({ queryKey: friendKeys.search(q), queryFn: () => searchUsers(q), enabled: searching });
  const suggested = useQuery({ queryKey: friendKeys.suggested, queryFn: () => suggestedPeople(15), enabled: !searching });
  const campus = useCampus();
  // "Συμφοιτητής · ΕΜΠ · ΗΜΜΥ" under suggested classmates.
  const whoIs = (p: Person) =>
    [p.reason === "classmate" ? t("people.reason.classmate") : p.reason === "school" ? t("people.reason.school") : null, campus.label(p)]
      .filter(Boolean)
      .join(" · ") || undefined;
  const people = searching ? results.data : suggested.data;
  const open = (username: string) => void navigate({ to: "/u/$username", params: { username } });

  return (
    <>
      <AppHeader />
      <div className="px-4 pt-2">
        <label className="flex h-12 items-center gap-2 rounded-2xl bg-secondary px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("people.searchPlaceholder")}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-transparent text-body outline-none placeholder:text-muted-foreground focus-visible:shadow-none"
          />
          {query && (
            <button type="button" aria-label={t("common.clear")} onClick={() => setQuery("")} className="text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
          )}
        </label>
        {!searching && (
          <h2 className="mb-1 mt-6 text-callout font-semibold text-muted-foreground">{t("people.suggested")}</h2>
        )}
        <ul className={searching ? "mt-3" : undefined}>
          {(people ?? []).map((p) => (
            <PersonRow key={p.id} person={p} subtitle={whoIs(p)} onOpen={() => open(p.username)}>
              <FollowButton userId={p.id} following={!!p.i_follow} followsMe={p.follows_me} />
            </PersonRow>
          ))}
        </ul>
        {people && !people.length && (
          <p className="py-12 text-center text-caption text-muted-foreground">{searching ? t("friends.noResults") : t("people.nobodyYet")}</p>
        )}
        {!searching && <InviteShare className="mt-8" />}
        {!searching && <ShareUsername />}
      </div>
    </>
  );
}

/** Tell people your username (native share sheet, clipboard as fallback). */
function ShareUsername() {
  const { t } = useTranslation();
  const me = useMyProfile();
  if (!me.data) return null;
  const username = me.data.username;
  async function share() {
    const text = t("friends.shareText", { username });
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(username);
        toast.success(t("friends.copied"));
      }
    } catch {
      /* cancelled */
    }
  }
  return (
    <button type="button" onClick={share} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-fine text-muted-foreground">{t("friends.yourUsername")}</span>
        <span className="block truncate font-semibold">@{username}</span>
      </span>
      <Share className="h-5 w-5 shrink-0" />
    </button>
  );
}
