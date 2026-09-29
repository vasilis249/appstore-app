import { createFileRoute } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const { t } = useTranslation();
  return (
    <>
      <AppHeader back title={t("tabs.messages")} />
      <EmptyState icon={Send} text={t("messages.empty")} />
    </>
  );
}
