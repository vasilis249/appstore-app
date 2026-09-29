import { createFileRoute } from "@tanstack/react-router";
import { Headphones } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/")({
  component: FeedPage,
});

function FeedPage() {
  const { t } = useTranslation();
  return <EmptyState icon={Headphones} text={t("shell.feedEmpty")} />;
}
