import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/owner/settings")({
  head: () => ({ meta: [{ title: "Ρυθμίσεις — Courtsie" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="text-3xl font-bold">{t("ownerSettings.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("ownerSettings.subtitle")}</p>
    </div>
  );
}
