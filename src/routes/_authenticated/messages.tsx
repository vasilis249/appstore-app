import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const { t } = useTranslation();
  return <EmptyState icon={MessageCircle} text={t("shell.messagesEmpty")} />;
}
