import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, AudioLines } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";

type View = "list" | "calendar";

export const Route = createFileRoute("/_authenticated/memories")({
  validateSearch: (s: Record<string, unknown>): { view?: View } =>
    s.view === "calendar" ? { view: "calendar" } : {},
  component: MemoriesPage,
});

function MemoriesPage() {
  const { t } = useTranslation();
  const { view = "list" } = Route.useSearch();
  const seg = "rounded-full px-5 py-2 text-sm font-semibold transition-colors";
  return (
    <>
      <AppHeader
        center={
          <div className="flex rounded-full bg-secondary p-1">
            <Link to="/memories" search={{}} className={`${seg} ${view === "list" ? "bg-[#3a3a3c]" : "text-foreground/80"}`}>
              {t("memories.list")}
            </Link>
            <Link
              to="/memories"
              search={{ view: "calendar" }}
              className={`${seg} ${view === "calendar" ? "bg-[#3a3a3c]" : "text-foreground/80"}`}
            >
              {t("memories.calendar")}
            </Link>
          </div>
        }
      />
      <EmptyState icon={view === "calendar" ? CalendarDays : AudioLines} text={t("memories.empty")} />
    </>
  );
}
