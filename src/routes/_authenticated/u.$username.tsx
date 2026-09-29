import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MoreHorizontal } from "lucide-react";
import { AppHeader, HeaderPill } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { PersonActionsSheet } from "@/components/friends/person-actions-sheet";
import { ProfileView } from "@/components/people/profile-view";
import { useAuth } from "@/hooks/use-auth";
import { friendKeys, profileByUsername } from "@/lib/friends";

export const Route = createFileRoute("/_authenticated/u/$username")({
  component: UserPage,
});

/** Someone's public profile. Your own username redirects to /profile. */
function UserPage() {
  const { username } = Route.useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [menu, setMenu] = useState(false);
  const q = useQuery({ queryKey: friendKeys.byUsername(username), queryFn: () => profileByUsername(username) });
  const p = q.data;
  if (p && p.id === user?.id) return <Navigate to="/profile" replace />;

  return (
    <>
      <AppHeader
        back
        title={`@${username}`}
        right={
          p && (
            <HeaderPill>
              <button type="button" onClick={() => setMenu(true)} aria-label={t("friends.actions")} className="grid h-9 w-10 place-items-center rounded-full">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </HeaderPill>
          )
        }
      />
      {q.data === null && <EmptyState text={t("rpcErrors.notFound")} />}
      {p && (
        <>
          <ProfileView person={p} isMe={false} />
          <PersonActionsSheet person={menu ? p : null} onOpenChange={setMenu} />
        </>
      )}
    </>
  );
}
