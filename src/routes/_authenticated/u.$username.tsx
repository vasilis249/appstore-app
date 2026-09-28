import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ProfileView } from "@/components/social/profile-view";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — Courtsie` }] }),
  component: UserProfilePage,
});

function UserProfilePage() {
  const { t } = useTranslation();
  const { username } = Route.useParams();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <ProfileView
        key={username}
        username={username}
        ownActions={
          <Link
            to="/profile"
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-secondary text-sm font-semibold transition hover:bg-muted"
          >
            {t("social.editProfile")}
          </Link>
        }
      />
    </div>
  );
}
