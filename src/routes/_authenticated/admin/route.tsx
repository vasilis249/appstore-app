import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building2, Users, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data, error } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (error || !data) throw redirect({ to: "/" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { t } = useTranslation();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const TABS = [
    { to: "/admin", label: t("admin.tabStats"), icon: LayoutDashboard },
    { to: "/admin/venues", label: t("admin.tabVenues"), icon: Building2 },
    { to: "/admin/users", label: t("admin.tabUsers"), icon: Users },
    { to: "/admin/reports", label: t("admin.tabReports"), icon: ShieldAlert },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-24">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">{t("admin.panelTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.panelSubtitle")}</p>
      </div>
      <nav className="mb-6 flex gap-2 border-b border-border/60">
        {TABS.map((tab) => {
          const active = path === tab.to;
          const Icon = tab.icon;
          return (
            <Link key={tab.to} to={tab.to} className={cn("inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <Icon className="h-4 w-4" /> {tab.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
