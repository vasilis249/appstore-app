import { Link } from "@tanstack/react-router";
import { Home, MapPin, Users, CalendarCheck, User, LayoutDashboard, Tag, Clock, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";

export function BottomNav() {
  const { user, role, actualRole } = useAuth();
  const { t } = useTranslation();
  const r = role as string | null;
  const isAdmin = actualRole === "admin";
  const isPureOwner = r === "owner";
  const isOwnerOrAdmin = r === "owner" || isAdmin;

  const items = isPureOwner
    ? [
        { to: "/owner", label: t("nav.ownerPanel.dashboard"), icon: LayoutDashboard, exact: true },
        { to: "/owner/venues", label: t("nav.ownerPanel.myVenues"), icon: MapPin },
        { to: "/owner/bookings", label: t("nav.ownerPanel.bookings"), icon: CalendarCheck },
        { to: "/owner/pricing", label: t("nav.ownerPanel.pricing"), icon: Tag },
        { to: "/owner/hours", label: t("nav.ownerPanel.hours"), icon: Clock },
      ]
    : [
        { to: "/", label: t("bottomNav.home"), icon: Home, exact: true },
        { to: "/venues", label: t("bottomNav.venues"), icon: MapPin },
        { to: "/open-games", label: t("bottomNav.games"), icon: Users },
        { to: "/community", label: t("bottomNav.community"), icon: UsersRound },
        isOwnerOrAdmin
          ? { to: "/owner", label: t("bottomNav.owner"), icon: LayoutDashboard }
          : { to: "/bookings", label: t("bottomNav.bookings"), icon: CalendarCheck },
        { to: user ? "/profile" : "/auth", label: user ? t("bottomNav.profile") : t("bottomNav.signIn"), icon: User },
      ];

  return (
    <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {items.map(({ to, label, icon: Icon, ...rest }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="flex flex-col items-center gap-1 py-3 text-[11px] text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
              activeOptions={{ exact: "exact" in rest ? rest.exact : false }}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
