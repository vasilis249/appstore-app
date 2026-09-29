import { createFileRoute } from "@tanstack/react-router";
import { Search, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/friends")({
  component: FriendsPage,
});

function FriendsPage() {
  const { t } = useTranslation();
  return (
    <>
      <AppHeader />
      <div className="px-4 pt-2">
        <label className="flex h-12 items-center gap-2 rounded-2xl bg-secondary px-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            placeholder={t("friends.searchPlaceholder")}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </label>
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("friends.myFriends")}
        </h2>
      </div>
      <EmptyState icon={Users} text={t("friends.empty")} />
    </>
  );
}
