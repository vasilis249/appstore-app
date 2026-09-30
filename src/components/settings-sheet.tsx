import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Ban, ChevronRight, FileText, Flag, GraduationCap, LogOut, Mail, MapPin, Megaphone, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminKeys, myStaffRole, openReportsCount, reportKeys } from "@/lib/admin";
import { useState } from "react";
import { BlockedSheet } from "@/components/blocked-sheet";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { LanguageToggle } from "@/components/language-toggle";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { supabase } from "@/integrations/supabase/client";
import { DailyPromptSwitch } from "@/components/daily-prompt-switch";

/** Everything that isn't the profile itself, in one place (opened from the ⚙︎ button). */
export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const staff = useQuery({ queryKey: adminKeys.staff, queryFn: myStaffRole, enabled: open });
  // Admins get Reports + Manage topics; campus moderators get Reports (their campus).
  const isAdmin = { data: staff.data?.is_admin };
  const isStaff = !!staff.data && (staff.data.is_admin || !!staff.data.moderates);
  const openReports = useQuery({ queryKey: reportKeys.openCount, queryFn: openReportsCount, enabled: open && isStaff });

  async function signOut() {
    onOpenChange(false);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = [
    { to: "/contact", icon: Mail, label: t("footer.contact") },
    { to: "/terms", icon: FileText, label: t("footer.terms") },
    { to: "/privacy", icon: Shield, label: t("footer.privacy") },
  ];
  const row = "flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm font-medium";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92vh] max-w-lg rounded-t-[28px] border-0 bg-surface-elevated">
        <DrawerTitle className="pt-4 text-center font-display text-lg font-bold">
          {t("settings.title")}
        </DrawerTitle>
        <DrawerDescription className="sr-only">{t("settings.title")}</DrawerDescription>
        <div className="safe-bottom space-y-3 overflow-y-auto p-4">
          <div className="divide-y divide-border rounded-2xl bg-secondary">
            <div className={row}>
              <span>{t("nav.language")}</span>
              <LanguageToggle />
            </div>
            <DailyPromptSwitch className={row} />
          </div>

          {isStaff && (
            <div className="divide-y divide-border rounded-2xl bg-secondary">
              <Link to="/admin/reports" onClick={() => onOpenChange(false)} className={row}>
                <span className="inline-flex items-center gap-3">
                  <Flag className="h-4 w-4 text-muted-foreground" /> {t("adminReports.title")}
                </span>
                <span className="inline-flex items-center gap-2">
                  {!!openReports.data && (
                    <span className="min-w-5 rounded-full bg-badge px-1.5 text-center text-xs font-semibold leading-5 text-white">
                      {openReports.data}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </span>
              </Link>
              {isAdmin.data && (
                <Link to="/admin/topics" onClick={() => onOpenChange(false)} className={row}>
                  <span className="inline-flex items-center gap-3">
                    <Megaphone className="h-4 w-4 text-muted-foreground" /> {t("admin.title")}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              )}
            </div>
          )}

          <div className="divide-y divide-border rounded-2xl bg-secondary">
            <Link to="/student" onClick={() => onOpenChange(false)} className={row}>
              <span className="inline-flex items-center gap-3">
                <GraduationCap className="h-4 w-4 text-muted-foreground" /> {t("student.settingsRow")}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link to="/location" onClick={() => onOpenChange(false)} className={row}>
              <span className="inline-flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" /> {t("location.settingsRow")}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <button type="button" onClick={() => setBlockedOpen(true)} className={`${row} w-full`}>
              <span className="inline-flex items-center gap-3">
                <Ban className="h-4 w-4 text-muted-foreground" /> {t("settings.blocked")}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <ul className="divide-y divide-border rounded-2xl bg-secondary">
            {links.map(({ to, icon: Icon, label }) => (
              <li key={to}>
                <Link to={to} onClick={() => onOpenChange(false)} className={row}>
                  <span className="inline-flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" /> {label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="rounded-2xl bg-secondary p-2">
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
            >
              <LogOut className="h-4 w-4" /> {t("profile.signOut")}
            </button>
            <DeleteAccountButton />
          </div>
        </div>
        <BlockedSheet open={blockedOpen} onOpenChange={setBlockedOpen} />
      </DrawerContent>
    </Drawer>
  );
}
