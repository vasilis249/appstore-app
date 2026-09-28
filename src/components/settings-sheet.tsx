import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Ban, ChevronRight, FileText, HelpCircle, LogOut, Mail, Shield } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { LanguageToggle } from "@/components/language-toggle";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/social/user-avatar";
import { listBlockedUsers, unblockUser } from "@/lib/api/community.functions";

/** Everything that isn't the profile itself, in one place (opened from the ⚙︎ button). */
export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [blockedOpen, setBlockedOpen] = useState(false);

  async function signOut() {
    onOpenChange(false);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = [
    { to: "/help", icon: HelpCircle, label: t("footer.help") },
    { to: "/contact", icon: Mail, label: t("footer.contact") },
    { to: "/terms", icon: FileText, label: t("footer.terms") },
    { to: "/privacy", icon: Shield, label: t("footer.privacy") },
  ];
  const row = "flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm font-medium";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92vh] max-w-lg rounded-t-[28px] border-0 bg-background">
        <DrawerTitle className="pt-4 text-center font-display text-lg font-bold">
          {t("settings.title")}
        </DrawerTitle>
        <DrawerDescription className="sr-only">{t("settings.title")}</DrawerDescription>
        <div className="safe-bottom space-y-3 overflow-y-auto p-4">
          <div className="divide-y divide-border/70 rounded-2xl bg-card shadow-sm ring-1 ring-border/60">
            <div className={row}>
              <span>{t("nav.language")}</span>
              <LanguageToggle />
            </div>
            <label className={row}>
              <span>{t("settings.darkMode")}</span>
              <Switch checked={theme === "dark"} onCheckedChange={toggle} />
            </label>
          </div>

          <div className="rounded-2xl bg-card shadow-sm ring-1 ring-border/60">
            <button type="button" onClick={() => setBlockedOpen(true)} className={`${row} w-full`}>
              <span className="inline-flex items-center gap-3">
                <Ban className="h-4 w-4 text-muted-foreground" /> {t("settings.blocked")}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <ul className="divide-y divide-border/70 rounded-2xl bg-card shadow-sm ring-1 ring-border/60">
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

          <div className="rounded-2xl bg-card p-2 shadow-sm ring-1 ring-border/60">
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

function BlockedSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const listFn = useServerFn(listBlockedUsers);
  const unblockFn = useServerFn(unblockUser);
  const q = useQuery({ queryKey: ["blocked-users"], enabled: open, queryFn: () => listFn() });

  async function unblock(userId: string) {
    await unblockFn({ data: { userId } });
    void q.refetch();
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} nested>
      <DrawerContent className="mx-auto h-[70vh] max-w-lg rounded-t-[28px] border-0 bg-background">
        <DrawerTitle className="pt-4 text-center font-display text-base font-bold">
          {t("settings.blocked")}
        </DrawerTitle>
        <DrawerDescription className="sr-only">{t("settings.blocked")}</DrawerDescription>
        <ul className="safe-bottom flex-1 overflow-y-auto px-4 py-3">
          {q.data && !q.data.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("settings.noBlocked")}
            </p>
          )}
          {(q.data ?? []).map((b) => (
            <li key={b.user_id} className="flex items-center gap-3 py-2">
              <UserAvatar name={b.full_name ?? "?"} photoUrl={b.photo_url} size={40} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{b.full_name}</span>
              <button
                type="button"
                onClick={() => unblock(b.user_id)}
                className="h-8 rounded-xl bg-secondary px-3 text-xs font-semibold"
              >
                {t("settings.unblock")}
              </button>
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
