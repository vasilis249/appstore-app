import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t } = useTranslation();
  return (
    <>
      <AppHeader back title={t("tabs.notifications")} />
      <EmptyState icon={Bell} text={t("notificationsPage.empty")} />
    </>
  );
}
