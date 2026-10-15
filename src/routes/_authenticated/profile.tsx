import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Menu, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppHeader, HEADER_BTN, HEADER_ICON, HeaderPill } from "@/components/app-header";
import { EditProfileSheet } from "@/components/edit-profile-sheet";
import { ProfileView } from "@/components/people/profile-view";
import { SettingsSheet } from "@/components/settings-sheet";
import { useMyProfile } from "@/hooks/use-my-profile";
import { FEATURES } from "@/lib/features";

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
        left={
          <Link to="/record" aria-label={t("voice.navRecord")} className={HEADER_BTN}>
            <Plus className="h-[22px] w-[22px]" strokeWidth={1.9} />
          </Link>
        }
        title={p?.username ?? " "}
        right={
          FEATURES.memories ? (
            <HeaderPill>
              <Link to="/memories" aria-label={t("tabs.memories")} className={HEADER_ICON}>
                <CalendarDays className="h-[22px] w-[22px]" strokeWidth={1.9} />
              </Link>
              <button type="button" onClick={() => setSettingsOpen(true)} aria-label={t("settings.title")} className={HEADER_ICON}>
                <Menu className="h-[22px] w-[22px]" strokeWidth={1.9} />
              </button>
            </HeaderPill>
          ) : (
            <button type="button" onClick={() => setSettingsOpen(true)} aria-label={t("settings.title")} className={HEADER_BTN}>
              <Menu className="h-[22px] w-[22px]" strokeWidth={1.9} />
            </button>
          )
        }
      />
      {p && (
        <>
          <ProfileView person={p} isMe onEdit={() => setEditOpen(true)} />
          <EditProfileSheet profile={p} open={editOpen} onOpenChange={setEditOpen} />
        </>
      )}
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
