import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppHeader, HeaderPill } from "@/components/app-header";
import { EditProfileSheet } from "@/components/edit-profile-sheet";
import { SettingsSheet } from "@/components/settings-sheet";
import { UserAvatar } from "@/components/user-avatar";
import { useMyProfile } from "@/hooks/use-my-profile";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useTranslation();
  const me = useMyProfile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const p = me.data;

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
      {p && (
        <div className="flex flex-col items-center px-4 pt-8 text-center">
          <UserAvatar name={p.full_name || p.username} path={p.avatar_path} size={112} />
          <h2 className="mt-4 text-2xl font-bold">{p.full_name || p.username}</h2>
          <p className="mt-0.5 text-base text-muted-foreground">{p.username}</p>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="mt-5 h-10 rounded-full bg-secondary px-6 text-sm font-semibold"
          >
            {t("profile.edit")}
          </button>
          <EditProfileSheet profile={p} open={editOpen} onOpenChange={setEditOpen} />
        </div>
      )}
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
