import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppHeader, HomeHeaderActions } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/")({
  component: FeedPage,
});

function FeedPage() {
  const { t } = useTranslation();
  return (
    <>
      <AppHeader right={<HomeHeaderActions />} />
      <EmptyState
        title={t("feed.emptyTitle")}
        text={t("feed.emptyText")}
        action={
          <Link to="/record" className="inline-flex h-12 items-center rounded-2xl bg-primary px-8 font-semibold text-primary-foreground">
            {t("feed.recordCta")}
          </Link>
        }
      />
    </>
  );
}
