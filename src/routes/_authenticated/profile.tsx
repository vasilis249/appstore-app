import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Settings, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState } from "@/components/empty-state";
import { SettingsSheet } from "@/components/settings-sheet";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const name = (user?.user_metadata?.full_name as string | undefined) || user?.email || "";

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-3">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
          {name.charAt(0).toUpperCase()}
        </span>
        <h1 className="min-w-0 flex-1 truncate font-display text-xl font-bold">{name}</h1>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label={t("settings.title")}
          className="grid h-10 w-10 place-items-center rounded-xl text-foreground transition hover:bg-muted"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
      <EmptyState icon={Users} text={t("shell.profileEmpty")} />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
