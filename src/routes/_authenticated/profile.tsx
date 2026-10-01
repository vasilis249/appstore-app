import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Menu, Plus } from "lucide-react";
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
        left={
          <Link to="/record" aria-label={t("voice.navRecord")} className="grid h-11 w-11 place-items-center rounded-full">
            <Plus className="h-[30px] w-[30px]" strokeWidth={1.7} />
          </Link>
        }
        center={<h1 className="max-w-[55vw] truncate text-[20px] font-extrabold tracking-[-0.02em]">{p?.username ?? ""}</h1>}
        right={
          <HeaderPill>
            <Link to="/memories" aria-label={t("tabs.memories")} className="grid h-11 w-11 place-items-center rounded-full">
              <CalendarDays className="h-[25px] w-[25px]" strokeWidth={1.9} />
            </Link>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={t("settings.title")}
              className="grid h-11 w-11 place-items-center rounded-full"
            >
              <Menu className="h-[27px] w-[27px]" strokeWidth={1.9} />
            </button>
          </HeaderPill>
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
