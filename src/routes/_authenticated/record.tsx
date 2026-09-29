import { createFileRoute } from "@tanstack/react-router";
import { Mic } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/_authenticated/record")({
  component: RecordPage,
});

/** Daily voice post recorder (recording itself arrives in Phase 3). */
function RecordPage() {
  const { t } = useTranslation();
  return (
    <>
      <AppHeader back title={t("record.title")} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 py-24 text-center">
        <button
          type="button"
          disabled
          aria-label={t("tabs.record")}
          className="grid h-28 w-28 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg disabled:opacity-100"
        >
          <Mic className="h-12 w-12" />
        </button>
        <p className="text-base text-muted-foreground">{t("record.hint")}</p>
      </div>
    </>
  );
}
