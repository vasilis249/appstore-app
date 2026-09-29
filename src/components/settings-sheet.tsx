import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight, FileText, LogOut, Mail, Shield } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { LanguageToggle } from "@/components/language-toggle";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { supabase } from "@/integrations/supabase/client";

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
          <div className="rounded-2xl bg-secondary">
            <div className={row}>
              <span>{t("nav.language")}</span>
              <LanguageToggle />
            </div>
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
      </DrawerContent>
    </Drawer>
  );
}
