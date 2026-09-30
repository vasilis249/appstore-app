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
  const row = "flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 text-body";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92vh] max-w-lg">
        <DrawerTitle className="pt-4 text-center font-display text-body font-semibold">
          {t("settings.title")}
        </DrawerTitle>
        <DrawerDescription className="sr-only">{t("settings.title")}</DrawerDescription>
        <div className="safe-bottom space-y-3 overflow-y-auto p-4">
          <div className="divide-y divide-border rounded-2xl bg-group">
            <div className={row}>
              <span>{t("nav.language")}</span>
              <LanguageToggle />
            </div>
            <DailyPromptSwitch className={row} />
          </div>

          {isStaff && (
            <div className="divide-y divide-border rounded-2xl bg-group">
              <Link to="/admin/reports" onClick={() => onOpenChange(false)} className={row}>
                <span className="inline-flex items-center gap-3">
                  <Flag className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} /> {t("adminReports.title")}
                </span>
                <span className="inline-flex items-center gap-2">
                  {!!openReports.data && (
                    <span className="min-w-5 rounded-full bg-badge px-1.5 text-center text-fine font-semibold leading-5 text-destructive-foreground">
                      {openReports.data}
                    </span>
                  )}
                  <ChevronRight className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
                </span>
              </Link>
              {isAdmin.data && (
                <Link to="/admin/topics" onClick={() => onOpenChange(false)} className={row}>
                  <span className="inline-flex items-center gap-3">
                    <Megaphone className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} /> {t("admin.title")}
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
                </Link>
              )}
            </div>
          )}

          <div className="divide-y divide-border rounded-2xl bg-group">
            <Link to="/student" onClick={() => onOpenChange(false)} className={row}>
              <span className="inline-flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} /> {t("student.settingsRow")}
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
            </Link>
            <Link to="/location" onClick={() => onOpenChange(false)} className={row}>
              <span className="inline-flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} /> {t("location.settingsRow")}
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
            </Link>
            <button type="button" onClick={() => setBlockedOpen(true)} className={`${row} w-full`}>
              <span className="inline-flex items-center gap-3">
                <Ban className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} /> {t("settings.blocked")}
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
            </button>
          </div>

          <ul className="divide-y divide-border rounded-2xl bg-group">
            {links.map(({ to, icon: Icon, label }) => (
              <li key={to}>
                <Link to={to} onClick={() => onOpenChange(false)} className={row}>
                  <span className="inline-flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} /> {label}
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
                </Link>
              </li>
            ))}
          </ul>

          <div className="divide-y divide-border overflow-hidden rounded-2xl bg-group">
            <button
              type="button"
              onClick={signOut}
              className="flex min-h-11 w-full items-center justify-center gap-2 py-2.5 text-body text-link"
            >
              <LogOut className="h-5 w-5" strokeWidth={1.8} /> {t("profile.signOut")}
            </button>
            <DeleteAccountButton />
          </div>
        </div>
        <BlockedSheet open={blockedOpen} onOpenChange={setBlockedOpen} />
      </DrawerContent>
    </Drawer>
  );
}
