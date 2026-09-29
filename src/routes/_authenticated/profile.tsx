import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader, HeaderPill } from "@/components/app-header";
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
    <>
      <AppHeader
        title={t("tabs.profile")}
        right={
          <HeaderPill>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={t("settings.title")}
              className="grid h-9 w-10 place-items-center rounded-full"
            >
              <Settings className="h-5 w-5" />
            </button>
          </HeaderPill>
        }
      />
      <div className="flex flex-col items-center px-4 pt-8 text-center">
        <span className="grid h-28 w-28 place-items-center rounded-full bg-secondary text-4xl font-bold">
          {name.charAt(0).toUpperCase()}
        </span>
        <h2 className="mt-4 text-2xl font-bold">{name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("profile.voiceSoon")}</p>
      </div>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
