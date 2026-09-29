import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const { t } = useTranslation();
  return <EmptyState icon={CalendarDays} text={t("shell.calendarEmpty")} />;
}
