import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  MapPin,
  CalendarRange,
  Settings,
  Tag,
  BarChart3,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = roles?.some((r) => r.role === "owner" || r.role === "admin");
    if (!allowed) throw redirect({ to: "/" });
    return { userId: userData.user.id };
  },
  component: OwnerLayout,
});

function OwnerLayout() {
  const { t } = useTranslation();
  const items = [
    { to: "/owner", label: t("nav.ownerPanel.overview"), icon: LayoutDashboard, exact: true },
    { to: "/owner/venues", label: t("nav.ownerPanel.myVenues"), icon: MapPin },
    { to: "/owner/pricing", label: t("nav.ownerPanel.pricing"), icon: Tag },
    { to: "/owner/hours", label: t("nav.ownerPanel.hours"), icon: Clock },
    { to: "/owner/reports", label: t("nav.ownerPanel.reports"), icon: BarChart3 },
    { to: "/owner/bookings", label: t("nav.ownerPanel.bookings"), icon: CalendarRange },
    { to: "/owner/settings", label: t("nav.ownerPanel.settings"), icon: Settings },
  ];
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8">
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-20 md:self-start">
          <div className="rounded-2xl border border-border/60 bg-surface p-3">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-primary/80">
              {t("nav.ownerPanel.panelTitle")}
            </p>
            <nav className="flex flex-col gap-1">
              {items.map((i) => (
                <Link
                  key={i.to}
                  to={i.to}
                  activeOptions={{ exact: i.exact }}
                  activeProps={{
                    className:
                      "bg-petrol/10 text-petrol font-semibold border-l-4 border-coral pl-2 dark:bg-primary/20 dark:text-primary dark:border-coral",
                  }}
                  inactiveProps={{
                    className:
                      "border-l-4 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40 dark:text-primary dark:hover:text-primary dark:hover:bg-primary/10",
                  }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition"
                >
                  <i.icon className="h-4 w-4" />
                  {i.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
      <div className="h-16" />
    </div>
  );
}
