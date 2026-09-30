import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppHeader, HeaderPill } from "@/components/app-header";
import { EditProfileSheet } from "@/components/edit-profile-sheet";
import { ProfileView } from "@/components/people/profile-view";
import { SettingsSheet } from "@/components/settings-sheet";
import { useMyProfile } from "@/hooks/use-my-profile";

export const Route = createFileRoute("/_authenticated/profile")({
  component: MyProfilePage,
});

function MyProfilePage() {
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
            <Link to="/memories" aria-label={t("tabs.memories")} className="grid h-9 w-10 place-items-center rounded-full">
              <CalendarDays className="h-5 w-5" />
            </Link>
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
        <>
          <ProfileView
            person={p}
            isMe
            ownAction={
              <button type="button" onClick={() => setEditOpen(true)} className="h-10 rounded-full bg-secondary px-6 text-caption font-semibold">
                {t("profile.edit")}
              </button>
            }
          />
          <EditProfileSheet profile={p} open={editOpen} onOpenChange={setEditOpen} />
        </>
      )}
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
